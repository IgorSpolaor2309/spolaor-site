// Teste local da medição e do caminho até o lead (campanha de leads gerais, ex.: /diagnostico-site).
// Pixel FALSO (fbevents.js simulado) e provedor de e-mail FALSO em :4010: nada sai da máquina, nenhum lead
// real, nenhum e-mail real. Antes: build com NEXT_PUBLIC_META_PIXEL_ID (qualquer número), RESEND_API_KEY,
// LEAD_EMAIL_TO, LEAD_EMAIL_FROM e RESEND_API_URL=http://localhost:4010/, depois
// "node node_modules/next/dist/bin/next start --port 3100". Uso: node scripts/teste-medicao-leads.mjs
//
// Confere: PageView da primeira página enfileirado antes da hidratação e sem duplicar; PageView nas
// navegações internas; página e formulário funcionando com o Pixel bloqueado; botões levando ao
// formulário em 360/390/402 px e no desktop; teclado certo por campo; validação; FormStart uma vez;
// Lead só depois do 200 com id (eventID = id do lead), nunca em clique, formulário inválido, falha do
// provedor ou envio descartado pelo anti-spam; nenhum dado pessoal nos eventos; origem, entrada e UTMs no lead.
import http from "node:http";
import { chromium } from "playwright-core";

const B = "http://localhost:3100";
const received = [];
let mode = "ok";
const server = http
  .createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      if (mode === "fail") {
        res.writeHead(500);
        return res.end("{}");
      }
      received.push(JSON.parse(b));
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"id":"fake"}');
    });
  })
  .listen(4010);

const out = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const NOME = "TESTE medição";
const FONE = "11900000000";
const SITE = "exemplo-medicao.com.br";
const exe = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: exe });

// Pixel simulado: registra cada chamada ao fbq (as da fila do <head> e as seguintes) em window.__fb
const FAKE_FB = `window.__fb=window.__fb||[];var f=window.fbq;f.callMethod=function(){window.__fb.push([].slice.call(arguments))};(f.queue||[]).forEach(function(a){f.callMethod.apply(f,a)});f.queue=[];`;
async function newPage({ pixel = "fake", slowJs = 0, ...opts } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", ...opts });
  await ctx.route("**/fbevents.js", (r) => (pixel === "blocked" ? r.abort() : r.fulfill({ contentType: "application/javascript", body: FAKE_FB })));
  await ctx.route("**/facebook.com/tr**", (r) => r.abort());
  await ctx.route("**/googletagmanager.com/**", (r) => r.abort());
  if (slowJs) await ctx.route("**/_next/static/**/*.js", async (r) => { await new Promise((s) => setTimeout(s, slowJs)); await r.continue(); });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource|fbevents|ERR_FAILED/.test(m.text()) && errs.push(m.text()));
  return { ctx, p, errs };
}
const fb = (p) => p.evaluate(() => window.__fb || []);
const count = (calls, name) => calls.filter((a) => a[1] === name).length;
const MOBILE = [
  ["360", { width: 360, height: 780 }],
  ["390", { width: 390, height: 844 }],
  ["402", { width: 402, height: 874 }],
];

