// Configuração da venda avulsa "Site de uma página". Tudo vem de variáveis de ambiente do servidor (Vercel →
// Settings → Environment Variables), separadas por ambiente como as da IA: Preview com credenciais de TESTE do
// Mercado Pago, Production com as de produção. Reaproveita MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, DATABASE_URL e o
// e-mail interno (RESEND_*, IA_OPERACAO_EMAIL/LEAD_EMAIL_TO) já configurados para a IA; nada da IA muda.
//
// A contratação só abre com SITES_CONTRATACAO_ATIVA=true e as condições listadas em SITES_CONDICOES — e só as
// condições listadas aparecem no checkout. Liste apenas as que foram VALIDADAS no ambiente de teste do Mercado
// Pago (ver docs/SITES-PACOTE.md): o cartão parcelado depende de a conta oferecer parcelas sem acréscimo ao
// comprador; sem isso, a condição não pode ser vendida pelo total aprovado.

import { CONDICOES, type CondicaoId } from "./oferta";

const env = (k: string) => (process.env[k] ?? "").trim();

export const sitesConfig = {
  ativa: () => env("SITES_CONTRATACAO_ATIVA") === "true",
  /** condições liberadas, na ordem da tabela aprovada (ids de oferta.ts, separados por vírgula) */
  condicoes: (): CondicaoId[] => {
    const lista = env("SITES_CONDICOES").split(",").map((s) => s.trim());
    return CONDICOES.map((c) => c.id).filter((id) => lista.includes(id));
  },
  /** Public Key do Mercado Pago (formulário de cartão seguro do próprio Mercado Pago, no navegador). */
  publicKey: () => env("NEXT_PUBLIC_MP_PUBLIC_KEY") || env("MP_PUBLIC_KEY"),
  mpToken: () => env("MP_ACCESS_TOKEN"),
  mpWebhookSecret: () => env("MP_WEBHOOK_SECRET"),
  mpApi: () => env("MP_API_URL") || "https://api.mercadopago.com",
  /** minutos de validade do QR Code do Pix */
  pixMinutos: () => {
    const v = Number(env("SITES_PIX_MINUTOS"));
    return Number.isInteger(v) && v >= 30 && v <= 1440 ? v : 60;
  },
  siteUrl: () => {
    const explicit = env("SITES_URL_PUBLICA") || env("IA_URL_PUBLICA");
    if (explicit) return explicit.replace(/\/+$/, "");
    if (env("VERCEL_ENV") === "preview" && env("VERCEL_BRANCH_URL")) return `https://${env("VERCEL_BRANCH_URL")}`;
    return env("NEXT_PUBLIC_SITE_URL").replace(/\/+$/, "");
  },
  /**
   * URL de notificação dos pagamentos deste fluxo. Na prévia protegida da Vercel leva o segredo de bypass (como na
   * IA); em produção, a própria rota. Nunca registrar esta URL em logs.
   */
  notificationUrl: (): string | null => {
    if (env("SITES_MP_NOTIFICATION_URL") === "off") return null;
    if (env("SITES_MP_NOTIFICATION_URL")) return env("SITES_MP_NOTIFICATION_URL");
    const bypass = env("VERCEL_AUTOMATION_BYPASS_SECRET");
    if (env("VERCEL_ENV") === "preview" && bypass && env("VERCEL_BRANCH_URL")) {
      return `https://${env("VERCEL_BRANCH_URL")}/api/sites-pacote/webhook?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
    }
    const base = sitesConfig.siteUrl();
    return base.startsWith("https://") ? `${base}/api/sites-pacote/webhook` : null;
  },
  isProduction: () => env("VERCEL_ENV") === "production",
};

/** O que falta para abrir a contratação (para a operação; nunca mostra valores). */
export function sitesReadiness(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!sitesConfig.ativa()) missing.push("SITES_CONTRATACAO_ATIVA=true");
  if (!sitesConfig.condicoes().length) missing.push("SITES_CONDICOES (condições validadas no teste)");
  if (!sitesConfig.mpToken()) missing.push("MP_ACCESS_TOKEN");
  else if (/\s/.test(sitesConfig.mpToken())) missing.push("MP_ACCESS_TOKEN (valor inválido)");
  if (sitesConfig.condicoes().some((c) => c.startsWith("cartao")) && !sitesConfig.publicKey()) missing.push("NEXT_PUBLIC_MP_PUBLIC_KEY (cartão)");
  if (!sitesConfig.mpWebhookSecret()) missing.push("MP_WEBHOOK_SECRET");
  if (!process.env.DATABASE_URL && process.env.SITES_STORE !== "memory" && process.env.IA_STORE !== "memory") missing.push("DATABASE_URL");
  if ((process.env.SITES_STORE === "memory" || process.env.IA_STORE === "memory") && process.env.VERCEL) missing.push("DATABASE_URL (memória só serve para teste local)");
  if (!sitesConfig.siteUrl()) missing.push("NEXT_PUBLIC_SITE_URL");
  return { ready: missing.length === 0, missing };
}

/**
 * Pedidos já criados continuam acompanháveis e confirmáveis mesmo se a contratação for fechada depois: basta o
 * Mercado Pago e o banco configurados (sem SITES_CONTRATACAO_ATIVA/SITES_CONDICOES).
 */
export function sitesOperacional() {
  const memoria = process.env.SITES_STORE === "memory" || process.env.IA_STORE === "memory";
  return !!sitesConfig.mpToken() && (memoria ? !process.env.VERCEL : !!process.env.DATABASE_URL);
}

/** O que a página e o checkout podem mostrar. */
export function publicSiteOffer() {
  const r = sitesReadiness();
  return { aberta: r.ready, condicoes: r.ready ? sitesConfig.condicoes() : ([] as CondicaoId[]) };
}
