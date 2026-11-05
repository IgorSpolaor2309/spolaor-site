import { NextResponse } from "next/server";
import { iaConfig } from "@/lib/ia/config";
import { bearerOk } from "@/lib/ia/access";
import { runCron } from "@/lib/ia/process";

// Rotina periódica (Vercel Cron envia Authorization: Bearer CRON_SECRET): novas tentativas de
// ativação, sincronização com o ZappMillion e guarda de renovação. Veja docs/ATENDIMENTO-IA.md.
export async function GET(req: Request) {
  if (!bearerOk(req, iaConfig.cronSecret())) return NextResponse.json({ ok: false }, { status: 401 });
  if (!process.env.DATABASE_URL && process.env.IA_STORE !== "memory") return NextResponse.json({ ok: true, skipped: "sem banco" });
  // Relógio simulado só nos testes locais (IA_STORE=memory), para conferir limites entre datas.
  const fake = process.env.IA_STORE === "memory" ? req.headers.get("x-ia-agora") : null;
  const report = await runCron(fake ? new Date(fake) : new Date());
  return NextResponse.json({ ok: true, report });
}
