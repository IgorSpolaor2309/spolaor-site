// Uso: node scripts/element.mjs <url> <seletor> <saida.png> [largura] [altura]  (captura de um elemento)
import { chromium } from "playwright-core";
const [url, sel, out, w="1440", h="900"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto(url, { waitUntil: "networkidle" });
const el = p.locator(sel).first();
await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
await p.evaluate(() => window.scrollBy(0, 1)); await p.waitForTimeout(600);
await el.screenshot({ path: out });
await b.close();
