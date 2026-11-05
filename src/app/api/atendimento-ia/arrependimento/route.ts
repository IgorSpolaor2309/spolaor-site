import { NextResponse } from "next/server";
import { contratacaoAutorizada } from "@/lib/ia/access";
import { comCanal } from "@/lib/ia/process";
import { solicitarArrependimento } from "@/lib/ia/reembolso";

// Pedido de arrependimento pelo comprador, no mesmo link de acompanhamento (Decreto 7.962/2013, art. 5):
// exige o token do link e confirmação explícita; o retorno confirma o recebimento com um protocolo.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { c?: string; t?: string; confirmar?: boolean };
  const c = await contratacaoAutorizada(body.c, body.t);
  if (!c) return NextResponse.json({ ok: false }, { status: 404 });
  if (body.confirmar !== true) return NextResponse.json({ ok: false, error: "confirmacao" }, { status: 422 });
  try {
    // Relógio simulado só em teste local (nunca na Vercel), para conferir o limite do prazo.
    const fake = !process.env.VERCEL && process.env.IA_STORE === "memory" ? req.headers.get("x-ia-agora") : null;
    const r = await comCanal("arrependimento", () => solicitarArrependimento(c, fake ? new Date(fake) : new Date()));
    if (!r.ok) return NextResponse.json({ ok: false, error: r.erro }, { status: 409 });
    return NextResponse.json({ ok: true, protocolo: r.reembolso.id, status: r.reembolso.status });
  } catch (e) {
    console.error("[atendimento-ia] falha no pedido de arrependimento:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "falha_pedido" }, { status: 502 });
  }
}
