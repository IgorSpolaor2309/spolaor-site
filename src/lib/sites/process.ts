import { sendInternalEmail } from "@/lib/ia/notify";
import { sitesConfig } from "./config";
import { MpError, mpSites, type MpPayment } from "./mercadopago";
import { brl, condicao, PACOTE, rotuloCondicao } from "./oferta";
import { hashToken, sitesStore, type Pedido, type StatusPedido } from "./store";

// Regras da venda avulsa do pacote de sites. Nada aqui libera serviço automaticamente: o pedido pago vira um aviso
// interno para a Spolaor falar com o comprador pelo WhatsApp. Pagamento só conta como confirmado quando o Mercado
// Pago devolve o pagamento APROVADO com o valor, a moeda e as parcelas da condição aprovada.

const nowIso = () => new Date().toISOString();

export class PedidoErro extends Error {
  constructor(
    public codigo: string,
    public http = 409,
    public mensagem?: string,
  ) {
    super(codigo);
  }
}

export type DadosPedido = { nome: string; email: string; whatsapp: string; condicao: string; chavePedido: string | null; utm: Record<string, string> };

/** Cria o pedido (ou reaproveita o da mesma chave: clique duplo/recarga) e devolve o link de acompanhamento. */
export async function iniciarPedido(d: DadosPedido): Promise<{ pedido: Pedido; token: string; novo: boolean }> {
  const c = condicao(d.condicao);
  if (!c || !sitesConfig.condicoes().includes(c.id)) throw new PedidoErro("condicao_indisponivel", 422);
  const s = sitesStore();
  if (d.chavePedido) {
    const ja = await s.byChave(d.chavePedido);
    if (ja) {
      if (ja.email !== d.email || ja.condicao !== c.id) throw new PedidoErro("pedido_divergente");
      // mesmo navegador repetindo o envio: novo token para o mesmo pedido (o anterior deixa de valer)
      const token = (await import("node:crypto")).randomBytes(24).toString("base64url");
      const p = await s.update(ja.id, { tokenHash: hashToken(token) });
      return { pedido: p, token, novo: false };
    }
  }
  try {
    const r = await s.create({
      chavePedido: d.chavePedido,
      nome: d.nome,
      email: d.email,
      whatsapp: d.whatsapp,
      condicao: c.id,
      meio: c.meio,
      parcelas: c.parcelas,
      valorParcela: c.parcela,
      total: c.total,
      utm: d.utm,
    });
    return { ...r, novo: true };
  } catch (e) {
    // corrida de dois envios com a mesma chave: o segundo reaproveita o primeiro
    if ((e as { code?: string }).code === "23505" && d.chavePedido) return iniciarPedido(d);
    throw e;
  }
}

export async function pedidoComToken(id: unknown, token: unknown): Promise<Pedido | null> {
  if (typeof id !== "string" || typeof token !== "string" || token.length < 20) return null;
  const p = await sitesStore().get(id);
  return p && p.tokenHash === hashToken(token) ? p : null;
}

const STATUS_FINAL: StatusPedido[] = ["pago", "estornado", "divergente"];

/** Gera (ou reaproveita, se ainda válido) o Pix do pedido. */
export async function pagarPix(p: Pedido): Promise<Pedido> {
  if (p.meio !== "pix") throw new PedidoErro("condicao_errada", 422);
  if (STATUS_FINAL.includes(p.status)) return p;
  const s = sitesStore();
  if (p.status === "pagamento_pendente" && p.pixCopiaCola && p.pixExpiraEm && Date.parse(p.pixExpiraEm) > Date.now() + 60_000) return p;
  const tentativa = p.tentativas + 1;
  const expira = new Date(Date.now() + sitesConfig.pixMinutos() * 60_000);
  const pay = await mpSites.criarPix({
    pedidoId: p.id,
    valor: p.total,
    descricao: PACOTE.descricao,
    email: p.email,
    nome: p.nome,
    expiraEm: expira,
    notificationUrl: sitesConfig.notificationUrl(),
    idempotencyKey: `site-${p.id}-pix-${tentativa}`,
  });
  const td = pay.point_of_interaction?.transaction_data;
  if (!td?.qr_code) throw new PedidoErro("pix_indisponivel", 502, "O Mercado Pago não devolveu o código Pix.");
  const atual = await s.update(p.id, {
    tentativas: tentativa,
    mpPaymentId: String(pay.id),
    pixCopiaCola: td.qr_code,
    pixQrBase64: td.qr_code_base64 ?? null,
    pixExpiraEm: pay.date_of_expiration ?? expira.toISOString(),
    ultimoErro: null,
  });
  return aplicarPagamento(atual, pay, "criacao");
}

