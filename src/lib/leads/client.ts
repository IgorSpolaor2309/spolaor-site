"use client";

import type { SyntheticEvent } from "react";
import type { LeadPayload } from "./schema";
import { trackFormStart, trackLead } from "../analytics";

const FIELD = "input:not([type=hidden]):not([name=website]), textarea, select, button, label";

/**
 * Props do <form> de lead para medir o início do formulário (FormStart, uma vez por origem): primeiro
 * foco ou toque num campo, opção ou botão do formulário. Não lê nem envia o conteúdo dos campos.
 */
export function formStartProps(origem: string) {
  const start = (e: SyntheticEvent) => {
    if ((e.target as Element | null)?.closest?.(FIELD)) trackFormStart(origem);
  };
  return { onFocus: start, onClick: start };
}

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
export function context(): Pick<LeadPayload, "pagina" | "entrada" | "referrer" | "utm"> {
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

export type SubmitResult = { ok: true; id?: string } | { ok: false; errors?: Record<string, string>; unavailable?: boolean };

/** Envia o lead para a API própria. Os formulários só conhecem esta função. */
export async function submitLead(data: LeadPayload, honeypot?: string): Promise<SubmitResult> {
  const res = await fetch("/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...data, ...context(), website: honeypot }),
  });
  const body = await res.json().catch(() => ({}));
  // 503: o site está sem destino de leads configurado; nada foi guardado.
  if (!res.ok) return { ok: false, errors: body.errors, unavailable: res.status === 503 };
  // Conversão medida só aqui: resposta 200 COM o id do lead registrado (envio aceito), uma vez por lead
  // (o id é o eventID). Sem id não há lead registrado (ex.: envio descartado pelo anti-spam), então não há
  // Lead. Uma falha da medição nunca transforma um envio aceito em erro na tela.
  if (typeof body.id === "string" && body.id) {
    try {
      trackLead(data.origem, body.id);
    } catch {
      // medição indisponível: o lead já foi aceito
    }
  }
  return { ok: true, id: body.id };
}
