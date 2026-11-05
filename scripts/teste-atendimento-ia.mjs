// Teste local do fluxo "Atendimento com IA" com Mercado Pago e ZappMillion SIMULADOS (nada sai da
// máquina; nenhuma assinatura, cliente ou cobrança real). Não substitui o teste nos ambientes de teste
// dos fornecedores (veja docs/ATENDIMENTO-IA.md).
//
// Antes: npm run build e, com as variáveis abaixo, `node node_modules/next/dist/bin/next start --port 3210`:
//   IA_STORE=memory IA_PRECO_MENSAL=297.00 IA_ZM_PLAN_ID=plan_teste IA_LIMITE_RESPOSTAS=2000
//   IA_CONTRATACAO_ATIVA=true NEXT_PUBLIC_SITE_URL=http://localhost:3210 IA_PAINEL_URL=https://painel.exemplo.test
//   IA_MEIOS_PAGAMENTO=cartao   (IA_CARENCIA_DIAS no padrão decidido: 10)
//   MP_ACCESS_TOKEN=teste-local MP_WEBHOOK_SECRET=segredo-teste MP_API_URL=http://localhost:4020
//   ZM_API_KEY=zm_test_local ZM_API_URL=http://localhost:4021 IA_ADMIN_TOKEN=admin-teste CRON_SECRET=cron-teste
// Segundo servidor (validação interna) em :3211 com as mesmas variáveis, exceto IA_CONTRATACAO_ATIVA, e com
//   IA_TOKEN_VALIDACAO=validacao-interna-teste-0123456789 NEXT_PUBLIC_SITE_URL=http://localhost:3211
// Uso: node scripts/teste-atendimento-ia.mjs
import http from "node:http";
import { createHmac } from "node:crypto";

const B = process.env.IA_TESTE_URL || "http://localhost:3210";
const SECRET = "segredo-teste";
const out = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();

/* ─────────────── Mercado Pago simulado ─────────────── */
const mp = { pre: new Map(), ap: new Map(), pay: new Map(), cb: new Map(), creates: [], puts: [] };
let seq = 1000;
http
  .createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      const send = (code, obj) => {
        res.writeHead(code, { "content-type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (req.headers.authorization !== "Bearer teste-local") return send(401, {});
      const u = new URL(req.url, "http://x");
      let m;
      if (/\/falha-/.test(u.pathname)) return send(503, { message: "indisponível" });
      if (/\/limite-/.test(u.pathname)) return send(429, { message: "local_rate_limited" });
      if (req.method === "POST" && u.pathname === "/preapproval") {
        const body = JSON.parse(b);
        mp.creates.push(body);
        const id = `pre_${seq++}`;
        const pre = { id, status: "pending", reason: body.reason, external_reference: body.external_reference, payer_email: body.payer_email, auto_recurring: body.auto_recurring, init_point: `https://mp.simulado/checkout?preapproval_id=${id}` };
        mp.pre.set(id, pre);
        return send(201, pre);
      }
      if ((m = u.pathname.match(/^\/preapproval\/(.+)$/))) {
        if (req.method === "GET") mp.gets = (mp.gets ?? 0) + 1;
        const pre = mp.pre.get(m[1]);
        if (!pre) return send(404, {});
        if (req.method === "PUT") {
          const body = JSON.parse(b || "{}");
          mp.puts.push({ id: m[1], ...body });
          if (body.status) pre.status = body.status;
        }
        return send(200, pre);
      }
      if (u.pathname === "/authorized_payments/search") return send(200, { results: [...mp.ap.values()].filter((a) => a.preapproval_id === u.searchParams.get("preapproval_id")) });
      if ((m = u.pathname.match(/^\/authorized_payments\/(.+)$/))) return mp.ap.has(m[1]) ? send(200, mp.ap.get(m[1])) : send(404, {});
      if ((m = u.pathname.match(/^\/v1\/payments\/(.+)$/))) return mp.pay.has(m[1]) ? send(200, mp.pay.get(m[1])) : send(404, {});
      if ((m = u.pathname.match(/^\/v1\/chargebacks\/(.+)$/))) return mp.cb.has(m[1]) ? send(200, mp.cb.get(m[1])) : send(404, {});
      send(404, {});
    });
  })
  .listen(4020);

