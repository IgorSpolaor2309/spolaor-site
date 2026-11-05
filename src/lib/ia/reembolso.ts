import { mp, MpError } from "./mercadopago";
import { notifyOps } from "./notify";
import { cancelSubscription, closeAfterRefund } from "./process";
import { store, type Contratacao, type Reembolso } from "./store";

// Direito de arrependimento (CDC art. 49; Decreto 7.962/2013 art. 5): na PRIMEIRA contratação, o comprador
// desiste pelo link de acompanhamento e recebe o valor integral. Renovações não reabrem o prazo.
//
// Pedido: registra (um por contratação), confirma o recebimento e cancela a assinatura (sem novas cobranças).
// Estorno: POST de reembolso integral no Mercado Pago, com chave de idempotência fixa. Conclusão: só quando o
// Mercado Pago informa o pagamento como `refunded` (releitura, webhook ou rotina); aí o acesso é encerrado.
// O direito do comprador não depende de nenhum reembolso do ZappMillion, que não é solicitado aqui.

const BRASILIA = 3 * 3_600_000;

/** Fim do prazo: 23:59:59 (Brasília) do 7º dia depois da liberação do acesso (ou do pagamento). */
export function prazoArrependimento(c: Contratacao): string | null {
  const base = c.acessoLiberadoEm ?? c.pagamentoConfirmadoEm ?? c.primeiroPagamentoEm;
  if (!base) return null;
  const local = new Date(new Date(base).getTime() - BRASILIA);
  const fim = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 7, 23, 59, 59, 999);
  return new Date(fim + BRASILIA).toISOString();
}

export function podeArrepender(c: Contratacao, agora = new Date()) {
  const prazo = prazoArrependimento(c);
  if (!prazo || agora.getTime() > new Date(prazo).getTime()) return false;
  return !(c.etapa === "suspensa" && (c.motivoSuspensao === "estorno" || c.motivoSuspensao === "contestacao"));
}

const automatico = () => (process.env.IA_REEMBOLSO_AUTOMATICO ?? "").trim() === "true";

/** Pagamento da primeira cobrança aprovada: é o único valor devolvido pelo arrependimento. */
async function primeiroPagamento(c: Contratacao) {
  const aprovadas = (await store().cobrancas(c.id)).filter((x) => x.aprovadaEm && x.pagamentoId);
  return aprovadas.sort((a, b) => a.aprovadaEm!.localeCompare(b.aprovadaEm!))[0] ?? null;
}

async function cancelarAssinatura(c: Contratacao, r: Reembolso) {
  if (r.assinaturaCanceladaEm) return r;
  try {
    await cancelSubscription(c);
    return store().updateRefund(r.id, { assinaturaCanceladaEm: new Date().toISOString() });
  } catch (e) {
    return store().updateRefund(r.id, { ultimoErro: `cancelamento da assinatura: ${(e as Error).message}` });
  }
}

/** Pedido do comprador. Idempotente: repetir devolve o mesmo protocolo. */
export async function solicitarArrependimento(c: Contratacao, agora = new Date()) {
  const s = store();
  const existente = await s.refundOf(c.id);
  if (existente) return { ok: true as const, reembolso: existente, novo: false };
  if (!podeArrepender(c, agora)) return { ok: false as const, erro: "fora_do_prazo" };
  const cob = await primeiroPagamento(c);
  if (!cob) return { ok: false as const, erro: "sem_pagamento" };
  const criado = await s.createRefund({ contratacaoId: c.id, pagamentoId: cob.pagamentoId!, valor: cob.valor });
  if (!criado) return { ok: true as const, reembolso: (await s.refundOf(c.id))!, novo: false };
  let r = await cancelarAssinatura(c, criado);
  await notifyOps(
    `Pedido de arrependimento · ${c.empresa}`,
    `Contratação ${c.id}, protocolo ${r.id}. Valor a devolver: ${r.valor} BRL. Assinatura ${r.assinaturaCanceladaEm ? "cancelada" : "NÃO cancelada (nova tentativa na rotina)"}. ` +
      (automatico() ? "Estorno automático em andamento." : "Execute o estorno pela ação reembolsar do admin ou pelo painel do Mercado Pago.") +
      " O reembolso de R$ 97,00 do ZappMillion não é solicitado automaticamente.",
  );
  if (automatico()) r = await executarEstorno(c).catch(() => r);
  return { ok: true as const, reembolso: r, novo: true };
}

/** Executa o estorno integral. Nunca conclui pelo retorno do POST: só a releitura do pagamento conclui. */
export async function executarEstorno(c: Contratacao) {
  const s = store();
  const r = await s.refundOf(c.id);
  if (!r) throw new Error("Sem pedido de arrependimento");
  if (r.status === "concluido") return r;
  const atual = await mp.getPayment(r.pagamentoId);
  if (atual.status === "refunded") return confirmarEstorno(c);
  if (!(await s.claimRefund(r.id, ["solicitado", "falhou"]))) return (await s.refundOf(c.id))!;
  try {
    const res = await mp.refundPayment(r.pagamentoId, `arrependimento-${c.id}`);
    await s.updateRefund(r.id, { mpReembolsoId: res.id != null ? String(res.id) : null, ultimoErro: null, tentativas: r.tentativas + 1 });
  } catch (e) {
    const recusado = e instanceof MpError && e.status >= 400 && e.status < 500 && e.status !== 429;
    // Recusa do provedor (ex.: saldo insuficiente): volta a depender da operação. Falha transitória fica
    // "processando": o resultado é desconhecido e a rotina relê o pagamento antes de qualquer nova tentativa.
    await s.updateRefund(r.id, { status: recusado ? "falhou" : "processando", ultimoErro: (e as Error).message, tentativas: r.tentativas + 1 });
    if (recusado) await notifyOps(`Estorno recusado · ${c.empresa}`, `Contratação ${c.id}, protocolo ${r.id}: ${(e as Error).message}. Resolva a causa e repita a ação reembolsar.`);
    return (await s.refundOf(c.id))!;
  }
  return confirmarEstorno(c);
}

/** Relê o pagamento no Mercado Pago e conclui só com `refunded` confirmado. */
export async function confirmarEstorno(c: Contratacao) {
  const s = store();
  const r = (await s.refundOf(c.id))!;
  if (r.status === "concluido") return r;
  const p = await mp.getPayment(r.pagamentoId);
  if (p.status !== "refunded") return r;
  const pronto = await s.updateRefund(r.id, { status: "concluido", confirmadoEm: new Date().toISOString(), ultimoErro: null });
  await closeAfterRefund(c);
  await notifyOps(`Reembolso concluído · ${c.empresa}`, `Contratação ${c.id}, protocolo ${r.id}. O Mercado Pago confirmou o estorno e o acesso foi encerrado.`);
  return pronto;
}

/** Rotina: conclui cancelamentos pendentes, confirma estornos e, se automático, executa os pendentes. */
export async function rotinaReembolsos() {
  const report: string[] = [];
  for (const r of await store().openRefunds()) {
    const c = await store().get(r.contratacaoId);
    if (!c) continue;
    try {
      await cancelarAssinatura(c, r);
      const fim = r.status === "solicitado" && automatico() ? await executarEstorno(c) : await confirmarEstorno(c);
      if (fim.status === "concluido") report.push(`${c.id}: reembolso concluído`);
    } catch (e) {
      report.push(`${c.id}: reembolso pendente (${(e as Error).message})`);
    }
  }
  return report;
}
