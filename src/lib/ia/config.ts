
// Configuração da oferta "Atendimento com IA no WhatsApp". Tudo vem de variáveis de ambiente do
// servidor (Vercel → Settings → Environment Variables), separadas por ambiente: Preview com
// credenciais de TESTE, Production com as de produção. Nada daqui vai para o navegador, exceto o
// resumo público de `publicOffer()` (preço e limite já decididos).
//
// A contratação só fica ativa quando TODOS os itens de `readiness()` estão definidos e
// IA_CONTRATACAO_ATIVA=true. Enquanto isso, a página mostra a oferta e um contato.

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
  /** Ciclo do Mercado Pago. Padrão mensal; "30:days" alinha com o ciclo de 30 dias do ZappMillion. */
  frequency: (): Frequency => {
    const [n, t] = (env("IA_MP_FREQUENCIA") || "1:months").split(":");
    const frequency = Number(n);
    return { frequency: Number.isInteger(frequency) && frequency > 0 ? frequency : 1, frequencyType: t === "days" ? "days" : "months" };
  },
  /** Horas de antecedência da renovação do ZappMillion em que a guarda age (padrão 36). */
  guardHours: () => Number(env("IA_GUARDA_HORAS")) || 36,
  mpToken: () => env("MP_ACCESS_TOKEN"),
  mpWebhookSecret: () => env("MP_WEBHOOK_SECRET"),
  mpApi: () => env("MP_API_URL") || "https://api.mercadopago.com",
  zmKey: () => env("ZM_API_KEY"),
  zmApi: () => env("ZM_API_URL") || "https://app.zappmillion.com/api/v1/provisioning",
  adminToken: () => env("IA_ADMIN_TOKEN"),
  cronSecret: () => env("CRON_SECRET"),
  siteUrl: () => env("NEXT_PUBLIC_SITE_URL").replace(/\/+$/, ""),
  enabledFlag: () => env("IA_CONTRATACAO_ATIVA") === "true",
  isProduction: () => env("VERCEL_ENV") === "production",
};

/**
 * O que falta para abrir a contratação. Também protege contra misturar ambientes: uma chave
 * zm_live_ fora de produção, ou zm_test_ em produção, bloqueia a contratação.
 */
export function readiness(): { ready: boolean; missing: string[] } {
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
  if (process.env.IA_STORE === "memory" && iaConfig.isProduction()) missing.push("DATABASE_URL (memória não é permitida em produção)");
  if (!iaConfig.siteUrl()) missing.push("NEXT_PUBLIC_SITE_URL");
  if (!iaConfig.enabledFlag()) missing.push("IA_CONTRATACAO_ATIVA=true");
  return { ready: missing.length === 0, missing };
}

/** Dados que a página pode mostrar. Preço e limite só aparecem quando definidos. */
export function publicOffer() {
  return { enabled: readiness().ready, price: iaConfig.price(), replyLimit: iaConfig.replyLimit() };
}
