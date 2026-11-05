import { NextResponse } from "next/server";
import { iaConfig } from "@/lib/ia/config";
import { bearerOk } from "@/lib/ia/access";
import { registerSchedule } from "@/lib/ia/agendador";
import { healthReport, mpAccount } from "@/lib/ia/health";
import { comCanal, reconcile, runCron } from "@/lib/ia/process";

// Rotina periódica (Vercel Cron envia Authorization: Bearer CRON_SECRET): novas tentativas de
// ativação, conferência direta no Mercado Pago, sincronização com o ZappMillion e guarda de renovação.
// Veja docs/ATENDIMENTO-IA.md.
export async function GET(req: Request) {
  if (!bearerOk(req, iaConfig.cronSecret())) return NextResponse.json({ ok: false }, { status: 401 });
  // ?agendar=1: registra a rotina de 5 minutos no QStash (idempotente); não executa a rotina.
  if (new URL(req.url).searchParams.get("agendar") === "1") {
    const agendador = await registerSchedule();
    console.info(`[atendimento-ia] agendador ${JSON.stringify(agendador)}`);
    return NextResponse.json({ ok: true, agendador });
  }
  // ?saude=1: diagnóstico só de leitura, gravado no log privado da Vercel (nunca na resposta, pois a rotina
  // roda em repositório público); não executa a rotina.
  if (new URL(req.url).searchParams.get("saude") === "1") {
    console.info(`[atendimento-ia] saude ${JSON.stringify({ ...(await healthReport()), contaMp: await mpAccount().catch((e: Error) => ({ erro: e.message })) })}`);
    return NextResponse.json({ ok: true, saude: "registrada no log" });
  }
  if (!process.env.DATABASE_URL && process.env.IA_STORE !== "memory") return NextResponse.json({ ok: true, skipped: "sem banco" });
  // Sem as chaves dos fornecedores (ex.: produção antes de abrir as vendas), não há o que conferir.
  if (!iaConfig.zmKey() || !iaConfig.mpToken()) return NextResponse.json({ ok: true, skipped: "sem chaves dos fornecedores" });
  // Relógio simulado só em teste local (nunca na Vercel), para conferir limites entre datas.
  const fake = !process.env.VERCEL && (process.env.IA_STORE === "memory" || process.env.IA_TESTE_RELOGIO === "1") ? req.headers.get("x-ia-agora") : null;
  // Registro de cada execução, para comprovar a frequência real pelo log.
  console.info(`[atendimento-ia] rotina executada origem=${(req.headers.get("user-agent") ?? "?").slice(0, 24)}`);
  const report = await comCanal("rotina", () => runCron(fake ? new Date(fake) : new Date()));
  // Conciliação com os clientes do ZappMillion: no cron diário da Vercel (user-agent vercel-cron) ou com
  // ?conciliar=1. Uma falha aqui não derruba a rotina (fica no relatório e no log).
  const daily = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron") || new URL(req.url).searchParams.get("conciliar") === "1";
  let conciliacao: string[] | { erro: string } | undefined;
  if (daily) {
    try {
      conciliacao = await reconcile();
    } catch (e) {
      console.error("[atendimento-ia] conciliação com o ZappMillion falhou:", (e as Error).message);
      conciliacao = { erro: (e as Error).message };
    }
  }
  return NextResponse.json({ ok: true, report, ...(conciliacao ? { conciliacao } : {}) });
}
