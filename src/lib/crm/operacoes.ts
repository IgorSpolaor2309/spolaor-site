import { randomUUID } from "node:crypto";
import { aplicarRespostaHumana, cancelarAutomacao, recalcularVez } from "./conversa";
import { db, type Db } from "./db";
import { registrarEvento } from "./entrada";
import { normEmail, normInstagram, normWhatsapp } from "./normalizar";
import { ETAPA_ROTULO, type CanalMensagem, type Categoria, type CustoTipo, type Etapa } from "./tipos";

// Alterações feitas por uma pessoa no CRM. Cada uma grava o histórico na mesma transação.
// Quem chama (src/app/leads/actions.ts) já conferiu a sessão e passa o usuário.
//
// "Assumir": qualquer ação de atendimento marca assumida_em. A partir daí a automação de primeiro contato
// daquela oportunidade para (mensagens automáticas ainda na fila são canceladas) e não recomeça.

async function assumir(tx: Db, oportunidadeId: string, usuarioId: string) {
  const r = await tx`
    update crm_oportunidades set assumida_em = now(), responsavel_id = coalesce(responsavel_id, ${usuarioId})
    where id = ${oportunidadeId} and assumida_em is null`;
  if (!r.count) return;
  const t = await tx`
    update crm_tarefas set status = 'cancelada', resultado = 'Atendimento assumido por uma pessoa antes do envio.', atualizado_em = now()
    where oportunidade_id = ${oportunidadeId} and status = 'pendente'`;
  const c = await tx`
    update crm_mensagens set status = 'cancelada', erro = 'Atendimento assumido por uma pessoa antes do envio.'
    where oportunidade_id = ${oportunidadeId} and automatica and status in ('pendente', 'falhou')`;
  await registrarEvento(tx, {
    oportunidadeId,
    tipo: "assumido",
    texto: c.count || t.count ? "Atendimento assumido. O primeiro contato automático que ainda não tinha saído foi cancelado." : "Atendimento assumido.",
    usuarioId,
  });
}

export async function assumirAtendimento(oportunidadeId: string, usuarioId: string) {
  const sql = await db();
  await sql.begin((tx) => assumir(tx, oportunidadeId, usuarioId));
}

export type Negocio = { etapa: Etapa; valorProposta: number | null; valorFechado: number | null; motivoPerda: string | null };

/** Etapa e valores. As etapas são livres: nenhuma transição é proibida. */
export async function salvarNegocio(oportunidadeId: string, n: Negocio, usuarioId: string) {
  const sql = await db();
  await sql.begin(async (tx) => {
    const [o] = await tx<{ etapa: Etapa; valor_proposta: string | null; valor_fechado: string | null; motivo_perda: string | null }[]>`
      select etapa, valor_proposta, valor_fechado, motivo_perda from crm_oportunidades where id = ${oportunidadeId} for update`;
    if (!o) throw new Error("Oportunidade não encontrada");
    const mudouEtapa = o.etapa !== n.etapa;
    await tx`
      update crm_oportunidades set
        etapa = ${n.etapa},
        aguardando = case when ${n.etapa} in ('ganho', 'perdido') then null else aguardando end,
        pendencia = case when ${n.etapa} in ('ganho', 'perdido') then null else pendencia end,
        valor_proposta = ${n.valorProposta},
        proposta_em = case when ${n.etapa} = 'proposta_enviada' or ${n.valorProposta}::numeric is not null then coalesce(proposta_em, now()) else proposta_em end,
        valor_fechado = ${n.valorFechado},
        fechado_em = case when ${n.etapa} = 'ganho' then coalesce(fechado_em, now()) else null end,
        motivo_perda = ${n.etapa === "perdido" ? n.motivoPerda : null},
        perdido_em = case when ${n.etapa} = 'perdido' then coalesce(perdido_em, now()) else null end,
        proxima_acao = case when ${n.etapa} in ('ganho', 'perdido') then null else proxima_acao end,
        proxima_acao_em = case when ${n.etapa} in ('ganho', 'perdido') then null else proxima_acao_em end,
        atualizado_em = now()
      where id = ${oportunidadeId}`;
    if (mudouEtapa) {
      await assumir(tx, oportunidadeId, usuarioId);
      await registrarEvento(tx, {
        oportunidadeId,
        tipo: "etapa",
        texto: `Etapa: ${ETAPA_ROTULO[o.etapa]} → ${ETAPA_ROTULO[n.etapa]}${n.etapa === "perdido" && n.motivoPerda ? `. Motivo: ${n.motivoPerda}` : ""}`,
        dados: { de: o.etapa, para: n.etapa },
        usuarioId,
      });
    }
    const antes = { p: o.valor_proposta === null ? null : Number(o.valor_proposta), f: o.valor_fechado === null ? null : Number(o.valor_fechado) };
    if (antes.p !== n.valorProposta || antes.f !== n.valorFechado) {
      await registrarEvento(tx, { oportunidadeId, tipo: "valor", texto: "Valores atualizados.", dados: { proposta: n.valorProposta, fechado: n.valorFechado }, usuarioId });
    }
  });
}

