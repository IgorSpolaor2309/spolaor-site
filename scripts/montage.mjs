// Junta várias capturas lado a lado numa imagem (para revisão rápida).
// Uso: node scripts/montage.mjs saida.png img1.png img2.png ...
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const [out, ...imgs] = process.argv.slice(2);
const html = `<body style="margin:0;display:flex;gap:8px;background:#333">${imgs
  .map((p) => `<img style="width:${Math.floor(1600 / imgs.length) - 8}px" src="data:image/png;base64,${readFileSync(p).toString("base64")}">`)
  .join("")}</body>`;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await b.close();
