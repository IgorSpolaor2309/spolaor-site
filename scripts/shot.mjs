// Uso: node scripts/shot.mjs <url> <saida.png> [largura] [altura] [fullPage] [scrollY]
import { chromium } from "playwright-core";
const [url, out, w = "1440", h = "900", full = "0", scrollY = "0"] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
if (full === "1") {
  // rola até o fim para disparar as animações de entrada
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
} else if (+scrollY) {
  await page.evaluate((y) => window.scrollTo(0, y), +scrollY);
}
await page.waitForTimeout(2500);
await page.screenshot({ path: out, fullPage: full === "1" });
if (errors.length) console.log("ERROS:", errors.join("\n"));
await browser.close();
