
// Configuração da oferta "Atendimento com IA no WhatsApp". Tudo vem de variáveis de ambiente do
// servidor (Vercel → Settings → Environment Variables), separadas por ambiente: Preview com
// credenciais de TESTE, Production com as de produção. Nada daqui vai para o navegador, exceto o
// resumo público de `publicOffer()` (preço e limite já decididos).
//
// A contratação só fica ativa quando TODOS os itens de `readiness()` estão definidos e
// IA_CONTRATACAO_ATIVA=true. Enquanto isso, a página mostra a oferta e um contato.

import { timingSafeEqual } from "node:crypto";

const env = (k: string) => (process.env[k] ?? "").trim();

export type Frequency = { frequency: number; frequencyType: "months" | "days" };

export const iaConfig = {
  /** Preço mensal cobrado do cliente, em reais (ex.: "197.00"). Definido pelo servidor. */
  price: () => {
    const v = Number(env("IA_PRECO_MENSAL").replace(",", "."));
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  },
  /** Plano do ZappMillion que corresponde a esta oferta (id de GET /v1/provisioning/plans). */
  zmPlanId: () => env("IA_ZM_PLAN_ID") || null,
  /** Limite de respostas exibido na página; conferido com agentReplyLimit do plano. */
  replyLimit: () => {
    const v = Number(env("IA_LIMITE_RESPOSTAS"));
    return Number.isInteger(v) && v > 0 ? v : null;
  },
  /** Playbooks instalados na criação do cliente (ids separados por vírgula), opcional. */
  playbookIds: () => env("IA_ZM_PLAYBOOK_IDS").split(",").map((s) => s.trim()).filter(Boolean),
  /**
   * Mapeamento das variáveis dos playbooks para os dados da contratação, em JSON:
   * {"<playbookId>": {"empresa": "empresa", "responsavel": "responsavel"}}. Só os campos
   * coletados na contratação podem ser usados (empresa, responsavel, email, telefone, segmento).
   */
  playbookVariables: (): Record<string, Record<string, string>> => {
    try {
      const v = JSON.parse(env("IA_ZM_PLAYBOOK_VARIAVEIS") || "{}");
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  },
  /**
   * Ciclo do Mercado Pago. Padrão "30:days", alinhado com os 30 dias do ZappMillion (a validar no
   * ambiente de teste do Mercado Pago). Alternativa: "1:months".
   */
  frequency: (): Frequency => {
    const [n, t] = (env("IA_MP_FREQUENCIA") || "30:days").split(":");
    const frequency = Number(n);
    return { frequency: Number.isInteger(frequency) && frequency > 0 ? frequency : 1, frequencyType: t === "days" ? "days" : "months" };
  },
  /**
   * Carência (decidida em 05/11/2026: 10 dias): só para renovação NÃO PAGA pelo cliente quando a
   * cobrança do novo ciclo do ZappMillion já está confirmada como paga (GET /clients/{id}/charges).
   * Não vale para cancelamento, estorno ou contestação, e nunca encurta um período pago.
   */
  graceDays: () => {
    const raw = env("IA_CARENCIA_DIAS");
    const v = Number(raw);
    return raw !== "" && Number.isFinite(v) && v >= 0 ? v : 10;
  },
  /** Meios de pagamento VALIDADOS no ambiente de teste do Mercado Pago: "cartao", "pix" ou ambos. */
  paymentMethods: (): ("cartao" | "pix")[] =>
    [...new Set(env("IA_MEIOS_PAGAMENTO").split(",").map((s) => s.trim().toLowerCase()))].filter((m): m is "cartao" | "pix" => m === "cartao" || m === "pix"),
  mpToken: () => env("MP_ACCESS_TOKEN"),
  mpWebhookSecret: () => env("MP_WEBHOOK_SECRET"),
  mpApi: () => env("MP_API_URL") || "https://api.mercadopago.com",
  zmKey: () => env("ZM_API_KEY"),
  zmApi: () => env("ZM_API_URL") || "https://app.zappmillion.com/api/v1/provisioning",
  adminToken: () => env("IA_ADMIN_TOKEN"),
  cronSecret: () => env("CRON_SECRET"),
  siteUrl: () => env("NEXT_PUBLIC_SITE_URL").replace(/\/+$/, ""),
  enabledFlag: () => env("IA_CONTRATACAO_ATIVA") === "true",
  /** URL de notificação enviada na criação da assinatura (opcional; a validar no teste do Mercado Pago). */
  mpNotificationUrl: () => env("IA_MP_NOTIFICATION_URL") || null,
  isProduction: () => env("VERCEL_ENV") === "production",
};

/**
 * O que falta para abrir a contratação. Também protege contra misturar ambientes: uma chave
 * zm_live_ fora de produção, ou zm_test_ em produção, bloqueia a contratação.
 */
/**
 * Link de validação interna: com /atendimento-ia?acesso=<IA_TOKEN_VALIDACAO>, quem tem o token compra
 * mesmo com IA_CONTRATACAO_ATIVA desligada (todo o resto precisa estar configurado). Serve para a
 * compra controlada antes dos anúncios.
 */
export function validationOk(token: unknown) {
  const want = env("IA_TOKEN_VALIDACAO");
  if (want.length < 24 || typeof token !== "string") return false;
  const a = Buffer.from(token);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function readiness(opts: { validation?: boolean } = {}): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!iaConfig.price()) missing.push("IA_PRECO_MENSAL");
  if (!iaConfig.zmPlanId()) missing.push("IA_ZM_PLAN_ID");
  if (!iaConfig.replyLimit()) missing.push("IA_LIMITE_RESPOSTAS");
  if (!iaConfig.mpToken()) missing.push("MP_ACCESS_TOKEN");
  if (!iaConfig.mpWebhookSecret()) missing.push("MP_WEBHOOK_SECRET");
  const zm = iaConfig.zmKey();
  if (!zm) missing.push("ZM_API_KEY");
  else if (iaConfig.isProduction() ? !zm.startsWith("zm_live_") : zm.startsWith("zm_live_")) missing.push("ZM_API_KEY (modo errado para este ambiente)");
  if (!process.env.DATABASE_URL && process.env.IA_STORE !== "memory") missing.push("DATABASE_URL");
  if (process.env.IA_STORE === "memory" && process.env.VERCEL) missing.push("DATABASE_URL (memória só serve para teste local)");
  if (!iaConfig.siteUrl()) missing.push("NEXT_PUBLIC_SITE_URL");
  if (!iaConfig.paymentMethods().length) missing.push("IA_MEIOS_PAGAMENTO (meios validados no teste)");
  if (!iaConfig.enabledFlag() && !opts.validation) missing.push("IA_CONTRATACAO_ATIVA=true");
  return { ready: missing.length === 0, missing };
}

/** Dados que a página pode mostrar. Preço e limite só aparecem quando definidos. */
export function publicOffer(opts: { validation?: boolean } = {}) {
  return { enabled: readiness(opts).ready, validation: !!opts.validation && !iaConfig.enabledFlag(), price: iaConfig.price(), replyLimit: iaConfig.replyLimit(), cycle: cycleLabel(), methods: iaConfig.paymentMethods() };
}

/** Texto do ciclo para a página, o checkout e as condições: "a cada 30 dias" ou "por mês". */
export function cycleLabel() {
  const f = iaConfig.frequency();
  if (f.frequencyType === "days") return f.frequency === 1 ? "por dia" : `a cada ${f.frequency} dias`;
  return f.frequency === 1 ? "por mês" : `a cada ${f.frequency} meses`;
}
