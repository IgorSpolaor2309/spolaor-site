import { sendInternalEmail } from "@/lib/ia/notify";
import { sitesConfig } from "./config";
import { MpError, mpSites, normalizarOrdem, pedidoDaRef, refPedido, type MpPayment } from "./mercadopago";
import { brl, condicao, PACOTE, rotuloCondicao } from "./oferta";
import { hashToken, sitesStore, type Pedido, type StatusPedido } from "./store";

// Regras da venda avulsa do pacote de sites. Nada aqui libera serviço automaticamente: o pedido pago vira um aviso
// interno para a Spolaor falar com o comprador pelo WhatsApp. Pagamento só conta como confirmado quando o Mercado
// Pago devolve a order PROCESSADA (aprovada) com o valor, a moeda e as parcelas da condição aprovada.
// `mpPaymentId` guarda o id da order do Mercado Pago (ORD…), que é o que as notificações trazem.

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
    minutos: sitesConfig.pixMinutos(),
    idempotencyKey: `site-${p.id}-pix-${tentativa}`,
  });
  if (!pay.qr_code) throw new PedidoErro("pix_indisponivel", 502, "O Mercado Pago não devolveu o código Pix.");
  const atual = await s.update(p.id, {
    tentativas: tentativa,
    mpPaymentId: String(pay.id),
    pixCopiaCola: pay.qr_code,
    pixQrBase64: pay.qr_code_base64 ?? null,
    pixExpiraEm: pay.date_of_expiration ?? expira.toISOString(),
    ultimoErro: null,
  });
  return aplicarPagamento(atual, pay, "criacao");
}

export type DadosCartao = {
  token: string;
  paymentMethodId: string;
  /** tipo informado pelo formulário do Mercado Pago (additionalData.paymentTypeId) */
  paymentTypeId: "credit_card" | "debit_card";
  issuerId: string | null;
  installments: number;
  payer: { email: string; identification?: { type: string; number: string } };
};

/** Tentativa "em_curso" sem resposta há mais que isto é tratada como incerta (a chamada ao Mercado Pago tem limite
 * de 15 s e até 2 novas tentativas em 429/423). */
const TENTATIVA_PARADA_SEG = 90;

/**
 * Falhas em que a cobrança pode ter sido criada: rede/timeout, 5xx, 409 (chave de idempotência já usada: a tentativa
 * anterior chegou ao Mercado Pago), 423, 429 e qualquer falha nossa depois de chamar. Recusa com a order devolvida
 * (402) e erros de validação (400/401/403/404/422) são definitivos: a order não foi criada ou foi recusada.
 */
function resultadoIncerto(e: unknown) {
  if (!(e instanceof MpError)) return true;
  if (e.ordem) return false;
  return e.status >= 500 || e.status === 408 || e.status === 409 || e.status === 423 || e.status === 429;
}

/** A order desta tentativa no Mercado Pago, se existir: a mais nova que ainda não está no histórico do pedido. */
async function ordemNovaDoPedido(p: Pedido): Promise<MpPayment | null> {
  const conhecidas = new Set((await sitesStore().pagamentos(p.id)).map((x) => x.id));
  const lista = (await mpSites.buscarPorPedido(p.id, p.criadoEm)).filter((o) => !conhecidas.has(String(o.id)));
  return lista.find((x) => x.status === "approved") ?? lista[0] ?? null;
}

/** Associa a order à tentativa (fecha a tentativa) e aplica o estado dela ao pedido. */
async function adotarOrdem(p: Pedido, pay: MpPayment, canal: string) {
  const atual = await sitesStore().update(p.id, { mpPaymentId: String(pay.id), tentativaEstado: null });
  return aplicarPagamento(atual, pay, canal);
}

/** Resultado desconhecido: o comprador vê "pagamento em verificação" (não "nada foi cobrado"); a tentativa fica com a
 * mesma chave para ser conciliada ou retomada. */
async function marcarIncerta(p: Pedido, e: unknown) {
  const msg = (e as Error)?.message ?? String(e);
  console.warn(`[sites-pacote] resultado desconhecido na cobrança do pedido ${p.id}: ${msg}`);
  return sitesStore().update(p.id, { status: "pagamento_pendente", tentativaEstado: "incerta", ultimoErro: `resultado desconhecido: ${msg.slice(0, 160)}` });
}