export type DadosCartao = {
  token: string;
  paymentMethodId: string;
  issuerId: string | null;
  installments: number;
  payer: { email: string; identification?: { type: string; number: string } };
};

/**
 * Cobra no cartão a condição aprovada. Recusa (sem cobrar) se: o pedido não for de cartão; as parcelas do
 * formulário forem outras; já houver pagamento aprovado ou em análise; ou o Mercado Pago indicar acréscimo ao
 * comprador para essa parcela, bandeira e emissor (o total cobrado seria maior que o aprovado).
 */
export async function pagarCartao(p: Pedido, d: DadosCartao): Promise<Pedido> {
  if (p.meio !== "cartao") throw new PedidoErro("condicao_errada", 422);
  if (STATUS_FINAL.includes(p.status)) throw new PedidoErro("pedido_encerrado");
  if (p.status === "pagamento_pendente") throw new PedidoErro("pagamento_em_analise");
  if (!sitesConfig.condicoes().includes(p.condicao as never)) throw new PedidoErro("condicao_indisponivel", 422);
  if (d.installments !== p.parcelas) throw new PedidoErro("parcelas_divergentes", 422);
  if (!/^[a-z_]{2,30}$/.test(d.paymentMethodId)) throw new PedidoErro("cartao_invalido", 422);
  const custos = await mpSites.parcelamento(p.total, d.paymentMethodId, d.issuerId);
  const custo = custos.flatMap((x) => x.payer_costs ?? []).find((pc) => pc.installments === p.parcelas);
  const semAcrescimo = !!custo && Number(custo.installment_rate) === 0 && Math.abs(Number(custo.total_amount) - p.total) < 0.005;
  if (!semAcrescimo) {
    await sitesStore().update(p.id, { ultimoErro: `parcelamento ${p.parcelas}x com acréscimo ou indisponível (${d.paymentMethodId})` });
    throw new PedidoErro(
      "parcelamento_indisponivel",
      422,
      custo
        ? `Para este cartão, o Mercado Pago cobraria mais que R$ ${brl(p.total)} em ${p.parcelas}×. Nada foi cobrado. Escolha outra condição ou outro cartão.`
        : `Este cartão não aceita ${p.parcelas}× pelo Mercado Pago. Nada foi cobrado. Escolha outra condição ou outro cartão.`,
    );
  }
  const s = sitesStore();
  const tentativa = p.tentativas + 1;
  await s.update(p.id, { tentativas: tentativa });
  const pay = await mpSites.criarCartao({
    pedidoId: p.id,
    valor: p.total,
    parcelas: p.parcelas,
    descricao: PACOTE.descricao,
    token: d.token,
    paymentMethodId: d.paymentMethodId,
    issuerId: d.issuerId,
    payer: { email: d.payer.email || p.email, ...(d.payer.identification ? { identification: d.payer.identification } : {}) },
    notificationUrl: sitesConfig.notificationUrl(),
    idempotencyKey: `site-${p.id}-cartao-${tentativa}`,
  });
  const atual = await s.update(p.id, { mpPaymentId: String(pay.id) });
  return aplicarPagamento(atual, pay, "criacao");
}