/* ─────────────── ZappMillion simulado ─────────────── */
const zm = { clients: new Map(), charges: new Map(), creates: [], suspends: [], reactivates: [], failCreate: 0 };
const zmCharge = (extId, start, status = "PAID") => {
  const list = zm.charges.get(extId) ?? [];
  list.unshift({ id: `ch_${seq++}`, status, amount: 97, currency: "BRL", planId: "plan_teste", periodStart: iso(start), periodEnd: iso(start + 30 * DAY), failureReason: null, createdAt: iso(start), paidAt: status === "PAID" ? iso(start) : null });
  zm.charges.set(extId, list);
};
const sub = (start) => ({ status: "ACTIVE", planId: "plan_teste", amount: 97, currency: "BRL", currentPeriodStart: iso(start), currentPeriodEnd: iso(start + 30 * DAY), scheduledPlanId: null });
http
  .createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      const send = (code, obj) => {
        res.writeHead(code, { "content-type": "application/json" });
        res.end(obj === undefined ? "" : JSON.stringify(obj));
      };
      if (req.headers.authorization !== "Bearer zm_test_local") return send(401, { type: "InvalidApiKey" });
      const u = new URL(req.url, "http://x");
      if (req.method === "GET" && u.pathname === "/plans") return send(200, { data: [{ id: "plan_teste", name: "PRO", monthlyPrice: 97, currency: "BRL", agentReplyLimit: 2000, billingCycleDays: 30 }] });
      if (req.method === "POST" && u.pathname === "/clients") {
        const body = JSON.parse(b);
        zm.creates.push(body);
        if (zm.failCreate > 0) {
          zm.failCreate--;
          return send(500, { type: "InternalError" });
        }
        if (zm.clients.has(body.externalId)) return send(200, zm.clients.get(body.externalId));
        const c = { externalId: body.externalId, name: body.name, status: "ACTIVE", organizationId: "org_1", workspaceId: "ws_1", userId: "usr_1", subscription: sub(Date.now()), messagingAccount: null, createdAt: iso(Date.now()) };
        zm.clients.set(body.externalId, c);
        zmCharge(body.externalId, Date.parse(c.subscription.currentPeriodStart));
        return send(201, c);
      }
      let m;
      if ((m = u.pathname.match(/^\/clients\/([^/]+)\/charges$/))) return send(200, { data: zm.charges.get(decodeURIComponent(m[1])) ?? [], total: 0, limit: 20, offset: 0 });
      if ((m = u.pathname.match(/^\/clients\/([^/]+)$/)) && req.method === "GET") {
        const c = zm.clients.get(decodeURIComponent(m[1]));
        return c ? send(200, c) : send(404, { type: "ProvisionedClientNotFound" });
      }
      if ((m = u.pathname.match(/^\/clients\/([^/]+)\/suspend$/))) {
        const c = zm.clients.get(decodeURIComponent(m[1]));
        zm.suspends.push(decodeURIComponent(m[1]));
        c.status = "SUSPENDED";
        c.subscription = null;
        return send(200, c);
      }
      if ((m = u.pathname.match(/^\/clients\/([^/]+)\/reactivate$/))) {
        const c = zm.clients.get(decodeURIComponent(m[1]));
        zm.reactivates.push(decodeURIComponent(m[1]));
        c.status = "ACTIVE";
        c.subscription = sub(Date.now());
        return send(200, c);
      }
      send(404, {});
    });
  })
  .listen(4021);

