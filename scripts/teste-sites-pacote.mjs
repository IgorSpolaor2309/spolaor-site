// Teste local da venda avulsa "Site de uma página" com Mercado Pago, e-mail e Pixel SIMULADOS (nada sai da máquina;
// nenhum pagamento real). O teste real no sandbox do Mercado Pago (API de Orders) é scripts/teste-sandbox-mp.mjs (docs/SITES-PACOTE.md).
//
// Antes: build com Pixel fictício e o servidor em :3220:
//   NEXT_PUBLIC_META_PIXEL_ID=000000000000001 npm run build
//   SITES_STORE=memory SITES_CONTRATACAO_ATIVA=true SITES_CONDICOES=pix,cartao-1x,cartao-2x,cartao-3x,cartao-6x,cartao-12x
//   MP_ACCESS_TOKEN=teste-local MP_WEBHOOK_SECRET=segredo-teste MP_API_URL=http://localhost:4040 NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-publica-local
//   RESEND_API_KEY=teste-local RESEND_API_URL=http://localhost:4042/emails LEAD_EMAIL_TO=ops@exemplo.test LEAD_EMAIL_FROM=site@exemplo.test
//   NEXT_PUBLIC_SITE_URL=http://localhost:3220 CRON_SECRET=cron-teste-0123456789
//   node node_modules/next/dist/bin/next start --port 3220
// Opcional: SITES_TESTE_FECHADO=http://localhost:3210 (um servidor SEM as variáveis SITES_*) para conferir a oferta fechada.
// Capturas: SITES_TESTE_CAPTURAS=<pasta>. Uso: node scripts/teste-sites-pacote.mjs
import http from "node:http";
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const B = process.env.SITES_TESTE_URL || "http://localhost:3220";
const FECHADO = process.env.SITES_TESTE_FECHADO || null;
const CAPT = process.env.SITES_TESTE_CAPTURAS || null;
const SECRET = "segredo-teste";
const out = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ─────────────── Mercado Pago simulado (API de Orders) ─────────────── */
// Guarda cada order num formato "clássico" (status approved/pending/rejected/in_process/cancelled/refunded,
// transaction_amount, installments…) que os testes manipulam, e responde no formato da API de Orders.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const mp = { pay: new Map(), creates: [], chaves: new Map(), modoCartao: "approved", juros: false, installmentsCalls: 0, seq: Date.now() % 1e9 }; // ids únicos por rodada (o servidor guarda pedidos em memória)
// Comportamentos para os testes de resultado desconhecido (todos de uso único, exceto atrasoBusca/atrasoCriacao):
// perderResposta: cria a order e derruba a conexão sem responder; falharAntes: derruba a conexão sem criar;
// atrasoBusca: a busca por referência ainda não enxerga orders novas; atrasoCriacao: ms antes de responder.
Object.assign(mp, { chamadas: [], tokensDaChave: new Map(), perderResposta: false, falharAntes: false, atrasoBusca: false, atrasoCriacao: 0 });
const ORD = { approved: ["processed", "accredited"], pending: ["action_required", "waiting_transfer"], in_process: ["processing", "in_process"], rejected: ["failed", "failed"], cancelled: ["canceled", "canceled"], expired: ["canceled", "expired"], refunded: ["refunded", "refunded"], charged_back: ["charged_back", "in_process"] };
function comoOrder(p) {
  const [status, detail] = ORD[p.status] ?? [p.status, p.status];
  const pm = p.payment_type_id === "bank_transfer"
    ? { id: "pix", type: "bank_transfer", qr_code: p.qr_code, qr_code_base64: p.qr_code_base64, ticket_url: "https://mp.simulado/pix" }
    : { id: p.payment_method_id, type: p.payment_type_id ?? "credit_card", installments: p.installments, installment_amount: (p.transaction_amount / (p.installments || 1)).toFixed(2) };
  return {
    id: p.id,
    type: "online",
    external_reference: p.external_reference,
    total_amount: Number(p.transaction_amount).toFixed(2),
    total_paid_amount: p.status === "approved" ? Number(p.total_paid ?? p.transaction_amount).toFixed(2) : "0.00",
    currency: p.currency_id ?? "BRL",
    status,
    status_detail: detail,
    created_date: p.created ?? new Date().toISOString(),
    last_updated_date: new Date().toISOString(),
    transactions: { payments: [{ id: `PAY${p.id}`, amount: Number(p.transaction_amount).toFixed(2), status, status_detail: p.status_detail ?? detail, date_of_expiration: p.date_of_expiration, payment_method: pm }] },
  };
}
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
      if (req.method === "POST" && u.pathname === "/v1/orders") {
        const key = req.headers["x-idempotency-key"];
        if (!key) return send(400, { errors: [{ code: "missing_idempotency_key" }] });
        const body = JSON.parse(b);
        const tok = body.transactions?.payments?.[0]?.payment_method?.token ?? null;
        mp.chamadas.push({ key, ref: body.external_reference, token: tok });
        if (mp.falharAntes) {
          mp.falharAntes = false;
          return req.socket.destroy(); // a requisição não chegou a criar nada
        }
        // como o Mercado Pago (medido no sandbox): mesma chave e mesmo corpo → a mesma order; mesma chave e outro
        // corpo (ex.: token de cartão novo) → 409 idempotency_key_already_used, sem criar outra
        if (mp.chaves.has(key)) {
          if (mp.tokensDaChave.get(key) !== tok) return send(409, { errors: [{ code: "idempotency_key_already_used", message: "X-Idempotency-Key already used. Please retry with a different value." }] });
          return send(200, comoOrder(mp.pay.get(mp.chaves.get(key))));
        }
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(body.external_reference ?? "")) return send(400, { errors: [{ code: "property_value", details: ["'$.external_reference' - does not match pattern"] }] });
        const t = body.transactions?.payments?.[0] ?? {};
        const pmb = t.payment_method ?? {};
        // visão "achatada" do pedido de cobrança, para as conferências
        mp.creates.push({ key, transaction_amount: Number(body.total_amount), amount: Number(t.amount), payment_method_id: pmb.id, payment_type_id: pmb.type, installments: pmb.installments, token: pmb.token, statement_descriptor: pmb.statement_descriptor, expiration_time: t.expiration_time, external_reference: body.external_reference, payer: body.payer, description: body.description });
        const id = `ORDSIM${mp.seq++}`;
        let p;
        if (pmb.id === "pix") {
          p = { id, status: "pending", status_detail: "waiting_transfer", transaction_amount: Number(body.total_amount), currency_id: "BRL", installments: 1, payment_method_id: "pix", payment_type_id: "bank_transfer", external_reference: body.external_reference, date_of_expiration: new Date(Date.now() + 3600e3).toISOString(), qr_code: `00020126PIXSIMULADO${id}`, qr_code_base64: PNG };
        } else {
          const st = mp.modoCartao;
          p = { id, status: st, status_detail: st === "rejected" ? "insufficient_amount" : st === "in_process" ? "in_process" : "accredited", transaction_amount: Number(body.total_amount), currency_id: "BRL", installments: pmb.installments, payment_method_id: pmb.id, payment_type_id: pmb.type ?? "credit_card", external_reference: body.external_reference };
        }
        mp.pay.set(id, p);
        mp.chaves.set(key, id);
        mp.tokensDaChave.set(key, tok);
        const responder = () => {
          if (mp.perderResposta) {
            mp.perderResposta = false;
            return req.socket.destroy(); // a order FOI criada, mas a resposta se perde
          }
          // cartão recusado: a API de Orders responde 402 com a order "failed" em data
          if (p.status === "rejected") return send(402, { errors: [{ code: "failed", message: "The following transactions failed", details: [`PAY${id}: ${p.status_detail}`] }], data: comoOrder(p) });
          return send(201, comoOrder(p));
        };
        if (mp.atrasoCriacao) setTimeout(responder, mp.atrasoCriacao);
        else responder();
        return;
      }
      if ((m = u.pathname.match(/^\/v1\/orders\/([A-Za-z0-9]+)$/)) && req.method === "GET") {
        // como o Mercado Pago: id fora do formato de order → 400 invalid_path_param; formato certo e inexistente → 404
        if (!/^ORD[A-Z0-9]+$/.test(m[1])) return send(400, { errors: [{ code: "invalid_path_param", message: "path param order id is invalid" }] });
        const p = mp.pay.get(m[1]);
        return p ? send(200, comoOrder(p)) : send(404, { errors: [{ code: "order_not_found" }] });
      }
      if (u.pathname === "/v1/orders" && req.method === "GET") {
        if (!u.searchParams.get("begin_date") || !u.searchParams.get("end_date")) return send(400, { errors: [{ code: "missing_required_params" }] });
        const ref = u.searchParams.get("external_reference");
        if (mp.atrasoBusca) return send(200, { data: [], paging: {} });
        return send(200, { data: [...mp.pay.values()].filter((p) => p.external_reference === ref).reverse().map(comoOrder), paging: {} });
      }
      if (u.pathname === "/v1/payment_methods/installments") {
        mp.installmentsCalls++;
        const amount = Number(u.searchParams.get("amount"));
        const payer_costs = [1, 2, 3, 4, 5, 6, 10, 12].map((n) => {
          const rate = mp.juros && n > 1 ? 12.5 : 0;
          const total = Math.round(amount * (1 + rate / 100) * 100) / 100;
          return { installments: n, installment_rate: rate, total_amount: total, installment_amount: Math.round((total / n) * 100) / 100 };
        });
        return send(200, [{ payment_method_id: u.searchParams.get("payment_method_id"), payer_costs }]);
      }
      return send(404, { message: "rota simulada inexistente" });
    });
  })
  .listen(4040);

