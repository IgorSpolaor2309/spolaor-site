// Capturas das telas do CRM (/leads) em 390 px e 1440 px, contra o servidor LOCAL de teste (mesma preparação de
// scripts/teste-crm.mjs: banco local, provedor de e-mail falso em :4010). Entra com o código lido do provedor falso.
// Uso: node scripts/previa-crm.mjs <pasta de saída> [id da oportunidade para a ficha]
import http from "node:http";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const B = "http://localhost:3100";
const pasta = process.argv[2] ?? "../previa-crm";
mkdirSync(pasta, { recursive: true });
const emails = [];
const provedor = http
  .createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      emails.push(JSON.parse(b || "{}"));
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"id":"fake"}');
    });
  })
  .listen(4010);

// YCloud simulada (:4040), só para as telas que leem o estado do número e dos modelos quando o servidor de teste
// está com o WhatsApp configurado (veja scripts/teste-crm-whatsapp.mjs). Sem isso, essas telas mostram "sem resposta".
const ycloud = http
  .createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    if (req.url.startsWith("/whatsapp/templates"))
      return res.end(JSON.stringify({ items: [{ name: "primeiro_contato_site", language: "pt_BR", status: "APPROVED", category: "UTILITY", components: [{ type: "BODY", text: "Olá, {{1}}! Aqui é a Spolaor Tecnologia. Recebemos {{2}} pelo nosso site. Posso continuar seu atendimento por aqui?" }] }] }));
    if (req.url.startsWith("/whatsapp/phoneNumbers"))
      return res.end(JSON.stringify({ items: [{ phoneNumber: "+5547900000000", status: "CONNECTED", qualityRating: "GREEN", messagingLimit: "TIER_250", verifiedName: "Spolaor Tecnologia" }] }));
    res.end("{}");
  })
  .on("error", () => {})
  .listen(4040);

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
await ctx.route(/facebook\.(com|net)/, (r) => r.abort());
const page = await ctx.newPage();
await page.goto(`${B}/leads/entrar`);
await page.screenshot({ path: `${pasta}/entrar-1440.png` });
await page.fill('input[name="email"]', "dono@teste.local");
await page.click('button[type="submit"]');
await page.waitForSelector('input[name="codigo"]');
for (let i = 0; i < 50 && !emails.length; i++) await new Promise((r) => setTimeout(r, 100));
await page.fill('input[name="codigo"]', emails[0].subject.match(/^(\d{6})/)[1]);
await page.click('button:has-text("Entrar")');
await page.waitForURL(`${B}/leads`);

let ficha = process.argv[3];
if (!ficha) ficha = (await page.locator('a[href^="/leads/o/"]').first().getAttribute("href")).split("/").pop();
const telas = [
  ["depende-de-mim", "/leads"],
  ["lista", "/leads/lista"],
  ["funil", "/leads/funil"],
  ["ficha", `/leads/o/${ficha}`],
  ["novo", "/leads/novo"],
  ["indicadores", "/leads/indicadores"],
  ["integracoes", "/leads/integracoes"],
  ["configuracoes", "/leads/configuracoes"],
];
const cookies = await ctx.cookies();
for (const [largura, altura, movel] of [
  [1440, 900, false],
  [390, 844, true],
]) {
  const c = await browser.newContext({ viewport: { width: largura, height: altura }, locale: "pt-BR", isMobile: movel, hasTouch: movel, deviceScaleFactor: movel ? 2 : 1 });
  await c.route(/facebook\.(com|net)/, (r) => r.abort());
  await c.addCookies(cookies);
  const p = await c.newPage();
  for (const [nome, caminho] of telas) {
    await p.goto(`${B}${caminho}`, { waitUntil: "networkidle" });
    await p.screenshot({ path: `${pasta}/${nome}-${largura}.png`, fullPage: true });
    if (movel) await p.screenshot({ path: `${pasta}/${nome}-${largura}-primeira-tela.png` });
  }
  if (movel) {
    await p.goto(`${B}/leads/entrar`);
  }
  await c.close();
}
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
const pm = await m.newPage();
await pm.goto(`${B}/leads/entrar`);
await pm.screenshot({ path: `${pasta}/entrar-390.png` });
await browser.close();
provedor.close();
ycloud.close();
console.log(`capturas em ${pasta}`);
