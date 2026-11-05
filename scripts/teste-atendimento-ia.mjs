// Teste local do fluxo "Atendimento com IA": Mercado Pago e ZappMillion FALSOS (nada sai da máquina,
// nenhuma assinatura ou cobrança real). Sobe os dois provedores simulados, usa um build local em :3210
// e percorre pagamento aprovado/pendente/recusado, notificação inválida e repetida, falha e nova
// tentativa do provisionamento, renovação, guarda de renovação, cancelamento, reativação e estorno.
//
// Antes: npm run build e, com as variáveis abaixo, `next start --port 3200`:
//   IA_STORE=memory IA_PRECO_MENSAL=197 IA_ZM_PLAN_ID=plan_teste IA_LIMITE_RESPOSTAS=1000
//   IA_CONTRATACAO_ATIVA=true NEXT_PUBLIC_SITE_URL=http://localhost:3210
//   MP_ACCESS_TOKEN=teste-local MP_WEBHOOK_SECRET=segredo-teste MP_API_URL=http://localhost:4020
//   ZM_API_KEY=zm_test_local ZM_API_URL=http://localhost:4021 IA_ADMIN_TOKEN=admin-teste CRON_SECRET=cron-teste
// Uso: node scripts/teste-atendimento-ia.mjs
import http from "node:http";
import { createHmac } from "node:crypto";

const B = process.env.IA_TESTE_URL || "http://localhost:3210";
const SECRET = "segredo-teste";
const out = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const day = 86_400_000;

/* ─────────────── Mercado Pago simulado ─────────────── */
const mp = { pre: new Map(), ap: new Map(), pay: new Map(), cb: new Map(), creates: [] };
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
      if (req.method === "POST" && u.pathname === "/preapproval") {
        const body = JSON.parse(b);
        mp.creates.push(body);
        const id = `pre_${seq++}`;
        const pre = { id, status: "pending", external_reference: body.external_reference, payer_email: body.payer_email, auto_recurring: body.auto_recurring, init_point: `https://mp.simulado/checkout?preapproval_id=${id}` };
        mp.pre.set(id, pre);
        return send(201, pre);
      }
      let m;
      if ((m = u.pathname.match(/^\/preapproval\/(.+)$/))) return mp.pre.has(m[1]) ? send(200, mp.pre.get(m[1])) : send(404, {});
      if ((m = u.pathname.match(/^\/authorized_payments\/(.+)$/))) return mp.ap.has(m[1]) ? send(200, mp.ap.get(m[1])) : send(404, {});
      if ((m = u.pathname.match(/^\/v1\/payments\/(.+)$/))) return mp.pay.has(m[1]) ? send(200, mp.pay.get(m[1])) : send(404, {});
      if ((m = u.pathname.match(/^\/v1\/chargebacks\/(.+)$/))) return mp.cb.has(m[1]) ? send(200, mp.cb.get(m[1])) : send(404, {});
      send(404, {});
    });
  })
  .listen(4020);

