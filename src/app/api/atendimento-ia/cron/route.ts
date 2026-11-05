import { NextResponse } from "next/server";
import { iaConfig } from "@/lib/ia/config";
import { bearerOk } from "@/lib/ia/access";
import { reconcile, runCron } from "@/lib/ia/process";

// Rotina periódica (Vercel Cron envia Authorization: Bearer CRON_SECRET): novas tentativas de
// ativação, sincronização com o ZappMillion e guarda de renovação. Veja docs/ATENDIMENTO-IA.md.
export async function GET(req: Request) {
  if (!bearerOk(req, iaConfig.cronSecret())) return NextResponse.json({ ok: false }, { status: 401 });
  if (!process.env.DATABASE_URL && process.env.IA_STORE !== "memory") return NextResponse.json({ ok: true, skipped: "sem banco" });
  // Relógio simulado só em teste local (nunca na Vercel), para conferir limites entre datas.
  const fake = !process.env.VERCEL && (process.env.IA_STORE === "memory" || process.env.IA_TESTE_RELOGIO === "1") ? req.headers.get("x-ia-agora") : null;
  const report = await runCron(fake ? new Date(fake) : new Date());
  // Conciliação: no cron diário da Vercel (?conciliar=1); o agendador por minuto não passa o parâmetro.
  const conciliacao = new URL(req.url).searchParams.get("conciliar") === "1" ? await reconcile() : undefined;
  return NextResponse.json({ ok: true, report, ...(conciliacao ? { conciliacao } : {}) });
}