// ── 1) PageView da primeira página antes da hidratação (JS do Next atrasado 2,5 s) e sem duplicar depois
{
  const { ctx, p, errs } = await newPage({ slowJs: 2500 });
  await p.goto(`${B}/diagnostico-site?utm_source=meta&fbclid=TESTE`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  const early = await p.evaluate(() => ({
    hydrated: document.documentElement.classList.contains("reveal-ready"),
    calls: (window.__fb || []).map((a) => a.slice(0, 2)).concat(((window.fbq && window.fbq.queue) || []).map((a) => [].slice.call(a, 0, 2))),
    h1: getComputedStyle(document.querySelector("h1")).visibility,
  }));
  ok(!early.hydrated && early.calls.some((a) => a[0] === "init") && early.calls.some((a) => a[1] === "PageView"), `antes da hidratação: init e PageView já enfileirados (hidratado=${early.hydrated}, chamadas=${JSON.stringify(early.calls)})`);
  await p.waitForFunction(() => document.documentElement.classList.contains("reveal-ready"), null, { timeout: 30000 });
  await p.waitForTimeout(800);
  let c = await fb(p);
  ok(count(c, "PageView") === 1 && count(c, "ViewContent") === 1, `depois da hidratação: PageView=${count(c, "PageView")} ViewContent=${count(c, "ViewContent")} (esperado 1 e 1)`);
  ok(!errs.length, `primeira abertura sem erros de JavaScript (${errs[0] || 0})`);
  await ctx.close();
}

// ── 2) navegação interna: PageView a cada página, sem recarregar e sem duplicar; voltar também conta
{
  const { ctx, p } = await newPage();
  await p.goto(`${B}/diagnostico-site`, { waitUntil: "networkidle" });
  await p.evaluate(() => (window.__mesmaPagina = 1));
  await p.locator('nav[aria-label="Principal"]').getByRole("link", { name: "Lojas virtuais", exact: true }).click();
  await p.waitForURL("**/lojas-virtuais");
  await p.waitForTimeout(800);
  const spa = await p.evaluate(() => window.__mesmaPagina === 1);
  let c = await fb(p);
  ok(spa && count(c, "PageView") === 2, `navegação interna para /lojas-virtuais: sem recarregar=${spa}, PageView=${count(c, "PageView")} (esperado 2)`);
  await p.goBack();
  await p.waitForURL("**/diagnostico-site");
  await p.waitForTimeout(800);
  c = await fb(p);
  ok(count(c, "PageView") === 3 && c.filter((a) => a[0] === "init").length === 1, `voltar pelo navegador: PageView=${count(c, "PageView")} (esperado 3), init=${c.filter((a) => a[0] === "init").length} (esperado 1)`);
  await ctx.close();
}

// ── 3) Pixel bloqueado (bloqueador, rede da Meta fora): página e envio funcionam, sem erro na tela
{
  const { ctx, p, errs } = await newPage({ pixel: "blocked", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await p.goto(`${B}/diagnostico-site`, { waitUntil: "networkidle" });
  const before = received.length;
  const f = p.locator("#formulario form");
  await f.getByLabel("Endereço do site").fill(SITE);
  await f.getByLabel("Seu nome").fill(NOME);
  await f.getByLabel("WhatsApp com DDD").fill(FONE);
  await f.locator("button[type=submit]").click();
  await p.waitForTimeout(1500);
  const success = await p.locator("[role=status]").filter({ hasText: /recebid/ }).count();
  ok(success === 1 && received.length === before + 1 && !errs.length, `Pixel bloqueado: lead enviado=${received.length - before}, sucesso na tela=${success}, erros JS=${errs.length} ${errs[0] || ""}`);
  await ctx.close();
}

// ── 4) celular 360/390/402 e desktop: botão da abertura leva ao formulário, campo visível e não coberto, teclado por campo
for (const [tag, vp] of [...MOBILE, ["desktop", { width: 1440, height: 900 }]]) {
  const mobile = tag !== "desktop";
  const { ctx, p, errs } = await newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  await p.goto(`${B}/diagnostico-site?utm_source=meta&utm_campaign=leads-gerais&utm_content=lapis`, { waitUntil: "networkidle" });
  const hero = p.locator("[data-hero-cta]");
  const heroBox = await hero.boundingBox();
  ok(heroBox && heroBox.y >= 0 && heroBox.y + heroBox.height <= vp.height, `${tag}: botão da abertura visível na primeira tela sem rolar (y=${Math.round(heroBox?.y)}–${Math.round(heroBox?.y + heroBox?.height)} de ${vp.height})`);
  if (mobile) await hero.tap();
  else await hero.click();
  await p.waitForTimeout(1600);
  const site = p.locator("#diag-site");
  const st = await site.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), covered: top !== el, hash: location.hash, search: location.search };
  });
  ok(st.top >= 0 && st.bottom <= vp.height && !st.covered && st.hash === "#solicitar" && st.search.includes("utm_content=lapis"), `${tag}: botão → #solicitar, campo do site visível (${st.top}–${st.bottom}) e não coberto=${!st.covered}, UTMs mantidas na URL`);
  const attrs = await p.evaluate(() =>
    ["site", "nome", "whatsapp", "email"].map((k) => {
      const el = document.getElementById(`diag-${k}`);
      return `${k}:${el.type}/${el.inputMode || "-"}/${el.autocomplete}`;
    }),
  );
  ok(attrs.join(" ") === "site:text/url/url nome:text/-/name whatsapp:tel/tel/tel-national email:email/email/email", `${tag}: teclado por campo ${attrs.join(" ")}`);
  // barra fixa do celular some enquanto o formulário está na tela
  if (mobile) {
    const bar = await p.evaluate(() => document.querySelector('div[class*="fixed inset-x-0 bottom-0"]')?.getAttribute("aria-hidden"));
    ok(bar === "true", `${tag}: barra fixa escondida com o formulário na tela (aria-hidden=${bar})`);
  }
  // envio vazio: erros, foco no primeiro erro, nenhuma chamada à API, FormStart uma vez, nenhum Lead
  let apiCalls = 0;
  p.on("request", (r) => r.url().endsWith("/api/lead") && apiCalls++);
  await p.locator("#formulario form button[type=submit]").click();
  await p.waitForTimeout(500);
  const errMsgs = await p.locator("#formulario form p.text-ember-soft").allInnerTexts();
  const focused = await p.evaluate(() => document.activeElement?.id);
  await site.click();
  await p.locator("#diag-nome").click();
  let c = await fb(p);
  ok(errMsgs.length === 3 && focused === "diag-site" && apiCalls === 0 && count(c, "Lead") === 0, `${tag}: envio vazio → ${errMsgs.length} erros (${errMsgs.join(" / ")}), foco=${focused}, API=${apiCalls}, Lead=${count(c, "Lead")}`);
  const fs = c.filter((a) => a[0] === "trackCustom" && a[1] === "FormStart");
  ok(fs.length === 1 && JSON.stringify(fs[0][2]) === '{"content_category":"diagnostico-site"}', `${tag}: FormStart=${fs.length} com ${JSON.stringify(fs[0]?.[2])} (só a origem)`);
  // envio válido com duplo clique: uma chamada, sucesso, Lead uma vez com eventID = id do lead
  const before = received.length;
  const ids = [];
  p.on("response", async (r) => r.url().endsWith("/api/lead") && ids.push((await r.json().catch(() => ({}))).id));
  await site.fill(SITE);
  await p.locator("#diag-nome").fill(NOME);
  await p.locator("#diag-whatsapp").fill(FONE);
  await p.locator("#diag-email").fill("teste@example.com");
  await p.locator("#formulario form button[type=submit]").dblclick();
  await p.waitForTimeout(1800);
  c = await fb(p);
  const leads = c.filter((a) => a[1] === "Lead");
  const success = await p.locator("[role=status]").filter({ hasText: /recebid/ }).count();
  ok(apiCalls === 1 && received.length === before + 1 && success === 1, `${tag}: duplo clique → API=${apiCalls}, e-mails=${received.length - before}, sucesso=${success}`);
  ok(leads.length === 1 && ids[0] && leads[0][3]?.eventID === ids[0] && leads[0][2]?.content_category === "diagnostico-site", `${tag}: Lead=${leads.length}, eventID=id do lead (${leads[0]?.[3]?.eventID === ids[0]})`);
  const blob = JSON.stringify(c);
  ok(!/TESTE|11900000000|example\.com|exemplo-medicao/i.test(blob), `${tag}: nenhum dado pessoal nos eventos do Pixel`);
  const m = received[received.length - 1];
  ok(
    m.text.includes("Origem do lead: diagnostico-site") && m.text.includes("Página do envio: /diagnostico-site") && m.text.includes("utm_source=meta") && m.text.includes("utm_content=lapis") && m.text.includes(`Site: https://${SITE}`),
    `${tag}: lead com origem, página e UTMs (${m.text.match(/UTM: .*/)?.[0]})`,
  );
  ok(!errs.length, `${tag}: sem erros de JavaScript ${errs[0] || ""}`);
  await ctx.close();
}

