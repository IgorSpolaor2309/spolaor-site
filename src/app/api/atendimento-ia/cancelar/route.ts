import { NextResponse } from "next/server";
import { contratacaoAutorizada } from "@/lib/ia/access";
import { cancelSubscription } from "@/lib/ia/process";

// Cancelamento pelo comprador, a partir do link de acompanhamento: cancela a assinatura no Mercado
// Pago (sem novas cobranças). O acesso continua até o fim do período já pago.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { c?: string; t?: string; confirmar?: boolean };
  const c = await contratacaoAutorizada(body.c, body.t);
  if (!c) return NextResponse.json({ ok: false }, { status: 404 });
  if (body.confirmar !== true) return NextResponse.json({ ok: false, error: "confirmacao" }, { status: 422 });
  try {
    const result = await cancelSubscription(c);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[atendimento-ia] falha ao cancelar:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "falha_cancelamento" }, { status: 502 });
  }
}
