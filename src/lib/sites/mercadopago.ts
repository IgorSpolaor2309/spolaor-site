import { sitesConfig } from "./config";

// Cliente mínimo do Mercado Pago para a venda avulsa do pacote de sites: Checkout Transparente via API de Orders
// (POST /v1/orders), o caminho atual recomendado pelo Mercado Pago e o único que aceita as credenciais de teste que o
// painel gera hoje (usuário de teste vendedor). A assinatura de IA continua na API dela (/preapproval), sem mudança.
// - Pix: order com payment_method pix/bank_transfer; o QR Code é exibido no próprio site;
// - cartão: o formulário seguro do Mercado Pago (Card Payment Brick) gera o token no navegador; o servidor cria a
//   order com o VALOR e as PARCELAS da condição aprovada (nunca os do navegador);
// - antes de cobrar no cartão, o servidor consulta GET /v1/payment_methods/installments e só segue se a parcela
//   escolhida não tiver acréscimo para o comprador (installment_rate 0 e total_amount = total aprovado);
// - notificações: tópico "Order (Mercado Pago)" configurado no painel (Orders não aceita URL por pedido).
// Só o servidor usa o Access Token. Nenhum dado de cartão passa pelo nosso servidor (só o token de uso único).

/** Referência do pedido no Mercado Pago (Orders aceita só letras, números, "-" e "_"). */
export const refPedido = (pedidoId: string) => `site_${pedidoId}`;
export const pedidoDaRef = (ref: string | null | undefined) => (ref && ref.startsWith("site_") ? ref.slice(5) : null);

type MpOrderPayment = {
  id: string;
  amount?: string;
  paid_amount?: string;
  status?: string;
  status_detail?: string;
  date_of_expiration?: string;
  payment_method?: {
    id?: string;
    type?: string;
    installments?: number;
    installment_amount?: string;
    qr_code?: string;
    qr_code_base64?: string;
    ticket_url?: string;
  };
};
export type MpOrder = {
  id: string;
  status: string; // created | processing | action_required | processed | failed | canceled | expired | refunded | charged_back | in_review
  status_detail?: string;
  external_reference?: string;
  total_amount: string;
  total_paid_amount?: string;
  currency?: string;
  created_date?: string;
  last_updated_date?: string;
  transactions?: { payments?: MpOrderPayment[] };
};

/**
 * Estado de uma order em termos de pagamento, o formato que as regras do pedido usam. `status` segue os nomes
 * clássicos (approved, pending, in_process, rejected, cancelled, expired, refunded, charged_back); `id` é o id
 * da order (ORD…), que é o que as notificações trazem.
 */
export type MpPayment = {
  id: string;
  status: string;
  status_detail: string | null;
  transaction_amount: number;
  currency_id: string;
  installments: number | null;
  payment_method_id: string | null;
  payment_type_id: string | null; // credit_card | debit_card | bank_transfer (pix)
  external_reference: string | null;
  date_approved: string | null;
  date_of_expiration: string | null;
  total_paid_amount: number | null;
  qr_code: string | null;
  qr_code_base64: string | null;
};

export type PayerCost = { installments: number; installment_rate: number; installment_amount: number; total_amount: number };

