import { efeitosDoEnvioAceito } from "../conversa";
import { db } from "../db";
import { registrarEvento } from "../entrada";
import { enviar, type EnvioWa } from "./ycloud";

// Envio de uma mensagem de WhatsApp já gravada em crm_mensagens (estado "enviando"). O id da nossa mensagem vai junto
// como identificador externo: é por ele que as notificações do provedor encontram a linha, inclusive quando a
// resposta do envio se perde.
//
// Resultados:
// - aceita         → o provedor aceitou; a entrega e a leitura chegam depois, por notificação.
// - recusada       → o provedor respondeu que não vai enviar (janela fechada, modelo indisponível, número inválido...).
// - tentar_depois  → o provedor recusou por limite de requisições: nada saiu, pode repetir.
// - incerta        → sem resposta (timeout, queda, erro 5xx): NÃO se sabe se saiu. Fica marcada assim até uma
//                    notificação do provedor, o eco do aplicativo ou uma pessoa resolver. Nunca é reenviada sozinha.

export type ResultadoEnvioWa = "aceita" | "recusada" | "tentar_depois" | "incerta";

export async function enviarWhatsapp(mensagemId: string, e: EnvioWa): Promise<ResultadoEnvioWa> {
  const r = await enviar(e, mensagemId);
  const sql = await db();
  const agora = new Date().toISOString();
  if (r.resultado === "aceita") {
    await sql.begin(async (tx) => {
      // Uma notificação do provedor pode ter chegado antes desta resposta e já ter avançado o estado: só avança.
      const [m] = await tx<{ antes: string }[]>`
        update crm_mensagens m set
          status = case when m.status in ('pendente', 'enviando', 'incerta', 'falhou') then ${r.status} else m.status end,
          provedor = 'ycloud', provedor_id = coalesce(m.provedor_id, ${r.provedorId}), wamid = coalesce(m.wamid, ${r.wamid}),
          enviado_em = coalesce(m.enviado_em, ${agora}), ocorrida_em = coalesce(m.ocorrida_em, ${agora}), erro = null
        from (select id, status as antes from crm_mensagens where id = ${mensagemId} for update) a
        where m.id = a.id returning a.antes`;
      if (m && ["pendente", "enviando", "incerta", "falhou"].includes(m.antes)) await efeitosDoEnvioAceito(tx, mensagemId, agora);
    });
    return "aceita";
  }
  if (r.resultado === "incerta") {
    await sql`update crm_mensagens set status = 'incerta', erro = ${r.erro.slice(0, 300)} where id = ${mensagemId} and status in ('pendente', 'enviando')`;
    console.error(`[crm] WhatsApp ${mensagemId}: resultado incerto (${r.erro})`);
    return "incerta";
  }
  await sql.begin(async (tx) => {
    const [m] = await tx<{ oportunidade_id: string | null; automatica: boolean }[]>`
      update crm_mensagens set status = 'falhou', erro = ${r.erro.slice(0, 300)} where id = ${mensagemId} and status in ('pendente', 'enviando', 'incerta')
      returning oportunidade_id, automatica`;
    // A falha do primeiro contato automático entra no histórico pela tarefa (tarefas.ts); aqui, a do envio humano.
    if (m?.oportunidade_id && !m.automatica && !r.tentarDepois) {
      await registrarEvento(tx, { oportunidadeId: m.oportunidade_id, tipo: "mensagem_falhou", texto: `A mensagem de WhatsApp não foi enviada: ${r.erro}`.slice(0, 300) });
    }
  });
  console.error(`[crm] WhatsApp ${mensagemId}: recusada (${r.erro})`);
  return r.tentarDepois ? "tentar_depois" : "recusada";
}
