// Repasse público e mínimo das notificações do Mercado Pago para a rota de webhook da prévia protegida
// do site (Deployment Protection). Não guarda segredo: autentica na prévia com o token OIDC deste projeto
// (Trusted Sources da Vercel, header x-vercel-trusted-oidc-idp-token). Só aceita POST, só repassa para UM
// endereço fixo e não altera corpo, query nem os cabeçalhos da assinatura: a validação x-signature continua
// sendo feita na rota de destino, com o MP_WEBHOOK_SECRET de lá.
import { getVercelOidcToken } from "@vercel/oidc";

const DESTINO = process.env.DESTINO_WEBHOOK || "https://spolaor-site-git-oferta-ia-whatsapp-spolaor.vercel.app/api/atendimento-ia/webhook";
const MAX_BYTES = 64 * 1024;

export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
}

export async function POST(req) {
  {
    const body = await req.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return new Response("Payload Too Large", { status: 413 });
    const target = new URL(DESTINO);
    target.search = new URL(req.url).search; // data.id, type (o Mercado Pago assina o data.id da query)
    const headers = { "content-type": req.headers.get("content-type") || "application/json" };
    for (const h of ["x-signature", "x-request-id", "user-agent"]) {
      const v = req.headers.get(h);
      if (v) headers[h] = v;
    }
    try {
      headers["x-vercel-trusted-oidc-idp-token"] = await getVercelOidcToken();
    } catch (e) {
      console.error("[relay] sem token OIDC:", e.message);
      return new Response("Relay sem OIDC", { status: 503 });
    }
    const res = await fetch(target, { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(15000) }).catch((e) => ({ status: 502, error: e.message }));
    console.info(`[relay] ${req.headers.get("x-request-id") || "?"} → HTTP ${res.status}${res.error ? ` (${res.error})` : ""}`);
    return new Response(res.error ? "Bad Gateway" : await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
  }
}