export class MpError extends Error {
  constructor(
    public status: number,
    message: string,
    public causes: string[] = [],
    /** order devolvida junto com o erro (ex.: HTTP 402 de cartão recusado traz a order em "data") */
    public ordem: MpOrder | null = null,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string, attempt = 0): Promise<T> {
  const res = await fetch(`${sitesConfig.mpApi()}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${sitesConfig.mpToken()}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  }).catch((e: Error) => {
    // só o tipo do erro: a mensagem do fetch pode repetir cabeçalhos
    throw new MpError(503, `Falha de rede ao chamar o Mercado Pago em ${method} ${path.split("?")[0]} (${e.name})`);
  });
  if ((res.status === 429 || res.status === 423) && attempt < 2) {
    const wait = Math.min(5, Number(res.headers.get("retry-after")) || attempt + 1) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return call<T>(method, path, body, idempotencyKey, attempt + 1);
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      errors?: { code?: string; message?: string; details?: string[] }[];
      cause?: { code?: string | number }[];
      data?: MpOrder;
    };
    const mask = (s?: string) => (s ?? "").replace(/[^\s@,;:"']+@[^\s@,;:"']+/g, "<e-mail>").replace(/https?:\/\/\S+/g, "<url>").slice(0, 200);
    const erros = Array.isArray(err.errors) ? err.errors : [];
    const causes = [...erros.map((e) => `${e.code ?? ""}`), ...(Array.isArray(err.cause) ? err.cause.map((c) => `${c.code ?? ""}`) : [])].filter(Boolean);
    const texto = err.message || err.error || erros.map((e) => [e.code, e.message, ...(e.details ?? [])].filter(Boolean).join(": ")).join("; ");
    const ordem = err.data && typeof err.data === "object" && typeof err.data.id === "string" ? err.data : null;
    throw new MpError(res.status, `Mercado Pago respondeu HTTP ${res.status} em ${method} ${path.split("?")[0]}: ${mask(texto)}`, causes, ordem);
  }
  return (await res.json()) as T;
}

const STATUS: Record<string, string> = {
  processed: "approved",
  action_required: "pending",
  created: "pending",
  processing: "in_process",
  in_review: "in_process",
  failed: "rejected",
  canceled: "cancelled",
  cancelled: "cancelled",
  expired: "expired",
  refunded: "refunded",
  charged_back: "charged_back",
};

/** Converte a order do Mercado Pago no estado de pagamento usado pelas regras do pedido. */
export function normalizarOrdem(o: MpOrder): MpPayment {
  const t = o.transactions?.payments?.[0];
  let status = STATUS[o.status] ?? o.status;
  if (o.status === "canceled" && (o.status_detail === "expired" || t?.status === "expired")) status = "expired";
  if (o.status === "failed" && o.status_detail === "expired") status = "expired";
  const detalhe = t?.status_detail && t.status_detail !== o.status ? t.status_detail : (o.status_detail ?? null);
  return {
    id: o.id,
    status,
    status_detail: detalhe,
    transaction_amount: Number(o.total_amount),
    currency_id: o.currency ?? "BRL",
    installments: t?.payment_method?.installments ?? (t?.payment_method?.type === "bank_transfer" ? 1 : null),
    payment_method_id: t?.payment_method?.id ?? null,
    payment_type_id: t?.payment_method?.type ?? null,
    external_reference: o.external_reference ?? null,
    date_approved: o.status === "processed" ? (o.last_updated_date ?? null) : null,
    date_of_expiration: t?.date_of_expiration ?? null,
    total_paid_amount: o.total_paid_amount != null ? Number(o.total_paid_amount) : null,
    qr_code: t?.payment_method?.qr_code ?? null,
    qr_code_base64: t?.payment_method?.qr_code_base64 || null,
  };
}

const valorTexto = (v: number) => v.toFixed(2);

export const mpSites = {
  criarPix: (p: { pedidoId: string; valor: number; descricao: string; email: string; nome: string; minutos: number; idempotencyKey: string }) =>
    call<MpOrder>(
      "POST",
      "/v1/orders",
      {
        type: "online",
        processing_mode: "automatic",
        total_amount: valorTexto(p.valor),
        external_reference: refPedido(p.pedidoId),
        description: p.descricao,
        payer: { email: p.email, first_name: p.nome.split(" ")[0].slice(0, 40) },
        transactions: {
          payments: [{ amount: valorTexto(p.valor), payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: `PT${p.minutos}M` }],
        },
      },
      p.idempotencyKey,
    ).then(normalizarOrdem),
  criarCartao: (p: {
    pedidoId: string;
    valor: number;
    parcelas: number;
    descricao: string;
    token: string;
    paymentMethodId: string;
    paymentTypeId: "credit_card" | "debit_card";
    payer: { email: string; identification?: { type: string; number: string } };
    idempotencyKey: string;
  }) =>
    call<MpOrder>(
      "POST",
      "/v1/orders",
      {
        type: "online",
        processing_mode: "automatic",
        total_amount: valorTexto(p.valor),
        external_reference: refPedido(p.pedidoId),
        description: p.descricao,
        payer: p.payer,
        transactions: {
          payments: [
            {
              amount: valorTexto(p.valor),
              payment_method: { id: p.paymentMethodId, type: p.paymentTypeId, token: p.token, installments: p.parcelas, statement_descriptor: "SPOLAOR" },
            },
          ],
        },
      },
      p.idempotencyKey,
    ).then(normalizarOrdem),
  getOrdem: (id: string) => call<MpOrder>("GET", `/v1/orders/${encodeURIComponent(id)}`).then(normalizarOrdem),
  /** Orders de um pedido (referência externa), da mais recente para a mais antiga. A busca exige um período. */
  buscarPorPedido: async (pedidoId: string, criadoEm: string) => {
    const ini = new Date(Date.parse(criadoEm) - 86400_000).toISOString();
    const fim = new Date(Date.now() + 86400_000).toISOString();
    const r = await call<{ data?: MpOrder[]; results?: MpOrder[]; elements?: MpOrder[] }>(
      "GET",
      `/v1/orders?external_reference=${encodeURIComponent(refPedido(pedidoId))}&begin_date=${encodeURIComponent(ini)}&end_date=${encodeURIComponent(fim)}`,
    );
    const lista = r.data ?? r.results ?? r.elements ?? [];
    return lista
      .filter((o) => o.external_reference === refPedido(pedidoId))
      .sort((a, b) => Date.parse(b.created_date ?? "") - Date.parse(a.created_date ?? ""))
      .map(normalizarOrdem);
  },
  /** Custos de parcelamento para este valor, bandeira e emissor (o que o comprador pagaria em cada parcela). */
  parcelamento: (valor: number, paymentMethodId: string, issuerId: string | null) =>
    call<{ payer_costs?: PayerCost[] }[]>(
      "GET",
      `/v1/payment_methods/installments?amount=${valor.toFixed(2)}&payment_method_id=${encodeURIComponent(paymentMethodId)}${issuerId ? `&issuer.id=${encodeURIComponent(issuerId)}` : ""}`,
    ),
  /** Cancela uma order ainda não paga (ex.: Pix vencido substituído por outro). */
  cancelar: (id: string, idempotencyKey: string) => call<MpOrder>("POST", `/v1/orders/${encodeURIComponent(id)}/cancel`, undefined, idempotencyKey).then(normalizarOrdem),
};
