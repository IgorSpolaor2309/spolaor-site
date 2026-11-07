// Teste da medição do funil do Atendimento com IA, com Mercado Pago, ZappMillion e Pixel simulados.
// Nada sai para a internet: o script do Facebook é bloqueado e as chamadas a window.fbq são registradas.
//
// Antes: build com um Pixel fictício e dois servidores locais (mesmas variáveis do teste-atendimento-ia, com
// MP_API_URL=http://localhost:4030 e ZM_API_URL=http://localhost:4031):
//   NEXT_PUBLIC_META_PIXEL_ID=000000000000001 npm run build
//   :3215 com IA_CONTRATACAO_ATIVA=true e NEXT_PUBLIC_SITE_URL=http://localhost:3215
//   :3216 sem IA_CONTRATACAO_ATIVA, com IA_TOKEN_VALIDACAO=validacao-interna-teste-0123456789
// Uso: node scripts/teste-medicao-funil.mjs
import http from "node:http";
import { chromium } from "playwright-core";

const B = "http://localhost:3215";
const BV = "http://localhost:3216";
const TOKEN = "validacao-interna-teste-0123456789";
const out = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const iso = (ms) => new Date(ms).toISOString();

/* ─────────── Mercado Pago, ZappMillion e "checkout do Mercado Pago" simulados ─────────── */
const mp = { pre: new Map(), pagos: new Set(), modo: "ok", seq: 1 };
const srv = (port, fn) =>
  http
    .createServer((q, r) => {
      let b = "";
      q.on("data", (c) => (b += c));
      q.on("end", () => {
        const s = (c, o) => {
          r.writeHead(c, { "content-type": "application/json" });
          r.end(JSON.stringify(o));
        };
        fn(q, s, new URL(q.url, "http://x"), b, r);
      });
    })
    .listen(port);
srv(4030, (q, s, u, b) => {
  let m;
  if (q.method === "POST" && u.pathname === "/preapproval") {
    if (mp.modo === "erro") return s(400, { message: "User bad request" });
    const x = JSON.parse(b);
    const id = `pre_${mp.seq++}`;
    const p = { id, status: "pending", external_reference: x.external_reference, auto_recurring: x.auto_recurring, ...(mp.modo === "semLink" ? {} : { init_point: `http://localhost:4032/checkout-mp?p=${id}` }) };
    mp.pre.set(id, p);
    return s(201, p);
  }
  if ((m = u.pathname.match(/^\/preapproval\/(.+)$/))) {
    const p = mp.pre.get(m[1]);
    if (!p) return s(404, {});
    if (q.method === "PUT") Object.assign(p, JSON.parse(b || "{}"));
    return s(200, mp.pagos.has(p.id) ? { ...p, status: "authorized" } : p);
  }
  if (u.pathname === "/authorized_payments/search") {
    const id = u.searchParams.get("preapproval_id");
    return s(200, { results: mp.pagos.has(id) ? [{ id: `ap_${id}`, preapproval_id: id, status: "processed", transaction_amount: 297, currency_id: "BRL", debit_date: iso(Date.now()), payment: { id: `pay_${id}`, status: "approved" } }] : [] });
  }
  s(404, {});
});
const zm = new Map();
srv(4031, (q, s, u, b) => {
  let m;
  if (u.pathname === "/plans") return s(200, { data: [{ id: "plan_teste", name: "PRO", monthlyPrice: 97, currency: "BRL", agentReplyLimit: 2000, billingCycleDays: 30 }] });
  const sub = { status: "ACTIVE", planId: "plan_teste", amount: 97, currency: "BRL", currentPeriodStart: iso(Date.now()), currentPeriodEnd: iso(Date.now() + 30 * 864e5), scheduledPlanId: null };
  if (q.method === "POST" && u.pathname === "/clients") {
    const x = JSON.parse(b);
    const c = { externalId: x.externalId, name: x.name, status: "ACTIVE", organizationId: "o", workspaceId: "w", userId: "u", subscription: sub, messagingAccount: null, createdAt: iso(Date.now()) };
    zm.set(x.externalId, c);
    return s(201, c);
  }
  if ((m = u.pathname.match(/^\/clients\/([^/]+)$/))) return zm.has(decodeURIComponent(m[1])) ? s(200, zm.get(decodeURIComponent(m[1]))) : s(404, {});
  s(404, {});
});
srv(4032, (q, s, u, b, r) => {
  r.writeHead(200, { "content-type": "text/html" });
  r.end("<!doctype html><title>Checkout simulado</title><p>Mercado Pago simulado</p>");
});