/** Confere o pagamento devolvido pelo Mercado Pago contra a condição aprovada do pedido. */
function confere(p: Pedido, pay: MpPayment): { ok: true } | { ok: false; motivo: string } {
  if (pay.currency_id !== "BRL") return { ok: false, motivo: `moeda ${pay.currency_id}` };
  if (Math.abs(Number(pay.transaction_amount) - p.total) >= 0.005) return { ok: false, motivo: `valor ${pay.transaction_amount} ≠ ${p.total}` };
  const pago = pay.transaction_details?.total_paid_amount;
  if (pago != null && Number(pago) - p.total >= 0.005) return { ok: false, motivo: `total pago ${pago} > ${p.total}` };
  if (p.meio === "pix" && pay.payment_type_id && pay.payment_type_id !== "bank_transfer") return { ok: false, motivo: `meio ${pay.payment_type_id}` };
  if (p.meio === "cartao") {
    if (!["credit_card", "debit_card"].includes(pay.payment_type_id ?? "")) return { ok: false, motivo: `meio ${pay.payment_type_id}` };
    if ((pay.installments ?? 1) !== p.parcelas) return { ok: false, motivo: `parcelas ${pay.installments} ≠ ${p.parcelas}` };
  }
  return { ok: true };
}

/**
 * Aplica o estado atual de um pagamento ao pedido. Regras: aprovado e conferido → pago (uma vez); pagamento antigo
 * não rebaixa um pedido pago nem sobrescreve a tentativa mais nova; estorno/contestação do pagamento aprovado →
 * estornado. Devolve o pedido atualizado.
 */
export async function aplicarPagamento(p: Pedido, pay: MpPayment, canal: string): Promise<Pedido> {
  const s = sitesStore();
  const pid = String(pay.id);
  if (pay.external_reference && pay.external_reference !== `site:${p.id}`) throw new Error("pagamento de outro pedido");
  await s.upsertPagamento({
    id: pid,
    pedidoId: p.id,
    status: pay.status,
    statusDetail: pay.status_detail ?? null,
    meio: pay.payment_type_id ?? null,
    parcelas: pay.installments ?? null,
    valor: Number(pay.transaction_amount),
    atualizadoEm: nowIso(),
  });
  const atual = (await s.get(p.id)) ?? p;
  const doPagamentoAtual = !atual.mpPaymentId || atual.mpPaymentId === pid;

  if (pay.status === "approved") {
    if (atual.status === "pago") return atual;
    const c = confere(atual, pay);
    if (!c.ok) {
      const r = await s.update(atual.id, { status: "divergente", mpPaymentId: pid, mpStatus: pay.status, mpStatusDetail: pay.status_detail ?? null, ultimoErro: c.motivo });
      await avisar(r, "divergente", c.motivo);
      return r;
    }
    const r = await s.update(atual.id, {
      status: "pago",
      mpPaymentId: pid,
      mpStatus: pay.status,
      mpStatusDetail: pay.status_detail ?? null,
      pagoEm: pay.date_approved ?? nowIso(),
      confirmadoPor: canal,
      ultimoErro: null,
    });
    await avisar(r, "pago");
    return r;
  }
  if (["refunded", "charged_back", "in_mediation"].includes(pay.status)) {
    if (atual.mpPaymentId === pid && (atual.status === "pago" || atual.status === "divergente")) {
      const r = await s.update(atual.id, { status: "estornado", mpStatus: pay.status, mpStatusDetail: pay.status_detail ?? null });
      await avisar(r, "estornado", pay.status);
      return r;
    }
    return atual;
  }
  // daqui para baixo: estados que nunca rebaixam um pedido encerrado nem trocam a tentativa mais nova
  if (STATUS_FINAL.includes(atual.status) || !doPagamentoAtual) return atual;
  if (["pending", "in_process", "authorized"].includes(pay.status)) {
    return s.update(atual.id, { status: "pagamento_pendente", mpPaymentId: pid, mpStatus: pay.status, mpStatusDetail: pay.status_detail ?? null });
  }
  if (pay.status === "rejected") {
    return s.update(atual.id, { status: "recusado", mpPaymentId: pid, mpStatus: pay.status, mpStatusDetail: pay.status_detail ?? null, ultimoErro: pay.status_detail ?? null });
  }
  if (pay.status === "cancelled" || pay.status === "expired") {
    return s.update(atual.id, { status: "expirado", mpStatus: pay.status, mpStatusDetail: pay.status_detail ?? null, pixCopiaCola: null, pixQrBase64: null });
  }
  return s.update(atual.id, { mpStatus: pay.status, mpStatusDetail: pay.status_detail ?? null });
}

