// Testes REAIS de cobrança no ambiente de teste do Mercado Pago (API de Orders), com o checkout do pacote de sites
// rodando nesta máquina (scripts/sandbox-local.sh, porta 3230). O cartão é digitado no formulário seguro do
// próprio Mercado Pago (Card Payment Brick, SDK JS v2), com os cartões de teste publicados pelo Mercado Pago.
// Nenhum dinheiro real: as credenciais são da conta de teste (o launcher confere a marca test_user).
//
//   bash scripts/sandbox-local.sh                # outro terminal
//   node --no-warnings scripts/teste-sandbox-mp.mjs
//
// O que NÃO dá para testar aqui:
// - a entrega real das notificações pelo Mercado Pago: ele não alcança localhost. As notificações são simuladas com
//   assinatura x-signature válida (segredo local do launcher) e apontam para orders REAIS do sandbox, que o servidor
//   relê no Mercado Pago, como faria com uma entrega real;
// - o parcelamento sem acréscimo da conta real: a conta de teste tem configuração própria ("parcelado cliente"), então
//   aqui o checkout DEVE recusar 2×, 3×, 6× e 12× antes de cobrar. O que o comprador real paga é conferido à parte,
//   só lendo, por scripts/sondar-parcelamento.mjs com a Public Key de produção;
// - avisos internos por e-mail (o sandbox roda sem provedor de e-mail; cobertos em teste-sites-pacote.mjs).

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import { chromium } from "playwright-core";

const B = process.env.SANDBOX_URL || "http://localhost:3230";
const MP = "https://api.mercadopago.com";
const SEGREDO = "sandbox-local-assinatura-simulada"; // o mesmo de scripts/sandbox-local.sh (não é credencial)
const CAPT = process.env.SANDBOX_CAPTURAS || "../previa-pacote-site/sandbox-orders";
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
mkdirSync(CAPT, { recursive: true });