/* ─────────────── e-mail simulado (Resend) ─────────────── */
const emails = [];
http
  .createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      emails.push(JSON.parse(b || "{}"));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: `email_${emails.length}` }));
    });
  })
  .listen(4042);

/* ─────────────── utilitários ─────────────── */
async function json(path, init = {}, base = B) {
  const r = await fetch(base + path, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
let rid = 1;
function webhook(dataId, { sign = true, requestId = `req-${rid++}`, type = "order", rota = "/api/sites-pacote/webhook" } = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", sign ? SECRET : "outro").update(`id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  return json(`${rota}?data.id=${encodeURIComponent(dataId)}&type=${type}`, {
    method: "POST",
    headers: { "x-signature": `ts=${ts},v1=${sig}`, "x-request-id": requestId },
    body: JSON.stringify({ type, action: `${type}.updated`, data: { id: dataId } }),
  });
}
let n = 0;
async function pedido(condicao, extra = {}) {
  n++;
  const r = await json("/api/sites-pacote/pedido", {
    method: "POST",
    body: JSON.stringify({ nome: "Pessoa Teste", email: `teste${n}@exemplo.test`, whatsapp: "(11) 98765-4321", condicao, aceite: true, utm: { utm_source: "meta", utm_campaign: "site-pacote" }, ...extra }),
  });
  return { ...r, cred: r.body.id ? { id: r.body.id, t: r.body.token } : null };
}
const status = (c) => json(`/api/sites-pacote/status?p=${c.id}&t=${c.t}`).then((r) => r.body.pedido);
const cartao = (c, formData, additionalData = { paymentTypeId: "credit_card" }) => json("/api/sites-pacote/cartao", { method: "POST", body: JSON.stringify({ id: c.id, t: c.t, formData, additionalData }) });
const fd = (installments, extra = {}) => ({ token: "tok_simulado", payment_method_id: "master", issuer_id: "24", installments, payer: { email: "teste@exemplo.test", identification: { type: "CPF", number: "123.456.789-09" } }, ...extra });
const emailsDe = (id) => emails.filter((e) => String(e.text ?? "").includes(id));
const ultimoCreate = () => mp.creates[mp.creates.length - 1];
const ordensDe = (c) => [...mp.pay.values()].filter((o) => o.external_reference === `site_${c.id}`);
const chamadasDe = (c) => mp.chamadas.filter((x) => x.ref === `site_${c.id}`);

