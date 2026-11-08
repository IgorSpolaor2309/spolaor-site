import { AsyncLocalStorage } from "node:async_hooks";
import { deveTerAcesso } from "./acesso-esperado";
import { estadoInicialAviso } from "./aviso-cadastro";
import { iaConfig, cycleLabel } from "./config";
import { mp, type AuthorizedPayment } from "./mercadopago";
import { zm, ZmError, type ZmClient } from "./zappmillion";
import { store, type Contratacao } from "./store";
import { notifyOps } from "./notify";

// Regras do fluxo. Cada função relê o recurso no Mercado Pago ou no ZappMillion e grava o estado:
// a ordem e a repetição das notificações não importam (idempotente, resistente a eventos fora de
// ordem e simultâneos). O retorno do navegador depois do checkout nunca confirma nada.
//
// PERÍODO PAGO (pagoAte): o comprador recebe o ciclo inteiro a partir do momento em que o acesso
// existe. Primeira cobrança: pagoAte = fim do período do ZappMillion criado para ele (início do
// acesso + 30 dias). Cada renovação aprovada soma um ciclo ao pagoAte anterior (contínuo). Se o
// acesso tinha sido suspenso por falta de pagamento, a reativação abre um novo período e pagoAte
// passa a ser o fim dele. Nada é suspenso antes de pagoAte.

const nowIso = () => new Date().toISOString();

// Por onde chegou a confirmação (webhook, página de acompanhamento, rotina ou admin): gravado em
// confirmadoPor para medir se o webhook está funcionando e quanto a conciliação está cobrindo.
const canalAtual = new AsyncLocalStorage<string>();
export const comCanal = <T>(canal: string, fn: () => Promise<T>) => canalAtual.run(canal, fn);
const isCancelled = (s?: string | null) => !!s && /^cancel+ed$/.test(s);
const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Soma um ciclo do Mercado Pago a uma data. */
export function addCycle(fromIso: string): string {
  const d = new Date(fromIso);
  const f = iaConfig.frequency();
  if (f.frequencyType === "days") d.setTime(d.getTime() + f.frequency * 86_400_000);
  else d.setUTCMonth(d.getUTCMonth() + f.frequency);
  return d.toISOString();
}

