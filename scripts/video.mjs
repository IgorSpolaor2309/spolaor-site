// Grava um vídeo rolando a homepage (prévia da experiência). Uso: node scripts/video.mjs <url> <pasta>
import { chromium } from "playwright-core";
const [url, dir] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.mouse.move(900, 400);
await page.waitForTimeout(3500);
for (let i = 0; i < 12; i++) { await page.mouse.move(700 + i * 30, 380 + (i % 3) * 20); await page.waitForTimeout(120); }
const stops = [600, 1200, 2000, 2600, 3200, 4200, 5200, 6300, 7300, 8300, 9300, 10400, 11400, 12400, 13400, 14400, 15400];
for (const target of stops) {
  const y = await page.evaluate(() => window.scrollY);
  const steps = 10;
  for (let s = 0; s < steps; s++) { await page.mouse.wheel(0, (target - y) / steps); await page.waitForTimeout(60); }
  await page.waitForTimeout(target >= 5200 && target <= 6300 ? 3200 : 1700);
}
await ctx.close();
await browser.close();