/* ─────────────── 1. API: validações, preço no servidor, Pix ─────────────── */
{
  let r = await json("/api/sites-pacote/pedido", { method: "POST", body: JSON.stringify({ nome: "x", email: "invalido", whatsapp: "12", condicao: "pix" }) });
  ok(r.status === 422 && r.body.errors?.email && r.body.errors?.whatsapp && r.body.errors?.aceite && r.body.errors?.nome, "dados inválidos e sem aceite → 422 com os erros por campo");
  r = await json("/api/sites-pacote/pedido", { method: "POST", body: JSON.stringify({ nome: "Pessoa", email: "a@exemplo.test", whatsapp: "11987654321", condicao: "pix", aceite: true, website: "spam" }) });
  ok(r.status === 400, "anti-spam (campo oculto) → 400, sem pedido");
  r = await pedido("cartao-24x");
  ok(r.status === 422 && r.body.error === "condicao_indisponivel", "condição fora da tabela aprovada → 422");
  const antes = mp.creates.length;
  r = await pedido("pix", { total: 1, valor: 1, preco: 1 });
  const c = ultimoCreate();
  ok(r.status === 200 && r.body.pedido?.status === "pagamento_pendente" && r.body.pedido?.pix?.copiaCola, "Pix: pedido criado e QR Code devolvido (pagamento pendente)");
  ok(mp.creates.length === antes + 1 && c.transaction_amount === 449.9 && c.payment_method_id === "pix", "Pix cobra R$ 449,90 da tabela (valor enviado pelo navegador ignorado)");
  ok(c.external_reference === `site_${r.body.id}` && /^site-.+-pix-1$/.test(c.key) && c.expiration_time === "PT60M", "Pix: referência do pedido (site_<id>), chave de idempotência e validade de 60 min");
  // repetição do envio (mesma chave do navegador): mesmo pedido, sem novo pagamento
  const chave = "chave-teste-0123456789abcdef";
  const r1 = await pedido("pix", { email: "repetido@exemplo.test", chavePedido: chave });
  const criados = mp.creates.length;
  const r2 = await json("/api/sites-pacote/pedido", { method: "POST", body: JSON.stringify({ nome: "Pessoa Teste", email: "repetido@exemplo.test", whatsapp: "11987654321", condicao: "pix", aceite: true, chavePedido: chave }) });
  ok(r2.body.id === r1.body.id && mp.creates.length === criados, "envio repetido com a mesma chave → mesmo pedido, nenhum Pix novo");
  const r3 = await json("/api/sites-pacote/pedido", { method: "POST", body: JSON.stringify({ nome: "Pessoa Teste", email: "outro@exemplo.test", whatsapp: "11987654321", condicao: "pix", aceite: true, chavePedido: chave }) });
  ok(r3.status === 409 && r3.body.error === "pedido_divergente", "mesma chave com outro e-mail → 409, sem misturar pedidos");
  const velho = await status(r1.cred);
  ok(!velho, "o link antigo deixa de valer quando o mesmo navegador reenvia (token novo)");
  await espera(600);
  const avisos = emailsDe(r.body.id);
  ok(avisos.length === 1 && /Novo pedido — pagamento pendente/.test(avisos[0].subject) && /Pix: R\$ 449,90/.test(avisos[0].text) && /wa\.me\/5511987654321/.test(avisos[0].text), "aviso interno do pedido novo: pendente, condição, total e WhatsApp do comprador");
  ok(/utm_campaign=site-pacote/.test(avisos[0].text), "aviso leva a origem (UTMs)");

  // confirmação do Pix pela notificação assinada
  const pagId = r.body.pedido && [...mp.pay.values()].find((p) => p.external_reference === `site_${r.body.id}`).id;
  let w = await webhook(pagId, { sign: false });
  ok(w.status === 401, "notificação sem assinatura válida → 401");
  w = await webhook(pagId);
  ok((await status(r.cred)).status === "pagamento_pendente", "notificação de pagamento ainda pendente não confirma nada");
  mp.pay.get(pagId).status = "approved";
  mp.pay.get(pagId).date_approved = new Date().toISOString();
  const rq = `req-aprovado-${pagId}`;
  w = await webhook(pagId, { requestId: rq });
  ok(w.status === 200 && (await status(r.cred)).status === "pago", "Pix aprovado (relido no Mercado Pago) → pago");
  w = await webhook(pagId, { requestId: rq });
  ok(w.body.duplicate === true, "mesma entrega repetida → ignorada");
  await webhook(pagId);
  const pagos = emailsDe(r.body.id).filter((e) => /Pagamento confirmado/.test(e.subject));
  ok(pagos.length === 1 && /PAGO/.test(pagos[0].text), "aviso de pagamento confirmado: um só, mesmo com notificações repetidas");

  // estorno do pago
  mp.pay.get(pagId).status = "refunded";
  await webhook(pagId);
  ok((await status(r.cred)).status === "estornado" && emailsDe(r.body.id).some((e) => /estornado/.test(e.subject)), "estorno do pagamento aprovado → estornado e aviso");

  // Pix vencido → novo Pix
  const rv = await pedido("pix");
  const pv = [...mp.pay.values()].find((p) => p.external_reference === `site_${rv.body.id}`);
  pv.status = "cancelled";
  pv.status_detail = "expired";
  await webhook(pv.id);
  ok((await status(rv.cred)).status === "expirado", "Pix vencido → expirado");
  const np = await json("/api/sites-pacote/pix", { method: "POST", body: JSON.stringify({ id: rv.cred.id, t: rv.cred.t }) });
  ok(np.body.pedido?.status === "pagamento_pendente" && /-pix-2$/.test(ultimoCreate().key), "novo Pix gerado com nova chave de idempotência");

  // order de outra origem chegando nesta rota
  const outro = `ORDSIM${mp.seq++}`;
  mp.pay.set(outro, { id: outro, status: "approved", transaction_amount: 297, currency_id: "BRL", external_reference: "spolaor-ia-xyz" });
  w = await webhook(outro);
  ok(w.body.result?.ignorado === "order de outra oferta", "order de outra origem → ignorada");
  w = await webhook("123456");
  ok(w.status === 200 && /inexistente/.test(w.body.ignored ?? ""), "notificação simulada pelo painel com id inventado (400/404 no Mercado Pago) → 200 e ignorada");
  w = await webhook("ORDSIM00000000000");
  ok(w.status === 200 && /inexistente/.test(w.body.ignored ?? ""), "order inexistente → 200 e ignorada, sem novas tentativas");
  w = await webhook(pagId, { type: "payment" });
  ok(w.status === 200 && w.body.ignored === "tipo payment", "nesta rota, só o tipo order é processado");

  // produção: o Mercado Pago manda o tópico Order para a URL de Webhooks da aplicação (rota da IA), que repassa
  const ri = await pedido("pix");
  const pi = [...mp.pay.values()].find((p) => p.external_reference === `site_${ri.body.id}`);
  w = await webhook(pi.id, { rota: "/api/atendimento-ia/webhook", sign: false });
  ok(w.status === 401, "rota da IA: notificação order sem assinatura válida → 401");
  pi.status = "approved";
  w = await webhook(pi.id, { rota: "/api/atendimento-ia/webhook" });
  ok(w.status === 200 && w.body.result?.status === "pago" && (await status(ri.cred)).status === "pago", "rota da IA repassa o tipo order para os sites → pago");
}