/* ─────────────── ZappMillion simulado ─────────────── */
const zm = { clients: new Map(), creates: [], suspends: [], reactivates: [], failCreate: 0, periodEnd: null };
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
      const client = (externalId, body) => ({
        externalId,
        name: body.name,
        status: "ACTIVE",
        organizationId: "org_1",
        workspaceId: "ws_1",
        userId: "usr_1",
        subscription: { status: "ACTIVE", planId: body.planId, amount: 97, currency: "BRL", currentPeriodStart: new Date().toISOString(), currentPeriodEnd: new Date(Date.now() + 30 * day).toISOString(), scheduledPlanId: null },
        messagingAccount: null,
        createdAt: new Date().toISOString(),
      });
      if (req.method === "GET" && u.pathname === "/plans") return send(200, { data: [{ id: "plan_teste", name: "Teste", monthlyPrice: 97, currency: "BRL", agentReplyLimit: 1000, billingCycleDays: 30 }] });
      if (req.method === "POST" && u.pathname === "/clients") {
        const body = JSON.parse(b);
        zm.creates.push(body);
        if (zm.failCreate > 0) {
          zm.failCreate--;
          return send(500, { type: "InternalError", message: "falha simulada" });
        }
        if (zm.clients.has(body.externalId)) return send(200, zm.clients.get(body.externalId)); // idempotência documentada
        const c = client(body.externalId, body);
        zm.clients.set(body.externalId, c);
        return send(201, c);
      }
      let m;
      if ((m = u.pathname.match(/^\/clients\/([^/]+)$/)) && req.method === "GET") {
        const c = zm.clients.get(decodeURIComponent(m[1]));
        if (!c) return send(404, { type: "ProvisionedClientNotFound" });
        if (zm.periodEnd && c.subscription) c.subscription.currentPeriodEnd = zm.periodEnd;
        return send(200, c);
      }
      if ((m = u.pathname.match(/^\/clients\/([^/]+)\/suspend$/))) {
        const c = zm.clients.get(decodeURIComponent(m[1]));
        zm.suspends.push(m[1]);
        c.status = "SUSPENDED";
        c.subscription = null;
        return send(200, c);
      }
      if ((m = u.pathname.match(/^\/clients\/([^/]+)\/reactivate$/))) {
        const c = zm.clients.get(decodeURIComponent(m[1]));
        zm.reactivates.push(m[1]);
        c.status = "ACTIVE";
        c.subscription = { status: "ACTIVE", planId: "plan_teste", amount: 97, currency: "BRL", currentPeriodStart: new Date().toISOString(), currentPeriodEnd: new Date(Date.now() + 30 * day).toISOString(), scheduledPlanId: null };
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
async function notify(type, dataId, { sign = true, requestId = `req-${rid++}` } = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", sign ? SECRET : "outro-segredo").update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
  return json(`/api/atendimento-ia/webhook?data.id=${encodeURIComponent(dataId)}&type=${type}`, {
    method: "POST",
    headers: { "x-signature": `ts=${ts},v1=${sig}`, "x-request-id": requestId },
    body: JSON.stringify({ type, action: `${type}.updated`, data: { id: dataId } }),
  });
}
const status = (c) => json(`/api/atendimento-ia/status?c=${c.id}&t=${c.token}`).then((r) => r.body.status);
const admin = (acao, id) => json("/api/atendimento-ia/admin", { method: "POST", headers: { authorization: "Bearer admin-teste" }, body: JSON.stringify({ acao, id }) });
const cron = () => json("/api/atendimento-ia/cron", { headers: { authorization: "Bearer cron-teste" } });
async function contratar(empresa, email) {
  const r = await json("/api/atendimento-ia/contratar", {
    method: "POST",
    body: JSON.stringify({ empresa, responsavel: "Pessoa Teste", email, telefone: "(11) 98765-4321", aceite: true, precoMensal: 1, utm: { utm_source: "teste" } }),
  });
  const u = new URL(B + r.body.acompanhar);
  return { ...r, id: u.searchParams.get("c"), token: u.searchParams.get("t") };
}
const preOf = (c) => [...mp.pre.values()].find((p) => p.external_reference === c.id);
function charge(c, { status = "approved", amount = 197, debit = new Date().toISOString() } = {}) {
  const pre = preOf(c);
  const id = String(seq++);
  const payId = String(seq++);
  mp.ap.set(id, { id: Number(id), preapproval_id: pre.id, status: status === "approved" ? "processed" : "recycling", transaction_amount: amount, currency_id: "BRL", debit_date: debit, external_reference: c.id, payment: { id: Number(payId), status, status_detail: status === "approved" ? "accredited" : "cc_rejected_insufficient_amount" } });
  mp.pay.set(payId, { id: Number(payId), status, transaction_amount: amount, currency_id: "BRL" });
  return { id, payId };
}

/* ─────────────── cenários ─────────────── */
const page = await (await fetch(B + "/atendimento-ia")).text();
ok(page.includes("Continuar para o pagamento") && page.includes("197,00") && page.includes("Assinar agora"), "página mostra a contratação com preço do servidor (R$ 197,00)");
ok(!/implanta[çc][ãa]o (inicial )?(é feita )?pela Spolaor|configurad[oa] pela Spolaor/i.test(page), "página não promete implantação pela Spolaor");
ok(!/zm_test_local|teste-local|segredo-teste/.test(page), "nenhuma credencial no HTML da página");

const bad = await json("/api/atendimento-ia/contratar", { method: "POST", body: JSON.stringify({ empresa: "", email: "x", aceite: false }) });
ok(bad.status === 422 && bad.body.errors?.aceite && bad.body.errors?.email, "contratação valida campos e aceite (422)");

const c1 = await contratar("Empresa Um", "um@exemplo.test");
ok(c1.status === 200 && c1.body.checkoutUrl?.startsWith("https://mp.simulado/"), "contratação devolve o checkout do Mercado Pago");
ok(mp.creates[0]?.auto_recurring?.transaction_amount === 197 && mp.creates[0]?.status === "pending" && mp.creates[0]?.external_reference === c1.id, "assinatura criada com preço do servidor (ignora precoMensal do navegador), pending e external_reference");

let st = await status(c1);
ok(st && !st.pagamentoConfirmado && st.passos[0].status === "em_andamento", "retorno do checkout não confirma nada: aguardando pagamento");
ok((await json(`/api/atendimento-ia/status?c=${c1.id}&t=errado`)).status === 404, "link de acompanhamento com token errado → 404");

const forged = await notify("subscription_preapproval", preOf(c1).id, { sign: false });
ok(forged.status === 401, "notificação com assinatura inválida → 401");
const nosig = await json(`/api/atendimento-ia/webhook?data.id=${preOf(c1).id}&type=subscription_preapproval`, { method: "POST", body: "{}" });
ok(nosig.status === 401, "notificação sem x-signature → 401");

preOf(c1).status = "authorized";
await notify("subscription_preapproval", preOf(c1).id);
st = await status(c1);
ok(st.passos[0].titulo === "Pagamento em processamento" && !st.pagamentoConfirmado, "assinatura autorizada ≠ pagamento aprovado");

const rej = charge(c1, { status: "rejected" });
await notify("subscription_authorized_payment", rej.id);
ok(zm.creates.length === 0 && !(await status(c1)).pagamentoConfirmado, "cobrança recusada: nada é criado no ZappMillion");

const wrong = charge(c1, { amount: 1 });
await notify("subscription_authorized_payment", wrong.id);
ok(zm.creates.length === 0, "cobrança com valor divergente: nada é criado");


const pay1 = charge(c1, { debit: new Date().toISOString() });
const rq = "req-dup";
const n1 = await notify("subscription_authorized_payment", pay1.id, { requestId: rq });
const n2 = await notify("subscription_authorized_payment", pay1.id, { requestId: rq });
const n3 = await notify("subscription_authorized_payment", pay1.id); // mesma cobrança, outra entrega
ok(n1.status === 200 && n2.body.duplicate === true && n3.status === 200, "notificação repetida é ignorada; reentrega diferente é processada sem efeito duplo");
ok(zm.creates.length === 1 && zm.creates[0].externalId === `spolaor-ia-${c1.id}` && zm.creates[0].planId === "plan_teste", "primeiro pagamento aprovado cria o cliente UMA vez, com externalId estável e plano configurado");
ok(zm.creates[0].user?.email === "um@exemplo.test" && zm.creates[0].user?.phoneNumber === "+5511987654321", "usuário do ZappMillion com e-mail e telefone em E.164");
st = await status(c1);
ok(st.pagamentoConfirmado && st.acessoLiberado && st.passos[1].titulo === "Acesso liberado" && st.passos[2].status === "no_painel" && st.passos[3].status === "no_painel", "status: pagamento confirmado e acesso liberado; agente e WhatsApp como tarefas no painel (não marcados como feitos)");

ok((await json("/api/atendimento-ia/configuracao", { method: "POST", body: "{}" })).status === 404, "não existe mais briefing obrigatório (rota removida)");
// WhatsApp conectado pelo comprador no painel → o status relê o ZappMillion e mostra a conexão
zm.clients.get(`spolaor-ia-${c1.id}`).messagingAccount = { id: "ma_1", phoneNumber: "+5511999999999", status: "CONNECTED" };
await cron();
st = await status(c1);
ok(st.passos[3].titulo === "WhatsApp conectado" && st.passos[3].status === "feito" && st.passos[2].status === "no_painel", "WhatsApp conectado aparece separado do agente configurado");

const renew = charge(c1, { debit: new Date(Date.now() + 30 * day).toISOString() });
await notify("subscription_authorized_payment", renew.id);
ok(zm.creates.length === 1 && zm.reactivates.length === 0, "renovação paga atualiza a contratação sem criar outro cliente nem reativar");

// Provisionamento com falha e nova tentativa
const c2 = await contratar("Empresa Dois", "dois@exemplo.test");
zm.failCreate = 1;
const p2 = charge(c2, { debit: new Date(Date.now() - 31 * day).toISOString() });
await notify("subscription_authorized_payment", p2.id);
st = await status(c2);
ok(st.pagamentoConfirmado && st.passos[1].status === "problema", "pago + falha no ZappMillion → 'Ativação pendente', sem mostrar acesso liberado");
const retry = await admin("retentar", c2.id);
ok(retry.body.result?.created === true && zm.creates.filter((x) => x.externalId === `spolaor-ia-${c2.id}`).length === 2 && zm.clients.size === 2, "nova tentativa usa o mesmo externalId e cria o acesso");
ok((await json("/api/atendimento-ia/admin", { method: "POST", body: JSON.stringify({ acao: "listar" }) })).status === 401, "rotas de operação exigem token");

// Guarda de renovação: c2 pagou um período que já acabou; a renovação do fornecedor está próxima.
zm.periodEnd = new Date(Date.now() + 2 * 3_600_000).toISOString();
ok((await json("/api/atendimento-ia/cron")).status === 401, "cron exige CRON_SECRET");
const g1 = await cron();
ok(zm.suspends.some((x) => x.includes(c2.id)) && !zm.suspends.some((x) => x.includes(c1.id)), "guarda suspende quem não pagou antes da renovação do fornecedor e preserva quem pagou");
const late = charge(c2);
await notify("subscription_authorized_payment", late.id);
ok(zm.reactivates.some((x) => x.includes(c2.id)), "pagamento aprovado depois da suspensão reativa o cliente");
zm.periodEnd = null;

// Cancelamento: acesso mantido até o fim do período pago
preOf(c1).status = "cancelled";
await notify("subscription_preapproval", preOf(c1).id);
const before = zm.suspends.length;
await cron();
ok(zm.suspends.length === before, "cancelamento mantém o acesso enquanto o período pago cobre a próxima renovação");

// Estorno
mp.pay.get(pay1.payId).status = "refunded";
await notify("payment", pay1.payId);
ok(zm.suspends.some((x) => x.includes(c1.id)), "estorno suspende o acesso");

// Contestação (chargeback) em c2
mp.pay.get(late.payId).status = "charged_back";
mp.cb.set("cb_1", { id: "cb_1", payments: [Number(late.payId)] });
await notify("topic_chargebacks_wh", "cb_1");
ok(zm.suspends.filter((x) => x.includes(c2.id)).length >= 2, "contestação suspende o acesso");

// Fora de ordem: cobrança aprovada chega antes da notificação da assinatura
const c3 = await contratar("Empresa Três", "tres@exemplo.test");
const p3 = charge(c3);
await notify("subscription_authorized_payment", p3.id);
preOf(c3).status = "authorized";
await notify("subscription_preapproval", preOf(c3).id);
st = await status(c3);
ok(st.pagamentoConfirmado && st.passos[1].titulo === "Acesso liberado", "eventos fora de ordem: cobrança antes da assinatura → acesso criado e etapa não regride");

console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("OK")).length} OK, ${out.filter((l) => l.startsWith("FALHA")).length} falhas`);
process.exit(out.some((l) => l.startsWith("FALHA")) ? 1 : 0);
