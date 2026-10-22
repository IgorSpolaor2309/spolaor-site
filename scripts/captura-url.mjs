// Captura uma URL (publicada ou local) em desktop e celular. Uso: node scripts/captura-url.mjs <base> <pasta> <prefixo> <caminho...>
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const [base, dir, prefix, ...paths] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const exe = process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe });
for (let path of paths) {
  path = path.startsWith("/") ? path : "/" + path.replace(/^home$/, "");
  const slug = path === "/" ? "home" : path.replace(/[\/#]/g, "-").replace(/^-/, "");
  for (const vp of [{ n: "desktop", w: 1440, h: 900, m: false }, { n: "celular", w: 390, h: 844, m: true }]) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 2 : 1, isMobile: vp.m, hasTouch: vp.m });
    const p = await ctx.newPage();
    await p.goto(base + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(5000);
    await p.screenshot({ path: `${dir}/${prefix}-${slug}-${vp.n}.png` });
    await ctx.close();
  }
}
await b.close();