/* ─────────── Navegador com Pixel registrado ─────────── */
const browser = await chromium.launch({ executablePath: process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined });
const PII = ["Maria Souza", "maria.funil@exemplo.test", "98765-4321", "11987654321", TOKEN];

/** Contexto novo: registra cada chamada a window.fbq; opções simulam armazenamento bloqueado e Pixel quebrado. */
async function contexto({ storageBloqueado = false, pixelQuebrado = false, mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
  const eventos = [];
  await ctx.exposeBinding("__fbqRec", (_src, json) => eventos.push(JSON.parse(json)));
  await ctx.route(/connect\.facebook\.net|facebook\.com|google-analytics|googletagmanager/, (r) => r.abort());
  await ctx.addInitScript(
    ({ storageBloqueado, pixelQuebrado }) => {
      if (storageBloqueado) {
        for (const k of ["localStorage", "sessionStorage"])
          Object.defineProperty(window, k, {
            configurable: true,
            get() {
              throw new Error("armazenamento bloqueado");
            },
          });
      }
      let real;
      Object.defineProperty(window, "fbq", {
        configurable: true,
        get: () => real,
        set(v) {
          const wrap = function (...a) {
            try {
              window.__fbqRec(JSON.stringify(a));
            } catch {}
            if (pixelQuebrado) throw new Error("Pixel quebrado");
            return v.apply(this, a);
          };
          Object.assign(wrap, v);
          real = wrap;
        },
      });
    },
    { storageBloqueado, pixelQuebrado },
  );
  const respostas = [];
  // Captura a resposta da API antes da navegação ao Mercado Pago (que interromperia a leitura).
  await ctx.route("**/api/atendimento-ia/contratar", async (route) => {
    const res = await route.fetch();
    const body = await res.json().catch(() => null);
    respostas.push({ status: res.status(), body });
    await route.fulfill({ response: res, json: body });
  });
  const page = await ctx.newPage();
  return { ctx, page, eventos, respostas };
}
const nomes = (ev) => ev.map((a) => (a[0] === "trackCustom" ? `custom:${a[1]}` : a[0] === "track" ? a[1] : a[0]));
const conta = (ev, nome) => nomes(ev).filter((n) => n === nome).length;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function abrirCheckout(t, base = B, qs = "") {
  await t.page.goto(`${base}/atendimento-ia/checkout${qs}`, { waitUntil: "networkidle" });
  await espera(600);
}
async function preencher(t, { nome = "Maria Souza", email = "maria.funil@exemplo.test", tel = "(11) 98765-4321", aceite = true } = {}) {
  await t.page.fill("#ia-nome", nome);
  await t.page.fill("#ia-email", email);
  await t.page.fill("#ia-telefone", tel);
  if (aceite) await t.page.locator("input[name=aceite]").check();
}
const enviar = (t, duplo = false) => (duplo ? t.page.getByRole("button", { name: "Continuar para pagamento" }).dblclick() : t.page.getByRole("button", { name: "Continuar para pagamento" }).click());
const naoTemPII = (ev) => !PII.some((p) => JSON.stringify(ev).includes(p)) && !/acompanhar|\?c=|[?&]t=|http/.test(JSON.stringify(ev));

/* 1. Entrada no checkout */
{
  const t = await contexto();
  await abrirCheckout(t);
  ok(conta(t.eventos, "InitiateCheckout") === 1, "entrada no checkout: um InitiateCheckout");
  const ic = t.eventos.find((a) => a[1] === "InitiateCheckout");
  ok(ic?.[2]?.value === 297 && ic[2].currency === "BRL" && /^checkout-/.test(ic?.[3]?.eventID ?? ""), "InitiateCheckout com valor, moeda e eventID da abertura");
  ok(conta(t.eventos, "PageView") === 1 && t.eventos.findIndex((a) => a[1] === "InitiateCheckout") >= 0, "PageView mantido e Pixel inicializado antes do evento");
  await t.page.fill("#ia-nome", "Digitando");
  await espera(300);
  ok(conta(t.eventos, "InitiateCheckout") === 1, "re-renderização e digitação não repetem InitiateCheckout");
  await t.page.goto(`${B}/atendimento-ia`, { waitUntil: "networkidle" });
  await t.page.locator("[data-hero-cta]").click();
  await t.page.waitForURL("**/atendimento-ia/checkout");
  await espera(600);
  ok(conta(t.eventos, "InitiateCheckout") === 2, "nova abertura vinda do botão da landing: novo InitiateCheckout");
  await t.ctx.close();
}

/* 2. Erros de validação e do provedor; resposta sem link */
{
  const t = await contexto();
  await abrirCheckout(t);
  await enviar(t);
  await espera(800);
  ok(t.respostas.at(-1)?.status === 422 && conta(t.eventos, "CompleteRegistration") === 0 && conta(t.eventos, "custom:PaymentRedirect") === 0, "campos inválidos: sem CompleteRegistration nem PaymentRedirect");
  mp.modo = "erro";
  await preencher(t, { email: "erro.funil@exemplo.test" });
  await enviar(t);
  await espera(1500);
  ok(t.respostas.at(-1)?.status === 502 && conta(t.eventos, "CompleteRegistration") === 0 && t.page.url().includes("/atendimento-ia/checkout"), "erro do provedor: sem sucesso e sem sair da página");
  mp.modo = "semLink";
  await t.page.fill("#ia-email", "semlink.funil@exemplo.test");
  await enviar(t);
  await espera(1500);
  ok(conta(t.eventos, "CompleteRegistration") === 0 && conta(t.eventos, "custom:PaymentRedirect") === 0 && t.page.url().includes("/atendimento-ia/checkout"), "Mercado Pago sem link: sem sucesso");
  mp.modo = "ok";
  await t.page.route("**/api/atendimento-ia/contratar", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "sem-link-simulado" }) }));
  await t.page.fill("#ia-email", "semlink2.funil@exemplo.test");
  await enviar(t);
  await espera(1200);
  ok(conta(t.eventos, "CompleteRegistration") === 0 && t.page.url().includes("/atendimento-ia/checkout"), "resposta da API sem link de pagamento: sem sucesso");
  await t.ctx.close();
}