const env = Object.fromEntries(
  readFileSync(".env.sandbox.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const PK = env.NEXT_PUBLIC_MP_PUBLIC_KEY;
const TOKEN = env.MP_ACCESS_TOKEN;

const out = [];
const registro = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const secao = (t) => out.push(`\n## ${t}`);
// SANDBOX_CENARIOS=1,6 roda só esses cenários (0 = ambiente)
const roda = (k) => !process.env.SANDBOX_CENARIOS || process.env.SANDBOX_CENARIOS.split(",").includes(String(k));

/* ─────────────── utilitários ─────────────── */
async function json(path, init = {}) {
  const r = await fetch(B + path, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function mpGet(path) {
  const r = await fetch(MP + path, { headers: { authorization: `Bearer ${TOKEN}` } });
  return r.json();
}
/**
 * Orders reais do pedido no Mercado Pago (referência site_<id>). A busca do Mercado Pago leva alguns segundos para
 * enxergar uma order nova: espera até haver `min` orders (ou o tempo acabar). Com min = 0, espera `semNada` ms antes
 * de concluir que não há nenhuma.
 */
async function ordens(pedidoId, { min = 1, ate = 30000, semNada = 8000 } = {}) {
  const ini = new Date(Date.now() - 86400e3).toISOString();
  const fim = new Date(Date.now() + 86400e3).toISOString();
  const busca = async () =>
    ((await mpGet(`/v1/orders?external_reference=site_${pedidoId}&begin_date=${encodeURIComponent(ini)}&end_date=${encodeURIComponent(fim)}`)).data ?? []).sort(
      (a, b) => Date.parse(a.created_date) - Date.parse(b.created_date),
    );
  if (min === 0) {
    await espera(semNada);
    return busca();
  }
  const limite = Date.now() + ate;
  let lista = await busca();
  while (lista.length < min && Date.now() < limite) {
    await espera(2000);
    lista = await busca();
  }
  return lista;
}
const ordem = (id) => mpGet(`/v1/orders/${id}`);
let n = 0;
const emailTeste = () => `comprador.sandbox.${Date.now()}.${++n}@exemplo.com`;
async function pedidoApi(condicao, nome = "Comprador Sandbox", extra = {}) {
  const r = await json("/api/sites-pacote/pedido", {
    method: "POST",
    body: JSON.stringify({ nome, email: emailTeste(), whatsapp: "(11) 98765-4321", condicao, aceite: true, utm: { utm_source: "sandbox", utm_campaign: "teste-orders" }, ...extra }),
  });
  return { ...r, cred: r.body.id ? { id: r.body.id, t: r.body.token } : null };
}
const statusPedido = (c) => json(`/api/sites-pacote/status?p=${c.id}&t=${c.t}`).then((r) => r.body.pedido);
let rid = 1;
function notificar(dataId, { rota = "/api/sites-pacote/webhook", type = "order", sign = true, requestId = `sandbox-${Date.now()}-${rid++}` } = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", sign ? SEGREDO : "assinatura-errada").update(`id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  return json(`${rota}?data.id=${encodeURIComponent(dataId)}&type=${type}`, {
    method: "POST",
    headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
    body: JSON.stringify({ type, action: `${type}.updated`, data: { id: dataId } }),
  });
}

// Cartões de teste da API de Orders (Brasil). O nome do titular define o resultado: APRO aprovado, OTHE recusado,
// CONT pendente. CPF de teste 12345678909.
const CARTOES = {
  master: { numero: "5480832801033311", cvv: "123", bin: "548083" },
  visa: { numero: "4235647728025682", cvv: "123", bin: "423564" },
};
async function tokenApi(bandeira, titular) {
  const c = CARTOES[bandeira];
  const r = await fetch(`${MP}/v1/card_tokens?public_key=${encodeURIComponent(PK)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ card_number: c.numero, expiration_month: 11, expiration_year: 2030, security_code: c.cvv, cardholder: { name: titular, identification: { type: "CPF", number: "12345678909" } } }),
  });
  const j = await r.json();
  if (!j.id) throw new Error(`token do cartão de teste não criado (HTTP ${r.status})`);
  return j.id;
}
/** pagamento pela API do checkout (mesma rota que o formulário usa), com token gerado pela Public Key de teste */
async function cartaoApi(cred, bandeira, titular, parcelas, valor) {
  const inst = await (await fetch(`${MP}/v1/payment_methods/installments?public_key=${encodeURIComponent(PK)}&amount=${valor}&bin=${CARTOES[bandeira].bin}`)).json();
  const op = inst.find((o) => o.payment_type_id === "credit_card") ?? inst[0] ?? {};
  return json("/api/sites-pacote/cartao", {
    method: "POST",
    body: JSON.stringify({
      id: cred.id,
      t: cred.t,
      formData: {
        token: await tokenApi(bandeira, titular),
        payment_method_id: op.payment_method_id ?? bandeira,
        issuer_id: op.issuer?.id ?? null,
        installments: parcelas,
        payer: { email: emailTeste(), identification: { type: "CPF", number: "12345678909" } },
      },
      additionalData: { paymentTypeId: "credit_card" },
    }),
  });
}

/* ─────────────── navegador (checkout real + Card Payment Brick) ─────────────── */
const browser = await chromium.launch({ executablePath: CHROME });
async function novaPagina() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "pt-BR" });
  await ctx.route(/facebook\.(com|net)/, (route) => route.abort()); // Pixel falso no build; nada sai para a Meta
  const page = await ctx.newPage();
  return { ctx, page };
}
async function checkoutUI(page, condicao, nome, email) {
  await page.goto(`${B}/sites/pacote/checkout?c=${condicao}&utm_source=sandbox&utm_campaign=teste-orders`, { waitUntil: "networkidle" });
  await page.fill("#site-nome", nome);
  await page.fill("#site-email", email);
  await page.fill("#site-whatsapp", "(11) 91234-5678");
  await page.check("#site-aceite");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.waitForURL(/\/sites\/pacote\/pedido\?p=/, { timeout: 30000 });
  const u = new URL(page.url());
  return { id: u.searchParams.get("p"), t: u.searchParams.get("t") };
}
async function pagarNoBrick(page, bandeira, titular, email) {
  const c = CARTOES[bandeira];
  const campo = (nome) => page.frameLocator(`iframe[name="${nome}"]`).locator(`#${nome}`);
  await campo("cardNumber").waitFor({ timeout: 45000 });
  await campo("cardNumber").click();
  await campo("cardNumber").pressSequentially(c.numero, { delay: 35 });
  await campo("expirationDate").click();
  await campo("expirationDate").pressSequentially("1130", { delay: 35 });
  await campo("securityCode").click();
  await campo("securityCode").pressSequentially(c.cvv, { delay: 35 });
  await page.locator('input[name="HOLDER_NAME"]').fill(titular);
  await page.locator('input[name="DOCUMENT"]').fill("12345678909");
  await page.locator('input[name="EMAIL"]').fill(email);
  await espera(2500); // o Brick consulta emissor e parcelas depois do número
  await page.locator("#site-cartao").getByRole("button", { name: /Pagar/ }).click();
}
// mensagens da página do pedido (o Next.js também tem um role="alert" próprio, o anúncio de rota)
const aviso = (page) => page.locator('p[role="alert"]').first();

/* ─────────────── 0. ambiente ─────────────── */
if (roda(0)) {
  secao("Ambiente");
  const me = await mpGet("/users/me");
  ok((me.tags ?? []).includes("test_user"), `credenciais de usuário de teste do Mercado Pago (marca test_user); nada aqui é cobrança real`);
  ok((await fetch(`${B}/sites/pacote/checkout`)).status === 200, `checkout local respondendo em ${B}`);
  const inst = await (await fetch(`${MP}/v1/payment_methods/installments?public_key=${encodeURIComponent(PK)}&amount=574.80&payment_method_id=visa`)).json();
  const pc = inst.find((o) => o.payment_type_id === "credit_card")?.payer_costs?.find((x) => x.installments === 12);
  registro.push({ cenario: "conta de teste: 12× visa", juros: pc?.installment_rate });
  ok(pc && pc.installment_rate > 0, `conta de teste em "parcelado cliente" (12× com ${pc?.installment_rate}% ao comprador): parcelados devem ser recusados aqui`);
}

/* ─────────────── 1. Pix pelo checkout ─────────────── */
if (roda(1)) {
  secao("Pix pelo checkout (navegador)");
  const { ctx, page } = await novaPagina();
  const cred = await checkoutUI(page, "pix", "APRO Sandbox", emailTeste());
  const qr = await page.getByAltText("QR Code do Pix").waitFor({ timeout: 20000 }).then(() => true, () => false);
  const copia = await page.locator("#pix-copia").inputValue().catch(() => "");
  ok(qr && copia.startsWith("000201"), "Pix gerado: QR Code e copia e cola na página do pedido");
  await page.screenshot({ path: `${CAPT}/01-pix-pendente-390.png`, fullPage: true });
  let os = await ordens(cred.id);
  const o = os[0] ? await ordem(os[0].id) : null; // a busca não traz a validade; a leitura por id traz
  const pag = o?.transactions?.payments?.[0];
  const minutos = pag ? Math.round((Date.parse(pag.date_of_expiration) - Date.parse(o.created_date)) / 60000) : null;
  ok(os.length === 1 && o.total_amount === "449.90" && pag?.payment_method?.id === "pix" && o.external_reference === `site_${cred.id}`, `uma order Pix no Mercado Pago com R$ 449,90 e referência site_<pedido> (${o?.id})`);
  ok(o && ["action_required", "processed"].includes(o.status) && minutos >= 58 && minutos <= 61, `Pix aguardando pagamento, validade de ${minutos} min`);
  // o sandbox aprova o Pix de teste (APRO) entre alguns segundos e ~2 min
  const confirmou = await page.getByText("Pagamento confirmado").waitFor({ timeout: 180000 }).then(() => true, () => false);
  os = await ordens(cred.id);
  ok(confirmou && os[0]?.status === "processed" && os[0]?.total_paid_amount === "449.90", "Pix pago no sandbox → a página confirma sozinha (conferência no Mercado Pago), R$ 449,90 pagos");
  await page.screenshot({ path: `${CAPT}/02-pix-pago-390.png`, fullPage: true });
  registro.push({ cenario: "Pix APRO (navegador)", pedido: cred.id, order: os[0]?.id, status: os[0]?.status, pago: os[0]?.total_paid_amount });
  await ctx.close();
}

/* ─────────────── 2. Cartão 1× aprovado pelo Brick ─────────────── */
if (roda(2)) {
  secao("Cartão 1× aprovado (Brick)");
  const { ctx, page } = await novaPagina();
  const email = emailTeste();
  const cred = await checkoutUI(page, "cartao-1x", "Comprador Sandbox", email);
  await page.screenshot({ path: `${CAPT}/03-cartao-1x-formulario-390.png`, fullPage: true });
  await pagarNoBrick(page, "master", "APRO", email);
  const pago = await page.getByText("Pagamento confirmado").waitFor({ timeout: 60000 }).then(() => true, () => false);
  await page.screenshot({ path: `${CAPT}/04-cartao-1x-pago-390.png`, fullPage: true });
  let os = await ordens(cred.id);
  const o = os[0];
  const pm = o?.transactions?.payments?.[0]?.payment_method ?? {};
  ok(pago && (await statusPedido(cred))?.status === "pago", "Mastercard de teste, titular APRO, 1× → pedido pago");
  ok(os.length === 1 && o.status === "processed" && o.status_detail === "accredited" && o.total_paid_amount === "449.90", `order processada no Mercado Pago, R$ 449,90 pagos (${o?.id})`);
  ok(pm.installments === 1 && pm.type === "credit_card" && pm.statement_descriptor === "SPOLAOR", "1× no crédito, SPOLAOR na fatura");
  const dup = await cartaoApi(cred, "visa", "APRO", 1, "449.90");
  await espera(6000);
  os = await ordens(cred.id);
  ok(dup.status === 409 && dup.body.error === "pedido_encerrado" && os.length === 1, `segunda cobrança no mesmo pedido recusada (${dup.status} ${dup.body.error}); continua uma order só`);
  registro.push({ cenario: "Cartão 1× APRO (Brick)", pedido: cred.id, order: o?.id, status: o?.status, pago: o?.total_paid_amount });
  await ctx.close();
}

/* ─────────────── 3. Recusado e nova tentativa ─────────────── */
if (roda(3)) {
  secao("Cartão recusado e nova tentativa (Brick)");
  const { ctx, page } = await novaPagina();
  const email = emailTeste();
  const cred = await checkoutUI(page, "cartao-1x", "Comprador Sandbox", email);
  await pagarNoBrick(page, "visa", "OTHE", email);
  const motivo = await aviso(page).waitFor({ timeout: 45000 }).then(() => aviso(page).innerText(), () => "");
  const st = await statusPedido(cred);
  ok(st?.status === "recusado" && /recus|não foi aprovado/i.test(motivo), `Visa de teste, titular OTHE → recusado, com motivo na página: "${motivo.slice(0, 80)}"`);
  await page.screenshot({ path: `${CAPT}/05-cartao-recusado-390.png`, fullPage: true });
  await page.reload({ waitUntil: "networkidle" });
  await pagarNoBrick(page, "visa", "APRO", email);
  const pago = await page.getByText("Pagamento confirmado").waitFor({ timeout: 60000 }).then(() => true, () => false);
  const os = await ordens(cred.id, { min: 2 });
  ok(pago && os.length === 2 && os[0].status === "failed" && os[1].status === "processed", `nova tentativa no mesmo pedido, titular APRO → pago (orders: ${os.map((x) => x.status).join(" → ")})`);
  registro.push({ cenario: "OTHE → APRO (Brick)", pedido: cred.id, orders: os.map((x) => `${x.id}:${x.status}`) });
  await ctx.close();
}

/* ─────────────── 4. Em análise ─────────────── */
if (roda(4)) {
  secao("Cartão em análise (Brick)");
  const { ctx, page } = await novaPagina();
  const email = emailTeste();
  const cred = await checkoutUI(page, "cartao-1x", "Comprador Sandbox", email);
  await pagarNoBrick(page, "master", "CONT", email);
  const analise = await page.getByText(/Pagamento em análise/).waitFor({ timeout: 45000 }).then(() => true, () => false);
  await page.screenshot({ path: `${CAPT}/06-cartao-em-analise-390.png`, fullPage: true });
  ok(analise && (await statusPedido(cred))?.status === "pagamento_pendente", "titular CONT → pagamento em análise (não conta como pago)");
  const nova = await cartaoApi(cred, "visa", "APRO", 1, "449.90");
  await espera(6000);
  const os = await ordens(cred.id);
  ok(nova.status === 409 && nova.body.error === "pagamento_em_analise" && os.length === 1, `nova cobrança bloqueada enquanto a anterior está em análise (${nova.status}); uma order só (${os[0]?.status})`);
  registro.push({ cenario: "CONT (Brick)", pedido: cred.id, order: os[0]?.id, status: os[0]?.status });
  await ctx.close();
}

/* ─────────────── 5. Parcelados na conta de teste ─────────────── */
if (roda(5)) {
  secao("Parcelados na conta de teste (parcelado cliente)");
  const { ctx, page } = await novaPagina();
  const email = emailTeste();
  const cred = await checkoutUI(page, "cartao-12x", "Comprador Sandbox", email);
  await pagarNoBrick(page, "master", "APRO", email);
  const msg = await aviso(page).waitFor({ timeout: 45000 }).then(() => aviso(page).innerText(), () => "");
  await page.screenshot({ path: `${CAPT}/07-12x-recusado-antes-de-cobrar-390.png`, fullPage: true });
  const os = await ordens(cred.id, { min: 0 });
  ok(/cobraria mais que R\$ 574,80 em 12×/.test(msg) && os.length === 0, `12× pelo formulário → recusado ANTES de cobrar, zero orders: "${msg.slice(0, 90)}"`);
  registro.push({ cenario: "12× (Brick)", pedido: cred.id, orders: os.length });
  await ctx.close();
  for (const [cond, parc, valor] of [["cartao-2x", 2, "469.80"], ["cartao-3x", 3, "479.70"], ["cartao-6x", 6, "509.40"]]) {
    const r = await pedidoApi(cond);
    const x = await cartaoApi(r.cred, "master", "APRO", parc, valor);
    const lista = await ordens(r.cred.id, { min: 0, semNada: 4000 });
    ok(x.status === 422 && x.body.error === "parcelamento_indisponivel" && lista.length === 0, `${parc}× (R$ ${valor}) → recusado antes de cobrar, zero orders`);
  }
}

/* ─────────────── 6. Notificações ─────────────── */
if (roda(6)) {
  secao("Notificações (assinatura simulada, orders reais)");
  const r = await pedidoApi("pix", "APRO Notifica");
  const cred = r.cred;
  let os = await ordens(cred.id);
  const id = os[0]?.id;
  ok(r.body.pedido?.status === "pagamento_pendente" && !!id, `Pix criado, order ${id} aguardando (o status do pedido NÃO é consultado até a notificação)`);
  let w = await notificar(id, { sign: false });
  ok(w.status === 401, "notificação com assinatura inválida → 401");
  w = await notificar(id, { type: "payment" });
  ok(w.status === 200 && /tipo payment/.test(w.body.ignored ?? ""), "rota de sites: tipo payment ignorado (só order)");
  for (let i = 0; i < 15 && os[0]?.status !== "processed"; i++) {
    await espera(3000);
    os = await ordens(cred.id);
  }
  ok(os[0]?.status === "processed", "o Mercado Pago aprovou o Pix de teste (order processed)");
  const rq = `sandbox-ia-${Date.now()}`;
  w = await notificar(id, { rota: "/api/atendimento-ia/webhook", requestId: rq });
  ok(w.status === 200 && w.body.result?.status === "pago", "rota de Webhooks da aplicação (a da IA, usada em produção) repassa a order → pedido pago");
  const w2 = await notificar(id, { rota: "/api/atendimento-ia/webhook", requestId: rq });
  ok(w2.body.duplicate === true, "a mesma entrega repetida → ignorada");
  const w3 = await notificar(id);
  ok(w3.status === 200 && w3.body.result?.status === "pago", "nova notificação pela rota de sites → continua pago, sem novo efeito");
  ok((await statusPedido(cred))?.status === "pago", "status do pedido: pago (confirmado pela notificação)");
  const w4 = await notificar("ORDTST00000000000000000000INEXISTENTE");
  ok(w4.status === 200 && /inexistente/.test(w4.body.ignored ?? ""), "order inexistente (ex.: simulação do painel) → 200 e ignorada");
  registro.push({ cenario: "Notificação Pix → pago", pedido: cred.id, order: id });
}

/* ─────────────── 7. Pedido duplicado ─────────────── */
if (roda(7)) {
  secao("Prevenção de pedido duplicado");
  const chavePedido = randomUUID();
  const email = emailTeste();
  const corpo = { nome: "Comprador Sandbox", email, whatsapp: "(11) 98765-4321", condicao: "pix", aceite: true, chavePedido };
  const a = await json("/api/sites-pacote/pedido", { method: "POST", body: JSON.stringify(corpo) });
  const b = await json("/api/sites-pacote/pedido", { method: "POST", body: JSON.stringify(corpo) });
  await espera(6000);
  const os = await ordens(a.body.id);
  ok(a.body.id && a.body.id === b.body.id && os.length === 1, `mesmo envio repetido (clique duplo) → mesmo pedido e um Pix só (${os.length} order)`);
}

await browser.close();
const falhas = out.filter((l) => l.startsWith("FALHA")).length;
const total = out.filter((l) => /^(OK|FALHA)/.test(l)).length;
const texto = `${out.join("\n")}\n\n${total - falhas}/${total} conferências OK · ${new Date().toISOString()}\n`;
console.log(texto);
writeFileSync(`${CAPT}/RESULTADO.txt`, `${texto}\nIds (sandbox):\n${registro.map((r) => JSON.stringify(r)).join("\n")}\n`);
process.exit(falhas ? 1 : 0);
