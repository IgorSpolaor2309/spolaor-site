import { iaConfig } from "./config";

// API de provisionamento do ZappMillion (modalidade Cartão e API). Cada criação cobra o primeiro
// mês no cartão da agência; o externalId é a chave de idempotência (repetir devolve o mesmo
// cliente com HTTP 200, sem nova cobrança). Limite: 60 requisições por minuto por chave.
// Documentação: https://www.zappmillion.com/developers

export type ZmPlan = { id: string; name: string; monthlyPrice: number; currency: string; agentReplyLimit: number; billingCycleDays: number };
export type ZmClient = {
  externalId: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "CANCELED";
  organizationId: string;
  workspaceId: string;
  userId: string;
  subscription: { status: string; planId: string; amount: number; currency: string; currentPeriodStart: string; currentPeriodEnd: string; scheduledPlanId: string | null } | null;
  messagingAccount: { id?: string; phoneNumber?: string; status?: string } | null;
  createdAt: string;
};

export type ZmCharge = { id: string; status: "PENDING" | "PAID" | "FAILED" | "REFUNDED"; amount: number; currency: string; planId: string; periodStart: string; periodEnd: string; failureReason: string | null; createdAt: string; paidAt: string | null };

export class ZmError extends Error {
  constructor(public status: number, public type: string, message: string) {
    super(message);
  }
  /** 429 e 5xx podem ser repetidos; os demais 4xx exigem correção antes. */
  get retryable() {
    return this.status === 429 || this.status >= 500;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${iaConfig.zmApi()}${path}`, {
      method,
      headers: { authorization: `Bearer ${iaConfig.zmKey()}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch (e) {
    // Só o tipo do erro: a mensagem do fetch pode repetir cabeçalhos, inclusive a chave.
    throw new ZmError(503, "NetworkError", `Falha de rede ao chamar o ZappMillion (${(e as Error).name})`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const type = typeof data?.type === "string" ? data.type : "Unknown";
    throw new ZmError(res.status, type, `ZappMillion HTTP ${res.status} ${type} em ${method} ${path}`);
  }
  return data as T;
}

const ext = (id: string) => `/clients/${encodeURIComponent(id)}`;

export const zm = {
  plans: () => call<{ data: ZmPlan[] }>("GET", "/plans").then((r) => r.data),
  billing: () => call<{ paymentMethod: { status: string } | null; activeSubscriptions: number; monthlyAmount: number }>("GET", "/billing"),
  getClient: (externalId: string) => call<ZmClient>("GET", ext(externalId)),
  createClient: (b: {
    externalId: string;
    name: string;
    planId: string;
    user: { name: string; email: string; phoneNumber?: string };
    playbookIds?: string[];
    playbookVariables?: Record<string, Record<string, string>>;
  }) => call<ZmClient>("POST", "/clients", { ...b, locale: "pt-BR" }),
  suspend: (externalId: string) => call<ZmClient>("POST", `${ext(externalId)}/suspend`),
  reactivate: (externalId: string, planId?: string) => call<ZmClient>("POST", `${ext(externalId)}/reactivate`, planId ? { planId } : {}),
  resendInvite: (externalId: string) => call<void>("POST", `${ext(externalId)}/resend-invite`),
  /** Clientes da agência (para conciliação), paginado. */
  listClients: (offset = 0) => call<{ data: ZmClient[]; total: number }>("GET", `/clients?limit=100&offset=${offset}`),
  /** Cobranças do cliente no cartão da agência, da mais recente para a mais antiga. */
  charges: (externalId: string) => call<{ data: ZmCharge[] }>("GET", `${ext(externalId)}/charges?limit=20`).then((r) => r.data),
};