/* 3. Cadastro aceito, encaminhamento, clique duplo e repetição do pedido */
let pago;
{
  const t = await contexto();
  await abrirCheckout(t);
  await preencher(t);
  await enviar(t, true);
  await t.page.waitForURL("**/checkout-mp**", { timeout: 15000 }).catch(() => {});
  ok(t.page.url().includes("localhost:4032/checkout-mp"), "cadastro aceito: segue para o link do Mercado Pago");
  ok(conta(t.eventos, "CompleteRegistration") === 1 && conta(t.eventos, "custom:PaymentRedirect") === 1, "clique duplo: um CompleteRegistration e um PaymentRedirect");
  const ordem = nomes(t.eventos);
  ok(ordem.indexOf("CompleteRegistration") < ordem.indexOf("custom:PaymentRedirect"), "ordem: cadastro aceito antes do encaminhamento");
  const r = t.respostas.find((x) => x.body?.ok);
  pago = { id: r.body.id, link: r.body.acompanhar };
  const cr = t.eventos.find((a) => a[1] === "CompleteRegistration");
  ok(cr?.[3]?.eventID === `registro-${pago.id}` && conta(t.eventos, "Purchase") === 0 && conta(t.eventos, "Subscribe") === 0 && conta(t.eventos, "Lead") === 0, "cadastro aceito não vira compra, assinatura paga nem Lead");
  await abrirCheckout(t);
  await preencher(t);
  await enviar(t);
  await t.page.waitForURL("**/checkout-mp**", { timeout: 15000 }).catch(() => {});
  ok(t.respostas.at(-1)?.body?.id === pago.id && conta(t.eventos, "CompleteRegistration") === 1 && conta(t.eventos, "custom:PaymentRedirect") === 1, "repetição do mesmo pedido: mesmos id e link, sem eventos repetidos");
  ok(naoTemPII(t.eventos), "eventos do checkout sem nome, e-mail, telefone, token ou URL");
  await t.ctx.close();
}

/* 4. Validação interna */
{
  const t = await contexto();
  await abrirCheckout(t, BV, `?acesso=${TOKEN}`);
  await preencher(t, { email: "interna.funil@exemplo.test" });
  await enviar(t);
  await t.page.waitForURL("**/checkout-mp**", { timeout: 15000 }).catch(() => {});
  ok(t.page.url().includes("checkout-mp") && ["InitiateCheckout", "CompleteRegistration", "custom:PaymentRedirect"].every((n) => conta(t.eventos, n) === 0), "validação interna: compra segue, nenhum evento do funil");
  const link = t.respostas.find((x) => x.body?.ok)?.body?.acompanhar;
  const pre = [...mp.pre.values()].at(-1);
  mp.pagos.add(pre.id);
  await t.page.goto(BV + link, { waitUntil: "networkidle" });
  await espera(4000);
  ok(conta(t.eventos, "Subscribe") === 0 && conta(t.eventos, "Purchase") === 0, "validação interna paga: sem Subscribe nem Purchase");
  await t.ctx.close();
}

