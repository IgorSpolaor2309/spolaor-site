import { NextResponse } from "next/server";
import { sitesReadiness } from "@/lib/sites/config";
import { estadoPublico, pagarPix, pedidoComToken, PedidoErro } from "@/lib/sites/process";

// Gera um novo Pix para o pedido quando o anterior venceu (ou devolve o atual, se ainda valer).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!sitesReadiness().ready) return NextResponse.json({ ok: false, error: "contratacao_indisponivel" }, { status: 503 });
  const p = await pedidoComToken(body.id, body.t);
  if (!p) return NextResponse.json({ ok: false, error: "pedido_nao_encontrado" }, { status: 404 });
  try {
    return NextResponse.json({ ok: true, pedido: estadoPublico(await pagarPix(p)) });
  } catch (e) {
    if (e instanceof PedidoErro) return NextResponse.json({ ok: false, error: e.codigo, message: e.mensagem }, { status: e.http });
    console.error("[sites-pacote] falha ao gerar o Pix:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "falha_pix" }, { status: 502 });
  }
}
