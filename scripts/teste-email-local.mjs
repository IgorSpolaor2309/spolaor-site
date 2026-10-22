// Teste local ponta a ponta do envio por e-mail: sobe um "provedor" falso em :4010, usa o build
// em :3100 (RESEND_API_URL aponta para o falso) e preenche cada formulário no navegador.
// Nada sai da máquina. Uso: node scripts/teste-email-local.mjs
import http from "node:http";
import { chromium } from "playwright-core";
const received = [];
let mode = "ok";
http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    if (mode === "fail") { res.writeHead(500); return res.end("{}"); }
    received.push({ auth: req.headers.authorization, body: JSON.parse(b) });
    res.writeHead(200, { "content-type": "application/json" }); res.end('{"id":"fake"}');
  });
}).listen(4010);
const B = "http://localhost:3100";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = []; const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const NOME = "TESTE — formulário do site";
async function diag(p, fixed) {
  const f = p.locator("#analise form").first(); await f.scrollIntoViewIfNeeded();
  if (!fixed) await f.locator("label:has(input[type=radio])").first().click();
  await f.locator("div[role=radiogroup]").last().locator("label").first().click();
  await f.getByRole("button", { name: "Continuar" }).click(); await p.waitForTimeout(500);
  await f.getByLabel("Seu nome", { exact: true }).fill(NOME);
  await f.getByLabel("Empresa", { exact: true }).fill("Teste Spolaor");
  await f.getByLabel("WhatsApp").fill("11900000000");
  await f.locator("button[type=submit]").click();
}
async function quote(p) {
  const f = p.locator("#orcamento form, form[aria-label='Falar sobre um projeto']").first(); await f.scrollIntoViewIfNeeded();
  await f.locator("button[aria-pressed]").first().click();
  await f.getByLabel("Seu nome", { exact: true }).fill(NOME);
  await f.getByLabel("Empresa", { exact: true }).fill("Teste Spolaor");
  await f.getByLabel("WhatsApp").fill("11900000000");
  await f.getByLabel("E-mail").fill("teste@example.com");
  await f.locator("button[type=submit]").click();
}
const cases = [["/", diag, false, "home"], ["/automacao", diag, false, "automacao"], ["/corretores", diag, true, "corretores"], ["/clinicas", diag, true, "clinicas"], ["/orcamentos", diag, true, "orcamentos"], ["/analise", diag, false, "pagina-analise"], ["/sites", quote, false, "sites"], ["/contato", quote, false, "contato"]];
for (const [path, fill, fixed, origem] of cases) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + path, { waitUntil: "networkidle" });
  const before = received.length;
  await fill(p, fixed); await p.waitForTimeout(1500);
  const success = await p.locator("[role=status]").filter({ hasText: /recebid/ }).count();
  const m = received[received.length - 1];
  ok(success === 1 && received.length === before + 1 && m.body.text.includes(`Origem do lead: ${origem}`) && m.body.text.includes(`Página do envio: ${path}`) && m.body.subject.startsWith("TESTE"), `${path}: sucesso=${success}, e-mails=${received.length - before}, origem=${origem}, assunto="${m?.body.subject}"`);
  await p.close();
}
const last = received[received.length - 1];
ok(last.auth === "Bearer chave-falsa" && JSON.stringify(last.body.to) === '["igspolaorr@gmail.com"]', `servidor autentica e envia só para ${JSON.stringify(last.body.to)}`);
// credencial nunca no navegador
const p = await b.newPage(); await p.goto(B + "/", { waitUntil: "networkidle" });
const html = await p.content(); ok(!html.includes("chave-falsa") && !html.includes("igspolaorr"), "chave e destinatário não aparecem no HTML da página");
// provedor recusa → erro, nunca sucesso
mode = "fail";
const p2 = await b.newPage({ viewport: { width: 1280, height: 900 } }); await p2.goto(B + "/corretores", { waitUntil: "networkidle" });
await diag(p2, true); await p2.waitForTimeout(1500);
ok((await p2.locator("[role=status]").filter({ hasText: /recebid/ }).count()) === 0 && (await p2.locator("[role=alert]").count()) > 0, "provedor recusa → formulário mostra erro e não mostra sucesso");
console.log(out.join("\n")); console.log("\nExemplo do e-mail:\n" + last.body.subject + "\n" + last.body.text);
await b.close(); process.exit(out.some((l) => l.startsWith("FALHA")) ? 1 : 0);
