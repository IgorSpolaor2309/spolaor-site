// Teste local das páginas de oferta: metadados, navegação, formulários, atribuição e eventos da Meta.
// Usa um provedor de e-mail FALSO em :4010 e um Pixel FALSO (script simulado), então nada sai da máquina.
// Antes: build com NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_META_PIXEL_ID (qualquer número) e as variáveis do
// e-mail apontando para http://localhost:4010/, e "next start -p 3100". Uso: node scripts/teste-ofertas-local.mjs
import http from "node:http";
import { chromium } from "playwright-core";

const B = "http://localhost:3100";
const received = [];
let mode = "ok";
http
  .createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      if (mode === "fail") { res.writeHead(500); return res.end("{}"); }
      received.push(JSON.parse(b));
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"id":"fake"}');
    });
  })
  .listen(4010);

const out = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const NOME = "TESTE — formulário do site";
const exe = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: exe });

// Pixel simulado: registra cada chamada ao fbq em window.__fb
const FAKE_FB = `window.__fb=window.__fb||[];var f=window.fbq;f.callMethod=function(){window.__fb.push([].slice.call(arguments))};(f.queue||[]).forEach(function(a){f.callMethod.apply(f,a)});f.queue=[];`;
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  await ctx.route("**/fbevents.js", (r) => r.fulfill({ contentType: "application/javascript", body: FAKE_FB }));
  await ctx.route("**/googletagmanager.com/**", (r) => r.abort());
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  return { ctx, p, errs };
}
const fb = (p) => p.evaluate(() => window.__fb || []);

// ── 1) metadados: canonical correto, sem localhost, noindex mantido
const pages = ["/", "/sites", "/lojas-virtuais", "/agendamento-online", "/automacao", "/diagnostico-site", "/corretores", "/clinicas", "/orcamentos", "/analise", "/contato"];
for (const path of pages) {
  const html = await (await fetch(B + path)).text();
  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  const robots = (html.match(/<meta name="robots" content="([^"]+)"/) || [])[1];
  ok(canon === `https://30diascomia.com${path === "/" ? "" : path}` && !html.includes("localhost") && /noindex/.test(robots || ""), `${path}: canonical=${canon} robots="${robots}" localhost=${html.includes("localhost")}`);
}
const sm = await (await fetch(B + "/sitemap.xml")).text();
ok(!sm.includes("localhost") && sm.includes("/lojas-virtuais") && sm.includes("/agendamento-online") && sm.includes("/diagnostico-site"), "sitemap sem localhost e com as 3 páginas novas");
const rb = await (await fetch(B + "/robots.txt")).text();
ok(/Disallow: \//.test(rb), "robots.txt segue bloqueando (domínio provisório)");

// ── 2) navegação e CTAs, desktop e celular
for (const [tag, vp, mobile] of [["desktop 1440", { width: 1440, height: 900 }, false], ["celular 390", { width: 390, height: 844 }, true]]) {
  const { ctx, p, errs } = await newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile });
  for (const path of ["/", "/lojas-virtuais", "/agendamento-online", "/diagnostico-site"]) {
    await p.goto(B + path, { waitUntil: "networkidle" });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const missing = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
    ok(overflow <= 0 && !missing.length, `${tag} ${path}: overflow=${overflow}px âncoras_sem_alvo=${missing.join(",") || 0}`);
  }
  ok(!errs.length, `${tag}: erros de console=${errs.length} ${errs[0] || ""}`);
  // menu leva às páginas novas
  for (const [label, path] of [["Lojas virtuais", "/lojas-virtuais"], ["Agendamento", "/agendamento-online"], ["Diagnóstico", "/diagnostico-site"]]) {
    await p.goto(B + "/", { waitUntil: "networkidle" });
    if (mobile) {
      await p.click('button[aria-label="Abrir menu"]');
      await p.locator("#menu-mobile").getByRole("link", { name: label === "Agendamento" ? "Agendamento online" : label === "Diagnóstico" ? "Diagnóstico de site" : label }).first().click();
    } else {
      await p.locator('nav[aria-label="Principal"]').getByRole("link", { name: label, exact: true }).click();
    }
    await p.waitForURL("**" + path);
    ok(true, `${tag}: menu "${label}" → ${path}`);
  }
  await ctx.close();
}
{ // dropdown de setores (desktop)
  const { ctx, p } = await newPage();
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Para o seu setor" }).click();
  const links = await p.locator("#menu-setores a").allInnerTexts();
  ok(links.length === 3, `dropdown "Para o seu setor": ${links.join(" | ")}`);
  await ctx.close();
}
{ // links da home para as ofertas
  const { ctx, p } = await newPage();
  await p.goto(B + "/", { waitUntil: "networkidle" });
  for (const href of ["/lojas-virtuais", "/agendamento-online", "/diagnostico-site", "/sites", "/automacao"]) {
    ok((await p.locator(`main a[href="${href}"]`).count()) > 0, `home tem link no conteúdo para ${href}`);
  }
  await ctx.close();
}

