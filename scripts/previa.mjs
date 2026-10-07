// Captura as quatro páginas (desktop e celular) para revisão.
// Uso: node scripts/previa.mjs <url-base> <pasta-de-saida>
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:3000", dir = "../previa-landings"] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });

const exe = process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });

const pages = [
  { slug: "home", path: "/", sections: ["#situacoes-title", "#cap-title", "#auto-title", "#segments-title", "#how-title", "#analysis-title"] },
  { slug: "corretores", path: "/corretores", sections: ["#situacoes-title", "#journey-title", "#division-title", "#analysis-title"] },
  { slug: "clinicas", path: "/clinicas", sections: ["#situacoes-title", "#journey-title", "#division-title", "#analysis-title"] },
  { slug: "orcamentos", path: "/orcamentos", sections: ["#situacoes-title", "#journey-title", "#division-title", "#analysis-title"] },
];

const errors = [];
for (const p of pages) {
  for (const vp of [
    { name: "desktop", width: 1440, height: 900, mobile: false },
    { name: "celular", width: 390, height: 844, mobile: true },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${p.path} ${vp.name}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${p.path} ${vp.name}: ${m.text()}`));
    await page.goto(base + p.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${dir}/${p.slug}-${vp.name}-01-hero.png` });
    if (!vp.mobile) {
      let n = 2;
      for (const sel of p.sections) {
        const ok = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const top = el.getBoundingClientRect().top + window.scrollY - 120;
          window.scrollTo({ top, behavior: "instant" });
          return true;
        }, sel);
        if (!ok) {
          errors.push(`${p.path}: seletor ${sel} não encontrado`);
          continue;
        }
        await page.waitForTimeout(sel.includes("auto") || sel.includes("journey") ? 5500 : 1800);
        await page.screenshot({ path: `${dir}/${p.slug}-${vp.name}-${String(n++).padStart(2, "0")}-${sel.replace(/[#-]title/g, "").replace("#", "")}.png` });
      }
    } else {
      // celular: capturas por seção, no tamanho da tela (a página inteira fica longa demais)
      let n = 2;
      for (const sel of [...p.sections, "#analysis-title"].filter((s, i, a) => a.indexOf(s) === i)) {
        const ok = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "instant" });
          return true;
        }, sel);
        if (!ok) continue;
        await page.waitForTimeout(sel.includes("auto") || sel.includes("journey") ? 4000 : 1500);
        await page.screenshot({ path: `${dir}/${p.slug}-${vp.name}-${String(n++).padStart(2, "0")}-${sel.replace(/[#-]title/g, "").replace("#", "")}.png` });
      }
    }
    await ctx.close();
  }
}
await browser.close();
if (errors.length) console.log("ERROS:\n" + errors.join("\n"));
else console.log("sem erros de console");
