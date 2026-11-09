import { sitesConfig } from "./config";

// Cliente mínimo do Mercado Pago para a venda avulsa do pacote de sites (Checkout Transparente):
// - Pix: POST /v1/payments com payment_method_id "pix" (QR Code exibido no próprio site);
// - cartão: o formulário seguro do Mercado Pago (Card Payment Brick) gera o token no navegador; o servidor cria o
//   pagamento com o VALOR e as PARCELAS da condição aprovada (nunca os do navegador);
// - antes de cobrar no cartão, o servidor consulta GET /v1/payment_methods/installments e só segue se a parcela
//   escolhida não tiver acréscimo para o comprador (installment_rate 0 e total_amount = total aprovado).
// Só o servidor usa o Access Token. Nenhum dado de cartão passa pelo nosso servidor (só o token de uso único).

export type MpPayment = {
  id: number | string;
  status: string; // pending | in_process | authorized | approved | rejected | cancelled | refunded | charged_back | in_mediation
  status_detail?: string | null;
  transaction_amount: number;
  currency_id: string;
  installments?: number | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null; // credit_card | debit_card | bank_transfer (pix) ...
  external_reference?: string | null;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  transaction_details?: { total_paid_amount?: number | null; installment_amount?: number | null } | null;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } } | null;
};

export type PayerCost = { installments: number; installment_rate: number; installment_amount: number; total_amount: number };

export class MpError extends Error {
  constructor(
    public status: number,
    message: string,
    public causes: string[] = [],
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
  if (res.status === 429 && attempt < 2) {
    const wait = Math.min(5, Number(res.headers.get("retry-after")) || attempt + 1) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return call<T>(method, path, body, idempotencyKey, attempt + 1);
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string; cause?: { code?: string | number; description?: string }[] };
    const mask = (s?: string) => (s ?? "").replace(/[^\s@,;:"']+@[^\s@,;:"']+/g, "<e-mail>").replace(/https?:\/\/\S+/g, "<url>").slice(0, 160);
    const causes = (Array.isArray(err.cause) ? err.cause : []).map((c) => `${c.code ?? ""}`.trim()).filter(Boolean);
    throw new MpError(res.status, `Mercado Pago respondeu HTTP ${res.status} em ${method} ${path.split("?")[0]}: ${mask(err.message || err.error)}`, causes);
  }
  return (await res.json()) as T;
}

/** "2026-11-10T13:45:00.000-03:00": formato de data com fuso exigido em date_of_expiration. */
export function dataComFuso(d: Date) {
  const br = new Date(d.getTime() - 3 * 3600 * 1000); // horário de Brasília (sem horário de verão desde 2019)
  return `${br.toISOString().slice(0, 23)}-03:00`;
}

export const mpSites = {
  criarPix: (p: { pedidoId: string; valor: number; descricao: string; email: string; nome: string; expiraEm: Date; notificationUrl: string | null; idempotencyKey: string }) =>
    call<MpPayment>(
      "POST",
      "/v1/payments",
      {
        transaction_amount: p.valor,
        description: p.descricao,
        payment_method_id: "pix",
        external_reference: `site:${p.pedidoId}`,
        date_of_expiration: dataComFuso(p.expiraEm),
        payer: { email: p.email, first_name: p.nome.split(" ")[0].slice(0, 40) },
        metadata: { pedido_id: p.pedidoId, oferta: "site-uma-pagina" },
        ...(p.notificationUrl ? { notification_url: p.notificationUrl } : {}),
      },
      p.idempotencyKey,
    ),
  criarCartao: (p: {
    pedidoId: string;
    valor: number;
    parcelas: number;
    descricao: string;
    token: string;
    paymentMethodId: string;
    issuerId: string | null;
    payer: { email: string; identification?: { type: string; number: string } };
    notificationUrl: string | null;
    idempotencyKey: string;
  }) =>
    call<MpPayment>(
      "POST",
      "/v1/payments",
      {
        transaction_amount: p.valor,
        token: p.token,
        description: p.descricao,
        installments: p.parcelas,
        payment_method_id: p.paymentMethodId,
        ...(p.issuerId ? { issuer_id: Number(p.issuerId) || p.issuerId } : {}),
        payer: p.payer,
        external_reference: `site:${p.pedidoId}`,
        statement_descriptor: "SPOLAOR",
        metadata: { pedido_id: p.pedidoId, oferta: "site-uma-pagina" },
        ...(p.notificationUrl ? { notification_url: p.notificationUrl } : {}),
      },
      p.idempotencyKey,
    ),
  getPayment: (id: string) => call<MpPayment>("GET", `/v1/payments/${encodeURIComponent(id)}`),
  /** Pagamentos de um pedido (external_reference), do mais recente para o mais antigo. */
  buscarPorPedido: (pedidoId: string) =>
    call<{ results?: MpPayment[] }>("GET", `/v1/payments/search?external_reference=${encodeURIComponent(`site:${pedidoId}`)}&sort=date_created&criteria=desc&limit=10`).then((r) => r.results ?? []),
  /** Custos de parcelamento para este valor, bandeira e emissor (o que o comprador pagaria em cada parcela). */
  parcelamento: (valor: number, paymentMethodId: string, issuerId: string | null) =>
    call<{ payer_costs?: PayerCost[] }[]>(
      "GET",
      `/v1/payment_methods/installments?amount=${valor.toFixed(2)}&payment_method_id=${encodeURIComponent(paymentMethodId)}${issuerId ? `&issuer.id=${encodeURIComponent(issuerId)}` : ""}`,
    ),
  cancelar: (id: string) => call<MpPayment>("PUT", `/v1/payments/${encodeURIComponent(id)}`, { status: "cancelled" }),
};
