import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { iaConfig } from "@/lib/ia/config";
import { bearerOk } from "@/lib/ia/access";
import { healthReport, mpAccount } from "@/lib/ia/health";
import { confirmarEstorno, executarEstorno } from "@/lib/ia/reembolso";
import { store, type Contratacao } from "@/lib/ia/store";
import { cancelSubscription, comCanal, provision, reactivateKeepingPaid, reconcile, reconcileWithMp, refreshFromZm, syncPreapproval } from "@/lib/ia/process";
import { zm } from "@/lib/ia/zappmillion";
import { mp } from "@/lib/ia/mercadopago";

// Ações da operação (Authorization: Bearer IA_ADMIN_TOKEN):
//   { "acao": "listar" }                                → contratações e etapas
//   { "acao": "retentar", "id": "<contratação>" }        → nova tentativa segura de criar o acesso
//   { "acao": "sincronizar", "id": "..." }               → relê a assinatura no Mercado Pago
//   { "acao": "reenviar-convite", "id": "..." }          → novo e-mail de acesso (ZappMillion)
//   { "acao": "atualizar", "id": "..." }                 → relê o cliente no ZappMillion (período, WhatsApp)
//   { "acao": "webhook", "id"?: "..." }                 → URL de notificação (sem segredo), notificações recebidas,
//                                                          URL gravada na assinatura e autoteste assinado de ponta a ponta
//   { "acao": "tempos", "id": "..." }                   → aprovação no Mercado Pago → confirmação no banco → acesso no
//                                                          ZappMillion, com os intervalos e o canal que confirmou
//   { "acao": "cancelar-pendente", "id": "..." }        → cancela no Mercado Pago uma assinatura que nunca teve
//                                                          cobrança aprovada (checkout abandonado); sem efeito em cobranças
//   { "acao": "conta-mp" }                              → conta vendedora e aplicação do MP_ACCESS_TOKEN (sem o token)
//   { "acao": "reembolsar", "id": "..." }               → executa o estorno integral de um pedido de arrependimento
//   { "acao": "conferir-reembolso", "id": "..." }       → relê o pagamento e conclui se o Mercado Pago confirmou
//   { "acao": "saude" }                                  → o que falta, banco, notificação e modo das chaves (sem valores)
export async function POST(req: Request) {
  if (!bearerOk(req, iaConfig.adminToken())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { acao?: string; id?: string; via?: string };
  if (body.acao === "saude") return NextResponse.json({ ok: true, ...(await healthReport()) });
  if (body.acao === "conta-mp") return NextResponse.json({ ok: true, ...(await mpAccount()) });
  if (body.acao === "webhook") return NextResponse.json({ ok: true, ...(await webhookDiagnostics(body.id, body.via === "relay")) });
  if (body.acao === "conciliar") return NextResponse.json({ ok: true, divergencias: await reconcile() });
  const s = store();
  if (body.acao === "listar") {
    const all = await s.list({});
    return NextResponse.json({
      ok: true,
      contratacoes: all.map((c) => ({ id: c.id, empresa: c.empresa, etapa: c.etapa, avisoCadastro: c.avisoCadastroStatus ?? null, avisoTentativas: c.avisoCadastroTentativas ?? 0, mpStatus: c.mpStatus, zmStatus: c.zmStatus, pagoAte: c.pagoAte, whatsapp: c.whatsappStatus, confirmadoPor: c.confirmadoPor ?? null, ultimoErro: c.ultimoErro, preAvisoPara: c.preAvisoPara, avisoFornecedorPara: c.avisoFornecedorPara })),
    });
  }
  const c = body.id ? await s.get(body.id) : null;
  if (!c) return NextResponse.json({ ok: false, error: "nao_encontrada" }, { status: 404 });
  switch (body.acao) {
    case "retentar":
      return NextResponse.json({ ok: true, result: await provision({ ...c, tentativas: c.tentativas }) });
    case "sincronizar":
      return NextResponse.json({ ok: true, result: c.mpPreapprovalId ? await comCanal("admin", () => syncPreapproval(c.mpPreapprovalId!)) : "sem assinatura" });
    case "atualizar":
      if (!c.zmStatus) return NextResponse.json({ ok: false, error: "acesso_nao_criado" }, { status: 409 });
      await refreshFromZm(c);
      return NextResponse.json({ ok: true });
    case "verificar-mp":
      // Conferência direta no Mercado Pago (assinatura e cobranças), aplicando o estado real.
      return NextResponse.json({ ok: true, ...(await comCanal("admin", () => reconcileWithMp(c))), contratacao: await s.get(c.id).then((x) => ({ etapa: x?.etapa, zmStatus: x?.zmStatus, pagoAte: x?.pagoAte })) });
    case "cancelar-pendente":
      if (c.primeiroPagamentoEm || (await s.cobrancas(c.id)).length || !["aguardando_pagamento", "assinatura_autorizada"].includes(c.etapa))
        return NextResponse.json({ ok: false, error: "nao_aplicavel" }, { status: 409 });
      return NextResponse.json({ ok: true, result: await comCanal("admin", () => cancelSubscription(c)) });
    case "reembolsar":
      return NextResponse.json({ ok: true, reembolso: await comCanal("admin", () => executarEstorno(c)) });
    case "conferir-reembolso":
      return NextResponse.json({ ok: true, reembolso: await comCanal("admin", () => confirmarEstorno(c)) });
    case "tempos":
      return NextResponse.json({ ok: true, ...(await timeline(c)) });
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

/** Endereço sem query (a da prévia leva o segredo de bypass) e se o bypass está presente. */
function describeUrl(u: string | null | undefined) {
  if (!u) return null;
  try {
    const x = new URL(u);
    return { endereco: `${x.origin}${x.pathname}`, comBypass: x.searchParams.has("x-vercel-protection-bypass") };
  } catch {
    return { endereco: "inválido", comBypass: false };
  }
}

/**
 * Diagnóstico do webhook sem expor segredos: (1) URL que vai na criação da assinatura; (2) notificações
 * reais registradas; (3) URL que o Mercado Pago gravou na assinatura da contratação informada; (4)
 * autoteste: assina uma notificação com MP_WEBHOOK_SECRET e envia à própria URL pública, passando pela
 * proteção da Vercel, pela validação x-signature e pelo registro de eventos (tipo ignorado, sem efeito).
 */
async function webhookDiagnostics(id?: string, viaRelay = false) {
  // via "relay": o autoteste passa pelo repasse temporário (IA_MP_RELAY_URL), como fará o Mercado Pago.
  const relay = (process.env.IA_MP_RELAY_URL ?? "").trim();
  if (viaRelay && !relay) return { erro: "IA_MP_RELAY_URL não definida" };
  const url = viaRelay ? relay : (iaConfig.mpNotificationUrl() ?? (iaConfig.siteUrl() ? `${iaConfig.siteUrl()}/api/atendimento-ia/webhook` : null));
  const recebidas = await store().eventStats().catch((e: Error) => ({ erro: e.message }));
  let naAssinatura: unknown = "sem contratação informada";
  if (id) {
    const c = await store().get(id);
    if (!c?.mpPreapprovalId) naAssinatura = "sem assinatura";
    else
      naAssinatura = await mp
        .getPreapproval(c.mpPreapprovalId)
        .then((p) => ({ status: p.status, notificationUrl: describeUrl((p as { notification_url?: string }).notification_url) ?? "ausente na resposta" }))
        .catch((e: Error) => ({ erro: e.message }));
  }
  let autoteste: unknown = "sem URL ou sem MP_WEBHOOK_SECRET";
  const secret = iaConfig.mpWebhookSecret();
  if (url && secret) {
    const dataId = `autoteste-${Date.now()}`;
    const requestId = randomUUID();
    const ts = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
    const target = new URL(url);
    target.searchParams.set("data.id", dataId);
    target.searchParams.set("type", "autoteste");
    const t0 = Date.now();
    autoteste = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
      body: JSON.stringify({ type: "autoteste", action: "autoteste", data: { id: dataId } }),
      signal: AbortSignal.timeout(15000),
      redirect: "manual",
    })
      .then(async (r) => ({ http: r.status, ms: Date.now() - t0, resposta: r.headers.get("content-type")?.includes("json") ? await r.json().catch(() => null) : "não JSON (bloqueado antes da rota?)" }))
      .catch((e: Error) => ({ erro: e.message }));
  }
  return { url: describeUrl(url), segredo: !!secret, recebidas, naAssinatura, autoteste };
}

/** Linha do tempo da primeira cobrança, com os intervalos em segundos. */
async function timeline(c: Contratacao) {
  const cob = (await store().cobrancas(c.id)).filter((x) => x.aprovadaEm).sort((a, b) => a.aprovadaEm!.localeCompare(b.aprovadaEm!))[0];
  const aprovadoMp = cob?.pagamentoId ? await mp.getPayment(cob.pagamentoId).then((p) => p.date_approved ?? null).catch(() => null) : null;
  const confirmadoBanco = c.pagamentoConfirmadoEm ?? cob?.aprovadaEm ?? null;
  const acesso = c.acessoLiberadoEm ?? (c.zmStatus ? await zm.getClient(c.externalId).then((x) => x.createdAt).catch(() => null) : null);
  const sec = (a?: string | null, b?: string | null) => (a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000) : null);
  return {
    criadoEm: c.criadoEm,
    aprovadoNoMercadoPago: aprovadoMp,
    confirmadoNoBanco: confirmadoBanco,
    acessoNoZappMillion: acesso,
    confirmadoPor: c.confirmadoPor ?? "não registrado (contratação anterior à medição)",
    origemDosTempos: { banco: c.pagamentoConfirmadoEm ? "pagamento_confirmado_em" : "aprovada_em da cobrança", acesso: c.acessoLiberadoEm ? "acesso_liberado_em" : "createdAt do cliente no ZappMillion" },
    segundos: { aprovacaoAteBanco: sec(aprovadoMp, confirmadoBanco), bancoAteAcesso: sec(confirmadoBanco, acesso), aprovacaoAteAcesso: sec(aprovadoMp, acesso) },
  };
}
