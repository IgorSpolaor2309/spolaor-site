"use client";

import type { LeadPayload } from "./schema";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
const ENTRY_KEY = "spolaor:entrada";

function readUtm(search: string) {
  const params = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) utm[k] = v.slice(0, 200);
  }
  return utm;
}

type Entry = { path: string; utm: Record<string, string> };

/**
 * Guarda a porta de entrada da visita (primeira página e UTMs dela). Assim um lead que chegou
 * por /corretores e enviou o formulário em outra página continua atribuído à landing.
 * Chamado uma vez por carregamento em LeadAttribution.
 */
export function rememberEntry() {
  try {
    if (sessionStorage.getItem(ENTRY_KEY)) return;
    const entry: Entry = { path: window.location.pathname, utm: readUtm(window.location.search) };
    sessionStorage.setItem(ENTRY_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage bloqueado: segue só com a página atual
  }
}

function readEntry(): Entry | null {
  try {
    const raw = sessionStorage.getItem(ENTRY_KEY);
    return raw ? (JSON.parse(raw) as Entry) : null;
  } catch {
    return null;
  }
}

/** Contexto de navegação enviado junto com o lead (página, entrada, origem do tráfego, UTMs). */
function context(): Pick<LeadPayload, "pagina" | "entrada" | "referrer" | "utm"> {
  const pagina = window.location.pathname;
  const entry = readEntry();
  const utm = readUtm(window.location.search);
  return {
    pagina,
    entrada: entry && entry.path !== pagina ? entry.path : undefined,
    referrer: document.referrer || undefined,
    utm: Object.keys(utm).length ? utm : (entry?.utm ?? {}),
  };
}

export type SubmitResult = { ok: true; id?: string } | { ok: false; errors?: Record<string, string> };

/** Envia o lead para a API própria. Os formulários só conhecem esta função. */
export async function submitLead(data: LeadPayload, honeypot?: string): Promise<SubmitResult> {
  const res = await fetch("/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...data, ...context(), website: honeypot }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, errors: body.errors };
  return { ok: true, id: body.id };
}