/* ─────────────── auxiliares ─────────────── */
const json = async (path, opts = {}) => {
  const r = await fetch(B + path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
let rid = 1;
function notify(type, dataId, { sign = true, requestId = `req-${rid++}` } = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", sign ? SECRET : "outro-segredo").update(`id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  return json(`/api/atendimento-ia/webhook?data.id=${encodeURIComponent(dataId)}&type=${type}`, {
    method: "POST",
    headers: { "x-signature": `ts=${ts},v1=${sig}`, "x-request-id": requestId },
    body: JSON.stringify({ type, action: `${type}.updated`, data: { id: dataId } }),
  });
}
const status = (c) => json(`/api/atendimento-ia/status?c=${c.id}&t=${c.token}`).then((r) => r.body.status);
const admin = (acao, id) => json("/api/atendimento-ia/admin", { method: "POST", headers: { authorization: "Bearer admin-teste" }, body: JSON.stringify({ acao, id }) });
const row = async (c) => (await admin("listar")).body.contratacoes.find((x) => x.id === c.id);
const cron = (agoraMs) => json("/api/atendimento-ia/cron", { headers: { authorization: "Bearer cron-teste", ...(agoraMs ? { "x-ia-agora": iso(agoraMs) } : {}) } });
const ext = (c) => `spolaor-ia-${c.id}`;
async function contratar(empresa, email) {
  const r = await json("/api/atendimento-ia/contratar", { method: "POST", body: JSON.stringify({ empresa, responsavel: "Pessoa Teste", email, telefone: "(11) 98765-4321", aceite: true, precoMensal: 1, utm: { utm_source: "teste" } }) });
  const u = new URL(B + r.body.acompanhar);
  return { ...r, id: u.searchParams.get("c"), token: u.searchParams.get("t") };
}
const preOf = (c) => [...mp.pre.values()].find((p) => p.external_reference === c.id);
function charge(c, { status = "approved", amount = 297, debit = iso(Date.now()) } = {}) {
  const pre = preOf(c);
  const id = String(seq++);
  const payId = String(seq++);
  mp.ap.set(id, { id: Number(id), preapproval_id: pre.id, status: status === "approved" ? "processed" : "scheduled", transaction_amount: amount, currency_id: "BRL", debit_date: debit, external_reference: c.id, payment: { id: Number(payId), status, status_detail: "" } });
  mp.pay.set(payId, { id: Number(payId), status, transaction_amount: amount, currency_id: "BRL", metadata: { preapproval_id: pre.id } });
  return {
    id,
    payId,
    approve() {
      mp.ap.get(id).payment.status = "approved";
      mp.ap.get(id).status = "processed";
      mp.pay.get(payId).status = "approved";
    },
  };
}

/* ─────────────── cenários ─────────────── */
const page = await (await fetch(B + "/atendimento-ia")).text();
ok(page.includes("297,00") && page.includes("a cada 30 dias") && page.includes("Comprar agora") && page.includes('href="#comprar"'), "página: R$ 297,00 a cada 30 dias e CTA Comprar agora levando ao formulário");
ok(page.includes("No cartão, a renovação é cobrada automaticamente") && !page.includes("No Pix"), "só o meio validado (cartão) aparece nas condições e no aceite");
ok(!/implanta[çc][ãa]o (inicial )?(é feita )?pela Spolaor|configurad[oa] pela Spolaor|por mês|\/mês/i.test(page), "página sem implantação pela Spolaor e sem 'por mês'");
ok(!/zm_test_local|teste-local|segredo-teste/.test(page), "nenhuma credencial no HTML");

const bad = await json("/api/atendimento-ia/contratar", { method: "POST", body: JSON.stringify({ empresa: "", email: "x", aceite: false }) });
ok(bad.status === 422 && bad.body.errors?.aceite && bad.body.errors?.email, "contratação valida campos e aceite (422)");

const c1 = await contratar("Empresa Um", "um@exemplo.test");
const cr = mp.creates[0];
ok(c1.body.checkoutUrl?.startsWith("https://mp.simulado/"), "contratação devolve o checkout do Mercado Pago");
ok(cr?.auto_recurring?.transaction_amount === 297 && cr.auto_recurring.frequency === 30 && cr.auto_recurring.frequency_type === "days" && cr.status === "pending", "assinatura: 297,00 BRL a cada 30 dias (preço do servidor; o navegador mandou 1)");
ok(/297,00 a cada 30 dias/.test(cr?.reason ?? "") && (cr?.reason ?? "").length <= 60, "descrição do checkout: R$ 297,00 a cada 30 dias, até 60 caracteres (limite do Mercado Pago)");