export async function definirProximaAcao(oportunidadeId: string, texto: string | null, quando: string | null, usuarioId: string) {
  const sql = await db();
  await sql.begin(async (tx) => {
    await tx`update crm_oportunidades set proxima_acao = ${texto}, proxima_acao_em = ${quando}, atualizado_em = now() where id = ${oportunidadeId}`;
    await registrarEvento(tx, {
      oportunidadeId,
      tipo: "proxima_acao",
      texto: quando ? `Próxima ação marcada${texto ? `: ${texto}` : ""}` : "Próxima ação concluída ou removida.",
      dados: { quando },
      usuarioId,
    });
  });
}

/**
 * Registra um contato feito por nós fora do sistema (WhatsApp, ligação, Direct...). O CRM não enviou nada:
 * a mensagem fica como "registrada", sem estado de entrega.
 */
export async function registrarContatoFeito(oportunidadeId: string, canal: CanalMensagem, corpo: string | null, usuarioId: string) {
  const sql = await db();
  await sql.begin(async (tx) => {
    const [o] = await tx<{ contato_id: string }[]>`select contato_id from crm_oportunidades where id = ${oportunidadeId} for update`;
    if (!o) throw new Error("Oportunidade não encontrada");
    const em = new Date().toISOString();
    await tx`
      insert into crm_mensagens (id, oportunidade_id, contato_id, canal, direcao, modo, via, corpo, status, usuario_id, ocorrida_em)
      values (${randomUUID()}, ${oportunidadeId}, ${o.contato_id}, ${canal}, 'saida', 'manual', 'registro', ${corpo || "(contato feito, texto não registrado)"}, 'registrada', ${usuarioId}, ${em})`;
    // Mesma regra de uma resposta pelo aplicativo ou pelo CRM: assume, para a automação e passa a vez ao interessado.
    await aplicarRespostaHumana(tx, { contatoId: o.contato_id, oportunidadeId, em, usuarioId, origem: "crm" });
    await registrarEvento(tx, { oportunidadeId, tipo: "contato_feito", texto: "Contato feito (registrado à mão).", dados: { canal }, usuarioId });
  });
}

/** Registra que a pessoa respondeu (informado à mão): ela entra na fila de quem aguarda retorno. */
export async function registrarResposta(oportunidadeId: string, canal: CanalMensagem, corpo: string | null, usuarioId: string) {
  const sql = await db();
  await sql.begin(async (tx) => {
    const [o] = await tx<{ contato_id: string }[]>`select contato_id from crm_oportunidades where id = ${oportunidadeId} for update`;
    if (!o) throw new Error("Oportunidade não encontrada");
    const em = new Date().toISOString();
    await assumir(tx, oportunidadeId, usuarioId);
    await cancelarAutomacao(tx, o.contato_id, "O interessado respondeu antes do envio automático.");
    await tx`
      insert into crm_mensagens (id, oportunidade_id, contato_id, canal, direcao, modo, via, corpo, status, usuario_id, ocorrida_em)
      values (${randomUUID()}, ${oportunidadeId}, ${o.contato_id}, ${canal}, 'entrada', 'manual', 'registro', ${corpo || "(resposta recebida, texto não registrado)"}, 'registrada', ${usuarioId}, ${em})`;
    await tx`update crm_oportunidades set ultima_entrada_em = ${em} where id = ${oportunidadeId}`;
    await recalcularVez(tx, oportunidadeId, "resposta");
    await tx`update crm_oportunidades set etapa = 'em_conversa' where id = ${oportunidadeId} and etapa in ('novo', 'aguardando_resposta')`;
    await registrarEvento(tx, { oportunidadeId, tipo: "resposta", texto: "Resposta do interessado (registrada à mão).", dados: { canal }, usuarioId });
  });
}

export async function adicionarNota(oportunidadeId: string, texto: string, usuarioId: string) {
  const sql = await db();
  await sql.begin(async (tx) => {
    await registrarEvento(tx, { oportunidadeId, tipo: "nota", texto, usuarioId });
    await tx`update crm_oportunidades set atualizado_em = now() where id = ${oportunidadeId}`;
  });
}

