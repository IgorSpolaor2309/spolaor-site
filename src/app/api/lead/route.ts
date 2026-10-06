import { NextResponse } from "next/server";
import { LIMITS, normalizeUrl, validateLead, type LeadPayload } from "@/lib/leads/schema";
import { NoLeadDestinationError, processLead } from "@/lib/leads/server/pipeline";
import type { LeadRecord } from "@/lib/leads/server/types";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const strList = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, LIMITS.lista).map((x) => x.slice(0, LIMITS.curto)) : [];

// Recebe os leads de todos os formulários e entrega aos conectores configurados.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "requisicao_invalida" }, { status: 400 });
  }

  // Honeypot anti-spam: campo invisível para pessoas
  if (body.website) return NextResponse.json({ ok: true });

  const lead: LeadPayload = {
    tipo: body.tipo === "projeto" ? "projeto" : "analise",
    origem: str(body.origem, LIMITS.curto) || "desconhecida",
    pagina: str(body.pagina, LIMITS.url),
    nome: str(body.nome, LIMITS.curto) ?? "",
    empresa: str(body.empresa, LIMITS.curto) ?? "",
    whatsapp: str(body.whatsapp, 40) ?? "",
    email: str(body.email, LIMITS.curto) ?? "",
    site: str(body.site, LIMITS.url),
    semSite: body.semSite === true,
    mensagem: str(body.mensagem, LIMITS.mensagem),
    urgencia: str(body.urgencia, LIMITS.curto),
    melhorias: strList(body.melhorias),
    servicos: strList(body.servicos),
    referrer: str(body.referrer, LIMITS.url),
    utm:
      body.utm && typeof body.utm === "object"
        ? Object.fromEntries(Object.entries(body.utm as Record<string, unknown>).slice(0, 10).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)]))
        : {},
  };

  const errors = validateLead(lead);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const record: LeadRecord = {
    ...lead,
    site: lead.site ? normalizeUrl(lead.site) : undefined,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? undefined,
  };

  try {
    await processLead(record);
  } catch (err) {
    if (err instanceof NoLeadDestinationError) {
      console.error("[lead] recebido sem destino configurado; nada foi salvo");
      return NextResponse.json({ ok: false, error: "destino_nao_configurado" }, { status: 503 });
    }
    console.error("[lead] falha ao registrar", err);
    return NextResponse.json({ ok: false, error: "falha_ao_registrar" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: record.id });
}
