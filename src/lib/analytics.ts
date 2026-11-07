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
  /** Marcado pelo código base do Pixel no <head> (lib/pixel-head.ts): o PageView da primeira página já saiu. */
  __spolaorPageView?: number;
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
  // Falha do Pixel ou do gtag nunca derruba a página.
  try {
    const win = w();
    // A primeira página da visita já teve o PageView enfileirado pelo <head>, antes da hidratação: não repete.
    if (win.__spolaorPageView) delete win.__spolaorPageView;
    else win.fbq?.("track", "PageView");
    win.gtag?.("event", "page_view", { page_path: pathname });
    const origem = origemFromPath(pathname);
    if (origem && origem !== "home" && origem !== "contato" && origem !== "pagina-analise") {
      win.fbq?.("track", "ViewContent", { content_name: INTERESSES[origem], content_category: origem });
    }
  } catch {
    // medição indisponível
  }
}

const sent = new Set<string>();

/* ─────────────── Funil do Atendimento com IA (docs/ATENDIMENTO-IA.md, "Medição do funil") ───────────────
 * InitiateCheckout → CompleteRegistration → PaymentRedirect (personalizado) → Subscribe + Purchase.
 * Regras: inicializa a medição antes de enfileirar; marca como enviado só depois de enfileirar; nenhuma falha
 * de Pixel, script bloqueado ou armazenamento indisponível interrompe a contratação; nenhum dado pessoal nos
 * parâmetros (só nome da oferta, categoria, valor e moeda; o eventID é o id da contratação). */

const IA = { content_name: "Atendimento com IA no WhatsApp", content_category: "atendimento-ia" } as const;

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string) {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // armazenamento indisponível: vale a marcação em memória desta página
    }
  },
};
const alreadySent = (key: string) => sent.has(key) || !!store.get(key);

/**
 * Enfileira no Pixel (e no GA4, se configurado) depois de garantir a inicialização. Devolve true só quando
 * algo foi enfileirado; erros do Pixel ou do gtag nunca escapam.
 */
function emit(fire: (win: Win) => void): boolean {
  if (!analyticsEnabled) return false;
  try {
    loadAnalytics();
    const win = w();
    if (!win.fbq && !win.gtag) return false;
    fire(win);
    return true;
  } catch {
    return false;
  }
}

/** Dispara uma única vez por chave: confere, enfileira e só então marca (memória e, se houver, localStorage). */
function once(key: string, fire: (win: Win) => void, persist = true) {
  if (alreadySent(key)) return false;
  if (!emit(fire)) return false;
  sent.add(key);
  if (persist) store.set(key);
  return true;
}

/** Entrada no checkout disponível. `aberturaId` é gerado uma vez por abertura da tela (não persiste). */
export function trackCheckoutView(aberturaId: string, value: number) {
  return once(
    `checkout-${aberturaId}`,
    (win) => {
      win.fbq?.("track", "InitiateCheckout", { ...IA, value, currency: "BRL", num_items: 1 }, { eventID: `checkout-${aberturaId}` });
      if (GA_ID) win.gtag?.("event", "begin_checkout", { value, currency: "BRL", items: [{ item_name: IA.content_name }] });
    },
    false,
  );
}

/** Cadastro aceito: a API devolveu o id da contratação e o link de pagamento. Uma vez por contratação. */
export function trackCheckoutRegistered(contratacaoId: string) {
  return once(`registro-${contratacaoId}`, (win) => {
    win.fbq?.("track", "CompleteRegistration", { ...IA, status: "pagamento_pendente" }, { eventID: `registro-${contratacaoId}` });
    if (GA_ID) win.gtag?.("event", "sign_up", { method: "checkout_atendimento_ia" });
  });
}

/**
 * Encaminhamento ao Mercado Pago, imediatamente antes de abrir o link. Indica que o site encaminhou o
 * comprador; NÃO comprova que o checkout do Mercado Pago carregou. Uma vez por contratação.
 */
export function trackPaymentRedirect(contratacaoId: string) {
  return once(`redirecionamento-${contratacaoId}`, (win) => {
    win.fbq?.("trackCustom", "PaymentRedirect", { ...IA }, { eventID: `redirecionamento-${contratacaoId}` });
    if (GA_ID) win.gtag?.("event", "payment_redirect", { content_category: IA.content_category });
  });
}

/**
 * Primeiro pagamento aprovado e confirmado pelo servidor (página de acompanhamento): Subscribe, para o
 * objetivo "Assinar" das campanhas, e Purchase, mantido como antes. Os dois descrevem a MESMA assinatura,
 * não duas vendas. Uma vez por contratação, também ao reabrir: se o marcador antigo `purchase-<id>` existir,
 * nada é enviado de novo. Validação interna nunca chega aqui (quem chama confere `interna`).
 */
export function trackPurchase(contratacaoId: string, value: number) {
  const purchaseKey = `purchase-${contratacaoId}`;
  if (alreadySent(purchaseKey) || alreadySent(`subscribe-${contratacaoId}`)) return false;
  const ok = emit((win) => {
    const params = { ...IA, value, currency: "BRL" };
    win.fbq?.("track", "Subscribe", { ...params, predicted_ltv: value }, { eventID: `subscribe-${contratacaoId}` });
    win.fbq?.("track", "Purchase", params, { eventID: contratacaoId });
    if (GA_ID) win.gtag?.("event", "purchase", { transaction_id: contratacaoId, value, currency: "BRL", items: [{ item_name: IA.content_name }] });
  });
  if (!ok) return false;
  for (const k of [purchaseKey, `subscribe-${contratacaoId}`]) {
    sent.add(k);
    store.set(k);
  }
  return true;
}

export function trackLead(origemRaw: string, leadId: string | undefined) {
  const origem: LeadOrigem | undefined = isOrigem(origemRaw) ? origemRaw : undefined;
  const key = leadId ?? `${origemRaw}-${Date.now()}`;
  if (sent.has(key)) return;
  sent.add(key);
  const params = { content_name: origem ? INTERESSES[origem] : origemRaw, content_category: origemRaw };
  try {
    const win = w();
    win.fbq?.("track", "Lead", params, { eventID: key });
    if (ADS_ID && ADS_LEAD_LABEL) win.gtag?.("event", "conversion", { send_to: `${ADS_ID}/${ADS_LEAD_LABEL}`, transaction_id: key });
    if (GA_ID) win.gtag?.("event", "generate_lead", { ...params, transaction_id: key });
  } catch {
    // medição indisponível: o lead já foi aceito pela API
  }
}

/**
 * Início do formulário: o visitante entrou num campo de um formulário de lead. Uma vez por origem a
 * cada carregamento da página. Evento personalizado (FormStart), NÃO é conversão nem Lead e não leva
 * nada do que foi digitado: só a origem do formulário. Serve para separar "ninguém chegou ao
 * formulário" de "começou e não terminou".
 */
export function trackFormStart(origemRaw: string) {
  const key = `form-start-${origemRaw}`;
  if (sent.has(key)) return;
  sent.add(key);
  try {
    const win = w();
    win.fbq?.("trackCustom", "FormStart", { content_category: origemRaw });
    if (GA_ID) win.gtag?.("event", "form_start", { form_id: origemRaw });
  } catch {
    // medição indisponível: o formulário segue normalmente
  }
}
