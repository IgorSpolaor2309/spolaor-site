// Casos extras das entradas [data-reveal]: navegação entre páginas e Voltar, sem JavaScript e
// com os scripts bloqueados (hidratação nunca acontece). Sem tocar nem rolar para revelar.
// Uso: node scripts/checagem-reveal-extra.mjs <url-base>
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const vp = { viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const out = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);

// transparentes visíveis na tela (mesma regra de checagem-reveal.mjs)
const probe = () => {
  const vh = innerHeight;
  return [...document.querySelectorAll("[data-reveal]")].filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.height < 4 || Math.min(r.bottom, vh) - Math.max(r.top, 0) < 8) return false;
    return Number(getComputedStyle(el).opacity) < 0.98;
  }).length;
};
const allHidden = () => [...document.querySelectorAll("[data-reveal]")].filter((el) => Number(getComputedStyle(el).opacity) < 0.98).length;

// 1) navegação interna (link) e Voltar
{
  const ctx = await browser.newContext(vp);
  const p = await ctx.newPage();
  await p.goto(base + "/", { waitUntil: "load" });
  await p.waitForTimeout(1800);
  ok((await p.evaluate(probe)) === 0, `home carregada: transparentes na tela = ${await p.evaluate(probe)}`);
  await p.evaluate(() => window.scrollTo(0, 900));
  await p.waitForTimeout(1200);
  await p.locator('main a[href="/lojas-virtuais"]:visible').first().click();
  await p.waitForURL("**/lojas-virtuais");
  await p.waitForTimeout(1800);
  ok((await p.evaluate(probe)) === 0, `navegação para /lojas-virtuais: transparentes na tela = ${await p.evaluate(probe)} (scrollY=${await p.evaluate(() => scrollY)})`);
  await p.goBack();
  await p.waitForURL((u) => new URL(u).pathname === "/");
  await p.waitForTimeout(1800);
  ok((await p.evaluate(probe)) === 0, `Voltar para a home: transparentes na tela = ${await p.evaluate(probe)} (scrollY=${await p.evaluate(() => scrollY)})`);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(1800);
  ok((await p.evaluate(probe)) === 0, `recarregar: transparentes na tela = ${await p.evaluate(probe)} (scrollY=${await p.evaluate(() => scrollY)})`);
  await ctx.close();
}

// 2) sem JavaScript: tudo visível
for (const path of ["/", "/diagnostico-site", "/contato"]) {
  const ctx = await browser.newContext({ ...vp, javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(base + path, { waitUntil: "load" });
  await p.waitForTimeout(500);
  const n = await p.evaluate(allHidden);
  ok(n === 0, `sem JavaScript ${path}: blocos [data-reveal] transparentes na página inteira = ${n}`);
  await ctx.close();
}

// 3) scripts do Next bloqueados (o script inline do <head> roda, a hidratação não): segurança em 2,5 s
for (const path of ["/", "/diagnostico-site"]) {
  const ctx = await browser.newContext(vp);
  const p = await ctx.newPage();
  await p.route("**/_next/static/chunks/**", (r) => (r.request().resourceType() === "script" ? r.abort() : r.continue()));
  await p.goto(base + path, { waitUntil: "load" });
  await p.waitForTimeout(800);
  const early = await p.evaluate(allHidden);
  await p.waitForTimeout(3000);
  const late = await p.evaluate(allHidden);
  const ready = await p.evaluate(() => document.documentElement.className);
  ok(late === 0, `scripts bloqueados ${path}: transparentes em 0,8 s = ${early}, em 3,8 s = ${late} (html: "${ready.includes("reveal-ready") ? "hidratado" : "sem hidratação"}")`);
  await ctx.close();
}

await browser.close();
console.log(out.join("\n"));
process.exit(out.some((l) => l.startsWith("FALHA")) ? 1 : 0);
