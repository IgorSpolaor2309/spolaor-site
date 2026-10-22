// Checagem local (servidor em localhost:3100): erros de console, rolagem horizontal, âncoras, CTAs,
// formulários (sem destino: erro honesto; com API simulada: sucesso e origem) e movimento reduzido.
// Não envia nada para fora: com "next start" sem conector a API responde 503 e nada é guardado.
import { chromium } from "playwright-core";
const B = "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const out = []; const ok = (c, m) => out.push(`${c ? "OK  " : "FALHA"} ${m}`);
const pages = ["/", "/sites", "/automacao", "/corretores", "/clinicas", "/orcamentos", "/analise", "/contato", "/sistemas", "/projetos", "/consultoria"];

// 1) erros de console, rolagem horizontal, âncoras dos CTAs
for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "celular"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  for (const r of pages) {
    const errs = []; p.removeAllListeners("pageerror"); p.removeAllListeners("console");
    p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
    await p.goto(B + r, { waitUntil: "networkidle" });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const missing = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute("href")).filter(h => h.length > 1 && !document.getElementById(h.slice(1))));
    ok(!errs.length && overflow <= 0 && !missing.length, `${tag} ${r}: erros=${errs.length} overflow=${overflow}px âncoras_sem_alvo=${[...new Set(missing)].join(",") || "0"}`);
  }
  await p.close();
}
// links internos com âncora para outra página
const p0 = await b.newPage();
await p0.goto(B + "/", { waitUntil: "networkidle" });
const cross = await p0.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="#"]')].map(a => a.getAttribute("href")).filter(h => h.startsWith("/") ))]);
for (const href of cross) {
  const [path, id] = href.split("#");
  await p0.goto(B + path, { waitUntil: "networkidle" });
  const has = await p0.evaluate(i => !!document.getElementById(i), id);
  ok(has, `link ${href} tem alvo`);
}
// header CTA por página
for (const [r, label, href] of [["/", "Analisar minha empresa", "#analise"], ["/sites", "Pedir orçamento", "#orcamento"], ["/automacao", "Diagnóstico do processo", "#analise"], ["/projetos", "Analisar minha empresa", "/analise"]]) {
  await p0.goto(B + r, { waitUntil: "networkidle" });
  const a = p0.locator("header a", { hasText: label }).first();
  ok((await a.getAttribute("href")) === href, `CTA do header em ${r}: "${label}" → ${href}`);
}
await p0.close();

// 2) formulários: sem destino → erro honesto, nunca sucesso
async function fillDiag(p, root, fixed) {
  const f = p.locator(`${root} form`).first();
  await f.scrollIntoViewIfNeeded();
  if (!fixed) await f.locator('label:has(input[type=radio])').first().click();
  const radios = f.locator('div[role=radiogroup]').last().locator("label");
  await radios.first().click();
  await f.getByRole("button", { name: "Continuar" }).click();
  await p.waitForTimeout(500);
  await f.getByLabel("Seu nome", { exact: true }).fill("Teste Local");
  await f.getByLabel("Empresa", { exact: true }).fill("Empresa Teste");
  await f.getByLabel("WhatsApp").fill("11900000000");
  await f.locator('button[type=submit]').click();
}
async function fillQuote(p) {
  const f = p.locator("#orcamento form, form[aria-label='Falar sobre um projeto']").first();
  await f.scrollIntoViewIfNeeded();
  await f.locator('button[aria-pressed]').first().click();
  await f.getByLabel("Seu nome", { exact: true }).fill("Teste Local");
  await f.getByLabel("Empresa", { exact: true }).fill("Empresa Teste");
  await f.getByLabel("WhatsApp").fill("11900000000");
  await f.getByLabel("E-mail").fill("teste@example.com");
  await f.locator('button[type=submit]').click();
}
const cases = [["/", (p) => fillDiag(p, "#analise"), "home"], ["/automacao", (p) => fillDiag(p, "#analise"), "automacao"], ["/corretores", (p) => fillDiag(p, "#analise", true), "corretores"], ["/sites", fillQuote, "sites"], ["/contato", fillQuote, "contato"]];
for (const mock of [false, true]) {
  for (const [r, fill, origem] of cases) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    let sent = null; let status = null;
    if (mock) await p.route("**/api/lead", route => { sent = route.request().postDataJSON(); route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"id":"mock"}' }); });
    p.on("response", res => res.url().endsWith("/api/lead") && (status = res.status()));
    p.on("request", req => req.url().endsWith("/api/lead") && !mock && (sent = req.postDataJSON()));
    await p.goto(B + r, { waitUntil: "networkidle" });
    await fill(p);
    await p.waitForTimeout(1500);
    const alert = await p.locator('[role=alert]').allInnerTexts();
    const success = await p.locator('[role=status]').filter({ hasText: /recebid/ }).count();
    if (!mock) ok(status === 503 && success === 0 && alert.some(t => t.includes("temporariamente indisponível")) && sent?.origem === origem, `${r}: API ${status}, sucesso mostrado=${success}, aviso="${(alert[0]||"").slice(0,60)}…", origem=${sent?.origem}`);
    else ok(success === 1 && sent?.origem === origem, `${r} (API simulada 200): sucesso mostrado=${success}, origem=${sent?.origem}, tipo=${sent?.tipo}`);
    await p.close();
  }
}

// 3) movimento reduzido: demonstração não avança sozinha e não mostra botão de pausa
const pr = await b.newPage({ reducedMotion: "reduce" });
await pr.goto(B + "/", { waitUntil: "networkidle" });
await pr.waitForTimeout(9000);
const cur = await pr.locator('figure [aria-current=step]').innerText();
const pause = await pr.locator('figure button', { hasText: /Pausar|Reproduzir/ }).count();
ok(cur.includes("1") && pause === 0, `movimento reduzido: etapa após 9s="${cur.replace(/\s+/g," ")}", botão pausar=${pause}`);
await pr.close();
const pm = await b.newPage();
await pm.goto(B + "/", { waitUntil: "networkidle" });
await pm.waitForTimeout(9000);
const cur2 = await pm.locator('figure [aria-current=step]').innerText();
ok(!cur2.includes("1"), `movimento normal: avança sozinho (etapa após 9s="${cur2.replace(/\s+/g," ")}")`);
await pm.locator('figure button', { hasText: "Pausar" }).click();
const before = await pm.locator('figure [aria-current=step]').innerText(); await pm.waitForTimeout(6000);
ok(before === await pm.locator('figure [aria-current=step]').innerText(), "botão Pausar interrompe a troca");
await pm.close();
console.log(out.join("\n"));
await b.close();
