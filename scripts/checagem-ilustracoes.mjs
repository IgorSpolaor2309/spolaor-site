// Revisão das páginas com ilustrações de serviço: primeira tela em 360, 390 e 1440 px,
// rolagem horizontal, posição do CTA principal e do formulário, carregamento das imagens e erros.
// Uso: node scripts/checagem-ilustracoes.mjs <url-base> <pasta-de-saida>
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:3000", dir = "../previa-ilustracoes"] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const exe = process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined;
const browser = await chromium.launch({ executablePath: exe });

const pages = [
  { slug: "diagnostico-site", path: "/diagnostico-site", form: "#solicitar", extra: ["#formulario"] },
  { slug: "lojas-virtuais", path: "/lojas-virtuais", form: "#formulario" },
  { slug: "agendamento-online", path: "/agendamento-online", form: "#formulario" },
  { slug: "sites", path: "/sites", form: "#orcamento" },
  { slug: "automacao", path: "/automacao", form: "#analise" },
  { slug: "sistemas", path: "/sistemas" },
  { slug: "home", path: "/", extra: ["#servicos"] },
];
const vps = [
  { name: "1440", width: 1440, height: 900, mobile: false },
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "360", width: 360, height: 740, mobile: true },
];

const problems = [];
const rows = [];
for (const p of pages) {
  for (const vp of vps) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(`${p.path} ${vp.name}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && problems.push(`${p.path} ${vp.name}: ${m.text()}`));
    await page.goto(base + p.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${dir}/${p.slug}-${vp.name}-01-primeira-tela.png` });
    const r = await page.evaluate((formSel) => {
      const main = document.querySelector("main") ?? document.body;
      const h1 = document.querySelector("h1");
      const cta = h1?.closest("section")?.querySelector("a[href^='#'], a[href*='#']");
      const ctaBox = cta?.getBoundingClientRect();
      const form = formSel ? document.querySelector(formSel) : null;
      const imgs = [...document.querySelectorAll("img[src*='ilustracoes']")].map((i) => ({
        src: decodeURIComponent(i.currentSrc).replace(/.*url=([^&]+).*/, "$1").replace(/.*\//, ""),
        ok: i.complete && i.naturalWidth > 0,
        w: Math.round(i.getBoundingClientRect().width),
        h: Math.round(i.getBoundingClientRect().height),
        top: Math.round(i.getBoundingClientRect().top + scrollY),
        loading: i.loading,
        alt: i.alt,
      }));
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        ctaText: cta?.textContent?.trim(),
        ctaBottom: ctaBox ? Math.round(ctaBox.bottom) : null,
        ctaH: ctaBox ? Math.round(ctaBox.height) : null,
        formTop: form ? Math.round(form.getBoundingClientRect().top + scrollY) : null,
        imgs,
      };
    }, p.form);
    rows.push({ page: p.path, vp: vp.name, ...r });
    if (r.overflow > 0) problems.push(`${p.path} ${vp.name}: rolagem horizontal de ${r.overflow}px`);
    if (r.ctaBottom != null && r.ctaBottom > vp.height) problems.push(`${p.path} ${vp.name}: CTA principal fora da primeira tela (${r.ctaBottom}px)`);
    for (const i of r.imgs) if (!i.ok && i.loading !== "lazy") problems.push(`${p.path} ${vp.name}: imagem não carregou ${i.src}`);
    // segunda captura: a ilustração (se estiver abaixo da dobra no celular) e seções extras
    let n = 2;
    for (const top of [...r.imgs.map((i) => i.top - 80)]) {
      await page.evaluate((t) => window.scrollTo({ top: t, behavior: "instant" }), top);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${dir}/${p.slug}-${vp.name}-${String(n++).padStart(2, "0")}-ilustracao.png` });
    }
    for (const sel of p.extra ?? []) {
      await page.evaluate((s) => { const el = document.querySelector(s); el && window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 80, behavior: "instant" }); }, sel);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${dir}/${p.slug}-${vp.name}-${String(n++).padStart(2, "0")}-${sel.slice(1)}.png` });
    }
    await ctx.close();
  }
}
await browser.close();
for (const r of rows) console.log(JSON.stringify(r));
console.log(problems.length ? "PROBLEMAS:\n" + problems.join("\n") : "Sem problemas detectados.");