ok(!(await status(c1)).pagamentoConfirmado, "retorno do checkout não confirma nada");
ok((await json(`/api/atendimento-ia/status?c=${c1.id}&t=errado`)).status === 404, "token errado → 404");
ok((await notify("subscription_preapproval", preOf(c1).id, { sign: false })).status === 401, "assinatura x-signature inválida → 401");
ok((await json(`/api/atendimento-ia/webhook?data.id=x&type=payment`, { method: "POST", body: "{}" })).status === 401, "sem x-signature → 401");
{
  const d = (await json("/api/atendimento-ia/admin", { method: "POST", headers: { authorization: "Bearer admin-teste" }, body: JSON.stringify({ acao: "webhook" }) })).body;
  ok(d.autoteste?.http === 200 && d.autoteste?.resposta?.result?.ignored === "tipo autoteste" && !JSON.stringify(d).includes("segredo-teste"), "diagnóstico do webhook: autoteste assinado passa pela rota, sem expor o segredo");
}
ok((await notify("subscription_preapproval", "ABCdef123", { requestId: "req-maiusc" })).status !== 401, "x-signature com data.id alfanumérico assinado em minúsculas → aceito");

preOf(c1).status = "authorized";
await notify("subscription_preapproval", preOf(c1).id);
{
  const s1 = await status(c1);
  ok(s1.passos[0].titulo === "Pagamento em processamento" && s1.confirmando === true && s1.liberando === false, "assinatura autorizada ≠ pagamento aprovado; página indica que está conferindo");
}
await notify("subscription_authorized_payment", charge(c1, { status: "rejected" }).id);
await notify("subscription_authorized_payment", charge(c1, { amount: 197 }).id);
ok(zm.creates.length === 0, "cobrança recusada ou com valor divergente não cria nada");

// Primeiro pagamento aprovado, com 6 entregas simultâneas (ids de requisição diferentes) + 1 repetida
const p1 = charge(c1);
const results = await Promise.all(
  [...Array(6)].map(() => notify("subscription_authorized_payment", p1.id)).concat(notify("subscription_authorized_payment", p1.id, { requestId: "dup" }), notify("subscription_authorized_payment", p1.id, { requestId: "dup" })),
);
ok(results.every((r) => r.status === 200), "entregas simultâneas e repetidas respondem 200");
ok(new Set(zm.creates.map((x) => x.externalId)).size === 1 && zm.clients.size === 1, "simultâneas: um único cliente no ZappMillion (externalId estável)");
let r1 = await row(c1);
ok(r1.confirmadoPor === "webhook", "canal da confirmação registrado: webhook");
{
  const t = (await admin("tempos", c1.id)).body;
  ok(t.confirmadoNoBanco && t.acessoNoZappMillion && t.segundos?.bancoAteAcesso != null && t.segundos.bancoAteAcesso >= 0, "linha do tempo: confirmação no banco → acesso no ZappMillion medida");
}
const zm1 = zm.clients.get(ext(c1)).subscription.currentPeriodEnd;
ok(r1.pagoAte === zm1, "período pago termina exatamente na renovação do fornecedor (acesso + 30 dias)");
let st = await status(c1);
ok(st.acessoLiberado && st.passos[1].titulo === "Acesso liberado" && st.passos[2].status === "no_painel" && st.passos[3].status === "no_painel", "acesso liberado; agente e WhatsApp como tarefas no painel, não concluídas");

zm.clients.get(ext(c1)).messagingAccount = { id: "ma_1", status: "CONNECTED" };
await admin("atualizar", c1.id);
st = await status(c1);
ok(st.passos[3].titulo === "WhatsApp conectado" && st.passos[2].status === "no_painel", "WhatsApp conectado separado do agente configurado");

// Renovação paga antecipada, com entregas simultâneas: soma UM ciclo
const paid1 = new Date(r1.pagoAte).getTime();
const p2 = charge(c1, { debit: iso(paid1 - 3_600_000) });
await Promise.all([...Array(5)].map(() => notify("subscription_authorized_payment", p2.id)));
r1 = await row(c1);
ok(new Date(r1.pagoAte).getTime() === paid1 + 30 * DAY, "renovação paga: soma exatamente um ciclo, mesmo com entregas simultâneas");
ok(zm.creates.length === new Set(zm.creates.map((x) => x.externalId)).size && zm.reactivates.length === 0, "renovação não cria cliente nem reativa (sem cobrança extra do fornecedor)");
zm.clients.get(ext(c1)).subscription = sub(paid1); // o fornecedor renova no fim do 1º período
zmCharge(ext(c1), paid1);
await cron(paid1);
ok(!zm.suspends.includes(ext(c1)), "com o próximo período pago, nada é suspenso na renovação do fornecedor");