/** Notificação do Mercado Pago (ou conferência): relê o pagamento e aplica ao pedido dele. */
export async function sincronizarPagamento(paymentId: string, canal: string) {
  const pay = await mpSites.getPayment(paymentId);
  const ref = pay.external_reference ?? "";
  if (!ref.startsWith("site:")) return { ignorado: "pagamento de outra oferta" };
  const p = await sitesStore().get(ref.slice(5));
  if (!p) return { ignorado: "pedido inexistente" };
  const r = await aplicarPagamento(p, pay, canal);
  return { ok: true, status: r.status };
}

/**
 * Conferência direta (página do pedido e rotina): no máximo uma a cada `intervalo` segundos por pedido. Lê o
 * pagamento atual e, se não houver id (falha entre criar e gravar), busca pelo pedido no Mercado Pago.
 */
export async function conferirPedido(p: Pedido, canal: string, intervalo = 12): Promise<Pedido> {
  if (!["pagamento_pendente", "criado", "recusado", "expirado"].includes(p.status)) return p;
  if (p.status !== "pagamento_pendente" && p.tentativas === 0) return p;
  const s = sitesStore();
  if (!(await s.claimConferencia(p.id, intervalo))) return p;
  try {
    if (p.mpPaymentId) return await aplicarPagamento(p, await mpSites.getPayment(p.mpPaymentId), canal);
    const lista = await mpSites.buscarPorPedido(p.id);
    const melhor = lista.find((x) => x.status === "approved") ?? lista[0];
    return melhor ? await aplicarPagamento(p, melhor, canal) : p;
  } catch (e) {
    if (e instanceof MpError) return p;
    throw e;
  }
}

/** Rotina: confere os pedidos com pagamento pendente (ex.: notificação perdida). */
export async function rotinaSites(limite = 30) {
  const s = sitesStore();
  const out: { id: string; status: string }[] = [];
  for (const p of await s.pendentes(limite)) out.push({ id: p.id, status: (await conferirPedido(p, "rotina", 60)).status });
  return out;
}

/* ───────────────────────────── avisos internos (e-mail da operação) ───────────────────────────── */

function linhaWhatsapp(w: string) {
  const d = w.replace(/\D/g, "");
  const full = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return `https://wa.me/${full}`;
}