export async function definirResponsavel(oportunidadeId: string, responsavelId: string | null, usuarioId: string) {
  const sql = await db();
  await sql.begin(async (tx) => {
    const [u] = responsavelId ? await tx<{ nome: string }[]>`select nome from crm_usuarios where id = ${responsavelId}` : [];
    if (responsavelId && !u) throw new Error("Responsável não encontrado");
    await tx`update crm_oportunidades set responsavel_id = ${responsavelId}, atualizado_em = now() where id = ${oportunidadeId}`;
    await registrarEvento(tx, { oportunidadeId, tipo: "responsavel", texto: u ? `Responsável: ${u.nome}` : "Sem responsável.", usuarioId });
  });
}

export async function marcarTeste(oportunidadeId: string, teste: boolean, usuarioId: string) {
  const sql = await db();
  await sql.begin(async (tx) => {
    await tx`update crm_oportunidades set teste = ${teste}, atualizado_em = now() where id = ${oportunidadeId}`;
    await registrarEvento(tx, { oportunidadeId, tipo: "teste", texto: teste ? "Marcado como teste (fora dos indicadores)." : "Desmarcado como teste.", usuarioId });
  });
}

export type ErroContato = "contato-whatsapp" | "contato-email" | "contato-nome" | "contato-duplicado";
export type EdicaoContato = { nome: string; empresa: string | null; whatsapp: string | null; email: string | null; instagram: string | null; site: string | null };

/** Edita os dados do contato. Devolve erro legível se o WhatsApp ou e-mail já é de outro contato (não une sozinho). */
export async function editarContato(oportunidadeId: string, e: EdicaoContato, usuarioId: string): Promise<{ ok: true } | { ok: false; erro: ErroContato }> {
  const whatsapp = normWhatsapp(e.whatsapp);
  const email = normEmail(e.email);
  if (e.whatsapp?.trim() && !whatsapp) return { ok: false, erro: "contato-whatsapp" };
  if (e.email?.trim() && !email) return { ok: false, erro: "contato-email" };
  if (e.nome.trim().length < 2) return { ok: false, erro: "contato-nome" };
  const sql = await db();
  return (await sql.begin(async (tx) => {
    const [o] = await tx<{ contato_id: string }[]>`select contato_id from crm_oportunidades where id = ${oportunidadeId}`;
    if (!o) return { ok: false, erro: "contato-nome" };
    const [outro] = await tx<{ id: string }[]>`
      select id from crm_contatos where id <> ${o.contato_id} and ((${whatsapp}::text is not null and whatsapp = ${whatsapp}) or (${email}::text is not null and email = ${email})) limit 1`;
    if (outro) return { ok: false, erro: "contato-duplicado" };
    await tx`
      update crm_contatos set nome = ${e.nome.trim()}, empresa = ${e.empresa}, whatsapp = ${whatsapp}, email = ${email},
        instagram = ${normInstagram(e.instagram)}, site = ${e.site}, atualizado_em = now()
      where id = ${o.contato_id}`;
    await registrarEvento(tx, { oportunidadeId, tipo: "contato_editado", texto: "Dados do contato atualizados.", usuarioId });
    return { ok: true };
  })) as { ok: true } | { ok: false; erro: ErroContato };
}

/** Serviço de interesse: a categoria (usada nos filtros) e, se quiser, um detalhe em texto livre. Só registra no histórico o que mudou. */
export async function editarServico(oportunidadeId: string, categoria: Categoria, servico: string | null, usuarioId: string) {
  const sql = await db();
  await sql.begin(async (tx) => {
    const [o] = await tx<{ categoria: string | null; servico: string | null }[]>`select categoria, servico from crm_oportunidades where id = ${oportunidadeId} for update`;
    if (!o || (o.categoria === categoria && (o.servico ?? null) === servico)) return;
    await tx`update crm_oportunidades set categoria = ${categoria}, servico = ${servico}, atualizado_em = now() where id = ${oportunidadeId}`;
    await registrarEvento(tx, { oportunidadeId, tipo: "servico", texto: `Serviço de interesse atualizado${servico ? `: ${servico}` : "."}`, dados: { categoria }, usuarioId });
  });
}

/* ───────────────────────────── custos informados ───────────────────────────── */

export async function adicionarCusto(c: { tipo: CustoTipo; inicio: string; fim: string; valor: number; estimado: boolean; nota: string | null }, usuarioId: string) {
  const sql = await db();
  await sql`
    insert into crm_custos (id, tipo, inicio, fim, valor, estimado, nota, usuario_id)
    values (${randomUUID()}, ${c.tipo}, ${c.inicio}, ${c.fim}, ${c.valor}, ${c.estimado}, ${c.nota}, ${usuarioId})`;
}

export async function removerCusto(id: string) {
  const sql = await db();
  await sql`delete from crm_custos where id = ${id}`;
}