// ── 5) falha do provedor: erro na tela, sem sucesso e sem Lead
{
  mode = "fail";
  const { ctx, p } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await p.goto(`${B}/diagnostico-site`, { waitUntil: "networkidle" });
  const status = [];
  p.on("response", (r) => r.url().endsWith("/api/lead") && status.push(r.status()));
  await p.locator("#diag-site").fill(SITE);
  await p.locator("#diag-nome").fill(NOME);
  await p.locator("#diag-whatsapp").fill(FONE);
  await p.locator("#formulario form button[type=submit]").click();
  await p.waitForTimeout(1800);
  const success = await p.locator("[role=status]").filter({ hasText: /recebid/ }).count();
  const alert = await p.locator("[role=alert]").count();
  const c = await fb(p);
  ok(status[0] === 502 && success === 0 && alert > 0 && count(c, "Lead") === 0, `provedor recusa → API ${status[0]}, sucesso=${success}, aviso de erro=${alert > 0}, Lead=${count(c, "Lead")}`);
  await ctx.close();
  mode = "ok";
}

// ── 6) envio descartado pelo anti-spam (campo invisível preenchido): API responde sem id → nenhum Lead, nenhum e-mail
{
  const { ctx, p } = await newPage();
  await p.goto(`${B}/diagnostico-site`, { waitUntil: "networkidle" });
  const before = received.length;
  await p.evaluate(() => (document.querySelector('#formulario input[name="website"]').value = "http://spam.example"));
  await p.locator("#diag-site").fill(SITE);
  await p.locator("#diag-nome").fill(NOME);
  await p.locator("#diag-whatsapp").fill(FONE);
  await p.locator("#formulario form button[type=submit]").click();
  await p.waitForTimeout(1500);
  const c = await fb(p);
  ok(received.length === before && count(c, "Lead") === 0, `anti-spam: e-mails=${received.length - before}, Lead=${count(c, "Lead")} (esperado 0 e 0)`);
  await ctx.close();
}

// ── 7) entrada por outra página com UTM: lead guarda a primeira página e as UTMs dela
{
  const { ctx, p } = await newPage();
  await p.goto(`${B}/?utm_source=meta&utm_campaign=leads-gerais`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.querySelector('a[href="/diagnostico-site"]').click());
  await p.waitForURL("**/diagnostico-site");
  await p.waitForLoadState("networkidle");
  const before = received.length;
  await p.locator("#diag-site").fill(SITE);
  await p.locator("#diag-nome").fill(NOME);
  await p.locator("#diag-whatsapp").fill(FONE);
  await p.locator("#formulario form button[type=submit]").click();
  await p.waitForTimeout(1500);
  const m = received[received.length - 1];
  ok(received.length === before + 1 && m.text.includes("Primeira página da visita: /") && m.text.includes("utm_campaign=leads-gerais"), `entrada pela home com UTM: ${m?.text.match(/Primeira página da visita: .*/)?.[0]} · ${m?.text.match(/UTM: .*/)?.[0]}`);
  await ctx.close();
}

console.log(out.join("\n"));
await browser.close();
server.close();
process.exit(out.some((l) => l.startsWith("FALHA")) ? 1 : 0);
