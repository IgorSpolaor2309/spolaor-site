import { iaConfig } from "./config";
import { mp, type AuthorizedPayment } from "./mercadopago";
import { zm, ZmError, type ZmClient } from "./zappmillion";
import { store, type Contratacao } from "./store";
import { notifyOps } from "./notify";

// Regras do fluxo. Cada função relê o recurso no Mercado Pago ou no ZappMillion e grava o estado:
// a ordem e a repetição das notificações não importam (idempotente e resistente a eventos fora de
// ordem). O retorno do navegador depois do checkout nunca confirma nada.

const nowIso = () => new Date().toISOString();
const isCancelled = (s?: string | null) => !!s && /^cancel+ed$/.test(s);
const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Fim do período coberto por uma cobrança aprovada, conforme o ciclo configurado. */
export function periodEnd(startIso: string): string {
  const d = new Date(startIso);
  const f = iaConfig.frequency();
  if (f.frequencyType === "days") d.setUTCDate(d.getUTCDate() + f.frequency);
  else d.setUTCMonth(d.getUTCMonth() + f.frequency);
  return d.toISOString();
}

const later = (a: string | null, b: string) => (!a || new Date(b) > new Date(a) ? b : a);

/** Telefone em E.164 (+55…), como o ZappMillion espera. */
export function e164(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+${d}`;
  return d.length === 10 || d.length === 11 ? `+55${d}` : `+${d}`;
}

/* ──────────────────────────────── contratação ──────────────────────────────── */

export async function startContratacao(input: {
  empresa: string;
  responsavel: string;
  email: string;
  telefone: string;
  segmento?: string;
  utm: Record<string, string>;
}) {
  const price = iaConfig.price()!;
  const planId = iaConfig.zmPlanId()!;
  const s = store();
  const { contratacao, token } = await s.create({
    etapa: "aguardando_pagamento",
    empresa: input.empresa,
    responsavel: input.responsavel,
    email: input.email,
    telefone: input.telefone,
    segmento: input.segmento ?? null,
    precoMensal: price,
    zmPlanId: planId,
    utm: input.utm,
    mpPreapprovalId: null,
    mpStatus: null,
    pagoAte: null,
    primeiroPagamentoEm: null,
    zmStatus: null,
    zmOrganizationId: null,
    zmWorkspaceId: null,
    zmUserId: null,
    zmPeriodoFim: null,
    whatsappStatus: null,
    ultimoErro: null,
    tentativas: 0,
    proximaTentativa: null,
    motivoSuspensao: null,
  });
  const backUrl = `${iaConfig.siteUrl()}/atendimento-ia/acompanhar?c=${contratacao.id}&t=${token}`;
  const pre = await mp.createPreapproval({
    reason: "Spolaor · Atendimento com IA no WhatsApp",
    externalReference: contratacao.id,
    payerEmail: input.email,
    amount: price,
    backUrl,
  });
  if (!pre.init_point) throw new Error("Mercado Pago não devolveu o link de pagamento (init_point)");
  await s.update(contratacao.id, { mpPreapprovalId: pre.id, mpStatus: pre.status });
  return { id: contratacao.id, token, checkoutUrl: pre.init_point };
}

/* ───────────────────────────── notificações (Mercado Pago) ───────────────────────────── */

/** Localiza a contratação de uma assinatura e confere o vínculo (external_reference). */
async function contratacaoDaAssinatura(preapprovalId: string, externalReference?: string) {
  const s = store();
  const c = (await s.byPreapproval(preapprovalId)) ?? (externalReference ? await s.get(externalReference).catch(() => null) : null);
  if (!c) return null;
  if (externalReference && externalReference !== c.id) return null;
  if (!c.mpPreapprovalId) await s.update(c.id, { mpPreapprovalId: preapprovalId });
  return c;
}

export async function syncPreapproval(preapprovalId: string) {
  const pre = await mp.getPreapproval(preapprovalId);
  const c = await contratacaoDaAssinatura(pre.id, pre.external_reference);
  if (!c) return { ignored: "assinatura sem contratação correspondente" };
  const ar = pre.auto_recurring;
  if (ar && (!sameAmount(ar.transaction_amount, c.precoMensal) || ar.currency_id !== "BRL")) {
    await store().update(c.id, { ultimoErro: `Valor da assinatura diverge (${ar.transaction_amount} ${ar.currency_id})` });
    await notifyOps(`Valor divergente na assinatura ${pre.id}`, `Contratação ${c.id}: esperado ${c.precoMensal} BRL, recebido ${ar.transaction_amount} ${ar.currency_id}. Nada foi liberado.`);
    return { error: "valor divergente" };
  }
  const patch: Partial<Contratacao> = { mpStatus: pre.status };
  if (pre.status === "authorized" && c.etapa === "aguardando_pagamento") patch.etapa = "assinatura_autorizada";
  if (isCancelled(pre.status) && c.etapa !== "cancelada" && c.etapa !== "suspensa") {
    // Mantém o acesso até o fim do período já pago; a guarda suspende no momento certo.
    patch.etapa = "cancelada";
    await notifyOps(`Assinatura cancelada · ${c.empresa}`, `Contratação ${c.id}. Pago até: ${c.pagoAte ?? "nenhuma cobrança aprovada"}. O acesso continua até essa data e é suspenso antes da próxima renovação do fornecedor.`);
  }
  await store().update(c.id, patch);
  return { ok: true, status: pre.status };
}

async function applyCharge(c: Contratacao, ap: AuthorizedPayment) {
  const s = store();
  const payStatus = ap.payment?.status ?? null;
  const { previous } = await s.upsertCobranca({
    id: String(ap.id),
    contratacaoId: c.id,
    status: ap.status,
    pagamentoId: ap.payment?.id != null ? String(ap.payment.id) : null,
    pagamentoStatus: payStatus,
    valor: ap.transaction_amount,
    moeda: ap.currency_id,
    dataDebito: ap.debit_date ?? ap.date_created ?? null,
    atualizadoEm: nowIso(),
  });
  if (payStatus === "approved" && previous?.pagamentoStatus !== "approved") {
    // Cobrança efetivamente aprovada (não basta a assinatura estar autorizada).
    const start = ap.debit_date ?? ap.date_created ?? nowIso();
    const first = !c.primeiroPagamentoEm;
    const updated = await s.update(c.id, {
      pagoAte: later(c.pagoAte, periodEnd(start)),
      primeiroPagamentoEm: c.primeiroPagamentoEm ?? start,
      ...(first && (c.etapa === "aguardando_pagamento" || c.etapa === "assinatura_autorizada") ? { etapa: "pagamento_confirmado" as const } : {}),
    });
    if (first) return provision(updated);
    // Renovação paga: atualiza a contratação existente. Se estava suspensa por falta de pagamento,
    // reativa (o ZappMillion cobra um novo ciclo do fornecedor só nesse caso).
    if (updated.etapa === "suspensa" && updated.motivoSuspensao === "inadimplencia") return reactivate(updated);
    return { ok: true, renewal: true };
  }
  if (payStatus && ["refunded", "charged_back", "in_mediation"].includes(payStatus)) return applyReversal(c, payStatus);
  return { ok: true, status: ap.status, payment: payStatus };
}

export async function syncAuthorizedPayment(id: string) {
  const ap = await mp.getAuthorizedPayment(id);
  const c = await contratacaoDaAssinatura(ap.preapproval_id, ap.external_reference);
  if (!c) return { ignored: "cobrança sem contratação correspondente" };
  if (!sameAmount(ap.transaction_amount, c.precoMensal) || ap.currency_id !== "BRL") {
    await store().update(c.id, { ultimoErro: `Valor da cobrança diverge (${ap.transaction_amount} ${ap.currency_id})` });
    await notifyOps(`Valor divergente na cobrança ${ap.id}`, `Contratação ${c.id}: esperado ${c.precoMensal} BRL. Nada foi liberado.`);
    return { error: "valor divergente" };
  }
  return applyCharge(c, ap);
}

/** Notificação de pagamento: só interessa se for de uma cobrança já registrada (estorno etc.). */
export async function syncPayment(id: string) {
  const s = store();
  const cob = await s.cobrancaByPagamento(id);
  if (!cob) return { ignored: "pagamento sem cobrança registrada (aguardando a notificação da assinatura)" };
  const p = await mp.getPayment(id);
  await s.upsertCobranca({ ...cob, pagamentoStatus: p.status, atualizadoEm: nowIso() });
  const c = await s.get(cob.contratacaoId);
  if (!c) return { ignored: "contratação removida" };
  if (["refunded", "charged_back", "in_mediation"].includes(p.status)) return applyReversal(c, p.status);
  return { ok: true, status: p.status };
}

export async function syncChargeback(id: string) {
  const cb = await mp.getChargeback(id);
  const results = [];
  for (const pid of cb.payments ?? []) results.push(await syncPayment(String(pid)));
  return { ok: true, results };
}

/** Estorno ou contestação: suspende o acesso e avisa a operação. */
async function applyReversal(c: Contratacao, status: string) {
  const motivo = status === "refunded" ? "estorno" : "contestacao";
  if (c.etapa === "suspensa" && c.motivoSuspensao === motivo) return { ok: true, already: true };
  await notifyOps(`Pagamento ${status} · ${c.empresa}`, `Contratação ${c.id}. O acesso foi suspenso. Confira a contestação ou o estorno no Mercado Pago.`);
  return suspend(c, motivo);
}

/* ─────────────────────────────── ZappMillion ─────────────────────────────── */

function syncedFields(cli: ZmClient): Partial<Contratacao> {
  return {
    zmStatus: cli.status,
    zmOrganizationId: cli.organizationId,
    zmWorkspaceId: cli.workspaceId,
    zmUserId: cli.userId,
    zmPeriodoFim: cli.subscription?.currentPeriodEnd ?? null,
    whatsappStatus: cli.messagingAccount?.status ?? null,
  };
}

function playbookVariables(c: Contratacao) {
  const fields: Record<string, string> = { empresa: c.empresa, responsavel: c.responsavel, email: c.email, telefone: c.telefone, segmento: c.segmento ?? "" };
  const out: Record<string, Record<string, string>> = {};
  for (const [pb, map] of Object.entries(iaConfig.playbookVariables())) {
    out[pb] = Object.fromEntries(Object.entries(map).map(([variable, field]) => [variable, fields[field] ?? ""]));
  }
  return out;
}

/** Cria o cliente no ZappMillion depois do primeiro pagamento aprovado. Seguro para repetir. */
export async function provision(c: Contratacao) {
  const s = store();
  if (!c.primeiroPagamentoEm) return { error: "sem pagamento aprovado" };
  if (c.zmStatus === "ACTIVE" || c.etapa === "acesso_criado") return { ok: true, already: true };
  try {
    const plans = await zm.plans();
    if (!plans.some((p) => p.id === c.zmPlanId)) throw new ZmError(404, "PlanNotFound", `Plano ${c.zmPlanId} não existe no ZappMillion`);
    const pbs = iaConfig.playbookIds();
    const cli = await zm.createClient({
      externalId: c.externalId,
      name: c.empresa,
      planId: c.zmPlanId,
      user: { name: c.responsavel, email: c.email, phoneNumber: e164(c.telefone) },
      ...(pbs.length ? { playbookIds: pbs, playbookVariables: playbookVariables(c) } : {}),
    });
    await s.update(c.id, { ...syncedFields(cli), etapa: "acesso_criado", ultimoErro: null, tentativas: 0, proximaTentativa: null });
    return { ok: true, created: true };
  } catch (e) {
    const err = e instanceof ZmError ? e : new ZmError(500, "Unknown", (e as Error).message);
    const tentativas = c.tentativas + 1;
    // 429/5xx: nova tentativa automática com espera crescente. Outros erros (cartão da agência
    // recusado, e-mail em uso, plano inexistente) esperam correção e nova tentativa manual.
    const proxima = err.retryable && tentativas < 8 ? new Date(Date.now() + 5 * 60_000 * 2 ** (tentativas - 1)).toISOString() : null;
    await s.update(c.id, { etapa: "ativacao_pendente", ultimoErro: `${err.status} ${err.type}`, tentativas, proximaTentativa: proxima });
    await notifyOps(
      `Ativação pendente · ${c.empresa}`,
      `Pagamento aprovado, mas a criação no ZappMillion falhou (${err.status} ${err.type}). Contratação ${c.id}. ${proxima ? `Nova tentativa automática em ${proxima}.` : "Corrija a causa e use a nova tentativa manual."}`,
    );
    return { error: err.type, retryAt: proxima };
  }
}

/** Relê o cliente no ZappMillion (período do fornecedor e conexão do WhatsApp). */
export async function refreshFromZm(c: Contratacao) {
  return store().update(c.id, syncedFields(await zm.getClient(c.externalId)));
}

async function suspend(c: Contratacao, motivo: string) {
  const s = store();
  try {
    const cli = c.zmStatus ? await zm.suspend(c.externalId) : null;
    await s.update(c.id, { ...(cli ? syncedFields(cli) : {}), etapa: "suspensa", motivoSuspensao: motivo });
    return { ok: true, suspended: motivo };
  } catch (e) {
    await s.update(c.id, { ultimoErro: `suspensão falhou: ${(e as Error).message}` });
    await notifyOps(`Falha ao suspender · ${c.empresa}`, `Contratação ${c.id}: ${(e as Error).message}. Suspenda pelo painel do ZappMillion.`);
    throw e;
  }
}

async function reactivate(c: Contratacao) {
  const s = store();
  try {
    const cli = await zm.reactivate(c.externalId, c.zmPlanId);
    await s.update(c.id, { ...syncedFields(cli), etapa: "acesso_criado", motivoSuspensao: null, ultimoErro: null });
    return { ok: true, reactivated: true };
  } catch (e) {
    await s.update(c.id, { ultimoErro: `reativação falhou: ${(e as Error).message}` });
    await notifyOps(`Reativação pendente · ${c.empresa}`, `Pagamento aprovado, mas a reativação no ZappMillion falhou: ${(e as Error).message}. Contratação ${c.id}.`);
    return { error: "reativacao" };
  }
}

/* ─────────────────────────────── rotina periódica ─────────────────────────────── */

/**
 * Executada pelo cron. (1) Repete ativações pendentes cuja espera venceu. (2) Atualiza o estado
 * dos clientes no ZappMillion (período, WhatsApp). (3) Guarda de renovação: o ZappMillion cobra o
 * cartão da agência a cada 30 dias; se o cliente não pagou o período seguinte, suspende antes da
 * renovação, sem cortar tempo já pago além da antecedência configurada (IA_GUARDA_HORAS).
 */
export async function runCron(now = new Date()) {
  const s = store();
  const report: string[] = [];
  for (const c of await s.list({ etapas: ["ativacao_pendente", "pagamento_confirmado"] })) {
    if (c.proximaTentativa && new Date(c.proximaTentativa) <= now) {
      const r = await provision(c);
      report.push(`${c.id}: nova tentativa → ${JSON.stringify(r)}`);
    }
  }
  for (const c of await s.list({ etapas: ["acesso_criado", "cancelada"] })) {
    if (c.zmStatus !== "ACTIVE") continue;
    let cur = c;
    try {
      cur = await refreshFromZm(c);
    } catch (e) {
      report.push(`${c.id}: não foi possível consultar o ZappMillion (${(e as Error).message})`);
    }
    if (cur.zmStatus !== "ACTIVE" || !cur.zmPeriodoFim) continue;
    const zmEnd = new Date(cur.zmPeriodoFim).getTime();
    const paid = cur.pagoAte ? new Date(cur.pagoAte).getTime() : 0;
    if (paid >= zmEnd) continue; // o cliente já pagou além da próxima renovação do fornecedor
    const suspendAt = Math.min(paid, zmEnd - iaConfig.guardHours() * 3_600_000);
    if (now.getTime() >= suspendAt) {
      const motivo = cur.etapa === "cancelada" ? "cancelamento" : "inadimplencia";
      await suspend(cur, motivo);
      report.push(`${c.id}: suspensa (${motivo}) antes da renovação de ${cur.zmPeriodoFim}`);
    }
  }
  return report;
}