/* ─────────────── 2. API: cartão ─────────────── */
{
  const r = await pedido("cartao-12x");
  ok(r.body.pedido?.status === "criado" && !r.body.pedido?.pix, "cartão 12×: pedido criado, sem pagamento ainda");
  let x = await cartao(r.cred, fd(1));
  ok(x.status === 422 && x.body.error === "parcelas_divergentes", "parcelas diferentes da condição → 422, nada cobrado");
  mp.juros = true;
  const antes = mp.creates.length;
  x = await cartao(r.cred, fd(12));
  ok(x.status === 422 && x.body.error === "parcelamento_indisponivel" && mp.creates.length === antes, "Mercado Pago com acréscimo ao comprador em 12× → recusado ANTES de cobrar");
  mp.juros = false;
  x = await cartao(r.cred, fd(12));
  const c = ultimoCreate();
  ok(x.status === 200 && x.body.pedido?.status === "pago", "cartão 12× aprovado e conferido → pago");
  ok(c.transaction_amount === 574.8 && c.amount === 574.8 && c.installments === 12 && c.token === "tok_simulado" && /-cartao-1$/.test(c.key) && c.payer?.identification?.number === "12345678909", "cobra R$ 574,80 em 12× com token, CPF só com dígitos e chave de idempotência");
  ok(c.payment_type_id === "credit_card" && c.statement_descriptor === "SPOLAOR" && c.external_reference === `site_${r.body.id}`, "order de cartão: crédito, SPOLAOR na fatura e referência do pedido");
  x = await cartao(r.cred, fd(12));
  ok(x.status === 409 && x.body.error === "pedido_encerrado", "pedido pago não aceita nova cobrança");
  await espera(600);
  const av = emailsDe(r.body.id);
  ok(av.filter((e) => /Pagamento confirmado/.test(e.subject)).length === 1 && /Cartão em 12× de R\$ 47,90 — total R\$ 574,80/.test(av.find((e) => /confirmado/.test(e.subject)).text), "aviso de pago com a condição comprada");

  for (const [cond, parc, total] of [["cartao-1x", 1, 449.9], ["cartao-2x", 2, 469.8], ["cartao-3x", 3, 479.7], ["cartao-6x", 6, 509.4]]) {
    const p = await pedido(cond);
    const y = await cartao(p.cred, fd(parc));
    ok(y.body.pedido?.status === "pago" && ultimoCreate().transaction_amount === total && ultimoCreate().installments === parc, `${cond}: cobra R$ ${total} em ${parc}× da tabela aprovada`);
  }

  // débito só à vista
  const rdb = await pedido("cartao-2x");
  const antesDeb = mp.creates.length;
  x = await cartao(rdb.cred, fd(2), { paymentTypeId: "debit_card" });
  ok(x.status === 422 && x.body.error === "parcelas_divergentes" && mp.creates.length === antesDeb, "cartão de débito em 2× → recusado antes de cobrar");
  x = await cartao(rdb.cred, fd(2), { paymentTypeId: "pix" });
  ok(x.status === 422 && x.body.error === "cartao_invalido", "tipo de cartão desconhecido → 422");

  // recusado → nova tentativa aprovada
  const rr = await pedido("cartao-3x");
  mp.modoCartao = "rejected";
  x = await cartao(rr.cred, fd(3));
  ok(x.body.pedido?.status === "recusado" && /limite/.test(x.body.pedido?.motivoRecusa ?? ""), "cartão recusado → recusado, com motivo legível");
  mp.modoCartao = "approved";
  x = await cartao(rr.cred, fd(3));
  ok(x.body.pedido?.status === "pago" && /-cartao-2$/.test(ultimoCreate().key), "nova tentativa (outra chave) aprovada → pago");

  ok(ordensDe(rr.cred).length === 2 && ordensDe(rr.cred).map((o) => o.status).join(",") === "rejected,approved", "recusa definitiva fecha a tentativa: a nova abre outra order (chave -cartao-2), e a recusada fica no histórico");

  // ── resultado desconhecido: a order FOI criada, mas a resposta se perdeu ──
  {
    const rp = await pedido("cartao-12x");
    mp.perderResposta = true;
    const a = await cartao(rp.cred, fd(12, { token: "tok_perdida_A" }));
    ok(
      a.status === 200 && a.body.pedido?.status === "pagamento_pendente" && a.body.pedido?.emVerificacao === true && !a.body.pedido?.motivoRecusa && ordensDe(rp.cred).length === 1,
      'resposta perdida depois de criar a order → "pagamento em verificação" (sem "nada foi cobrado"); 1 order no Mercado Pago',
    );
    const b = await cartao(rp.cred, fd(12, { token: "tok_perdida_B" }));
    const ch = chamadasDe(rp.cred);
    ok(b.body.pedido?.status === "pago" && ordensDe(rp.cred).length === 1 && ch.length === 1, "nova submissão do comprador → concilia pela referência e adota a order existente: pago, nenhuma chamada de cobrança nova");
  }
  // ── a mesma coisa, mas a busca do Mercado Pago ainda não enxerga a order: retomada com a MESMA chave ──
  {
    const rp = await pedido("cartao-3x");
    mp.perderResposta = true;
    await cartao(rp.cred, fd(3, { token: "tok_lag_A" }));
    mp.atrasoBusca = true;
    const b = await cartao(rp.cred, fd(3, { token: "tok_lag_B" }));
    mp.atrasoBusca = false;
    const ch = chamadasDe(rp.cred);
    ok(
      b.status === 200 && b.body.pedido?.emVerificacao === true && ch.length === 2 && ch[0].key === ch[1].key && ordensDe(rp.cred).length === 1,
      "retomada com a mesma chave de idempotência → o Mercado Pago responde 409 e não cria outra; segue em verificação",
    );
    const st = await status(rp.cred);
    ok(st?.status === "pago" && !st?.emVerificacao, "a conferência acha a order pela referência do pedido → pago");
  }
  // ── a conexão caiu ANTES de chegar ao Mercado Pago (nada foi criado) ──
  {
    const rp = await pedido("cartao-1x");
    mp.falharAntes = true;
    const a = await cartao(rp.cred, fd(1, { token: "tok_rede_A" }));
    ok(a.body.pedido?.emVerificacao === true, "falha de rede sem resposta → também em verificação (não dá para afirmar nada)");
    const b = await cartao(rp.cred, fd(1, { token: "tok_rede_B" }));
    const ch = chamadasDe(rp.cred);
    ok(b.body.pedido?.status === "pago" && ch.length === 2 && ch[0].key === ch[1].key && ordensDe(rp.cred).length === 1, "nova submissão retoma com a mesma chave e cria a única order → pago");
  }
  // ── a order EXISTE no Mercado Pago, mas a busca não a enxerga por muito tempo (SITES_TESTE_INVISIVEL_SEG; 960 = 16 min) ──
  // Sem liberação por prazo: a tentativa e a chave continuam, em "pagamento em verificação", bloqueando cobrança
  // independente, até a notificação chegar ou a order aparecer.
  {
    const rp = await pedido("cartao-2x");
    mp.perderResposta = true;
    await cartao(rp.cred, fd(2, { token: "tok_invisivel_A" }));
    mp.atrasoBusca = true;
    const segundos = Number(process.env.SITES_TESTE_INVISIVEL_SEG || 15);
    const inicio = Date.now();
    const vistos = [];
    do {
      vistos.push(await status(rp.cred));
      if (Date.now() - inicio < segundos * 1000) await espera(Math.min(13_000, Math.max(0, segundos * 1000 - (Date.now() - inicio)) + 500)); // a conferência roda a cada 12 s
    } while (Date.now() - inicio < segundos * 1000);
    vistos.push(await status(rp.cred));
    const minutos = ((Date.now() - inicio) / 60000).toFixed(1);
    ok(
      vistos.every((v) => v?.status === "pagamento_pendente" && v?.emVerificacao === true && !v?.motivoRecusa) && ordensDe(rp.cred).length === 1,
      `order invisível na busca por ${minutos} min (${vistos.length} conferências): continua "pagamento em verificação", sem "nada foi cobrado", sem liberar`,
    );
    // o comprador tenta de novo: retoma com a MESMA chave → 409 do Mercado Pago, nenhuma order nova
    const b = await cartao(rp.cred, fd(2, { token: "tok_invisivel_B" }));
    const ch = chamadasDe(rp.cred);
    ok(
      b.status === 200 && b.body.pedido?.emVerificacao === true && ch.length === 2 && ch[0].key === ch[1].key && ordensDe(rp.cred).length === 1,
      "nova submissão depois disso → mesma chave, 409 no Mercado Pago, nenhuma cobrança independente; segue em verificação",
    );
    // a notificação da order chega → confirma normalmente
    const ord = ordensDe(rp.cred)[0];
    ord.status = "approved";
    const w = await webhook(ord.id);
    const st = await status(rp.cred);
    ok(w.status === 200 && w.body.result?.status === "pago" && st?.status === "pago" && !st?.emVerificacao, "a notificação da order chega → pago normalmente");
    mp.atrasoBusca = false;
  }
  // ── a mesma situação, mas a order aparece na busca (sem notificação) → a conferência confirma ──
  {
    const rp = await pedido("cartao-6x");
    mp.perderResposta = true;
    await cartao(rp.cred, fd(6, { token: "tok_aparece_A" }));
    mp.atrasoBusca = true;
    ok((await status(rp.cred))?.emVerificacao === true, "order ainda invisível → em verificação");
    const ord = ordensDe(rp.cred)[0];
    ord.status = "approved";
    mp.atrasoBusca = false;
    await espera(12_500);
    const st = await status(rp.cred);
    ok(st?.status === "pago" && ordensDe(rp.cred).length === 1 && chamadasDe(rp.cred).length === 1, "a order aparece na busca → a conferência adota e confirma: pago, uma order, nenhuma chamada nova");
  }
  // ── duas submissões simultâneas ao mesmo pedido ──
  {
    const rp = await pedido("cartao-6x");
    mp.atrasoCriacao = 800;
    const [x1, x2] = await Promise.all([cartao(rp.cred, fd(6, { token: "tok_conc_A" })), cartao(rp.cred, fd(6, { token: "tok_conc_B" }))]);
    mp.atrasoCriacao = 0;
    const cods = [x1.status, x2.status].sort().join(",");
    ok(
      cods === "200,409" && [x1, x2].some((x) => x.body.error === "pagamento_em_andamento") && chamadasDe(rp.cred).length === 1 && ordensDe(rp.cred).length === 1,
      "duas submissões simultâneas → uma tentativa e uma order; a outra recebe 409 (pagamento em andamento)",
    );
    ok((await status(rp.cred))?.status === "pago", "o pedido fica pago pela tentativa única");
  }

  // em análise → bloqueia nova tentativa; confirmação pela notificação
  const ra = await pedido("cartao-6x");
  mp.modoCartao = "in_process";
  x = await cartao(ra.cred, fd(6));
  ok(x.body.pedido?.status === "pagamento_pendente", "cartão em análise → pagamento pendente (não é pago)");
  x = await cartao(ra.cred, fd(6));
  ok(x.status === 409 && x.body.error === "pagamento_em_analise", "nova cobrança bloqueada enquanto a anterior está em análise");
  mp.modoCartao = "approved";
  const pa = [...mp.pay.values()].find((p) => p.external_reference === `site_${ra.cred.id}`);
  pa.status = "approved";
  await webhook(pa.id);
  ok((await status(ra.cred)).status === "pago", "análise aprovada (notificação) → pago");

  // aprovado com divergência (valor) → não conta como pago
  const rd = await pedido("cartao-2x");
  mp.modoCartao = "in_process";
  await cartao(rd.cred, fd(2));
  mp.modoCartao = "approved";
  const pd = [...mp.pay.values()].find((p) => p.external_reference === `site_${rd.cred.id}`);
  Object.assign(pd, { status: "approved", transaction_amount: 449.9 });
  await webhook(pd.id);
  const sd = await status(rd.cred);
  ok(sd.status === "divergente" && emailsDe(rd.cred.id).some((e) => /divergência/.test(e.subject)), "aprovado com valor diferente → divergente (não pago) e aviso");
  // conferência direta (sem notificação): o acompanhamento busca no Mercado Pago
  const rc = await pedido("cartao-6x");
  mp.modoCartao = "in_process";
  await cartao(rc.cred, fd(6));
  mp.modoCartao = "approved";
  const pc = [...mp.pay.values()].find((p) => p.external_reference === `site_${rc.cred.id}`);
  pc.status = "approved";
  await espera(12_500);
  ok((await status(rc.cred)).status === "pago", "sem notificação: o acompanhamento confere no Mercado Pago e confirma");
  ok((await json(`/api/sites-pacote/status?p=${rc.cred.id}&t=errado-0123456789012345678`)).status === 404, "token errado → 404");
  ok((await json("/api/sites-pacote/rotina")).status === 401 && (await json("/api/sites-pacote/rotina", { headers: { authorization: "Bearer cron-teste-0123456789" } })).body.ok === true, "rotina protegida pelo CRON_SECRET");
}