// Cancelamento pela página: sem novas cobranças, acesso até o fim do período pago
const cancel = await json("/api/atendimento-ia/cancelar", { method: "POST", body: JSON.stringify({ c: c1.id, t: c1.token, confirmar: true }) });
ok(cancel.status === 200 && mp.puts.some((p) => p.id === preOf(c1).id && p.status === "cancelled"), "cancelamento envia status cancelled ao Mercado Pago");
st = await status(c1);
ok(st.cancelada && st.acessoLiberado && /continua até/.test(st.resumo), "cancelada: acesso continua e a página mostra até quando");
const end1 = new Date((await row(c1)).pagoAte).getTime();
await cron(end1 - 12 * 3_600_000);
ok((await row(c1)).preAvisoPara === (await row(c1)).pagoAte && !zm.suspends.includes(ext(c1)), "cancelada: pré-aviso à operação 24 h antes do fim, sem suspender");
await cron(end1 - 1);
ok(!zm.suspends.includes(ext(c1)), "1 ms antes do fim do período pago: não suspende");
await cron(end1);
ok(zm.suspends.includes(ext(c1)), "no instante exato do fim do período pago (= renovação do fornecedor): suspende antes de renovar");

// Renovação não paga, fornecedor ainda não renovou → suspende no fim; pagamento tardio reativa
const c2 = await contratar("Empresa Dois", "dois@exemplo.test");
zm.failCreate = 1;
await notify("subscription_authorized_payment", charge(c2).id);
st = await status(c2);
ok(st.pagamentoConfirmado && st.passos[1].titulo === "Ativação pendente" && !st.acessoLiberado, "pago + falha no ZappMillion → ativação pendente, sem acesso liberado");
ok((await admin("retentar", c2.id)).body.result?.created && zm.clients.has(ext(c2)), "nova tentativa usa o mesmo externalId e cria o acesso");
const end2 = new Date((await row(c2)).pagoAte).getTime();
const late = charge(c2, { status: "pending", debit: iso(end2) });
await notify("subscription_authorized_payment", late.id);
await cron(end2 - 60_000);
ok(!zm.suspends.includes(ext(c2)), "cobrança pendente antes do fim: acesso mantido");
await cron(end2);
ok(zm.suspends.includes(ext(c2)), "fim do período sem pagamento e sem renovação do fornecedor: suspende");
late.approve();
await notify("payment", late.payId); // só a notificação de pagamento
const r2 = await row(c2);
ok(zm.reactivates.includes(ext(c2)) && r2.etapa === "acesso_criado" && r2.pagoAte === zm.clients.get(ext(c2)).subscription.currentPeriodEnd, "pendente → aprovado só com a notificação de pagamento: reativa e o novo período acompanha o fornecedor");

// Renovação não paga quando o fornecedor JÁ renovou: tolerância, depois suspende
const c3 = await contratar("Empresa Três", "tres@exemplo.test");
await notify("subscription_authorized_payment", charge(c3).id);
const end3 = new Date((await row(c3)).pagoAte).getTime();
zm.clients.get(ext(c3)).subscription = sub(end3); // o ZappMillion cobrou o novo ciclo
zmCharge(ext(c3), end3, "PAID");
await cron(end3 + DAY);
ok(!zm.suspends.includes(ext(c3)) && (await row(c3)).avisoFornecedorPara === iso(end3), "fornecedor já renovou: operação avisada AO ENTRAR na carência, acesso mantido");
await cron(end3 + 10 * DAY - 1);
ok(!zm.suspends.includes(ext(c3)), "carência: 1 ms antes do fim dos 10 dias, acesso mantido");
await cron(end3 + 10 * DAY);
ok(zm.suspends.includes(ext(c3)), "fim da carência de 10 dias sem pagamento: suspende");

