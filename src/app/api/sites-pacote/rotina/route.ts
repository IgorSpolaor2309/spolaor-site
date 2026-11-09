import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { rotinaSites } from "@/lib/sites/process";

// Conferência de rotina dos pedidos com pagamento pendente (notificação perdida). Protegida por CRON_SECRET
// (Authorization: Bearer <CRON_SECRET>), o mesmo segredo das rotinas da IA; pode ser chamada pelo agendador já usado.
export async function GET(req: Request) {
  const want = (process.env.CRON_SECRET ?? "").trim();
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = want.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, conferidos: await rotinaSites() });
}
