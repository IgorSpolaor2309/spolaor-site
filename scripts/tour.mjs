// Uso: node scripts/tour.mjs <url> <prefixo> [largura] [altura] [passo]
// Rola a página e salva uma captura por "tela", como um visitante veria.
import { chromium } from "playwright-core";
const [url, prefix, w = "1440", h = "900", step = "900"] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const mobile = +w < 600;
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const height = await page.evaluate(() => document.documentElement.scrollHeight);
let i = 0;
for (let y = 0; y < height; y += +step) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${prefix}_${String(i++).padStart(2, "0")}.png` });
}
console.log("capturas:", i, "altura:", height);
if (errors.length) console.log("ERROS:", errors.join("\n"));
await browser.close();
