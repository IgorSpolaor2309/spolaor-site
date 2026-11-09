import { NextResponse } from "next/server";
import { sitesOperacional } from "@/lib/sites/config";
import { conferirPedido, estadoPublico, pedidoComToken } from "@/lib/sites/process";

// Estado do pedido para a página de acompanhamento. Enquanto o pagamento estiver pendente, confere direto no
// Mercado Pago (no máximo a cada ~12 s por pedido): a confirmação não depende só da notificação.
export async function GET(req: Request) {
  // sem Mercado Pago/banco configurados: responde antes de abrir o banco
  if (!sitesOperacional()) return NextResponse.json({ ok: false, error: "contratacao_indisponivel" }, { status: 503 });
  const url = new URL(req.url);
  const p = await pedidoComToken(url.searchParams.get("p"), url.searchParams.get("t"));
  if (!p) return NextResponse.json({ ok: false, error: "pedido_nao_encontrado" }, { status: 404 });
  const atual = await conferirPedido(p, "acompanhamento");
  return NextResponse.json({ ok: true, pedido: estadoPublico(atual) }, { headers: { "cache-control": "no-store" } });
}