// currentPeriodEnd mudou, mas a cobrança do fornecedor está PENDENTE: não conta como renovado → sem carência
const c7 = await contratar("Empresa Sete", "sete@exemplo.test");
await notify("subscription_authorized_payment", charge(c7).id);
const end7 = new Date((await row(c7)).pagoAte).getTime();
zm.clients.get(ext(c7)).subscription = sub(end7);
zmCharge(ext(c7), end7, "PENDING");
await cron(end7);
ok(zm.suspends.includes(ext(c7)) && !(await row(c7)).avisoFornecedorPara, "período do fornecedor avançou com cobrança pendente: sem carência, suspende no fim do período pago");

// Cancelada com o fornecedor já renovado e pago: sem carência
const c8 = await contratar("Empresa Oito", "oito@exemplo.test");
await notify("subscription_authorized_payment", charge(c8).id);
const end8 = new Date((await row(c8)).pagoAte).getTime();
preOf(c8).status = "cancelled";
await notify("subscription_preapproval", preOf(c8).id);
zm.clients.get(ext(c8)).subscription = sub(end8);
zmCharge(ext(c8), end8, "PAID");
await cron(end8 + 60_000);
ok(zm.suspends.includes(ext(c8)) && (await row(c8)).avisoFornecedorPara === iso(end8), "cancelada: sem carência mesmo com o fornecedor renovado; operação avisada do custo");

// Estorno e contestação
const c4 = await contratar("Empresa Quatro", "quatro@exemplo.test");
const p4 = charge(c4);
await notify("subscription_authorized_payment", p4.id);
mp.pay.get(p4.payId).status = "refunded";
await notify("payment", p4.payId);
ok(zm.suspends.includes(ext(c4)), "estorno suspende o acesso");
const c5 = await contratar("Empresa Cinco", "cinco@exemplo.test");
const p5 = charge(c5);
await notify("subscription_authorized_payment", p5.id);
mp.pay.get(p5.payId).status = "charged_back";
mp.cb.set("cb_1", { id: "cb_1", payments: [Number(p5.payId)] });
await notify("topic_chargebacks_wh", "cb_1");
ok(zm.suspends.includes(ext(c5)), "contestação suspende o acesso");

// Fora de ordem: cobrança pendente sem notificação própria; aprovação chega só como pagamento; depois a assinatura
const c6 = await contratar("Empresa Seis", "seis@exemplo.test");
const p6 = charge(c6, { status: "pending" });
p6.approve();
await notify("payment", p6.payId);
preOf(c6).status = "authorized";
await notify("subscription_preapproval", preOf(c6).id);
st = await status(c6);
ok(st.pagamentoConfirmado && st.passos[1].titulo === "Acesso liberado", "fora de ordem + só notificação de pagamento: acesso criado e etapa não regride");

// Link de validação interna num segundo servidor com tudo configurado, mas IA_CONTRATACAO_ATIVA desligada
const BV = process.env.IA_TESTE_URL_VALIDACAO || "http://localhost:3211";
const TOKEN = "validacao-interna-teste-0123456789";
const pv = await fetch(BV + "/atendimento-ia").then((r) => r.text()).catch(() => null);
if (pv === null) ok(false, "servidor de validação em " + BV + " não respondeu");
else {
  const pt = await (await fetch(BV + "/atendimento-ia?acesso=" + TOKEN)).text();
  ok(pv.includes("Quero ser avisado") && !pv.includes("Modo de validação"), "contratação desligada: página pública sem compra");
  ok(pt.includes("Modo de validação interna") && pt.includes("Comprar agora"), "link com token: formulário de compra e aviso de validação");
  const body = { empresa: "Spolaor validação", responsavel: "Teste", email: "validacao@exemplo.test", telefone: "11987654321", aceite: true };
  const sem = await fetch(BV + "/api/atendimento-ia/contratar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const errado = await fetch(BV + "/api/atendimento-ia/contratar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, acesso: "x".repeat(34) }) });
  const com = await fetch(BV + "/api/atendimento-ia/contratar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, acesso: TOKEN }) });
  const comBody = await com.json().catch(() => ({}));
  ok(sem.status === 503 && errado.status === 503 && com.status === 200 && !!comBody.checkoutUrl, "API: sem token ou token errado → 503; token certo → checkout");
  const u = new URL(BV + comBody.acompanhar);
  const vst = (await (await fetch(BV + "/api/atendimento-ia/status?c=" + u.searchParams.get("c") + "&t=" + u.searchParams.get("t"))).json()).status;
  ok(vst?.interna === true, "compra de validação marcada como interna (não dispara Purchase)");
}