// ── 3) formulários: validação, sucesso, atribuição e Meta
async function contactForm(p) {
  const f = p.locator("#formulario form, #orcamento form, main form").first();
  await f.scrollIntoViewIfNeeded();
  await f.locator("button[aria-pressed]").first().click();
  await f.getByLabel("Seu nome", { exact: true }).fill(NOME);
  await f.getByLabel("Empresa", { exact: true }).fill("TESTE Spolaor");
  await f.getByLabel("WhatsApp").fill("11900000000");
  await f.getByLabel("E-mail").fill("teste@example.com");
  await f.locator("button[type=submit]").click();
}
async function diagForm(p) {
  const f = p.locator("#formulario form").first();
  await f.scrollIntoViewIfNeeded();
  await f.locator("label:has(input[type=radio])").first().click();
  await f.locator("div[role=radiogroup]").last().locator("label").first().click();
  await f.getByRole("button", { name: "Continuar" }).click();
  await p.waitForTimeout(400);
  await f.getByLabel("Seu nome", { exact: true }).fill(NOME);
  await f.getByLabel("Empresa", { exact: true }).fill("TESTE Spolaor");
  await f.getByLabel("WhatsApp").fill("11900000000");
  await f.locator("button[type=submit]").click();
}

// 3a) validação: enviar vazio mostra erros e não dispara Lead
{
  const { ctx, p } = await newPage();
  await p.goto(B + "/lojas-virtuais", { waitUntil: "networkidle" });
  let calls = 0;
  p.on("request", (r) => r.url().endsWith("/api/lead") && calls++);
  const f = p.locator("#formulario form").first();
  await f.scrollIntoViewIfNeeded();
  await f.locator("button[type=submit]").click();
  await p.waitForTimeout(600);
  const msgs = await f.locator("p.text-ember-soft").count();
  ok(msgs >= 3 && calls === 0 && !(await fb(p)).some((a) => a[1] === "Lead"), `/lojas-virtuais: envio vazio → ${msgs} erros de campo, chamadas à API=${calls}, Lead=0`);
  await ctx.close();
}
// 3b) diagnóstico exige o site
{
  const { ctx, p } = await newPage();
  await p.goto(B + "/diagnostico-site", { waitUntil: "networkidle" });
  const f = p.locator("#formulario form").first();
  await f.scrollIntoViewIfNeeded();
  await f.locator("label:has(input[type=radio])").first().click();
  await f.locator("div[role=radiogroup]").last().locator("label").first().click();
  await f.getByRole("button", { name: "Continuar" }).click();
  await p.waitForTimeout(400);
  ok((await f.getByText("Informe o endereço do site que vamos analisar.").count()) > 0, "/diagnostico-site: sem o endereço do site não avança");
  await ctx.close();
}
// 3c) sucesso nas 3 páginas novas + atribuição (UTM e entrada) + Meta
const cases = [
  ["/lojas-virtuais", contactForm, "Loja virtual", "lojas-virtuais"],
  ["/agendamento-online", contactForm, "Agendamento online", "agendamento-online"],
  ["/diagnostico-site", async (p) => { await p.locator("#formulario form").first().getByLabel("Endereço do site que vamos analisar").fill("exemplo.com.br"); await diagForm(p); }, "Diagnóstico e melhoria de site", "diagnostico-site"],
];
for (const [path, fill, interesse, origem] of cases) {
  const { ctx, p } = await newPage();
  // entra por /lojas-virtuais com UTM e navega (sem recarregar) até a página de destino
  await p.goto(`${B}/lojas-virtuais?utm_source=meta&utm_campaign=teste`, { waitUntil: "networkidle" });
  if (path !== "/lojas-virtuais") {
    await p.evaluate((href) => { const a = document.querySelector(`a[href="${href}"]`); a.click(); }, path);
    await p.waitForURL("**" + path);
    await p.waitForLoadState("networkidle");
  }
  // o diagnóstico exige o site antes do passo 1; preenche pelo próprio fill
  const before = received.length;
  const pv0 = (await fb(p)).filter((a) => a[1] === "PageView").length;
  await fill(p);
  await p.waitForTimeout(1800);
  const success = await p.locator("[role=status]").filter({ hasText: /recebid/ }).count();
  const m = received[received.length - 1];
  const calls = await fb(p);
  const leads = calls.filter((a) => a[1] === "Lead");
  const views = calls.filter((a) => a[1] === "ViewContent").map((a) => a[2]?.content_category);
  const pageViews = calls.filter((a) => a[1] === "PageView").length;
  ok(success === 1 && received.length === before + 1, `${path}: sucesso=${success}, e-mails=${received.length - before}`);
  ok(m.subject.includes(interesse) && m.text.includes(`Interesse: ${interesse}`) && m.text.includes(`Origem do lead: ${origem}`), `${path}: e-mail diferencia o interesse → assunto="${m.subject}"`);
  ok(m.text.includes(`Página do envio: ${path}`) && (path === "/lojas-virtuais" || m.text.includes("Primeira página da visita: /lojas-virtuais")) && m.text.includes("utm_source=meta"), `${path}: atribuição no e-mail (página do envio, entrada e UTM)`);
  ok(leads.length === 1 && leads[0][2]?.content_category === origem, `${path}: Meta Lead disparado ${leads.length}× (categoria=${leads[0]?.[2]?.content_category})`);
  ok(pageViews === (path === "/lojas-virtuais" ? 1 : 2) && views.includes(origem), `${path}: PageView=${pageViews} (1 por página vista), ViewContent=${views.join(",")}`);
  const blob = JSON.stringify(calls);
  ok(!/TESTE|11900000000|teste@example|exemplo\.com/i.test(blob), `${path}: eventos sem nome, telefone, e-mail ou site do visitante`);
  await ctx.close();
}
// 3d) provedor recusa → sem sucesso e sem Lead
{
  mode = "fail";
  const { ctx, p } = await newPage();
  await p.goto(B + "/agendamento-online", { waitUntil: "networkidle" });
  await contactForm(p);
  await p.waitForTimeout(1800);
  const success = await p.locator("[role=status]").filter({ hasText: /recebid/ }).count();
  ok(success === 0 && (await p.locator("[role=alert]").count()) > 0 && !(await fb(p)).some((a) => a[1] === "Lead"), "provedor recusa → erro na tela, sem sucesso e sem evento Lead");
  await ctx.close();
  mode = "ok";
}
// 3e) página recarregada / re-render não duplica PageView
{
  const { ctx, p } = await newPage();
  await p.goto(B + "/lojas-virtuais", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.locator("#formulario").scrollIntoViewIfNeeded();
  await p.locator("#formulario form button[aria-pressed]").first().click();
  await p.waitForTimeout(500);
  const c = await fb(p);
  ok(c.filter((a) => a[1] === "PageView").length === 1 && c.filter((a) => a[1] === "ViewContent").length === 1, "interações na página não duplicam PageView/ViewContent");
  await ctx.close();
}
// 3f) demais formulários seguem enviando (home, /automacao, /sites, /contato, segmentos)
for (const [path, fill, origem] of [["/", diagFormAny, "home"], ["/automacao", diagFormAny, "automacao"], ["/corretores", diagFormFixed, "corretores"], ["/sites", contactForm, "sites"], ["/contato", contactForm, "contato"]]) {
  const { ctx, p } = await newPage();
  await p.goto(B + path, { waitUntil: "networkidle" });
  const before = received.length;
  await fill(p);
  await p.waitForTimeout(1500);
  ok(received.length === before + 1 && received[received.length - 1].text.includes(`Origem do lead: ${origem}`), `${path}: continua enviando (origem=${origem}, interesse="${received[received.length - 1]?.text.match(/Interesse: (.*)/)?.[1]}")`);
  await ctx.close();
}
async function diagFormAny(p) {
  const f = p.locator("#analise form").first(); await f.scrollIntoViewIfNeeded();
  await f.locator("label:has(input[type=radio])").first().click();
  await f.locator("div[role=radiogroup]").last().locator("label").first().click();
  await f.getByRole("button", { name: "Continuar" }).click(); await p.waitForTimeout(400);
  await f.getByLabel("Seu nome", { exact: true }).fill(NOME); await f.getByLabel("Empresa", { exact: true }).fill("TESTE Spolaor"); await f.getByLabel("WhatsApp").fill("11900000000");
  await f.locator("button[type=submit]").click();
}
async function diagFormFixed(p) {
  const f = p.locator("#analise form").first(); await f.scrollIntoViewIfNeeded();
  await f.locator("div[role=radiogroup]").last().locator("label").first().click();
  await f.getByRole("button", { name: "Continuar" }).click(); await p.waitForTimeout(400);
  await f.getByLabel("Seu nome", { exact: true }).fill(NOME); await f.getByLabel("Empresa", { exact: true }).fill("TESTE Spolaor"); await f.getByLabel("WhatsApp").fill("11900000000");
  await f.locator("button[type=submit]").click();
}

console.log(out.join("\n"));
await browser.close();
process.exit(out.some((l) => l.startsWith("FALHA")) ? 1 : 0);
