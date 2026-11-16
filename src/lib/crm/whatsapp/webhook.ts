import { aplicarStatus, registrarEco, registrarEntrada } from "../conversa";
import { crmConfigured, db } from "../db";
import { listarModelos, traduzir, type EventoYCloud } from "./ycloud";

// Recebimento das notificações da YCloud.
//
// 1. A assinatura é conferida na rota (corpo cru) antes de qualquer coisa.
// 2. O evento é gravado como chegou (crm_webhook_eventos), com o id do evento como chave: uma repetição não entra
//    duas vezes. A YCloud mantém o id do evento nas novas tentativas.
// 3. O processamento vem depois de gravado. Se falhar, o evento continua gravado e sem "processado_em"; a rotina
//    o processa de novo. Cada efeito é idempotente pelos identificadores da MENSAGEM (não só do evento), porque a
//    YCloud avisa que a mesma interação pode gerar outro id de evento.
// 4. A ordem de chegada não importa: de quem é a vez é decidido pela hora real das mensagens (../conversa.ts).

const MAX_TENTATIVAS = 6;

async function processar(ev: EventoYCloud): Promise<string> {
  const t = traduzir(ev);
  switch (t.classe) {
    case "entrada": {
      const r = await registrarEntrada(t.entrada);
      return r.resultado === "gravada" ? `mensagem recebida${r.oportunidadeId ? "" : " (sem oportunidade)"}${r.pediuParar ? " · pediu para parar" : ""}` : `entrada ${r.resultado}`;
    }
    case "eco": {
      const r = await registrarEco(t.eco);
      return `eco: ${r.resultado}`;
    }
    case "status": {
      const r = await aplicarStatus(t.status);
      return `estado ${t.status.status}: ${r.resultado}`;
    }
    case "modelo": {
      const r = await listarModelos(true);
      return r.ok ? "modelos atualizados" : `modelos não atualizados (${r.erro})`;
    }
    case "numero":
    case "conta": {
      // Último aviso sobre o número ou a conta (qualidade, desconexão, remoção): aparece em Integrações.
      const sql = await db();
      await sql`
        insert into crm_config (chave, valor) values (${`whatsapp:evento-${t.classe}`}, ${sql.json(t.evento as never)})
        on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`;
      return `${t.classe} atualizado`;
    }
    default:
      return `ignorado: ${t.motivo}`;
  }
}

/** Grava e processa uma notificação já autenticada. Devolve o que aconteceu (para o log). Nunca lança erro. */
export async function receberEvento(ev: EventoYCloud): Promise<{ gravado: boolean; resultado: string }> {
  if (!ev || typeof ev.id !== "string" || !ev.id || typeof ev.type !== "string") return { gravado: false, resultado: "evento sem id ou tipo" };
  if (!crmConfigured()) return { gravado: false, resultado: "sem banco" };
  const sql = await db();
  const chave = `ycloud:${ev.id.slice(0, 200)}`;
  const novo = await sql`
    insert into crm_webhook_eventos (id, provedor, tipo, payload) values (${chave}, 'ycloud', ${ev.type.slice(0, 120)}, ${sql.json(ev as never)})
    on conflict (id) do nothing`;
  if (!novo.count) {
    // Repetição. Se a primeira entrega já foi processada, nada a fazer; se não, tenta agora.
    const [e] = await sql<{ processado_em: Date | null }[]>`select processado_em from crm_webhook_eventos where id = ${chave}`;
    if (e?.processado_em) return { gravado: true, resultado: "repetido (já processado)" };
  }
  return { gravado: true, resultado: await processarGravado(chave, ev) };
}

async function processarGravado(chave: string, ev: EventoYCloud): Promise<string> {
  const sql = await db();
  try {
    const resultado = await processar(ev);
    await sql`update crm_webhook_eventos set processado_em = now(), resultado = ${resultado.slice(0, 300)}, erro = null, tentativas = tentativas + 1 where id = ${chave}`;
    return resultado;
  } catch (e) {
    const erro = (e as Error).message.slice(0, 300);
    console.error(`[crm] webhook ${chave} não processado: ${erro}`);
    await sql`update crm_webhook_eventos set erro = ${erro}, tentativas = tentativas + 1 where id = ${chave}`.catch(() => {});
    return `erro: ${erro}`;
  }
}

/** Rotina: notificações gravadas que não chegaram a ser processadas; e limpeza do que já tem mais de 90 dias. */
export async function rotinaWebhooks(): Promise<string[]> {
  const sql = await db();
  const rows = await sql<{ id: string; payload: EventoYCloud }[]>`
    select id, payload from crm_webhook_eventos
    where processado_em is null and tentativas < ${MAX_TENTATIVAS} and recebido_em < now() - interval '1 minute'
    order by recebido_em limit 30`;
  const out: string[] = [];
  for (const r of rows) out.push(`webhook ${r.id.slice(-8)}: ${await processarGravado(r.id, r.payload)}`);
  await sql`delete from crm_webhook_eventos where processado_em is not null and recebido_em < now() - interval '90 days'`.catch(() => {});
  return out;
}

export type EstadoWebhook = {
  total: number;
  ultimoEm: string | null;
  ultimaEntradaEm: string | null;
  ultimoEcoEm: string | null;
  ultimoEstadoEm: string | null;
  semProcessar: number;
  historico: number;
};

/** O que já chegou do provedor, para a tela de Integrações mostrar evidência e não suposição. */
export async function estadoWebhook(): Promise<EstadoWebhook> {
  const sql = await db();
  const [r] = await sql`
    select count(*)::int as total, max(recebido_em) as ultimo,
      max(recebido_em) filter (where tipo = 'whatsapp.inbound_message.received') as entrada,
      max(recebido_em) filter (where tipo in ('whatsapp.smb.message.echoes', 'whatsapp.smb.message.created')) as eco,
      max(recebido_em) filter (where tipo = 'whatsapp.message.updated') as estado,
      count(*) filter (where processado_em is null)::int as pendentes,
      count(*) filter (where tipo = 'whatsapp.smb.history')::int as historico
    from crm_webhook_eventos where provedor = 'ycloud'`;
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  return { total: r.total, ultimoEm: iso(r.ultimo), ultimaEntradaEm: iso(r.entrada), ultimoEcoEm: iso(r.eco), ultimoEstadoEm: iso(r.estado), semProcessar: r.pendentes, historico: r.historico };
}
