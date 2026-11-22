// Capturas do caminho do pedido: formulário do site → ficha → fila do CRM, em 390 px e 1440 px.
// Só contra o servidor LOCAL de teste (preparação de scripts/teste-crm.mjs: Postgres local, e-mail FALSO em :4010,
// automação de primeiro contato desligada). Dados fictícios; apaga os dados das tabelas crm_* do banco LOCAL.
// Uso: CRM_TESTE_DATABASE_URL=postgres://postgres:teste-local@127.0.0.1:15433/postgres node scripts/previa-pedidos.mjs <pasta>
import http from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { chromium } from "playwright-core";

const B = "http://localhost:3100";
const DB = process.env.CRM_TESTE_DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):/.test(DB)) {
  console.error("Defina CRM_TESTE_DATABASE_URL apontando para um Postgres LOCAL (127.0.0.1).");
  process.exit(2);
}
const pasta = process.argv[2] ?? "../previa-crm-pedidos";
mkdirSync(pasta, { recursive: true });
const sql = postgres(DB, { max: 2, onnotice: () => {} });
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
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (body) => fetch(`${B}/api/lead`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const notas = [];

// Banco local limpo (sem apagar a versão do esquema) e automação desligada, como em produção.
for (const t of ["crm_tarefas", "crm_webhook_eventos", "crm_eventos", "crm_mensagens", "crm_envios", "crm_oportunidades", "crm_contatos", "crm_sessoes", "crm_login_codigos", "crm_custos"]) await sql.unsafe(`delete from ${t}`);
await sql`delete from crm_config where chave <> 'esquema'`;
await sql`delete from crm_usuarios`;

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const FAKE_FB = `window.fbq=window.fbq||function(){};`;
async function contexto(largura) {
  const movel = largura < 768;
  const ctx = await browser.newContext({ viewport: { width: largura, height: movel ? 844 : 900 }, isMobile: movel, hasTouch: movel, locale: "pt-BR" });
  await ctx.route(/connect\.facebook\.net|facebook\.com|googletagmanager|google-analytics/, (r) => (r.request().url().includes("fbevents.js") ? r.fulfill({ contentType: "application/javascript", body: FAKE_FB }) : r.abort()));
  return ctx;
}
const foto = async (alvo, nome) => {
  await alvo.screenshot({ path: `${pasta}/${nome}.png`, animations: "disabled" });
  notas.push(nome);
};

/* 1) formulário da home, vindo do anúncio geral (UTMs e ids de anúncio fictícios) */
const UTM = "utm_source=facebook&utm_medium=paid&utm_campaign=Exemplo%20an%C3%BAncio%20geral&utm_content=video_servicos&campaign_id=120200000000000001&adset_id=120200000000000002&ad_id=120200000000000003";
let idPedido = null;
for (const largura of [390, 1440]) {
  const ctx = await contexto(largura);
  const p = await ctx.newPage();
  await p.goto(`${B}/?${UTM}`, { waitUntil: "networkidle" });
  const bloco = p.locator("#analise");
  await bloco.scrollIntoViewIfNeeded();
  await p.evaluate(() => document.querySelector("section[aria-labelledby=analysis-title]")?.scrollIntoView());
  await espera(900);
  await foto(p.locator("section[aria-labelledby=analysis-title]"), `1-home-bloco-${largura}`);
  const f = p.locator("form[data-formulario=pedido]");
  await f.locator("label", { hasText: "Loja virtual" }).click();
  await f.locator("textarea").fill("Vendo doces pelo Instagram e anoto as encomendas no caderno. Quero receber os pedidos já organizados.");
  await f.getByLabel("Site ou Instagram atual").fill("@doces.exemplo");
  await f.getByLabel("Ainda estou começando").check();
  await espera(300);
  await foto(f, `2-home-passo1-loja-${largura}`);
  await f.getByRole("button", { name: "Continuar" }).click();
  await espera(600);
  await f.getByLabel("Seu nome", { exact: true }).fill(largura === 390 ? "Paula Exemplo" : "Paula Exemplo (desktop)");
  await f.getByLabel("WhatsApp").fill(largura === 390 ? "(11) 90000-0101" : "(11) 90000-0102");
  await foto(f, `3-home-passo2-contato-${largura}`);
  const [resp] = await Promise.all([p.waitForResponse((r) => r.url().endsWith("/api/lead")), f.locator("button[type=submit]").click()]);
  const corpo = await resp.json();
  if (largura === 390) idPedido = corpo.id;
  await espera(900);
  await foto(f, `4-home-enviado-${largura}`);
  await ctx.close();
}

/* 2) /contato com "ainda não sei" e /lojas-virtuais (orçamento da página) no celular */
{
  const ctx = await contexto(390);
  const p = await ctx.newPage();
  await p.goto(`${B}/contato#formulario`, { waitUntil: "networkidle" });
  const f = p.locator("form[data-formulario=pedido]");
  await f.scrollIntoViewIfNeeded();
  await f.locator("label", { hasText: "Ainda não sei" }).click();
  await f.getByLabel("Ainda não tenho site nem Instagram").check();
  await espera(300);
  await foto(f, "5-contato-nao-sei-390");
  await p.goto(`${B}/lojas-virtuais#formulario`, { waitUntil: "networkidle" });
  await espera(600);
  await foto(p.locator("#formulario form"), "6-lojas-orcamento-390");
  await ctx.close();
}

/* 3) registros no formato antigo (como os do Aldair): diagnóstico da home sem serviço, sem mensagem, sem site */
const ANTIGO = { tipo: "analise", origem: "home", pagina: "/", nome: "Contato Antigo (exemplo)", empresa: "Negócio antigo exemplo", whatsapp: "(11) 90000-0201", email: "antigo@exemplo.local", segmento: "Clínica ou consultório", problema: "Contatos espalhados entre WhatsApp, planilha e e-mail", mensagem: "", referrer: "https://instagram.com/", utm: { utm_source: "facebook", utm_medium: "paid", utm_campaign: "Exemplo anúncio geral", utm_content: "video_servicos", campaign_id: "120200000000000001", adset_id: "120200000000000002", ad_id: "120200000000000003" } };
const a1 = await post(ANTIGO);
await espera(1200);
const a2 = await post({ ...ANTIGO, origem: "pagina-analise", pagina: "/analise", entrada: "/", segmento: "Corretor de imóveis" });
const [{ oportunidade_id: idAntigo }] = await sql`select oportunidade_id from crm_envios where id = ${a1.id}`;
const [{ oportunidade_id: idAntigo2 }] = await sql`select oportunidade_id from crm_envios where id = ${a2.id}`;
notas.push(`antigo: 2 envios → ${idAntigo === idAntigo2 ? "mesma oportunidade" : "oportunidades diferentes"}`);
// um pedido de outro serviço da mesma pessoa do pedido da home, minutos depois (oportunidade separada, com aviso)
await post({ tipo: "analise", formulario: "pedido", pedido: "site", origem: "contato", pagina: "/contato", nome: "Paula Exemplo", empresa: "", whatsapp: "(11) 90000-0101", email: "", mensagem: "Também quero uma página simples com o cardápio." });
// falha de envio com motivo (aviso interno recusado pelo provedor), para a fila
await sql`update crm_envios set aviso_status = 'falhou', aviso_erro = 'Provedor de e-mail recusou o envio (HTTP 500)', aviso_tentativas = 3 where id = ${a1.id}`;

/* 4) CRM: login com o código lido do provedor falso */
const sessao = async (largura) => {
  const ctx = await contexto(largura);
  const p = await ctx.newPage();
  if (largura === 1440) {
    await p.goto(`${B}/leads/entrar`);
    await p.fill('input[name="email"]', "dono@teste.local");
    await p.click('button[type="submit"]');
    await p.waitForSelector('input[name="codigo"]');
    for (let i = 0; i < 60 && !emails.some((e) => /^\d{6}/.test(e.subject ?? "")); i++) await espera(100);
    const cod = emails.filter((e) => /^\d{6}/.test(e.subject ?? "")).pop().subject.match(/^(\d{6})/)[1];
    await p.fill('input[name="codigo"]', cod);
    await p.click('button:has-text("Entrar")');
    await p.waitForURL(`${B}/leads`);
  }
  return { ctx, p };
};
const { ctx: ctxD, p: d } = await sessao(1440);
const cookie = (await ctxD.cookies()).find((c) => c.name === "spolaor_crm");
const [{ oportunidade_id: idNovo }] = await sql`select oportunidade_id from crm_envios where id = ${idPedido}`;
for (const [nome, url] of [["7-fila", "/leads"], ["8-ficha-pedido-novo", `/leads/o/${idNovo}`], ["9-ficha-registro-antigo", `/leads/o/${idAntigo}`], ["10-lista", "/leads/lista"]]) {
  await d.goto(`${B}${url}`);
  await espera(500);
  await d.screenshot({ path: `${pasta}/${nome}-1440.png`, fullPage: true });
  notas.push(`${nome}-1440`);
}
const ctxM = await contexto(390);
await ctxM.addCookies([{ ...cookie }]);
const m = await ctxM.newPage();
for (const [nome, url] of [["7-fila", "/leads"], ["8-ficha-pedido-novo", `/leads/o/${idNovo}`], ["9-ficha-registro-antigo", `/leads/o/${idAntigo}`]]) {
  await m.goto(`${B}${url}`);
  await espera(500);
  await m.screenshot({ path: `${pasta}/${nome}-390.png`, fullPage: false });
  await m.screenshot({ path: `${pasta}/${nome}-390-inteira.png`, fullPage: true });
  notas.push(`${nome}-390`);
}
writeFileSync(`${pasta}/capturas.txt`, notas.join("\n") + "\n");
await browser.close();
await sql.end();
provedor.close();
console.log(notas.join("\n"));
