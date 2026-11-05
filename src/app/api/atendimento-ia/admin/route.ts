import { NextResponse } from "next/server";
import { iaConfig, readiness } from "@/lib/ia/config";
import { bearerOk } from "@/lib/ia/access";
import { dbHealth, store } from "@/lib/ia/store";
import { provision, reactivateKeepingPaid, reconcile, refreshFromZm, syncPreapproval } from "@/lib/ia/process";
import { zm } from "@/lib/ia/zappmillion";

// Ações da operação (Authorization: Bearer IA_ADMIN_TOKEN):
//   { "acao": "listar" }                                → contratações e etapas
//   { "acao": "retentar", "id": "<contratação>" }        → nova tentativa segura de criar o acesso
//   { "acao": "sincronizar", "id": "..." }               → relê a assinatura no Mercado Pago
//   { "acao": "reenviar-convite", "id": "..." }          → novo e-mail de acesso (ZappMillion)
//   { "acao": "atualizar", "id": "..." }                 → relê o cliente no ZappMillion (período, WhatsApp)
//   { "acao": "saude" }                                  → o que falta, banco, notificação e modo das chaves (sem valores)
export async function POST(req: Request) {
  if (!bearerOk(req, iaConfig.adminToken())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { acao?: string; id?: string };
  if (body.acao === "saude") return NextResponse.json({ ok: true, ...(await health()) });
  if (body.acao === "conciliar") return NextResponse.json({ ok: true, divergencias: await reconcile() });
  const s = store();
  if (body.acao === "listar") {
    const all = await s.list({});
    return NextResponse.json({
      ok: true,
      contratacoes: all.map((c) => ({ id: c.id, empresa: c.empresa, etapa: c.etapa, mpStatus: c.mpStatus, zmStatus: c.zmStatus, pagoAte: c.pagoAte, whatsapp: c.whatsappStatus, ultimoErro: c.ultimoErro, preAvisoPara: c.preAvisoPara, avisoFornecedorPara: c.avisoFornecedorPara })),
    });
  }
  const c = body.id ? await s.get(body.id) : null;
  if (!c) return NextResponse.json({ ok: false, error: "nao_encontrada" }, { status: 404 });
  switch (body.acao) {
    case "retentar":
      return NextResponse.json({ ok: true, result: await provision({ ...c, tentativas: c.tentativas }) });
    case "sincronizar":
      return NextResponse.json({ ok: true, result: c.mpPreapprovalId ? await syncPreapproval(c.mpPreapprovalId) : "sem assinatura" });
    case "atualizar":
      if (!c.zmStatus) return NextResponse.json({ ok: false, error: "acesso_nao_criado" }, { status: 409 });
      await refreshFromZm(c);
      return NextResponse.json({ ok: true });
    case "reativar":
      // Só para quem tem período pago e foi suspenso pelo fornecedor (não pelo site).
      if (c.etapa === "suspensa" || c.zmStatus === "ACTIVE") return NextResponse.json({ ok: false, error: "nao_aplicavel" }, { status: 409 });
      return NextResponse.json({ ok: true, result: await reactivateKeepingPaid(c) });
    case "reenviar-convite":
      if (c.zmStatus !== "ACTIVE") return NextResponse.json({ ok: false, error: "acesso_nao_criado" }, { status: 409 });
      await zm.resendInvite(c.externalId);
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ ok: false, error: "acao_desconhecida" }, { status: 400 });
  }
}

/** Diagnóstico sem valores secretos: nomes do que falta, modo das chaves e alcance dos fornecedores. */
async function health() {
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
  let mpConta: unknown = "não consultado";
  if (iaConfig.mpToken()) {
    mpConta = await fetch(`${iaConfig.mpApi()}/users/me`, { headers: { authorization: `Bearer ${iaConfig.mpToken()}` }, signal: AbortSignal.timeout(8000) })
      .then(async (r) => {
        const u = await r.json().catch(() => ({}));
        return r.ok ? { contaDeTeste: Array.isArray(u.tags) && u.tags.includes("test_user"), tokenDeTeste: iaConfig.mpToken().startsWith("TEST-"), site: u.site_id } : { erro: `HTTP ${r.status}` };
      })
      .catch((e: Error) => ({ erro: e.message }));
  }
  return {
    ambiente: process.env.VERCEL_ENV ?? "local",
    falta: readiness().missing,
    banco: await dbHealth(),
    notificacao: { urlNaCriacao: !!iaConfig.mpNotificationUrl(), bypassDaPrevia: !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET, segredoDasNotificacoes: !!iaConfig.mpWebhookSecret() },
    zappmillion: { modo: zmKey.startsWith("zm_test_") ? "teste" : zmKey.startsWith("zm_live_") ? "produção" : zmKey ? "?" : "sem chave", plano: zmPlano },
    mercadoPago: mpConta,
    urlPublica: iaConfig.siteUrl() || null,
  };
}
