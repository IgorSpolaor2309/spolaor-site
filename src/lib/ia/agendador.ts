import { iaConfig } from "./config";

// Rotina a cada 15 minutos pelo QStash (Upstash, Vercel Marketplace): o cron da Vercel no plano Hobby é
// diário e o agendamento do GitHub Actions não disparou. O registro é idempotente (id fixo) e feito no
// servidor, para ninguém manusear QSTASH_TOKEN nem CRON_SECRET. Nunca devolver o corpo da resposta.
//
// Por que 15 minutos: cada execução consulta o banco, e o Neon só dorme após 5 minutos sem atividade. A cada
// 5 minutos ele ficaria sempre ligado (720 h x 0,25 CU = 180 CU-horas por mês, contra 100 no plano Free) e
// seria suspenso perto do 17º dia do ciclo, parando compras e notificações. A cada 15: cerca de 60 CU-horas.
// Em plano pago do Neon, basta voltar para 5 e repetir ?agendar=1.
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
      "Upstash-Cron": "*/15 * * * *",
      "Upstash-Method": "GET",
      "Upstash-Retries": "2",
      "Upstash-Schedule-Id": SCHEDULE_ID,
      "Upstash-Forward-Authorization": `Bearer ${iaConfig.cronSecret()}`,
    },
    signal: AbortSignal.timeout(10000),
  }).catch((e: Error) => ({ ok: false, status: 0, name: e.name }));
  return { registrado: res.ok, http: res.status, id: SCHEDULE_ID };
}