ok((await json("/api/atendimento-ia/admin", { method: "POST", body: JSON.stringify({ acao: "listar" }) })).status === 401 && (await json("/api/atendimento-ia/cron")).status === 401, "rotas internas exigem token");
ok((await json("/api/atendimento-ia/configuracao", { method: "POST", body: "{}" })).status === 404, "sem briefing obrigatório");

// Notificação de recurso inexistente (simulação do painel, data.id 123456): 200 ignorada, sem efeito;
// a mesma entrega repetida continua duplicada. Falhas transitórias (5xx, 429): 500 e nova tentativa aceita.
{
  const antes = JSON.stringify((await admin("listar")).body.contratacoes);
  const criados = zm.creates.length;
  const n1 = await notify("subscription_preapproval", "123456", { requestId: "simulacao-painel" });
  const n2 = await notify("payment", "123456", { requestId: "simulacao-pagamento" });
  const n3 = await notify("subscription_authorized_payment", "999999", { requestId: "simulacao-cobranca" });
  ok(n1.status === 200 && n1.body.ignored && n2.status === 200 && n2.body.ignored && n3.status === 200 && n3.body.ignored, "recurso inexistente no Mercado Pago (simulação do painel) → 200 ignorada");
  ok(JSON.stringify((await admin("listar")).body.contratacoes) === antes && zm.creates.length === criados, "recurso inexistente: nenhuma contratação alterada, nenhum acesso criado");
  ok((await notify("subscription_preapproval", "123456", { requestId: "simulacao-painel" })).body.duplicate === true, "simulação repetida (mesmo request-id) → duplicada");
  const f1 = await notify("subscription_preapproval", "falha-1", { requestId: "transitoria-1" });
  const f2 = await notify("subscription_preapproval", "falha-1", { requestId: "transitoria-1" });
  ok(f1.status === 500 && f2.status === 500, "Mercado Pago 5xx → 500 e a nova tentativa da mesma entrega é processada (não vira duplicada)");
  const l1 = await notify("payment", "limite-1", { requestId: "limite-1" });
  ok(l1.status === 500, "Mercado Pago 429 persistente (após as novas tentativas internas) → 500 para nova tentativa");
}

// Sem nenhuma notificação: só a página de acompanhamento aberta libera o acesso, com no máximo uma
// leitura no Mercado Pago a cada 25 s mesmo com várias consultas seguidas.
{
  const c9 = await contratar("Empresa Nove", "nove@exemplo.test");
  preOf(c9).status = "authorized";
  charge(c9);
  const before = mp.gets ?? 0;
  const [a9] = await Promise.all([status(c9), status(c9), status(c9)]);
  const b9 = await status(c9);
  const lidas = (mp.gets ?? 0) - before;
  ok((a9.acessoLiberado || b9.acessoLiberado) && lidas === 1, `sem webhook: página de acompanhamento confirma e libera sozinha (${lidas} leitura no Mercado Pago para 4 consultas)`);
  ok((await row(c9)).confirmadoPor === "acompanhamento" && b9.confirmando === false && !!b9.conferidoEm, "canal registrado: acompanhamento; página deixa de mostrar 'conferindo'");
}
// Sem notificação e com a página fechada: a rotina confere e libera.
{
  const c10 = await contratar("Empresa Dez", "dez@exemplo.test");
  preOf(c10).status = "authorized";
  charge(c10);
  await cron();
  const r10 = await row(c10);
  ok(r10.zmStatus === "ACTIVE" && r10.confirmadoPor === "rotina", "sem webhook e sem página aberta: a rotina confirma e libera (canal: rotina)");
}

console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("OK")).length} OK, ${out.filter((l) => l.startsWith("FALHA")).length} falhas`);
process.exit(out.some((l) => l.startsWith("FALHA")) ? 1 : 0);
