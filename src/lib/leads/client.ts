"use client";

import type { LeadPayload } from "./schema";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

/** Contexto de navegação enviado junto com o lead (página, origem do tráfego, UTMs). */
function context(): Pick<LeadPayload, "pagina" | "referrer" | "utm"> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) utm[k] = v.slice(0, 200);
  }
  return { pagina: window.location.pathname, referrer: document.referrer || undefined, utm };
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