/* 5. Pagamento confirmado, sem confirmação e reabertura */
{
  const t = await contexto();
  await t.page.goto(B + pago.link, { waitUntil: "networkidle" });
  await espera(3500);
  ok(conta(t.eventos, "Subscribe") === 0 && conta(t.eventos, "Purchase") === 0, "sem pagamento confirmado: sem Subscribe nem Purchase");
  const pre = [...mp.pre.values()].find((p) => p.external_reference === pago.id);
  mp.pagos.add(pre.id);
  await t.page.goto(B + pago.link, { waitUntil: "networkidle" });
  // A página confere o Mercado Pago no máximo a cada 25 s: espera até 45 s pela confirmação.
  for (let i = 0; i < 45 && conta(t.eventos, "Subscribe") === 0; i++) await espera(1000);
  const sub = t.eventos.find((a) => a[1] === "Subscribe");
  const pur = t.eventos.find((a) => a[1] === "Purchase");
  ok(conta(t.eventos, "Subscribe") === 1 && conta(t.eventos, "Purchase") === 1, "primeiro pagamento confirmado: um Subscribe e um Purchase");
  ok(sub?.[2]?.value === 297 && sub[2].currency === "BRL" && sub?.[3]?.eventID === `subscribe-${pago.id}` && pur?.[3]?.eventID === pago.id, "Subscribe e Purchase com valor e eventIDs da mesma contratação");
  await t.page.reload({ waitUntil: "networkidle" });
  await espera(3000);
  await t.page.goto(B + pago.link, { waitUntil: "networkidle" });
  await espera(3000);
  ok(conta(t.eventos, "Subscribe") === 1 && conta(t.eventos, "Purchase") === 1, "atualizar e reabrir o acompanhamento: sem repetição");
  ok(naoTemPII(t.eventos), "eventos do acompanhamento sem dados pessoais nem link privado");
  await t.ctx.close();
}

/* 6. Marcador antigo de Purchase (gravado pela versão anterior) */
{
  const t = await contexto();
  await t.ctx.addInitScript((id) => {
    try {
      localStorage.setItem(`purchase-${id}`, "1");
    } catch {}
  }, pago.id);
  await t.page.goto(B + pago.link, { waitUntil: "networkidle" });
  await espera(3500);
  ok(conta(t.eventos, "Subscribe") === 0 && conta(t.eventos, "Purchase") === 0, "marcador antigo purchase-<id> respeitado: nada reenviado");
  await t.ctx.close();
}

/* 7. Armazenamento bloqueado e Pixel quebrado não impedem a contratação */
for (const [nome, opts] of [
  ["armazenamento bloqueado", { storageBloqueado: true }],
  ["Pixel quebrado", { pixelQuebrado: true }],
]) {
  const t = await contexto(opts);
  await abrirCheckout(t);
  await preencher(t, { email: `${nome.split(" ")[0]}.funil@exemplo.test` });
  await enviar(t, true);
  await t.page.waitForURL("**/checkout-mp**", { timeout: 15000 }).catch(() => {});
  const posts = t.respostas.length;
  ok(t.page.url().includes("checkout-mp") && posts >= 1, `${nome}: contratação e redirecionamento funcionam`);
  if (opts.storageBloqueado) ok(conta(t.eventos, "CompleteRegistration") === 1 && conta(t.eventos, "custom:PaymentRedirect") === 1, "armazenamento bloqueado: eventos enfileirados uma vez");
  await t.ctx.close();
}

/* 8. Mobile: mesmo funil */
{
  const t = await contexto({ mobile: true });
  await t.page.goto(`${B}/atendimento-ia`, { waitUntil: "networkidle" });
  await t.page.locator("[data-hero-cta]").click();
  await t.page.waitForURL("**/atendimento-ia/checkout");
  await espera(600);
  await preencher(t, { email: "mobile.funil@exemplo.test" });
  await enviar(t);
  await t.page.waitForURL("**/checkout-mp**", { timeout: 15000 }).catch(() => {});
  ok(conta(t.eventos, "InitiateCheckout") === 1 && conta(t.eventos, "CompleteRegistration") === 1 && conta(t.eventos, "custom:PaymentRedirect") === 1 && t.page.url().includes("checkout-mp"), "celular: entrada, cadastro e encaminhamento");
  await t.ctx.close();
}

await browser.close();
console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("OK")).length} OK, ${out.filter((l) => l.startsWith("FALHA")).length} falhas`);
process.exit(out.some((l) => l.startsWith("FALHA")) ? 1 : 0);