export function montarAvisoPedido(p: Pedido, tipo: "pendente" | "pago" | "estornado" | "divergente", detalhe?: string) {
  const c = condicao(p.condicao);
  const titulo = {
    pendente: "Novo pedido — pagamento pendente",
    pago: "Pagamento confirmado",
    estornado: "Pagamento estornado/contestado",
    divergente: "Pagamento aprovado com divergência (NÃO tratado como pago)",
  }[tipo];
  const subject = `Sites · ${titulo} · ${p.nome}`;
  const linhas = [
    `${titulo}`,
    "",
    `Oferta: ${PACOTE.nome} (venda avulsa)`,
    `Condição: ${c ? rotuloCondicao(c) : p.condicao} — total R$ ${brl(p.total)}`,
    `Situação: ${tipo === "pago" ? "PAGO (confirmado pelo Mercado Pago)" : tipo === "pendente" ? "pagamento ainda NÃO confirmado" : tipo}`,
    detalhe ? `Detalhe: ${detalhe}` : "",
    "",
    `Nome: ${p.nome}`,
    `E-mail: ${p.email}`,
    `WhatsApp: ${p.whatsapp} — ${linhaWhatsapp(p.whatsapp)}`,
    "",
    `Pedido: ${p.id}`,
    p.mpPaymentId ? `Pagamento no Mercado Pago: ${p.mpPaymentId}` : "",
    `Criado em: ${new Date(p.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    Object.keys(p.utm ?? {}).length ? `Origem: ${Object.entries(p.utm).map(([k, v]) => `${k}=${v}`).join(" ")}` : "",
    "",
    tipo === "pago"
      ? "Próximo passo: falar com o comprador pelo WhatsApp para reunir informações e materiais. O prazo de 5 dias úteis da primeira versão conta a partir do recebimento de tudo."
      : tipo === "pendente"
        ? "Nada foi cobrado ainda. Se o pagamento for confirmado, chega outro aviso."
        : "",
  ];
  return { subject, text: linhas.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n") };
}

/** Um aviso por tipo e pedido (reserva no banco + chave de idempotência no provedor de e-mail). */
export async function avisar(p: Pedido, tipo: "pendente" | "pago" | "estornado" | "divergente", detalhe?: string) {
  const s = sitesStore();
  const campo = tipo === "pendente" ? "avisoPendenteEm" : tipo === "pago" ? "avisoPagoEm" : null;
  if (campo && !(await s.claimAviso(p.id, campo))) return { ok: true, ja: true };
  const m = montarAvisoPedido(p, tipo, detalhe);
  const r = await sendInternalEmail({ ...m, idempotencyKey: `site-${tipo}-${p.id}` });
  if (!r.ok) {
    console.warn(`[sites-pacote] aviso ${tipo} do pedido ${p.id} não enviado (${r.erro})`);
    if (campo && r.erro !== "e-mail não configurado") await s.releaseAviso(p.id, campo);
  }
  return r;
}

/** Aviso de pedido novo, rodado depois da resposta: não envia se o pedido já estiver pago (vai só o de pago). */
export async function avisoPedidoNovo(id: string) {
  const p = await sitesStore().get(id);
  if (!p || p.status === "pago" || p.utm?.validacao === "interna") return;
  await avisar(p, "pendente");
}

/* ───────────────────────────── estado público (página do pedido) ───────────────────────────── */

export function estadoPublico(p: Pedido) {
  const c = condicao(p.condicao);
  return {
    id: p.id,
    status: p.status,
    condicao: p.condicao,
    rotulo: c ? rotuloCondicao(c) : p.condicao,
    meio: p.meio,
    parcelas: p.parcelas,
    parcela: p.valorParcela,
    total: p.total,
    nome: p.nome.split(" ")[0],
    whatsapp: p.whatsapp,
    pix:
      p.meio === "pix" && p.status === "pagamento_pendente" && p.pixCopiaCola
        ? { copiaCola: p.pixCopiaCola, qrBase64: p.pixQrBase64, expiraEm: p.pixExpiraEm }
        : null,
    motivoRecusa: p.status === "recusado" ? mensagemRecusa(p.mpStatusDetail) : null,
    interna: p.utm?.validacao === "interna",
  };
}

/** Mensagens para o comprador a partir do status_detail do Mercado Pago (sem expor códigos internos). */
export function mensagemRecusa(detail: string | null) {
  const m: Record<string, string> = {
    cc_rejected_insufficient_amount: "O cartão não tem limite suficiente para este valor.",
    cc_rejected_bad_filled_security_code: "O código de segurança do cartão não confere.",
    cc_rejected_bad_filled_date: "A data de validade do cartão não confere.",
    cc_rejected_bad_filled_other: "Algum dado do cartão não confere.",
    cc_rejected_call_for_authorize: "O banco pediu autorização para este pagamento. Fale com o banco e tente de novo.",
    cc_rejected_card_disabled: "O cartão está desativado. Fale com o banco ou use outro cartão.",
    cc_rejected_duplicated_payment: "Já existe um pagamento igual recente neste cartão.",
    cc_rejected_high_risk: "O pagamento foi recusado pela análise de segurança. Tente outro cartão ou o Pix.",
    cc_rejected_max_attempts: "Muitas tentativas com este cartão. Use outro cartão ou o Pix.",
  };
  return (detail && m[detail]) || "O pagamento não foi aprovado. Nada foi cobrado. Confira os dados ou tente outro cartão ou o Pix.";
}
