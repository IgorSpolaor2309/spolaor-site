"use client";

// Medição de campanhas (Meta Pixel; Google Analytics e Google Ads opcionais).
//
// Tudo é DESLIGADO por padrão: só carrega e só dispara se o ID correspondente estiver definido
// em variável de ambiente (veja .env.example). Nenhum dado pessoal vai nos eventos: nada de nome,
// telefone, e-mail ou texto da mensagem; só o nome da oferta e a página de origem.

import { INTERESSES, isOrigem, origemFromPath, type LeadOrigem } from "./leads/schema";

const env = (v?: string) => (v ?? "").trim();
export const META_PIXEL_ID = env(process.env.NEXT_PUBLIC_META_PIXEL_ID);
export const GA_ID = env(process.env.NEXT_PUBLIC_GA_ID);
export const ADS_ID = env(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID);
export const ADS_LEAD_LABEL = env(process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL);

export const analyticsEnabled = !!(META_PIXEL_ID || GA_ID || ADS_ID);

type Win = Window & {
  fbq?: ((...a: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
  _fbq?: unknown;
  dataLayer?: unknown[];
  gtag?: (...a: unknown[]) => void;
};
const w = () => window as Win;

/** Carrega os scripts de medição configurados (uma vez). */
export function loadAnalytics() {
  const win = w();
  if (META_PIXEL_ID && !win.fbq) {
    const q: unknown[] = [];
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else q.push(args);
    } as NonNullable<Win["fbq"]>;
    fbq.queue = q;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    win.fbq = fbq;
    win._fbq = fbq;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
    fbq("init", META_PIXEL_ID);
  }
  const gid = GA_ID || ADS_ID;
  if (gid && !win.gtag) {
    win.dataLayer = win.dataLayer || [];
    win.gtag = function (...args: unknown[]) {
      win.dataLayer!.push(args);
    };
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gid)}`;
    document.head.appendChild(s);
    win.gtag("js", new Date());
    if (GA_ID) win.gtag("config", GA_ID, { send_page_view: false });
    if (ADS_ID) win.gtag("config", ADS_ID);
  }
}

/** Visualização de página (a cada navegação) e, nas páginas de oferta, ViewContent. */
export function trackPageView(pathname: string) {
  const win = w();
  win.fbq?.("track", "PageView");
  win.gtag?.("event", "page_view", { page_path: pathname });
  const origem = origemFromPath(pathname);
  if (origem && origem !== "home" && origem !== "contato" && origem !== "pagina-analise") {
    win.fbq?.("track", "ViewContent", { content_name: INTERESSES[origem], content_category: origem });
  }
}

const sent = new Set<string>();

/**
 * Conversão: chamada SOMENTE depois que a API aceitou o lead (resposta 200), uma vez por lead.
 * `leadId` é o ID devolvido pela API e serve de eventID (deduplicação).
 */
export function trackLead(origemRaw: string, leadId: string | undefined) {
  const origem: LeadOrigem | undefined = isOrigem(origemRaw) ? origemRaw : undefined;
  const key = leadId ?? `${origemRaw}-${Date.now()}`;
  if (sent.has(key)) return;
  sent.add(key);
  const params = { content_name: origem ? INTERESSES[origem] : origemRaw, content_category: origemRaw };
  const win = w();
  win.fbq?.("track", "Lead", params, { eventID: key });
  if (ADS_ID && ADS_LEAD_LABEL) win.gtag?.("event", "conversion", { send_to: `${ADS_ID}/${ADS_LEAD_LABEL}`, transaction_id: key });
  if (GA_ID) win.gtag?.("event", "generate_lead", { ...params, transaction_id: key });
}