/* ─────────────── 3. Navegador: páginas, larguras, eventos ─────────────── */
const browser = await chromium.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
if (CAPT) mkdirSync(CAPT, { recursive: true });
async function contexto(vp) {
  const ctx = await browser.newContext({ viewport: vp, ...(vp.width < 700 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const eventos = [];
  await ctx.exposeBinding("__fbqRec", (_s, j) => eventos.push(JSON.parse(j)));
  await ctx.route(/connect\.facebook\.net|facebook\.com|google-analytics|googletagmanager/, (r) => r.abort());
  // formulário de cartão do Mercado Pago SIMULADO (o SDK real não é carregado no teste)
  await ctx.route(/sdk\.mercadopago\.com/, (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: `window.MercadoPago = function(){ return { bricks: function(){ return { create: function(tipo, id, s){
        window.__brick = s;
        var el = document.getElementById(id);
        var b = document.createElement('button'); b.type='button'; b.id='pagar-simulado'; b.textContent='Pagar (simulado) ' + s.customization.paymentMethods.minInstallments + 'x de ' + s.initialization.amount;
        b.onclick = function(){ s.callbacks.onSubmit({ token:'tok_simulado', payment_method_id:'master', issuer_id:'24', installments: s.customization.paymentMethods.minInstallments, payer:{ email:'comprador@exemplo.test' } }, { paymentTypeId:'credit_card', bin:'503143', lastFourDigits:'6351' }).catch(function(){}); };
        el.appendChild(b); s.callbacks.onReady && s.callbacks.onReady();
        return Promise.resolve({ unmount: function(){ el.innerHTML=''; } }); } }; } }; };`,
    }),
  );
  await ctx.addInitScript(() => {
    let real;
    Object.defineProperty(window, "fbq", {
      configurable: true,
      get: () => real,
      set(v) {
        const wrap = function (...a) {
          try {
            window.__fbqRec(JSON.stringify(a));
          } catch {}
          return v.apply(this, a);
        };
        Object.assign(wrap, v);
        real = wrap;
      },
    });
  });
  return { ctx, eventos };
}
const larguras = [
  { width: 360, height: 640, nome: "360" },
  { width: 390, height: 844, nome: "390" },
  { width: 402, height: 874, nome: "402" },
  { width: 1440, height: 900, nome: "desktop" },
];
const semRolagemLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
async function visivelSemRolar(page, texto) {
  const loc = page.getByText(texto, { exact: false }).first();
  const bb = await loc.boundingBox();
  const vh = page.viewportSize().height;
  return !!bb && bb.y >= 0 && bb.y + bb.height <= vh && (await loc.isVisible());
}

for (const vp of larguras) {
  const { ctx } = await contexto(vp);
  const page = await ctx.newPage();
  await page.goto(`${B}/sites/pacote`, { waitUntil: "networkidle" });
  const h1 = await visivelSemRolar(page, "O site da sua empresa, em uma página");
  const preco = await page.locator('[aria-label="Preço"]').boundingBox();
  const cta = await page.getByRole("link", { name: "Contratar meu site" }).first().boundingBox();
  const vh = vp.height;
  ok(h1 && preco && preco.y + preco.height <= vh && cta && cta.y + cta.height <= vh, `/sites/pacote ${vp.nome}: título, 12× de R$ 47,90 + total + à vista e botão de contratar na primeira tela, sem rolar`);
  const textoPreco = await page.locator('[aria-label="Preço"]').innerText();
  ok(/12×/.test(textoPreco) && /47,90/.test(textoPreco) && /574,80/.test(textoPreco) && /449,90 no Pix ou cartão à vista/.test(textoPreco) && /Não é assinatura/.test(textoPreco), `/sites/pacote ${vp.nome}: valores legíveis e "não é assinatura"`);
  ok(await semRolagemLateral(page), `/sites/pacote ${vp.nome}: sem rolagem lateral`);
  // sem animação de entrada que esconda conteúdo na primeira tela
  const opacidades = await page.evaluate(() => [...document.querySelectorAll("section:first-of-type h1, section:first-of-type [aria-label='Preço'], [data-hero-cta]")].map((el) => getComputedStyle(el).opacity));
  ok(opacidades.every((o) => o === "1"), `/sites/pacote ${vp.nome}: conteúdo da primeira tela visível sem depender de animação`);
  if (CAPT) await page.screenshot({ path: `${CAPT}/pacote-${vp.nome}-primeira-tela.png` });
  if (CAPT && vp.nome !== "360") await page.screenshot({ path: `${CAPT}/pacote-${vp.nome}-inteira.png`, fullPage: true });
  await page.goto(`${B}/sites/pacote/checkout?c=cartao-12x`, { waitUntil: "networkidle" });
  ok(await semRolagemLateral(page), `checkout ${vp.nome}: sem rolagem lateral`);
  const form = await page.locator('form[aria-label="Contratar o site de uma página"]').boundingBox();
  const barra = await page.locator(".fixed.inset-x-0.bottom-0").first().boundingBox().catch(() => null);
  ok(!!form && (!barra || barra.y >= vh), `checkout ${vp.nome}: nenhuma barra fixa cobrindo o formulário`);
  ok(await visivelSemRolar(page, "Você vai pagar"), `checkout ${vp.nome}: condição, parcela e total visíveis sem rolar`);
  if (CAPT) {
    await page.screenshot({ path: `${CAPT}/checkout-${vp.nome}-primeira-tela.png` });
    if (vp.nome !== "360") await page.screenshot({ path: `${CAPT}/checkout-${vp.nome}-inteira.png`, fullPage: true });
  }
  await ctx.close();
}

// /sites: chamada do pacote e FAQ sem contradição
{
  const { ctx } = await contexto({ width: 390, height: 844 });
  const page = await ctx.newPage();
  await page.goto(`${B}/sites`, { waitUntil: "networkidle" });
  const link = page.getByRole("link", { name: "Ver o pacote" });
  ok((await link.count()) === 1 && (await link.getAttribute("href")) === "/sites/pacote", "/sites: chamada do pacote leva a /sites/pacote");
  const html = await page.content();
  ok(!/não publicamos tabela de preços/.test(html) && /preço fechado/.test(html), "/sites: FAQ não diz mais que não há preço publicado");
  ok(await page.getByRole("link", { name: /Pedir orçamento de site/ }).first().isVisible(), "/sites: orçamento para projetos maiores continua");
  if (CAPT) await page.screenshot({ path: `${CAPT}/sites-390-chamada.png`, fullPage: true });
  await ctx.close();
}

// Página do pedido com resultado desconhecido: "pagamento em verificação", sem formulário e sem convite a outro pedido
{
  const rp = await pedido("cartao-1x");
  mp.perderResposta = true;
  await cartao(rp.cred, fd(1, { token: "tok_pagina_verificacao" }));
  mp.atrasoBusca = true; // mantém o pedido em verificação durante a conferência da página
  const { ctx } = await contexto({ width: 390, height: 844 });
  const page = await ctx.newPage();
  await page.goto(`${B}/sites/pacote/pedido?p=${rp.cred.id}&t=${rp.cred.t}`, { waitUntil: "networkidle" });
  const verif = await page.getByText("Pagamento em verificação").waitFor({ timeout: 8000 }).then(() => true, () => false);
  const html = await page.content();
  ok(verif && (await page.locator("#site-cartao").count()) === 0 && !/nada foi cobrado/i.test(html) && !/Voltar ao checkout/.test(html), 'página do pedido: "Pagamento em verificação", sem formulário de cartão, sem "nada foi cobrado" e sem convite a outro pedido');
  if (CAPT) await page.screenshot({ path: `${CAPT}/pedido-em-verificacao-390.png`, fullPage: true });
  mp.atrasoBusca = false;
  await ctx.close();
}

// Fluxo no navegador: cartão 12× (formulário simulado) e Pix, com eventos do Pixel
for (const fluxo of ["cartao-12x", "pix"]) {
  const { ctx, eventos } = await contexto({ width: 390, height: 844 });
  const page = await ctx.newPage();
  await page.goto(`${B}/sites/pacote/checkout?c=${fluxo}&utm_source=meta&utm_campaign=site-pacote`, { waitUntil: "networkidle" });
  await espera(300);
  const ic = eventos.filter((e) => e[0] === "track" && e[1] === "InitiateCheckout");
  ok(ic.length === 1 && ic[0][2].value === (fluxo === "pix" ? 449.9 : 574.8) && ic[0][2].content_category === "sites-pacote", `${fluxo}: InitiateCheckout uma vez na entrada, com o total da condição`);
  await page.fill("#site-nome", "Comprador Teste");
  await page.fill("#site-email", `navegador-${fluxo}@exemplo.test`);
  await page.fill("#site-whatsapp", "(11) 91234-5678");
  await page.getByRole("button", { name: /Continuar/ }).click();
  ok(await page.getByText("É preciso concordar").isVisible(), `${fluxo}: sem aceite, o formulário avisa e não cria pedido`);
  await page.check("#site-aceite");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.waitForURL(/\/sites\/pacote\/pedido\?p=/);
  const u = new URL(page.url());
  const cred = { id: u.searchParams.get("p"), t: u.searchParams.get("t") };
  ok(!eventos.some((e) => e[1] === "Purchase"), `${fluxo}: nenhum Purchase por clique, cadastro ou redirecionamento`);
  if (CAPT) await page.screenshot({ path: `${CAPT}/pedido-${fluxo}-390.png`, fullPage: true });
  if (fluxo === "cartao-12x") {
    await page.locator("#pagar-simulado").click();
    await page.getByText("Pagamento confirmado").waitFor({ timeout: 8000 });
  } else {
    ok(await page.getByAltText("QR Code do Pix").waitFor({ timeout: 8000 }).then(() => true, () => false), "pix: QR Code e copia e cola na página do pedido");
    const p = [...mp.pay.values()].find((x) => x.external_reference === `site_${cred.id}`);
    p.status = "approved";
    await webhook(p.id);
    await page.getByText("Pagamento confirmado").waitFor({ timeout: 12000 });
  }
  if (CAPT) await page.screenshot({ path: `${CAPT}/pedido-${fluxo}-pago-390.png`, fullPage: true });
  await espera(300);
  const compras = eventos.filter((e) => e[1] === "Purchase");
  const valor = fluxo === "pix" ? 449.9 : 574.8;
  ok(compras.length === 1 && compras[0][2].value === valor && compras[0][2].currency === "BRL" && compras[0][3]?.eventID === `site-${cred.id}`, `${fluxo}: Purchase uma vez, só depois da confirmação, com R$ ${valor}`);
  ok(!eventos.some((e) => e[1] === "Subscribe"), `${fluxo}: nenhum Subscribe`);
  const tudo = JSON.stringify(eventos);
  ok(!/exemplo\.test|91234|Comprador/.test(tudo), `${fluxo}: nenhum dado pessoal nos eventos`);
  await page.reload({ waitUntil: "networkidle" });
  await espera(500);
  ok(eventos.filter((e) => e[1] === "Purchase").length === 1, `${fluxo}: reabrir a página não repete o Purchase`);
  const ped = await status(cred);
  ok(ped.status === "pago", `${fluxo}: pedido pago no servidor`);
  const av = emailsDe(cred.id);
  ok(av.some((e) => /utm_source=meta/.test(e.text)), `${fluxo}: UTMs preservadas até o aviso interno`);
  await ctx.close();
}

// oferta fechada (servidor sem SITES_*): página sem botão de compra e API recusando
if (FECHADO) {
  const r = await json("/api/sites-pacote/pedido", { method: "POST", body: JSON.stringify({ nome: "Pessoa", email: "a@exemplo.test", whatsapp: "11987654321", condicao: "pix", aceite: true }) }, FECHADO);
  ok(r.status === 503, "contratação desligada → API recusa (503)");
  const html = await (await fetch(`${FECHADO}/sites/pacote/checkout`)).text();
  ok(/não está disponível agora/.test(html), "contratação desligada → checkout explica e não oferece pagamento");
}

await browser.close();
console.log(out.join("\n"));
const falhas = out.filter((l) => l.startsWith("FALHA")).length;
console.log(`\n${out.length - falhas}/${out.length} conferências OK`);
process.exit(falhas ? 1 : 0);
