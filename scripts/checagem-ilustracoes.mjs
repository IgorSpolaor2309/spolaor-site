// Revisão das aberturas com ilustração: primeira tela em 360, 390, 402 e 1440 px, três telas
// seguidas (com sobreposição) da home e do diagnóstico, rolagem horizontal, altura da ilustração,
// botão principal e barra fixa do celular. Não envia formulário.
// Uso: node scripts/checagem-ilustracoes.mjs <url-base> <pasta-de-saida>
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:3000", dir = "../previa-ilustracoes"] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const exe = process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined;
const browser = await chromium.launch({ executablePath: exe });

const pages = [
  { slug: "home", path: "/", seq: true },
  { slug: "diagnostico-site", path: "/diagnostico-site", seq: true },
  { slug: "lojas-virtuais", path: "/lojas-virtuais" },
  { slug: "agendamento-online", path: "/agendamento-online" },
  { slug: "sites", path: "/sites" },
  { slug: "automacao", path: "/automacao" },
  { slug: "sistemas", path: "/sistemas" },
  { slug: "corretores", path: "/corretores" },
  { slug: "clinicas", path: "/clinicas" },
  { slug: "orcamentos", path: "/orcamentos" },
  { slug: "consultoria", path: "/consultoria" },
];
const vps = [
  { name: "360", width: 360, height: 740, mobile: true },
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "402", width: 402, height: 874, mobile: true },
  { name: "1440", width: 1440, height: 900, mobile: false },
];
// Margem para as barras do Safari (endereço + abas), que a captura não reproduz.
const SAFARI = 110;

const problems = [];
const bar = () => {
  const el = document.querySelector("div.fixed.bottom-0");
  return !!el && getComputedStyle(el).display !== "none" && getComputedStyle(el).transform === "none" && el.getBoundingClientRect().top < innerHeight - 1;
};
for (const p of pages) {
  for (const vp of vps) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(`${p.path} ${vp.name}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && problems.push(`${p.path} ${vp.name}: ${m.text()}`));
    await page.goto(base + p.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1300);
    const r = await page.evaluate(() => {
      const cta = document.querySelector("[data-hero-cta]")?.getBoundingClientRect();
      const img = document.querySelector("main section img[src*='ilustracoes']")?.getBoundingClientRect();
      const next = document.querySelector("main > section:nth-of-type(2), main > div > section:nth-of-type(2)")?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        ctaBottom: cta ? Math.round(cta.bottom) : null,
        imgTop: img ? Math.round(img.top) : null,
        imgH: img ? Math.round(img.height) : null,
        imgBottom: img ? Math.round(img.bottom) : null,
        nextTop: next ? Math.round(next.top) : null,
      };
    });
    r.barAtTop = await page.evaluate(bar);
    console.log(`${p.path.padEnd(20)} ${vp.name.padEnd(5)} cta↓${r.ctaBottom} img ${r.imgTop}–${r.imgBottom} (h${r.imgH}) próxima seção ${r.nextTop} overflow ${r.overflow} barra-no-topo ${r.barAtTop}`);
    if (r.overflow > 0) problems.push(`${p.path} ${vp.name}: rolagem horizontal ${r.overflow}px`);
    if (vp.mobile && r.ctaBottom > vp.height - SAFARI) problems.push(`${p.path} ${vp.name}: botão principal termina em ${r.ctaBottom}px (área útil estimada ${vp.height - SAFARI}px)`);
    if (vp.mobile && r.barAtTop) problems.push(`${p.path} ${vp.name}: barra fixa visível com o botão da abertura na tela`);
    await page.screenshot({ path: `${dir}/${p.slug}-${vp.name}-tela-1.png` });
    if (p.seq && vp.mobile) {
      // telas 2 e 3, com ~12% de sobreposição para mostrar a continuidade
      for (const n of [2, 3]) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), Math.round((n - 1) * vp.height * 0.88));
        await page.waitForTimeout(1300);
        const b = await page.evaluate(bar);
        console.log(`   tela ${n}: barra fixa ${b ? "visível" : "oculta"}`);
        await page.screenshot({ path: `${dir}/${p.slug}-${vp.name}-tela-${n}.png` });
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log(problems.length ? "PROBLEMAS:\n" + problems.join("\n") : "Sem problemas detectados.");