/**
 * Cobra no cartão a condição aprovada. Recusa (sem cobrar) se: o pedido não for de cartão; as parcelas do
 * formulário forem outras; já houver pagamento aprovado ou em análise; ou o Mercado Pago indicar acréscimo ao
 * comprador para essa parcela, bandeira e emissor (o total cobrado seria maior que o aprovado).
 *
 * Proteção contra cobrança dupla (no servidor e no banco, não no botão):
 * 1. A tentativa é reservada no banco ANTES de chamar o Mercado Pago (abrirTentativaCartao: um UPDATE com a linha
 *    travada). Duas submissões ao mesmo pedido nunca abrem tentativas independentes: a segunda recebe 409.
 * 2. A chave de idempotência é a da tentativa e fica gravada. Se a resposta da criação se perder, a tentativa fica
 *    "incerta" e o comprador vê "pagamento em verificação". Uma nova submissão retoma A MESMA tentativa: primeiro
 *    procura a order no Mercado Pago (referência do pedido); se não achar, cria com a MESMA chave. O Mercado Pago
 *    devolve a mesma order (mesmo corpo) ou 409 (a chave já gerou uma order), e nunca cria uma segunda.
 * 3. Recusa definitiva (402 com a order "failed") fecha a tentativa: a próxima abre outra, com chave nova.
 */
export async function pagarCartao(p: Pedido, d: DadosCartao): Promise<Pedido> {
  if (p.meio !== "cartao") throw new PedidoErro("condicao_errada", 422);
  if (STATUS_FINAL.includes(p.status)) throw new PedidoErro("pedido_encerrado");
  if (p.status === "pagamento_pendente" && !p.tentativaEstado) throw new PedidoErro("pagamento_em_analise");
  if (!sitesConfig.condicoes().includes(p.condicao as never)) throw new PedidoErro("condicao_indisponivel", 422);
  if (d.installments !== p.parcelas) throw new PedidoErro("parcelas_divergentes", 422);
  if (!/^[a-z_]{2,30}$/.test(d.paymentMethodId)) throw new PedidoErro("cartao_invalido", 422);
  if (d.paymentTypeId === "debit_card" && p.parcelas > 1)
    throw new PedidoErro("parcelas_divergentes", 422, "Cartão de débito só aceita pagamento à vista. Escolha cartão de crédito ou outra condição.");
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
  const t = await s.abrirTentativaCartao(p.id, TENTATIVA_PARADA_SEG);
  if (!t) {
    const atual = (await s.get(p.id)) ?? p;
    if (STATUS_FINAL.includes(atual.status)) throw new PedidoErro("pedido_encerrado");
    if (atual.tentativaEstado === "em_curso")
      throw new PedidoErro(
        "pagamento_em_andamento",
        409,
        "Já existe um pagamento deste pedido sendo processado. Não pague de novo: o resultado aparece nesta página em instantes.",
      );
    throw new PedidoErro("pagamento_em_analise");
  }
  try {
    // retomada de tentativa incerta: a order pode já existir (a resposta é que se perdeu)
    if (t.retomada) {
      const achada = await ordemNovaDoPedido(t.pedido).catch(() => null);
      if (achada) return await adotarOrdem(t.pedido, achada, "conciliacao");
    }
    let pay: MpPayment;
    try {
      pay = await mpSites.criarCartao({
        pedidoId: p.id,
        valor: p.total,
        parcelas: p.parcelas,
        descricao: PACOTE.descricao,
        token: d.token,
        paymentMethodId: d.paymentMethodId,
        paymentTypeId: d.paymentTypeId,
        payer: { email: d.payer.email || p.email, ...(d.payer.identification ? { identification: d.payer.identification } : {}) },
        idempotencyKey: t.chave,
      });
    } catch (e) {
      // cartão recusado: o Mercado Pago responde HTTP 402 com a order "failed" no corpo; vira pedido recusado
      if (e instanceof MpError && e.ordem) pay = normalizarOrdem(e.ordem);
      else if (resultadoIncerto(e)) return await marcarIncerta(t.pedido, e);
      else {
        // erro de validação: a order não foi criada → fecha a tentativa, pode tentar de novo
        await s.update(p.id, { tentativaEstado: null, ultimoErro: (e as Error).message.slice(0, 200) });
        throw e;
      }
    }
    return await adotarOrdem(t.pedido, pay, "criacao");
  } catch (e) {
    if (e instanceof MpError || e instanceof PedidoErro) throw e;
    // falha nossa no meio do caminho (ex.: banco depois de criar a order): não dá para afirmar se cobrou
    return marcarIncerta(t.pedido, e).catch(() => {
      throw e;
    });
  }
}

