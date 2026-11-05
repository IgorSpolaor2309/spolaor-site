import { iaConfig } from "./config";

// Rotina a cada 5 minutos pelo QStash (Upstash, Vercel Marketplace): o cron da Vercel no plano Hobby é
// diário e o agendamento do GitHub Actions não disparou. O registro é idempotente (id fixo) e feito no
// servidor, para ninguém manusear QSTASH_TOKEN nem CRON_SECRET. Nunca devolver o corpo da resposta.
const SCHEDULE_ID = "atendimento-ia-rotina";

export async function registerSchedule() {
  const token = (process.env.QSTASH_TOKEN ?? "").trim();
  if (!token) return { registrado: false, motivo: "sem QSTASH_TOKEN" };
  const base = ((process.env.QSTASH_URL ?? "").trim() || "https://qstash.upstash.io").replace(/\/+$/, "");
  const destino = `${iaConfig.siteUrl()}/api/atendimento-ia/cron`;
  const res = await fetch(`${base}/v2/schedules/${destino}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "Upstash-Cron": "*/5 * * * *",
      "Upstash-Method": "GET",
      "Upstash-Retries": "2",
      "Upstash-Schedule-Id": SCHEDULE_ID,
      "Upstash-Forward-Authorization": `Bearer ${iaConfig.cronSecret()}`,
    },
    signal: AbortSignal.timeout(10000),
  }).catch((e: Error) => ({ ok: false, status: 0, name: e.name }));
  return { registrado: res.ok, http: res.status, id: SCHEDULE_ID };
}
