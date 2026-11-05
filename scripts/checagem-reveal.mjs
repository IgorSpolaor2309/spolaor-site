// Animações de entrada: abre cada página numa sessão nova, SEM tocar nem rolar, e procura blocos
// que estão na área visível mas continuam transparentes (opacity < 0,98) depois da animação.
// Depois rola em passos pequenos e repete a conferência a cada passo.
// Uso: node scripts/checagem-reveal.mjs <url-base> [--reduce] [--slow] [--shots <pasta>]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const base = args[0] && !args[0].startsWith("--") ? args[0] : "http://localhost:3000";
const reduce = args.includes("--reduce");
const slow = args.includes("--slow");
const shots = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });
const only = args.includes("--pages") ? args[args.indexOf("--pages") + 1].split(",") : null;

const paths = only ?? ["/", "/sites", "/lojas-virtuais", "/agendamento-online", "/automacao", "/diagnostico-site", "/sistemas", "/corretores", "/clinicas", "/orcamentos", "/analise", "/consultoria", "/projetos", "/contato"];
// alturas úteis: Safari com barras (≈ 560–700) e a tela inteira
const vps = [
  [360, 560], [360, 640], [390, 664], [390, 750], [402, 700], [402, 874], [1440, 900],
];
const exe = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: exe });

// Elementos com opacidade inline (motion) ou animação CSS de entrada, visíveis na tela e ainda transparentes.
const probe = () => {
  const vh = window.visualViewport?.height ?? innerHeight;
  const out = [];
  for (const el of document.querySelectorAll("main *, footer *")) {
    const st = el.getAttribute("style") || "";
    if (!/opacity/.test(st) && !el.classList.contains("fade-up")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.top >= vh) continue;
    // só os que o usuário realmente vê: a parte visível precisa ter pelo menos 8 px
    if (Math.min(r.bottom, vh) - Math.max(r.top, 0) < 8) continue;
    const op = Number(getComputedStyle(el).opacity);
    if (op < 0.98) out.push(`${el.tagName.toLowerCase()} top=${Math.round(r.top)} op=${op.toFixed(2)} "${(el.textContent || "").trim().slice(0, 50)}"`);
  }
  return out;
};

let failures = 0;
for (const path of paths) {
  for (const [w, h] of vps) {
    const mobile = w < 768;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, reducedMotion: reduce ? "reduce" : "no-preference" });
    const page = await ctx.newPage();
    if (slow) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 200 * 1024, uploadThroughput: 100 * 1024 });
    }
    await page.goto(base + path, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(slow ? 3500 : 1800);
    const first = await page.evaluate(probe);
    if (shots && [390, 360, 402].includes(w)) await page.screenshot({ path: `${shots}/${path === "/" ? "home" : path.slice(1)}-${w}x${h}-carregamento.png` });
    const scrolled = [];
    // rolagem em passos de 160 px (programática, só para o teste), conferindo após cada parada
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 160, n = 0; y < total && n < 14; y += 160, n++) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(1100);
      const bad = await page.evaluate(probe);
      if (bad.length) scrolled.push(`y=${y}: ${bad[0]}${bad.length > 1 ? ` (+${bad.length - 1})` : ""}`);
    }
    const ok = !first.length && !scrolled.length;
    if (!ok) failures++;
    console.log(`${ok ? "OK   " : "FALHA"} ${path.padEnd(20)} ${w}x${h}` + (first.length ? `\n   sem interação: ${first.slice(0, 3).join(" | ")}${first.length > 3 ? ` (+${first.length - 3})` : ""}` : "") + (scrolled.length ? `\n   rolando: ${scrolled.slice(0, 2).join(" | ")}` : ""));
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `${failures} combinações com conteúdo visível transparente` : "Nenhum conteúdo visível ficou transparente.");
process.exit(failures ? 1 : 0);