/** Confere a order devolvida pelo Mercado Pago contra a condição aprovada do pedido. */
function confere(p: Pedido, pay: MpPayment): { ok: true } | { ok: false; motivo: string } {
  if (pay.currency_id !== "BRL") return { ok: false, motivo: `moeda ${pay.currency_id}` };
  if (Math.abs(Number(pay.transaction_amount) - p.total) >= 0.005) return { ok: false, motivo: `valor ${pay.transaction_amount} ≠ ${p.total}` };
  const pago = pay.total_paid_amount;
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
  if (pay.external_reference && pay.external_reference !== refPedido(p.id)) throw new Error("pagamento de outro pedido");
  const conhecida = (await s.pagamentos(p.id)).some((x) => x.id === pid);
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
  let atual = (await s.get(p.id)) ?? p;
  // Order que o pedido ainda não conhecia durante uma tentativa aberta ou incerta (ex.: a resposta da criação se
  // perdeu e a notificação chegou antes): é a order dessa tentativa → passa a ser a atual e fecha a tentativa.
  if (atual.tentativaEstado && !conhecida && atual.mpPaymentId !== pid) atual = await s.update(atual.id, { mpPaymentId: pid, tentativaEstado: null });
  const doPagamentoAtual = atual.mpPaymentId === pid || (!atual.mpPaymentId && !atual.tentativaEstado);

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
      tentativaEstado: null,
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

/** Notificação do Mercado Pago (ou conferência): relê a order e aplica ao pedido dela. */
export async function sincronizarPagamento(ordemId: string, canal: string) {
  const pay = await mpSites.getOrdem(ordemId);
  const pedidoId = pedidoDaRef(pay.external_reference);
  if (!pedidoId) return { ignorado: "order de outra oferta" };
  const p = await sitesStore().get(pedidoId);
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
    // tentativa incerta (ou parada): procura a order dela no Mercado Pago; sem order depois de incertaLiberaSeg (15 min),
    // a tentativa não chegou lá → nada foi cobrado e o comprador pode tentar de novo
    const parada = p.tentativaEstado === "em_curso" && !!p.tentativaEm && Date.now() - Date.parse(p.tentativaEm) > TENTATIVA_PARADA_SEG * 1000;
    if (p.tentativaEstado === "incerta" || parada) {
      const achada = await ordemNovaDoPedido(p);
      if (achada) return await adotarOrdem(p, achada, canal);
      if (p.tentativaEm && Date.now() - Date.parse(p.tentativaEm) > sitesConfig.incertaLiberaSeg() * 1000)
        return await s.update(p.id, { status: "recusado", tentativaEstado: null, mpStatusDetail: "tentativa_sem_cobranca", ultimoErro: "tentativa sem order no Mercado Pago" });
      return p;
    }
    if (p.mpPaymentId) return await aplicarPagamento(p, await mpSites.getOrdem(p.mpPaymentId), canal);
    const lista = await mpSites.buscarPorPedido(p.id, p.criadoEm);
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
    // não dá para afirmar se houve cobrança (resposta perdida, tentativa em andamento): a página mostra
    // "pagamento em verificação" e não oferece nova cobrança
    emVerificacao: p.meio === "cartao" && !!p.tentativaEstado && p.status !== "pago",
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
    // status_detail das transações da API de Orders
    insufficient_amount: "O cartão não tem limite suficiente para este valor.",
    card_insufficient_amount: "O cartão não tem limite suficiente para este valor.",
    amount_limit_exceeded: "O valor passa do limite do cartão. Tente outro cartão ou o Pix.",
    bad_filled_card_data: "Algum dado do cartão não confere.",
    required_call_for_authorize: "O banco pediu autorização para este pagamento. Fale com o banco e tente de novo.",
    card_disabled: "O cartão está desativado. Fale com o banco ou use outro cartão.",
    high_risk: "O pagamento foi recusado pela análise de segurança. Tente outro cartão ou o Pix.",
    max_attempts_exceeded: "Muitas tentativas com este cartão. Use outro cartão ou o Pix.",
    invalid_installments: "Este cartão não aceita essa quantidade de parcelas. Escolha outra condição ou outro cartão.",
    rejected_by_issuer: "O banco emissor recusou o pagamento. Nada foi cobrado. Tente outro cartão ou o Pix.",
    tentativa_sem_cobranca: "A tentativa anterior não chegou a ser registrada no Mercado Pago, e nada foi cobrado. Você pode tentar de novo.",
  };
  return (detail && m[detail]) || "O pagamento não foi aprovado. Nada foi cobrado. Confira os dados ou tente outro cartão ou o Pix.";
}
