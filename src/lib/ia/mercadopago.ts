import { iaConfig } from "./config";

// Cliente mínimo da API do Mercado Pago (Assinaturas sem plano associado, com pagamento
// pendente: o cliente informa o cartão no checkout hospedado do Mercado Pago, pelo init_point).
// Só o servidor chama esta API, com o Access Token. A Public Key não é usada.

export type Preapproval = {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  external_reference?: string;
  payer_email?: string;
  init_point?: string;
  next_payment_date?: string;
  auto_recurring?: { frequency: number; frequency_type: string; transaction_amount: number; currency_id: string };
};

export type AuthorizedPayment = {
  id: number | string;
  preapproval_id: string;
  status: string; // scheduled | processed | recycling | cancelled ...
  transaction_amount: number;
  currency_id: string;
  debit_date?: string;
  date_created?: string;
  external_reference?: string;
  payment?: { id: number | string; status: string; status_detail?: string } | null;
};

export type Payment = {
  id: number | string;
  status: string;
  transaction_amount: number;
  currency_id: string;
  date_approved?: string | null;
  external_reference?: string | null;
  metadata?: { preapproval_id?: string } | null;
  point_of_interaction?: { transaction_data?: { subscription_id?: string } } | null;
};

export class MpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string, attempt = 0): Promise<T> {
  const res = await fetch(`${iaConfig.mpApi()}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${iaConfig.mpToken()}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  // Limite de requisições (429): até 2 novas tentativas, respeitando Retry-After (máx. 5 s cada).
  if (res.status === 429 && attempt < 2) {
    const wait = Math.min(5, Number(res.headers.get("retry-after")) || attempt + 1) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return call<T>(method, path, body, idempotencyKey, attempt + 1);
  }
  if (!res.ok) {
    // Só o motivo do erro (message e códigos de cause), com e-mails e URLs mascarados: nunca o corpo inteiro.
    const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string; cause?: { code?: string | number; description?: string }[] };
    const mask = (s?: string) => (s ?? "").replace(/[^\s@,;:"']+@[^\s@,;:"']+/g, "<e-mail>").replace(/https?:\/\/\S+/g, "<url>").slice(0, 160);
    const causes = (Array.isArray(err.cause) ? err.cause : []).map((c) => `${c.code ?? ""} ${mask(c.description)}`.trim()).join(" | ");
    throw new MpError(res.status, `Mercado Pago respondeu HTTP ${res.status} em ${method} ${path.split("?")[0]}: ${mask(err.message || err.error)}${causes ? ` [${causes}]` : ""}`);
  }
  return (await res.json()) as T;
}

export const mp = {
  createPreapproval: (p: { reason: string; externalReference: string; payerEmail: string; amount: number; backUrl: string }) => {
    const f = iaConfig.frequency();
    return call<Preapproval>(
      "POST",
      "/preapproval",
      {
        reason: p.reason,
        external_reference: p.externalReference,
        payer_email: p.payerEmail,
        back_url: p.backUrl,
        status: "pending",
        ...(iaConfig.mpNotificationUrl() ? { notification_url: iaConfig.mpNotificationUrl() } : {}),
        auto_recurring: { frequency: f.frequency, frequency_type: f.frequencyType, transaction_amount: p.amount, currency_id: "BRL" },
      },
      `preapproval-${p.externalReference}`,
    );
  },
  getPreapproval: (id: string) => call<Preapproval>("GET", `/preapproval/${encodeURIComponent(id)}`),
  setPreapprovalStatus: (id: string, status: "paused" | "cancelled" | "authorized") =>
    call<Preapproval>("PUT", `/preapproval/${encodeURIComponent(id)}`, { status }),
  getAuthorizedPayment: (id: string) => call<AuthorizedPayment>("GET", `/authorized_payments/${encodeURIComponent(id)}`),
  getPayment: (id: string) => call<Payment>("GET", `/v1/payments/${encodeURIComponent(id)}`),
  /** Cobranças de uma assinatura (GET /authorized_payments/search). Parâmetros a confirmar no teste. */
  searchAuthorizedPayments: (preapprovalId: string) =>
    call<{ results?: AuthorizedPayment[] }>("GET", `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`).then((r) => r.results ?? []),
  getChargeback: (id: string) => call<{ id: string; payments?: (number | string)[] }>("GET", `/v1/chargebacks/${encodeURIComponent(id)}`),
};
