// Teste local da venda avulsa "Site de uma página" com Mercado Pago, e-mail e Pixel SIMULADOS (nada sai da máquina;
// nenhum pagamento real). Não substitui o teste com as credenciais de TESTE do Mercado Pago na prévia (docs/SITES-PACOTE.md).
//
// Antes: build com Pixel fictício e o servidor em :3220:
//   NEXT_PUBLIC_META_PIXEL_ID=000000000000001 npm run build
//   SITES_STORE=memory SITES_CONTRATACAO_ATIVA=true SITES_CONDICOES=pix,cartao-1x,cartao-2x,cartao-3x,cartao-6x,cartao-12x
//   MP_ACCESS_TOKEN=teste-local MP_WEBHOOK_SECRET=segredo-teste MP_API_URL=http://localhost:4040 NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-publica-local
//   RESEND_API_KEY=teste-local RESEND_API_URL=http://localhost:4042/emails LEAD_EMAIL_TO=ops@exemplo.test LEAD_EMAIL_FROM=site@exemplo.test
//   NEXT_PUBLIC_SITE_URL=http://localhost:3220 CRON_SECRET=cron-teste-0123456789 SITES_MP_NOTIFICATION_URL=off
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

/* ─────────────── Mercado Pago simulado ─────────────── */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const mp = { pay: new Map(), creates: [], chaves: new Map(), modoCartao: "approved", juros: false, installmentsCalls: 0, seq: 5000 };
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
      if (req.method === "POST" && u.pathname === "/v1/payments") {
        const key = req.headers["x-idempotency-key"];
        if (!key) return send(400, { message: "X-Idempotency-Key obrigatório", cause: [{ code: 4292 }] });
        if (mp.chaves.has(key)) return send(200, mp.pay.get(mp.chaves.get(key)));
        const body = JSON.parse(b);
        mp.creates.push({ ...body, key });
        const id = String(mp.seq++);
        let p;
        if (body.payment_method_id === "pix") {
          p = {
            id,
            status: "pending",
            status_detail: "pending_waiting_transfer",
            transaction_amount: body.transaction_amount,
            currency_id: "BRL",
            installments: 1,
            payment_method_id: "pix",
            payment_type_id: "bank_transfer",
            external_reference: body.external_reference,
            date_of_expiration: body.date_of_expiration,
            transaction_details: { total_paid_amount: body.transaction_amount },
            point_of_interaction: { transaction_data: { qr_code: `00020126PIXSIMULADO${id}`, qr_code_base64: PNG, ticket_url: "https://mp.simulado/pix" } },
          };
        } else {
          const st = mp.modoCartao;
          p = {
            id,
            status: st,
            status_detail: st === "rejected" ? "cc_rejected_insufficient_amount" : st === "in_process" ? "pending_contingency" : "accredited",
            transaction_amount: body.transaction_amount,
            currency_id: "BRL",
            installments: body.installments,
            payment_method_id: body.payment_method_id,
            payment_type_id: "credit_card",
            external_reference: body.external_reference,
            date_approved: st === "approved" ? new Date().toISOString() : null,
            transaction_details: { total_paid_amount: body.transaction_amount, installment_amount: Math.round((body.transaction_amount / body.installments) * 100) / 100 },
          };
        }
        mp.pay.set(id, p);
        mp.chaves.set(key, id);
        return send(201, p);
      }
      if ((m = u.pathname.match(/^\/v1\/payments\/(\d+)$/)) && req.method === "GET") {
        const p = mp.pay.get(m[1]);
        return p ? send(200, p) : send(404, { message: "not found" });
      }
      if (u.pathname === "/v1/payments/search") {
        const ref = u.searchParams.get("external_reference");
        return send(200, { results: [...mp.pay.values()].filter((p) => p.external_reference === ref).reverse() });
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
function webhook(dataId, { sign = true, requestId = `req-${rid++}`, type = "payment" } = {}) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", sign ? SECRET : "outro").update(`id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  return json(`/api/sites-pacote/webhook?data.id=${encodeURIComponent(dataId)}&type=${type}`, {
    method: "POST",
    headers: { "x-signature": `ts=${ts},v1=${sig}`, "x-request-id": requestId },
    body: JSON.stringify({ type, action: "payment.updated", data: { id: dataId } }),
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
const cartao = (c, formData) => json("/api/sites-pacote/cartao", { method: "POST", body: JSON.stringify({ id: c.id, t: c.t, formData }) });
const fd = (installments, extra = {}) => ({ token: "tok_simulado", payment_method_id: "master", issuer_id: "24", installments, payer: { email: "teste@exemplo.test", identification: { type: "CPF", number: "123.456.789-09" } }, ...extra });
const emailsDe = (id) => emails.filter((e) => String(e.text ?? "").includes(id));
const ultimoCreate = () => mp.creates[mp.creates.length - 1];

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
  ok(c.external_reference === `site:${r.body.id}` && /^site-.+-pix-1$/.test(c.key) && c.date_of_expiration?.endsWith("-03:00"), "Pix: referência do pedido, chave de idempotência e validade com fuso");
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
  const pagId = r.body.pedido && [...mp.pay.values()].find((p) => p.external_reference === `site:${r.body.id}`).id;
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
  const pv = [...mp.pay.values()].find((p) => p.external_reference === `site:${rv.body.id}`);
  pv.status = "cancelled";
  pv.status_detail = "expired";
  await webhook(pv.id);
  ok((await status(rv.cred)).status === "expirado", "Pix vencido → expirado");
  const np = await json("/api/sites-pacote/pix", { method: "POST", body: JSON.stringify({ id: rv.cred.id, t: rv.cred.t }) });
  ok(np.body.pedido?.status === "pagamento_pendente" && /-pix-2$/.test(ultimoCreate().key), "novo Pix gerado com nova chave de idempotência");

  // pagamento de outra oferta (ex.: IA) chegando nesta rota
  const outro = String(mp.seq++);
  mp.pay.set(outro, { id: outro, status: "approved", transaction_amount: 297, currency_id: "BRL", external_reference: "spolaor-ia-xyz" });
  w = await webhook(outro);
  ok(w.body.result?.ignorado === "pagamento de outra oferta", "pagamento de outra oferta → ignorado");
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
  ok(c.transaction_amount === 574.8 && c.installments === 12 && c.token === "tok_simulado" && /-cartao-1$/.test(c.key) && c.payer?.identification?.number === "12345678909", "cobra R$ 574,80 em 12× com token, CPF só com dígitos e chave de idempotência");
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

  // recusado → nova tentativa aprovada
  const rr = await pedido("cartao-3x");
  mp.modoCartao = "rejected";
  x = await cartao(rr.cred, fd(3));
  ok(x.body.pedido?.status === "recusado" && /limite/.test(x.body.pedido?.motivoRecusa ?? ""), "cartão recusado → recusado, com motivo legível");
  mp.modoCartao = "approved";
  x = await cartao(rr.cred, fd(3));
  ok(x.body.pedido?.status === "pago" && /-cartao-2$/.test(ultimoCreate().key), "nova tentativa (outra chave) aprovada → pago");

  // em análise → bloqueia nova tentativa; confirmação pela notificação
  const ra = await pedido("cartao-6x");
  mp.modoCartao = "in_process";
  x = await cartao(ra.cred, fd(6));
  ok(x.body.pedido?.status === "pagamento_pendente", "cartão em análise → pagamento pendente (não é pago)");
  x = await cartao(ra.cred, fd(6));
  ok(x.status === 409 && x.body.error === "pagamento_em_analise", "nova cobrança bloqueada enquanto a anterior está em análise");
  mp.modoCartao = "approved";
  const pa = [...mp.pay.values()].find((p) => p.external_reference === `site:${ra.cred.id}`);
  pa.status = "approved";
  await webhook(pa.id);
  ok((await status(ra.cred)).status === "pago", "análise aprovada (notificação) → pago");

  // aprovado com divergência (valor) → não conta como pago
  const rd = await pedido("cartao-2x");
  mp.modoCartao = "in_process";
  await cartao(rd.cred, fd(2));
  mp.modoCartao = "approved";
  const pd = [...mp.pay.values()].find((p) => p.external_reference === `site:${rd.cred.id}`);
  Object.assign(pd, { status: "approved", transaction_amount: 449.9 });
  await webhook(pd.id);
  const sd = await status(rd.cred);
  ok(sd.status === "divergente" && emailsDe(rd.cred.id).some((e) => /divergência/.test(e.subject)), "aprovado com valor diferente → divergente (não pago) e aviso");
  // conferência direta (sem notificação): o acompanhamento busca no Mercado Pago
  const rc = await pedido("cartao-6x");
  mp.modoCartao = "in_process";
  await cartao(rc.cred, fd(6));
  mp.modoCartao = "approved";
  const pc = [...mp.pay.values()].find((p) => p.external_reference === `site:${rc.cred.id}`);
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
        b.onclick = function(){ s.callbacks.onSubmit({ token:'tok_simulado', payment_method_id:'master', issuer_id:'24', installments: s.customization.paymentMethods.minInstallments, payer:{ email:'comprador@exemplo.test' } }).catch(function(){}); };
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
    ok(await page.getByAltText("QR Code do Pix").isVisible(), "pix: QR Code e copia e cola na página do pedido");
    const p = [...mp.pay.values()].find((x) => x.external_reference === `site:${cred.id}`);
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
