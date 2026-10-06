// Captura cada seção da home rolando até ela. Uso: node scripts/sections.mjs <url> <pasta> <largura> <altura> <prefixo>
import { chromium } from "playwright-core";
const [url, dir, w, h, prefix] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const mobile = +w < 600;
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
await page.goto(url, { waitUntil: "networkidle" });
if (mobile) await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
await page.waitForTimeout(4500);
await page.screenshot({ path: `${dir}/${prefix}-01-hero.png` });
const targets = [
  ["02-vazamentos", "#leaks-title", -40],
  ["03-mesmo-produto", "#same-title", -40],
  ["04-automacao", "#auto-title", 520],
  ["05-servicos", "#services-title", -40],
  ["06-projeto", "#case-title", 380],
  ["07-analise", "#analysis-title", -60],
];
for (const [name, sel, offset] of targets) {
  await page.evaluate(([sel, offset]) => {
    const el = document.querySelector(sel);
    const top = el.getBoundingClientRect().top + window.scrollY - 140 + offset;
    window.scrollTo({ top, behavior: "instant" });
  }, [sel, offset]);
  await page.waitForTimeout(name === "04-automacao" ? 4800 : 2200);
  await page.screenshot({ path: `${dir}/${prefix}-${name}.png` });
}
await browser.close();
