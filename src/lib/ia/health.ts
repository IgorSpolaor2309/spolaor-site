import { iaConfig, readiness } from "./config";
import { dbHealth } from "./store";
import { zm } from "./zappmillion";

// Diagnóstico de produção sem valores secretos e só com leituras: não cria cliente nem cobrança.

/** Diagnóstico sem valores secretos: nomes do que falta, modo das chaves e alcance dos fornecedores. */
export async function healthReport() {
  const zmKey = iaConfig.zmKey();
  const zmPlan = iaConfig.zmPlanId();
  let zmPlano: unknown = "não consultado";
  if (zmKey) {
    zmPlano = await zm
      .plans()
      .then((ps) => {
        const p = ps.find((x) => x.id === zmPlan);
        return p ? { encontrado: true, nome: p.name, custo: p.monthlyPrice, respostas: p.agentReplyLimit, ciclo: p.billingCycleDays } : { encontrado: false, disponiveis: ps.map((x) => x.id) };
      })
      .catch((e: Error) => ({ erro: e.message }));
  }
  let zmConta: unknown = "não consultado";
  if (zmKey) {
    zmConta = await Promise.all([zm.billing(), zm.listClients(0)])
      .then(([b, c]) => ({ cartao: b.paymentMethod?.status ?? "sem cartão", assinaturasAtivas: b.activeSubscriptions, custoMensal: b.monthlyAmount, clientes: c.total }))
      .catch((e: Error) => ({ erro: e.message }));
  }
  let mpConta: unknown = "não consultado";
  if (iaConfig.mpToken()) {
    mpConta = await fetch(`${iaConfig.mpApi()}/users/me`, { headers: { authorization: `Bearer ${iaConfig.mpToken()}` }, signal: AbortSignal.timeout(8000) })
      .then(async (r) => {
        const u = await r.json().catch(() => ({}));
        return r.ok ? { contaDeTeste: Array.isArray(u.tags) && u.tags.includes("test_user"), tokenDeTeste: iaConfig.mpToken().startsWith("TEST-"), site: u.site_id } : { erro: `HTTP ${r.status}` };
      })
      .catch((e: Error) => ({ erro: e.name }));
  }
  return {
    ambiente: process.env.VERCEL_ENV ?? "local",
    falta: readiness().missing,
    banco: await dbHealth(),
    notificacao: { urlNaCriacao: !!iaConfig.mpNotificationUrl(), bypassDaPrevia: !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET, segredoDasNotificacoes: !!iaConfig.mpWebhookSecret() },
    zappmillion: { modo: zmKey.startsWith("zm_test_") ? "teste" : zmKey.startsWith("zm_live_") ? "produção" : zmKey ? "?" : "sem chave", plano: zmPlano, conta: zmConta },
    mercadoPago: mpConta,
    agendador5min: !!(process.env.QSTASH_TOKEN ?? "").trim(),
    urlPublica: iaConfig.siteUrl() || null,
  };
}

/**
 * Qual conta e qual aplicação o MP_ACCESS_TOKEN usa, para configurar o webhook no lugar certo. Mostra só
 * identificadores públicos (id do usuário, apelido, id da aplicação), nunca o token.
 */
export async function mpAccount() {
  const token = iaConfig.mpToken();
  if (!token) return { erro: "sem MP_ACCESS_TOKEN" };
  const seg = token.split("-");
  // Formato observado: APP_USR-<id da aplicação>-<data>-<hash>-<id do usuário>
  const appId = seg.length >= 5 && /^\d+$/.test(seg[1]) ? seg[1] : null;
  const userIdNoToken = seg.length >= 5 && /^\d+$/.test(seg[seg.length - 1]) ? seg[seg.length - 1] : null;
  const get = (path: string) =>
    fetch(`${iaConfig.mpApi()}${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }).then(async (r) => ({ http: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> }));
  const me = await get("/users/me").catch((e: Error) => ({ http: 0, body: { erro: e.name } as Record<string, unknown> }));
  const app = appId ? await get(`/applications/${appId}`).catch(() => null) : null;
  const tags = Array.isArray(me.body.tags) ? (me.body.tags as string[]) : [];
  return {
    prefixo: seg[0],
    usuario: { id: me.body.id ?? null, apelido: me.body.nickname ?? null, site: me.body.site_id ?? null, contaDeTeste: tags.includes("test_user"), idConfereComToken: userIdNoToken ? String(me.body.id) === userIdNoToken : null },
    aplicacao: { id: appId, http: app?.http ?? null, nome: (app?.body.name as string | undefined) ?? null, dono: (app?.body.owner_id as number | undefined) ?? null },
    painel: appId ? `https://www.mercadopago.com.br/developers/panel/app/${appId}` : "https://www.mercadopago.com.br/developers/panel/app",
  };
}