/** Telefone em E.164 (+55…), como o ZappMillion espera. */
export function e164(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+${d}`;
  return d.length === 10 || d.length === 11 ? `+55${d}` : `+${d}`;
}

/* ──────────────────────────────── contratação ──────────────────────────────── */

/** Pedido repetido ainda sendo criado por outra requisição, ou já pago: o navegador não recebe outro link. */
export class PedidoError extends Error {
  constructor(public codigo: "em_andamento" | "ja_contratada") {
    super(codigo);
  }
}

/** Reaproveita o pedido da mesma chave. Devolve o link existente ou libera a chave para uma nova tentativa. */
async function pedidoExistente(chave: string, email: string) {
  const s = store();
  const c = await s.byOrderKey(chave);
  if (!c) return null;
  const aberto = c.etapa === "aguardando_pagamento" && !isCancelled(c.mpStatus);
  if (c.email === email && aberto && c.mpCheckoutUrl) return { id: c.id, token: null, checkoutUrl: c.mpCheckoutUrl };
  if (c.email === email && aberto && Date.now() - new Date(c.criadoEm).getTime() < 60_000) throw new PedidoError("em_andamento");
  if (c.primeiroPagamentoEm) throw new PedidoError("ja_contratada");
  await s.update(c.id, { chavePedido: null });
  return null;
}

export async function startContratacao(input: { empresa: string; responsavel: string; email: string; telefone: string; segmento?: string; utm: Record<string, string>; chavePedido?: string | null }) {
  const price = iaConfig.price()!;
  const planId = iaConfig.zmPlanId()!;
  const s = store();
  const chavePedido = input.chavePedido ?? null;
  if (chavePedido) {
    const existente = await pedidoExistente(chavePedido, input.email);
    if (existente) return existente;
  }
  const criado = await s
    .create({
    etapa: "aguardando_pagamento",
    chavePedido,
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
    preAvisoPara: null,
    avisoFornecedorPara: null,
  })
    .catch((e: Error) => {
      // Duas requisições simultâneas com a mesma chave: o índice único deixa só uma criar a assinatura.
      if (chavePedido && /duplicate key|chave_pedido/i.test(e.message)) throw new PedidoError("em_andamento");
      throw e;
    });
  const { contratacao, token } = criado;
  const backUrl = `${iaConfig.siteUrl()}/atendimento-ia/acompanhar?c=${contratacao.id}&t=${token}`;
  const valor = price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  let pre: Awaited<ReturnType<typeof mp.createPreapproval>>;
  try {
    pre = await mp.createPreapproval({
      // O Mercado Pago aceita no máximo 60 caracteres em reason (erro 400 acima disso).
      reason: `Atendimento IA WhatsApp · ${valor} ${cycleLabel()}`.slice(0, 60),
      externalReference: contratacao.id,
      payerEmail: input.email,
      amount: price,
      backUrl,
    });
    if (!pre.init_point) throw new Error("Mercado Pago não devolveu o link de pagamento (init_point)");
  } catch (e) {
    // Sem assinatura criada: libera a chave para o comprador tentar de novo (ex.: corrigir o e-mail).
    if (chavePedido) await s.update(contratacao.id, { chavePedido: null }).catch(() => {});
    throw e;
  }
  // Assinatura e link salvos na mesma escrita que agenda o aviso interno de novo cadastro (validação interna não avisa).
  await s.update(contratacao.id, { mpPreapprovalId: pre.id, mpStatus: pre.status, mpCheckoutUrl: pre.init_point, avisoCadastroStatus: estadoInicialAviso(input.utm) });
  return { id: contratacao.id, token, checkoutUrl: pre.init_point };
}

/** Cancela a assinatura no Mercado Pago (sem novas cobranças). O acesso continua até pagoAte. */
export async function cancelSubscription(c: Contratacao) {
  if (!c.mpPreapprovalId) return { error: "sem assinatura" };
  if (!isCancelled(c.mpStatus)) await mp.setPreapprovalStatus(c.mpPreapprovalId, "cancelled");
  return syncPreapproval(c.mpPreapprovalId);
}

/* ───────────────────────────── notificações (Mercado Pago) ───────────────────────────── */

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
    patch.etapa = "cancelada";
    await notifyOps(
      `Assinatura cancelada · ${c.empresa}`,
      `Contratação ${c.id}. Acesso mantido até ${c.pagoAte ?? "— (nenhuma cobrança aprovada)"}; suspensão automática depois dessa data.`,
    );
  }
  await store().update(c.id, patch);
  return { ok: true, status: pre.status, proximaCobranca: pre.next_payment_date ?? null };
}

async function applyCharge(c: Contratacao, ap: AuthorizedPayment) {
  const s = store();
  const payStatus = ap.payment?.status ?? null;
  await s.upsertCobranca({
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
  if (payStatus === "approved") {
    // Cobrança efetivamente aprovada (assinatura autorizada não basta). Só quem marca primeiro aplica.
    if (!(await s.claimApproval(String(ap.id)))) return resumeIfInterrupted(c.id, String(ap.id), ap);
    const cur = (await s.get(c.id))!;
    if (!cur.primeiroPagamentoEm) {
      const updated = await s.update(c.id, {
        primeiroPagamentoEm: ap.debit_date ?? nowIso(),
        pagamentoConfirmadoEm: nowIso(),
        confirmadoPor: canalAtual.getStore() ?? "desconhecido",
        ...(cur.etapa === "aguardando_pagamento" || cur.etapa === "assinatura_autorizada" || cur.etapa === "cancelada" ? { etapa: "pagamento_confirmado" as const } : {}),
      });
      return provision(updated);
    }
    // Renovação paga. Suspensa por falta de pagamento → reativa (novo período do fornecedor).
    if (cur.etapa === "suspensa" && cur.motivoSuspensao === "inadimplencia") return reactivate(cur);
    // Acesso ativo: soma um ciclo ao período pago, sem criar cliente nem cobrar o fornecedor de novo.
    await s.update(c.id, { pagoAte: addCycle(cur.pagoAte ?? nowIso()) });
    return { ok: true, renewal: true };
  }
  if (payStatus && ["refunded", "charged_back", "in_mediation"].includes(payStatus)) return applyReversal(c, payStatus);
  return { ok: true, status: ap.status, payment: payStatus };
}

/**
 * A aprovação já foi marcada (claimApproval) por outra execução. Se essa execução parou no meio (função
 * encerrada entre a marcação e a gravação, ou antes de criar o acesso), retoma depois de 60 s — tempo de
 * sobra para uma execução normal terminar —, para nenhuma contratação paga ficar parada.
 */
async function resumeIfInterrupted(contratacaoId: string, cobrancaId: string, ap: AuthorizedPayment) {
  const s = store();
  const cur = await s.get(contratacaoId);
  const cob = (await s.cobrancas(contratacaoId)).find((x) => x.id === cobrancaId);
  const stale = !!cob?.aprovadaEm && Date.now() - new Date(cob.aprovadaEm).getTime() > 60_000;
  if (!cur || !stale) return { ok: true, already: true };
  if (!cur.primeiroPagamentoEm && ["aguardando_pagamento", "assinatura_autorizada", "cancelada"].includes(cur.etapa)) {
    const updated = await s.update(cur.id, {
      primeiroPagamentoEm: ap.debit_date ?? cob.aprovadaEm,
      pagamentoConfirmadoEm: nowIso(),
      confirmadoPor: `${canalAtual.getStore() ?? "desconhecido"} (retomada)`,
      etapa: "pagamento_confirmado",
    });
    return provision(updated);
  }
  if (cur.primeiroPagamentoEm && cur.etapa === "pagamento_confirmado" && !cur.zmStatus) return provision(cur);
  return { ok: true, already: true };
}

export async function syncAuthorizedPayment(id: string) {
  return applyAuthorizedPayment(await mp.getAuthorizedPayment(id));
}

/** Aplica uma cobrança já lida no Mercado Pago (notificação ou busca), conferindo vínculo, valor e moeda. */
async function applyAuthorizedPayment(ap: AuthorizedPayment) {
  const c = await contratacaoDaAssinatura(ap.preapproval_id, ap.external_reference);
  if (!c) return { ignored: "cobrança sem contratação correspondente" };
  if (!sameAmount(ap.transaction_amount, c.precoMensal) || ap.currency_id !== "BRL") {
    await store().update(c.id, { ultimoErro: `Valor da cobrança diverge (${ap.transaction_amount} ${ap.currency_id})` });
    await notifyOps(`Valor divergente na cobrança ${ap.id}`, `Contratação ${c.id}: esperado ${c.precoMensal} BRL. Nada foi liberado.`);
    return { error: "valor divergente" };
  }
  return applyCharge(c, ap);
}

/**
 * Notificação de pagamento. Se a cobrança já é conhecida, atualiza o status (estorno, contestação).
 * Se chegou só a notificação de pagamento (sem a da cobrança recorrente), localiza a assinatura
 * pelo pagamento e relê as cobranças dela no Mercado Pago.
 */
export async function syncPayment(id: string) {
  const s = store();
  const p = await mp.getPayment(id);
  const cob = await s.cobrancaByPagamento(id);
  if (cob) {
    await s.upsertCobranca({ ...cob, pagamentoStatus: p.status, atualizadoEm: nowIso() });
    const c = await s.get(cob.contratacaoId);
    if (!c) return { ignored: "contratação removida" };
    if (p.status === "approved" && !cob.aprovadaEm) return syncAuthorizedPayment(cob.id);
    if (["refunded", "charged_back", "in_mediation"].includes(p.status)) return applyReversal(c, p.status);
    return { ok: true, status: p.status };
  }
  const preapprovalId = p.metadata?.preapproval_id ?? p.point_of_interaction?.transaction_data?.subscription_id ?? null;
  const c = preapprovalId ? await s.byPreapproval(preapprovalId) : p.external_reference ? await s.get(p.external_reference).catch(() => null) : null;
  if (!c?.mpPreapprovalId) return { ignored: "pagamento sem assinatura correspondente" };
  const results = [];
  for (const ap of await mp.searchAuthorizedPayments(c.mpPreapprovalId)) {
    if (String(ap.payment?.id ?? "") === String(p.id) || ap.payment?.status === "approved") results.push(await syncAuthorizedPayment(String(ap.id)));
  }
  return { ok: true, viaBusca: results };
}

export async function syncChargeback(id: string) {
  const cb = await mp.getChargeback(id);
  const results = [];
  for (const pid of cb.payments ?? []) results.push(await syncPayment(String(pid)));
  return { ok: true, results };
}

/** Fim do arrependimento: o Mercado Pago confirmou o estorno, então o acesso termina e o ciclo do fornecedor é encerrado. */
export async function closeAfterRefund(c: Contratacao) {
  const atual = (await store().get(c.id)) ?? c;
  if (atual.etapa === "suspensa" && atual.motivoSuspensao === "arrependimento") return { ok: true, already: true };
  return suspend(atual, "arrependimento");
}

async function applyReversal(c: Contratacao, status: string) {
  // Estorno de um pedido de arrependimento: quem conclui (e encerra o acesso) é o fluxo do pedido.
  if (status === "refunded" && (await store().refundOf(c.id))) {
    const { confirmarEstorno } = await import("./reembolso");
    return { ok: true, reembolso: (await confirmarEstorno(c)).status };
  }
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
    // O período pago começa com o acesso: termina junto com o período do fornecedor.
    const pagoAte = cli.subscription?.currentPeriodEnd ?? addCycle(nowIso());
    await s.update(c.id, { ...syncedFields(cli), pagoAte, etapa: "acesso_criado", acessoLiberadoEm: nowIso(), ultimoErro: null, tentativas: 0, proximaTentativa: null });
    return { ok: true, created: true };
  } catch (e) {
    const err = e instanceof ZmError ? e : new ZmError(500, "Unknown", (e as Error).message);
    const tentativas = c.tentativas + 1;
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
    // Reativar cobra um novo ciclo do fornecedor e abre um novo período: o pago acompanha.
    await s.update(c.id, { ...syncedFields(cli), pagoAte: cli.subscription?.currentPeriodEnd ?? addCycle(nowIso()), etapa: "acesso_criado", motivoSuspensao: null, ultimoErro: null });
    return { ok: true, reactivated: true };
  } catch (e) {
    await s.update(c.id, { ultimoErro: `reativação falhou: ${(e as Error).message}` });
    await notifyOps(`Reativação pendente · ${c.empresa}`, `Pagamento aprovado, mas a reativação no ZappMillion falhou: ${(e as Error).message}. Contratação ${c.id}.`);
    return { error: "reativacao" };
  }
}

/* ─────────────────────────────── rotina periódica ─────────────────────────────── */

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/**
 * Executada pelo agendador. (1) Repete ativações pendentes cuja espera venceu. (2) Avisa a operação
 * 24 h antes do fim do período de uma assinatura cancelada (o ZappMillion não tem cancelamento
 * agendado: a renovação dele coincide com o fim do período pago). (3) Relê os clientes perto do fim do
 * período. (4) No fim do período pago — NUNCA antes:
 *   - cancelada → suspende;
 *   - renovação não paga e o fornecedor ainda não renovou → suspende (evita a cobrança do fornecedor);
 *   - renovação não paga e a cobrança do novo ciclo do fornecedor CONFIRMADA (charges: PAID) → avisa a
 *     operação NESSE momento e mantém o acesso por IA_CARENCIA_DIAS (10); ao terminar sem pagamento,
 *     suspende. Sem cobrança do fornecedor confirmada → suspende no fim do período pago.
 */
export async function runCron(now = new Date()) {
  const s = store();
  const report: string[] = [];
  const t = now.getTime();
  let planCost: string | null | undefined;
  const cost = async (planId: string) => {
    if (planCost === undefined) {
      const p = await zm.plans().then((ps) => ps.find((x) => x.id === planId)).catch(() => null);
      planCost = p ? p.monthlyPrice.toLocaleString("pt-BR", { style: "currency", currency: p.currency }) : null;
    }
    return planCost ?? "um ciclo do plano";
  };

  for (const c of await s.list({ etapas: ["ativacao_pendente", "pagamento_confirmado"] })) {
    if (c.proximaTentativa && new Date(c.proximaTentativa).getTime() <= t) report.push(`${c.id}: nova tentativa → ${JSON.stringify(await provision(c))}`);
    // Pago e sem acesso, sem tentativa agendada (execução interrompida antes de criar o acesso).
    else if (c.etapa === "pagamento_confirmado" && !c.zmStatus && !c.proximaTentativa && t - new Date(c.atualizadoEm).getTime() > 120_000)
      report.push(`${c.id}: retomada da ativação → ${JSON.stringify(await provision(c))}`);
  }
  // Rede de segurança: contratações aguardando pagamento nos últimos 3 dias são conferidas direto no
  // Mercado Pago (caso uma notificação se perca).
  for (const c of await s.list({ etapas: ["aguardando_pagamento", "assinatura_autorizada"] })) {
    if (!c.mpPreapprovalId || t - new Date(c.criadoEm).getTime() > 3 * 86_400_000) continue;
    try {
      const r = await reconcileWithMp(c);
      if (r.cobrancas.length) report.push(`${c.id}: conferida no Mercado Pago (${r.cobrancas.length} cobrança(s))`);
    } catch (e) {
      report.push(`${c.id}: falha ao conferir no Mercado Pago (${(e as Error).message})`);
    }
  }
  const { rotinaReembolsos } = await import("./reembolso");
  report.push(...(await rotinaReembolsos()));
  const emReembolso = new Set((await s.openRefunds()).map((r) => r.contratacaoId));
  for (const c of await s.list({ etapas: ["acesso_criado", "cancelada"] })) {
    if (c.zmStatus !== "ACTIVE" || !c.pagoAte || emReembolso.has(c.id)) continue;
    const paid = new Date(c.pagoAte).getTime();

    if (c.etapa === "cancelada" && t >= paid - 24 * 3_600_000 && t < paid && c.preAvisoPara !== c.pagoAte) {
      await notifyOps(
        `Fim de assinatura cancelada em 24 h · ${c.empresa}`,
        `Contratação ${c.id}: o período pago termina em ${fmt(c.pagoAte)}, junto com a renovação do ZappMillion (sem cancelamento agendado no fornecedor). A suspensão roda no fim do período; se o fornecedor cobrar antes, o custo é ${await cost(c.zmPlanId)}.`,
      );
      await s.update(c.id, { preAvisoPara: c.pagoAte });
      report.push(`${c.id}: pré-aviso de fim de período enviado`);
    }

    // Limite do ZappMillion: 60 requisições/min. Com o agendador a cada minuto, só consulta quem está
    // a 10 min (ou além) do fim do período pago, e os demais a cada 6 h (WhatsApp e período).
    if (t < paid - 10 * 60_000 && Date.now() - new Date(c.atualizadoEm).getTime() < 6 * 3_600_000) continue;
    let cur = c;
    try {
      cur = await refreshFromZm(c);
    } catch (e) {
      report.push(`${c.id}: não foi possível consultar o ZappMillion (${(e as Error).message})`);
      continue;
    }
    if (cur.zmStatus !== "ACTIVE") {
      // O fornecedor suspendeu por conta própria (ex.: cartão da agência recusado na renovação dele).
      if (t < paid) {
        await notifyOps(
          `Fornecedor suspendeu cliente com período pago · ${cur.empresa}`,
          `Contratação ${cur.id}: o ZappMillion está ${cur.zmStatus} e o cliente pagou até ${fmt(cur.pagoAte!)}. Confira o cartão da agência em "Cartão e API" e use a ação "reativar" (cobra um ciclo do fornecedor) para restabelecer.`,
        );
        report.push(`${c.id}: fornecedor suspendeu com período pago; operação avisada`);
      }
      continue;
    }
    if (!cur.pagoAte) continue;
    if (t < paid) continue; // período pago em curso: nunca suspende antes do fim

    // O fornecedor só conta como renovado com a cobrança do novo ciclo CONFIRMADA (status PAID, período
    // começando no fim do período pago ou depois). A mudança de currentPeriodEnd sozinha não basta.
    const zmEnd = cur.zmPeriodoFim ? new Date(cur.zmPeriodoFim).getTime() : 0;
    let fornecedorRenovou = false;
    if (zmEnd > paid) {
      try {
        fornecedorRenovou = (await zm.charges(cur.externalId)).some((ch) => ch.status === "PAID" && new Date(ch.periodEnd).getTime() > paid && new Date(ch.periodStart).getTime() >= paid - 3_600_000);
      } catch (e) {
        report.push(`${c.id}: não foi possível consultar as cobranças do fornecedor (${(e as Error).message}); nova verificação na próxima execução`);
        continue;
      }
    }
    const graceEnd = paid + iaConfig.graceDays() * 86_400_000;
    let motivo: string | null = null;
    if (cur.etapa === "cancelada") motivo = "cancelamento"; // cancelamento: sem carência, só o período quitado
    else if (!fornecedorRenovou || t >= graceEnd) motivo = "inadimplencia";

    if (fornecedorRenovou && cur.avisoFornecedorPara !== cur.pagoAte) {
      await notifyOps(
        `Fornecedor renovou sem recebimento · ${cur.empresa}`,
        `Contratação ${cur.id}: o período pago terminou em ${fmt(cur.pagoAte)} e a cobrança do novo ciclo do ZappMillion está confirmada (paga, até ${fmt(cur.zmPeriodoFim!)}; custo ${await cost(cur.zmPlanId)}). ${
          motivo ? `O acesso está sendo suspenso (${motivo}).` : `O cliente entrou em carência até ${fmt(new Date(graceEnd).toISOString())} enquanto o Mercado Pago tenta a cobrança.`
        }`,
      );
      cur = await s.update(cur.id, { avisoFornecedorPara: cur.pagoAte });
    }
    if (!motivo) {
      report.push(`${c.id}: fornecedor já renovou; em carência até ${new Date(graceEnd).toISOString()}`);
      continue;
    }
    await suspend(cur, motivo);
    if (fornecedorRenovou && cur.avisoFornecedorPara === cur.pagoAte && t >= graceEnd) {
      await notifyOps(`Carência terminou sem pagamento · ${cur.empresa}`, `Contratação ${cur.id}: a carência terminou em ${fmt(new Date(graceEnd).toISOString())} sem cobrança aprovada no Mercado Pago. O acesso foi suspenso.`);
    }
    report.push(`${c.id}: suspensa (${motivo}) ${fornecedorRenovou && t >= graceEnd ? "ao fim da carência" : "no fim do período pago"} ${cur.pagoAte}`);
  }
  return report;
}

/** Reativa no fornecedor sem mudar o período pago (ex.: depois de o ZappMillion suspender por cartão recusado). */
export async function reactivateKeepingPaid(c: Contratacao) {
  const cli = await zm.reactivate(c.externalId, c.zmPlanId);
  await store().update(c.id, { ...syncedFields(cli), ultimoErro: null });
  return { ok: true, zmStatus: cli.status };
}

/**
 * Conciliação diária entre as contratações e os clientes do ZappMillion: avisa a operação de clientes
 * ativos no fornecedor que não deveriam estar (custo sem receita) e de contratações ativas que o
 * fornecedor não tem como ativas.
 */
export async function reconcile() {
  const s = store();
  const ours = new Map((await s.list({})).map((c) => [c.externalId, c]));
  const theirs = new Map<string, ZmClient>();
  for (let offset = 0; offset < 10_000; offset += 100) {
    const page = await zm.listClients(offset);
    for (const cli of page.data) theirs.set(cli.externalId, cli);
    if (page.data.length < 100) break;
  }
  const problemas: string[] = [];
  for (const [ext, cli] of theirs) {
    if (!ext.startsWith("spolaor-ia-") || cli.status !== "ACTIVE") continue;
    const c = ours.get(ext);
    if (!c) problemas.push(`${ext}: ativo no ZappMillion sem contratação no site`);
    else if (c.etapa === "suspensa") problemas.push(`${ext}: ativo no ZappMillion, suspenso no site (${c.motivoSuspensao})`);
  }
  for (const [ext, c] of ours) {
    if (deveTerAcesso(c) && theirs.get(ext)?.status !== "ACTIVE") problemas.push(`${ext}: ativo no site, ${theirs.get(ext)?.status ?? "ausente"} no ZappMillion`);
  }
  if (problemas.length) await notifyOps(`Conciliação: ${problemas.length} divergência(s)`, problemas.join("\n"));
  return problemas;
}

/**
 * Conciliação direta com o Mercado Pago (não depende do webhook): relê a assinatura e as cobranças dela e
 * aplica o estado real com as mesmas regras idempotentes das notificações. Devolve só status e valores.
 */
export async function reconcileWithMp(c: Contratacao) {
  if (!c.mpPreapprovalId) return { assinatura: null, cobrancas: [] as unknown[] };
  // Uma leitura da assinatura e uma busca das cobranças; cada cobrança é aplicada com os dados da busca
  // (sem nova consulta), para não esbarrar no limite de requisições do Mercado Pago.
  await store().update(c.id, { mpConferidoEm: nowIso() });
  const pre = (await syncPreapproval(c.mpPreapprovalId)) as { status?: string; proximaCobranca?: string | null };
  const aps = await mp.searchAuthorizedPayments(c.mpPreapprovalId);
  const cobrancas = [];
  for (const ap of aps) {
    await applyAuthorizedPayment(ap);
    cobrancas.push({ id: String(ap.id), status: ap.status, pagamento: ap.payment?.status ?? null, detalhe: ap.payment?.status_detail ?? null, valor: ap.transaction_amount, moeda: ap.currency_id, debito: ap.debit_date ?? null });
  }
  return { assinatura: { status: pre.status ?? null, proximaCobranca: pre.proximaCobranca ?? null }, cobrancas };
}
