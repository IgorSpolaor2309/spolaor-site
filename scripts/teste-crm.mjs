// Teste local do CRM (/leads) com Postgres de verdade, provedor de e-mail FALSO (:4010) e Pixel FALSO.
// Nada sai da máquina: nenhum lead real, nenhum e-mail real, nenhum evento para a Meta.
//
// Preparação (uma vez):
//   docker run -d --name spolaor-crm-teste-pg -e POSTGRES_PASSWORD=teste-local -p 127.0.0.1:15433:5432 postgres:16-alpine
//   build com NEXT_PUBLIC_META_PIXEL_ID (qualquer número), RESEND_API_KEY, LEAD_EMAIL_TO, LEAD_EMAIL_FROM e
//   RESEND_API_URL=http://localhost:4010/
// Servidor (o banco TEM de ser local; o script recusa qualquer outro):
//   DATABASE_URL=postgres://postgres:teste-local@127.0.0.1:15433/postgres CRM_ACESSO_EMAILS=dono@teste.local
//   CRM_EMAIL_REPLY_TO=comercial@teste.local CRON_SECRET=teste-cron RESEND_API_KEY=teste LEAD_EMAIL_TO=destino@teste.local
//   LEAD_EMAIL_FROM="Site <site@teste.local>" RESEND_API_URL=http://localhost:4010/
//   node node_modules/next/dist/bin/next start --port 3100
// Uso: CRM_TESTE_DATABASE_URL=postgres://postgres:teste-local@127.0.0.1:15433/postgres node scripts/teste-crm.mjs
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";
import { chromium } from "playwright-core";

const B = "http://localhost:3100";
const DB = process.env.CRM_TESTE_DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):/.test(DB)) {
  console.error("Defina CRM_TESTE_DATABASE_URL apontando para um Postgres LOCAL (127.0.0.1). O teste apaga os dados das tabelas crm_*.");
  process.exit(2);
}
const DONO = "dono@teste.local";
const sql = postgres(DB, { max: 2, onnotice: () => {} });

/* ── provedor de e-mail falso ── */
const emails = [];
let mode = "ok"; // ok | fail
const provedor = http
  .createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      const corpo = JSON.parse(b || "{}");
      const registro = { ...corpo, idem: req.headers["idempotency-key"] ?? null, aceito: mode !== "fail" };
      emails.push(registro);
      if (mode === "fail") {
        res.writeHead(500);
        return res.end("{}");
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(`{"id":"fake-${emails.length}"}`);
    });
  })
  .listen(4010);
const aceitos = (f) => emails.filter((e) => e.aceito && f(e));

const out = [];
let falhas = 0;
const ok = (c, m) => {
  if (!c) falhas++;
  out.push(`${c ? "OK   " : "FALHA"} ${m}`);
};
const secao = (t) => out.push(`\n── ${t} ──`);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function ate(fn, ms = 8000) {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v || Date.now() - t > ms) return v;
    await espera(150);
  }
}

const post = (body) => fetch(`${B}/api/lead`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const lead = (extra) => ({
  tipo: "projeto",
  origem: "sites",
  pagina: "/sites",
  nome: "Marina Albuquerque",
  empresa: "Ateliê Albuquerque (validação local)",
  whatsapp: "(11) 98888-0001",
  email: "marina@validacao.local",
  mensagem: "Preciso de um site novo para o ateliê.",
  utm: {},
  ...extra,
});
const cron = () => fetch(`${B}/api/atendimento-ia/cron`, { headers: { authorization: "Bearer teste-cron" } }).then((r) => r.status);

// Garante o esquema (o servidor aplica na primeira conexão) e zera os dados das tabelas do CRM.
await fetch(`${B}/leads/entrar`).catch(() => {});
await post({ website: "x" });
const existe = await ate(async () => (await sql`select to_regclass('crm_oportunidades') as t`)[0].t, 15000);
if (!existe) {
  // Primeira execução: a tabela nasce quando o servidor grava o primeiro envio.
  await post(lead({ nome: "TESTE criação do esquema", whatsapp: "(11) 90000-0000", email: "esquema@validacao.local" }));
  await ate(async () => (await sql`select to_regclass('crm_oportunidades') as t`)[0].t, 15000);
}
// Faz o servidor abrir a conexão com o banco (é nela que ele aplica o esquema) antes de esperar pela versão.
await cron();
// Espera o servidor terminar de aplicar a versão atual do esquema (ele faz isso na primeira conexão).
const versaoEsquema = readFileSync(new URL("../src/lib/crm/schema.ts", import.meta.url), "utf8").match(/CRM_SCHEMA_VERSAO = "([0-9a-f]+)"/)[1];
const esquemaPronto = await ate(async () => (await sql`select valor from crm_config where chave = 'esquema'`.catch(() => []))[0]?.valor === versaoEsquema, 30000);
if (!esquemaPronto) {
  console.error("O servidor não aplicou a versão atual do esquema (o build está atualizado? o servidor usa este banco?).");
  process.exit(2);
}
// Zera os dados do CRM sem tocar no registro de versão do esquema (um TRUNCATE ... CASCADE o apagaria, porque
// crm_config referencia crm_usuarios).
for (const t of ["crm_tarefas", "crm_webhook_eventos", "crm_eventos", "crm_mensagens", "crm_envios", "crm_oportunidades", "crm_contatos", "crm_sessoes", "crm_login_codigos", "crm_custos"]) await sql.unsafe(`delete from ${t}`);
await sql`delete from crm_config where chave <> 'esquema'`;
await sql`delete from crm_usuarios`;
emails.length = 0;

const exe = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ executablePath: exe });
const FAKE_FB = `window.__fb=window.__fb||[];var f=window.fbq;f.callMethod=function(){window.__fb.push([].slice.call(arguments))};(f.queue||[]).forEach(function(a){f.callMethod.apply(f,a)});f.queue=[];`;
async function contexto(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", ...opts });
  const meta = [];
  await ctx.route(/connect\.facebook\.net|facebook\.com/, (r) => {
    meta.push(r.request().url());
    return r.request().url().includes("fbevents.js") ? r.fulfill({ contentType: "application/javascript", body: FAKE_FB }) : r.abort();
  });
  return { ctx, meta };
}

// Clica num botão que dispara uma ação do servidor e espera a resposta dela e a página recarregada.
async function acao(page, seletor) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]), page.click(seletor)]);
  await page.waitForLoadState("networkidle");
  await espera(300);
}

try {
  /* ───────────────────────────── esquema ───────────────────────────── */
  secao("Esquema");
  const sqlArquivo = readFileSync(new URL("../db/crm.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const schemaTs = readFileSync(new URL("../src/lib/crm/schema.ts", import.meta.url), "utf8");
  ok(schemaTs.includes(JSON.stringify(sqlArquivo)), "src/lib/crm/schema.ts tem o mesmo SQL de db/crm.sql");
  const rls = await sql`select count(*)::int as n from pg_class where relname like 'crm\\_%' and relkind = 'r' and not relrowsecurity`;
  ok(rls[0].n === 0, "todas as tabelas crm_* têm RLS ligado");
  const semIndice = await sql`
    select conrelid::regclass::text as tabela, a.attname as coluna from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.conrelid::regclass::text like 'crm\\_%'
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = a.attnum)`;
  // crm_config.usuario_id e crm_custos.usuario_id ficam sem índice de propósito (tabelas minúsculas).
  const faltam = semIndice.filter((r) => !["crm_config", "crm_custos"].includes(r.tabela));
  ok(faltam.length === 0, `chaves estrangeiras com índice${faltam.length ? ` (faltam: ${faltam.map((r) => `${r.tabela}.${r.coluna}`).join(", ")})` : ""}`);

  /* ───────────────────────────── acesso ───────────────────────────── */
  secao("Acesso");
  const privadas = ["/leads", "/leads/lista", "/leads/funil", "/leads/indicadores", "/leads/integracoes", "/leads/configuracoes", "/leads/novo", "/leads/o/00000000-0000-4000-8000-000000000000"];
  const semSessao = await Promise.all(privadas.map((p) => fetch(`${B}${p}`, { redirect: "manual" }).then(async (r) => ({ p, status: r.status, loc: r.headers.get("location"), html: await r.text() }))));
  ok(semSessao.every((r) => r.status === 307 && r.loc === "/leads/entrar"), `sem sessão, as ${privadas.length} páginas respondem 307 → /leads/entrar (${[...new Set(semSessao.map((r) => r.status))].join(",")})`);
  ok(semSessao.every((r) => !/Albuquerque|whatsapp|crm_/i.test(r.html)), "a resposta sem sessão não traz nenhum dado de contato");
  const exp = await fetch(`${B}/api/leads/exportar`);
  ok(exp.status === 401 && !(await exp.text()).includes(";"), "sem sessão, /api/leads/exportar responde 401 sem conteúdo");
  const cookieFalso = await fetch(`${B}/leads`, { redirect: "manual", headers: { cookie: "spolaor_crm=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } });
  ok(cookieFalso.status === 307, "cookie inventado não dá acesso");
  const manifest = ".next/prerender-manifest.json";
  if (existsSync(manifest)) {
    const rotas = Object.keys(JSON.parse(readFileSync(manifest, "utf8")).routes ?? {});
    ok(!rotas.some((r) => r.startsWith("/leads")), "nenhuma página de /leads é gerada no build (todas dinâmicas)");
  }
  const entrar = await fetch(`${B}/leads/entrar`);
  const entrarHtml = await entrar.text();
  ok(/noindex/.test(entrar.headers.get("x-robots-tag") ?? "") && /no-store/.test(entrar.headers.get("cache-control") ?? ""), `cabeçalhos de /leads: X-Robots-Tag=${entrar.headers.get("x-robots-tag")} · Cache-Control=${entrar.headers.get("cache-control")}`);
  ok(/<meta name="robots" content="noindex/.test(entrarHtml), "meta robots noindex em /leads/entrar");

  const { ctx, meta } = await contexto();
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));

  // e-mail fora da lista: mesma tela, nenhum e-mail enviado
  await page.goto(`${B}/leads/entrar`);
  const cromo = await page.evaluate(() => ({ footer: document.querySelectorAll("footer").length, nav: document.querySelectorAll("header nav").length, texto: document.body.innerText }));
  ok(cromo.footer === 0 && cromo.nav === 0 && !/Diagnóstico gratuito|Lojas virtuais/.test(cromo.texto), "/leads/entrar sem cabeçalho, menu nem rodapé do site público");
  await page.fill('input[name="email"]', "intruso@teste.local");
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="codigo"]');
  ok(emails.length === 0 && (await sql`select count(*)::int as n from crm_login_codigos`)[0].n === 0, "e-mail fora da lista: mesma tela de código, nenhum código criado nem enviado");
  await page.fill('input[name="codigo"]', "123456");
  await page.click('button:has-text("Entrar")');
  await page.waitForSelector('[role="alert"]');
  ok(page.url().endsWith("/leads/entrar"), "e-mail fora da lista não entra com código qualquer");

  // e-mail autorizado: código errado, bloqueio, código novo
  await page.goto(`${B}/leads/entrar`);
  await page.fill('input[name="email"]', DONO);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="codigo"]');
  const cod1 = await ate(() => emails.find((e) => e.to?.[0] === DONO)?.subject?.match(/^(\d{6})/)?.[1]);
  ok(!!cod1, "e-mail autorizado recebe um código de 6 dígitos");
  ok(!(await sql`select codigo_hash from crm_login_codigos`)[0].codigo_hash.includes(cod1), "o banco guarda só o hash do código");
  const errado = cod1 === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) {
    await page.fill('input[name="codigo"]', errado);
    await page.click('button:has-text("Entrar")');
    await page.waitForFunction((n) => document.querySelector('input[name="codigo"]')?.value === "" || document.querySelectorAll('[role="alert"]').length >= 1, i);
    await espera(250);
  }
  ok(page.url().endsWith("/leads/entrar"), "5 códigos errados não entram");
  await page.fill('input[name="codigo"]', cod1);
  await page.click('button:has-text("Entrar")');
  await espera(1200);
  ok(page.url().endsWith("/leads/entrar"), "depois de 5 erros, nem o código certo entra (código bloqueado)");
  await page.click('button:has-text("Enviar outro código")');
  const cod2 = await ate(() => emails.filter((e) => e.to?.[0] === DONO).at(1)?.subject?.match(/^(\d{6})/)?.[1]);
  await page.fill('input[name="codigo"]', cod2);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(`${B}/leads`);
  ok(true, "código novo e correto entra em /leads");
  const cookie = (await ctx.cookies()).find((c) => c.name === "spolaor_crm");
  ok(cookie?.httpOnly && cookie.sameSite === "Lax", `cookie de sessão httpOnly e SameSite=Lax (expira em ~${Math.round((cookie.expires - Date.now() / 1000) / 86400)} dias)`);
  ok(!(await sql`select token_hash from crm_sessoes`)[0].token_hash.includes(cookie.value), "o banco guarda só o hash da sessão");
  // código já usado não serve de novo
  const { ctx: ctx2 } = await contexto();
  const p2 = await ctx2.newPage();
  await p2.goto(`${B}/leads/entrar`);
  await p2.fill('input[name="email"]', DONO);
  await p2.click('button[type="submit"]');
  await p2.waitForSelector('input[name="codigo"]');
  await p2.fill('input[name="codigo"]', cod2);
  await p2.click('button:has-text("Entrar")');
  await espera(1200);
  ok(p2.url().endsWith("/leads/entrar"), "código já usado não entra de novo");
  await ctx2.close();
  ok((await page.evaluate(() => typeof window.fbq)) === "undefined" && meta.length === 0, "em /leads não há Pixel (fbq indefinido) nem requisição à Meta");
  emails.length = 0;

  /* ───────────────────────────── persistência ───────────────────────────── */
  secao("Persistência dos formulários");
  const r1 = await post(lead({ pagina: "/sites", entrada: "/lojas-virtuais", referrer: "https://www.google.com/", utm: { utm_source: "facebook", utm_medium: "paid", utm_campaign: "sites-nov", campaign_id: "120210000000000001", adset_id: "120210000000000002", ad_id: "120210000000000003", fbclid: "IwAR0abc" } }));
  ok(r1.status === 200 && /^[0-9a-f-]{36}$/.test(r1.body.id ?? ""), `/api/lead aceita e devolve id (${r1.status})`);
  const [env1] = await sql`select e.*, o.etapa, o.servico, o.origem, o.canal, o.registro, o.pagina, o.entrada, o.utm, o.meta_campaign_id, o.meta_adset_id, o.meta_ad_id, o.mensagem, c.nome, c.whatsapp, c.email
    from crm_envios e join crm_oportunidades o on o.id = e.oportunidade_id join crm_contatos c on c.id = o.contato_id where e.id = ${r1.body.id}`;
  ok(!!env1, "o envio está no banco com o MESMO id devolvido ao navegador (eventID do Lead)");
  ok(env1?.etapa === "novo" && env1.servico === "Site ou landing page" && env1.canal === "formulario" && env1.registro === "automatico", `oportunidade criada: etapa=${env1?.etapa}, serviço="${env1?.servico}", canal=${env1?.canal}`);
  ok(env1?.whatsapp === "5511988880001" && env1.email === "marina@validacao.local", `contato normalizado: whatsapp=${env1?.whatsapp}, email=${env1?.email}`);
  ok(env1?.pagina === "/sites" && env1.entrada === "/lojas-virtuais" && env1.utm.utm_campaign === "sites-nov", "página do envio, página de entrada e UTMs gravadas");
  ok(env1?.meta_campaign_id === "120210000000000001" && env1.meta_adset_id === "120210000000000002" && env1.meta_ad_id === "120210000000000003", "identificadores de campanha, conjunto e anúncio gravados quando vêm na URL");
  ok(env1?.payload?.nome === "Marina Albuquerque" && env1.payload.mensagem?.includes("ateliê"), "payload original do envio preservado");
  await ate(async () => (await sql`select aviso_status from crm_envios where id = ${r1.body.id}`)[0].aviso_status === "enviado");
  const avisos1 = aceitos((e) => e.text?.includes(r1.body.id));
  ok(avisos1.length === 1 && avisos1[0].to[0] === "destino@teste.local" && avisos1[0].subject.startsWith("Novo lead · Site ou landing page"), `aviso por e-mail preservado: 1 e-mail, assunto "${avisos1[0]?.subject}"`);
  ok(avisos1[0]?.text.includes(`/leads/o/${env1.oportunidade_id}`), "o aviso traz o link da ficha no CRM");

  // falha do provedor de e-mail: o lead continua salvo e aceito
  mode = "fail";
  const r2 = await post(lead({ nome: "Rogério Tavares", empresa: "Tavares Refrigeração", whatsapp: "11 97777-0002", email: "rogerio@validacao.local", origem: "lojas-virtuais", pagina: "/lojas-virtuais" }));
  ok(r2.status === 200 && !!r2.body.id, `provedor de e-mail fora do ar: API responde ${r2.status} com id (lead aceito porque está gravado)`);
  const [env2] = await sql`select aviso_status, aviso_tentativas, aviso_erro, oportunidade_id from crm_envios where id = ${r2.body.id}`;
  ok(env2?.aviso_status === "falhou" && env2.aviso_tentativas === 1 && /HTTP 500/.test(env2.aviso_erro), `contato salvo e aviso marcado como falhou (${env2?.aviso_erro})`);
  ok((await sql`select count(*)::int as n from crm_eventos where oportunidade_id = ${env2.oportunidade_id} and tipo = 'aviso_falhou'`)[0].n === 1, "a falha do aviso entra no histórico da oportunidade");
  mode = "ok";
  ok((await cron()) === 200, "rotina do site executa (200)");
  await ate(async () => (await sql`select aviso_status from crm_envios where id = ${r2.body.id}`)[0].aviso_status === "enviado");
  const [env2b] = await sql`select aviso_status, aviso_tentativas from crm_envios where id = ${r2.body.id}`;
  const tent2 = emails.filter((e) => e.text?.includes(r2.body.id));
  ok(env2b.aviso_status === "enviado" && env2b.aviso_tentativas === 2 && tent2.filter((e) => e.aceito).length === 1, "a rotina reenvia o aviso que falhou: 1 e-mail aceito");
  ok(tent2.length === 2 && tent2[0].idem === tent2[1].idem && tent2[0].idem === `lead-aviso-${r2.body.id}`, "as duas tentativas usam a mesma chave de idempotência no provedor");
  await cron();
  await espera(500);
  ok(aceitos((e) => e.text?.includes(r2.body.id)).length === 1 && aceitos((e) => e.text?.includes(r1.body.id)).length === 1, "rodar a rotina de novo não reenvia avisos já aceitos");
  ok((await cron().then(() => fetch(`${B}/api/atendimento-ia/cron`).then((r) => r.status))) === 401, "rotina sem o segredo responde 401");

  const antes = (await sql`select count(*)::int as n from crm_envios`)[0].n;
  const spam = await post({ ...lead({ nome: "Robô" }), website: "http://spam" });
  const invalido = await post(lead({ nome: "", whatsapp: "1" }));
  ok(spam.status === 200 && !spam.body.id && invalido.status === 422 && (await sql`select count(*)::int as n from crm_envios`)[0].n === antes, "anti-spam (200 sem id) e envio inválido (422) não gravam nada");

  /* ───────────────────────────── duplicação ───────────────────────────── */
  secao("Duplicação e identidade");
  const conta = async () => (await sql`select (select count(*) from crm_contatos)::int as c, (select count(*) from crm_oportunidades)::int as o, (select count(*) from crm_envios)::int as e`)[0];
  const c0 = await conta();
  const r3 = await post(lead({ whatsapp: "+55 11 98888 0001", email: "", tipo: "analise", origem: "sites", segmento: "Outro", problema: "Outro", mensagem: "Esqueci de dizer: preciso para dezembro." }));
  const c1 = await conta();
  ok(r3.status === 200 && c1.c === c0.c && c1.o === c0.o && c1.e === c0.e + 1, `mesma pessoa (mesmo WhatsApp, formato diferente), mesmo serviço: nenhum contato nem oportunidade nova, só o envio (${c0.c}/${c0.o}/${c0.e} → ${c1.c}/${c1.o}/${c1.e})`);
  ok((await sql`select count(*)::int as n from crm_eventos where oportunidade_id = ${env1.oportunidade_id} and tipo = 'novo_envio'`)[0].n === 1, "o novo envio entra no histórico da oportunidade existente");
  ok(r3.body.id !== r1.body.id && (await sql`select oportunidade_id from crm_envios where id = ${r3.body.id}`)[0].oportunidade_id === env1.oportunidade_id, "cada envio tem o próprio id (uma conversão por envio aceito, como antes)");
  const r4 = await post(lead({ origem: "lojas-virtuais", pagina: "/lojas-virtuais", mensagem: "Também quero vender online." }));
  const c2 = await conta();
  ok(r4.status === 200 && c2.c === c1.c && c2.o === c1.o + 1, "mesma pessoa, serviço diferente (loja virtual): mesmo contato, oportunidade nova");
  const r5 = await post(lead({ nome: "Marina Albuquerque", empresa: "Outro ateliê", whatsapp: "(21) 96666-0005", email: "outra.marina@validacao.local" }));
  const c3 = await conta();
  ok(r5.status === 200 && c3.c === c2.c + 1 && c3.o === c2.o + 1, "nome idêntico com WhatsApp e e-mail diferentes: contato NOVO (nome não une registros)");
  const r6 = await post(lead({ nome: "M. Albuquerque", whatsapp: "(11) 95555-0006", email: "MARINA@validacao.local", origem: "agendamento-online", pagina: "/agendamento-online" }));
  const c4 = await conta();
  ok(r6.status === 200 && c4.c === c3.c && c4.o === c3.o + 1, "mesmo e-mail (maiúsculas diferentes) com outro telefone: mesmo contato");
  ok((await sql`select nome, whatsapp from crm_contatos where email = 'marina@validacao.local'`)[0].whatsapp === "5511988880001", "formulário não sobrescreve nome nem WhatsApp já gravados do contato");
  const simult = await Promise.all(Array.from({ length: 6 }, (_, i) => post(lead({ nome: "Bianca Furtado", empresa: "Furtado Odontologia", whatsapp: "(31) 94444-0007", email: "bianca@validacao.local", mensagem: `envio simultâneo ${i}` }))));
  const c5 = await conta();
  ok(simult.every((r) => r.status === 200) && c5.c === c4.c + 1 && c5.o === c4.o + 1 && c5.e === c4.e + 6, `6 envios simultâneos da mesma pessoa: 1 contato, 1 oportunidade, 6 envios (${c5.c - c4.c}/${c5.o - c4.o}/${c5.e - c4.e})`);
  ok(new Set(simult.map((r) => r.body.id)).size === 6, "os 6 envios simultâneos têm ids distintos");
  const t7 = await post(lead({ nome: "TESTE — formulário do site", whatsapp: "(11) 93333-0008", email: "teste@validacao.local" }));
  ok((await sql`select o.teste from crm_envios e join crm_oportunidades o on o.id = e.oportunidade_id where e.id = ${t7.body.id}`)[0].teste === true, "envio com nome iniciado por TESTE fica marcado como teste (fora dos indicadores)");

  /* ───────────────────────────── atendimento ───────────────────────────── */
  secao("Fluxo de atendimento (navegador, com sessão)");
  await page.goto(`${B}/leads`);
  const novosTxt = await page.locator("#manual").evaluate((el) => el.textContent ?? "");
  ok(/Marina Albuquerque/.test(novosTxt) && /Rogério Tavares/.test(novosTxt) && /Bianca Furtado/.test(novosTxt) && /Novo pedido/.test(novosTxt), "fila: com a automação desligada, os contatos dos formulários aparecem em “Depende de mim” como “Novo pedido” (sem primeiro atendimento)");
  await page.goto(`${B}/leads/lista`);
  ok(/Anúncio na Meta/.test(await page.locator("#conteudo").innerText()), "lista mostra a fonte declarada na URL (Anúncio na Meta)");
  await page.goto(`${B}/leads`);
  ok(!/TESTE — formulário/.test(novosTxt) && /envio de teste aberto fica fora desta fila/.test(await page.locator("#conteudo").innerText()), "fila: envio de teste não entra na fila de atendimento (fica indicado e acessível pela lista)");
  await page.goto(`${B}/leads/o/${env1.oportunidade_id}`);
  ok((await page.locator("h1").innerText()).includes("Marina Albuquerque"), "ficha abre com nome e empresa");
  const fichaTxt = await page.locator("body").innerText();
  ok(fichaTxt.includes("Preciso de um site novo") && fichaTxt.includes("utm_campaign=sites-nov") && fichaTxt.includes("campanha 120210000000000001") && fichaTxt.includes("/lojas-virtuais"), "ficha mostra mensagem original, UTMs, identificadores do anúncio e página de entrada");
  ok(fichaTxt.includes("Novo envio do formulário pelo mesmo contato") && fichaTxt.includes("preciso para dezembro"), "histórico mostra o segundo envio da mesma pessoa");
  const wa = await page.locator('a:has-text("Abrir no WhatsApp")').getAttribute("href");
  ok(wa.startsWith("https://wa.me/5511988880001?text=") && decodeURIComponent(wa).includes("Oi, Marina!"), "botão do WhatsApp abre wa.me com o modelo preenchido (envio manual)");

  // ação do servidor sem sessão: captura uma requisição real e repete sem o cookie
  let capturada = null;
  page.on("request", (rq) => {
    if (rq.method() === "POST" && rq.headers()["next-action"] && !capturada) capturada = { url: rq.url(), headers: rq.headers(), body: rq.postDataBuffer() };
  });
  await page.fill('textarea[name="nota"]', "Anotação de validação: cliente prefere contato à tarde.");
  await page.click('button:has-text("Salvar anotação")');
  await page.waitForURL(/msg=nota/);
  ok((await page.locator("body").innerText()).includes("cliente prefere contato à tarde"), "anotação salva aparece no histórico");
  const notas = async () => (await sql`select count(*)::int as n from crm_eventos where tipo = 'nota'`)[0].n;
  const n0 = await notas();
  const { cookie: _c, ...semCookie } = capturada.headers;
  const replay = await fetch(capturada.url, { method: "POST", headers: semCookie, body: capturada.body, redirect: "manual" });
  await espera(600);
  ok((await notas()) === n0, `ação do servidor repetida SEM cookie não grava nada (resposta ${replay.status}${replay.headers.get("x-action-redirect") ? ` → ${replay.headers.get("x-action-redirect")}` : ""})`);
  const replayOk = await fetch(capturada.url, { method: "POST", headers: capturada.headers, body: capturada.body, redirect: "manual" });
  await espera(600);
  ok((await notas()) === n0 + 1, `a mesma requisição COM a sessão grava (controle do teste, resposta ${replayOk.status})`);

  await acao(page, 'button:has-text("Registrar como enviada")');
  let [o1] = await sql`select * from crm_oportunidades where id = ${env1.oportunidade_id}`;
  ok(o1.etapa === "aguardando_resposta" && o1.aguardando === "cliente" && o1.primeiro_contato_em && o1.assumida_em && o1.responsavel_id, "registrar contato feito: etapa Aguardando resposta, aguardando o interessado, primeiro contato e responsável gravados");
  const [m1] = await sql`select * from crm_mensagens where oportunidade_id = ${env1.oportunidade_id}`;
  ok(m1.modo === "manual" && m1.status === "registrada" && m1.canal === "whatsapp" && m1.corpo.includes("Oi, Marina!"), "mensagem de WhatsApp fica como “registrada à mão” (sem estado de entrega inventado)");
  await page.goto(`${B}/leads`);
  const link1 = `a[href="/leads/o/${env1.oportunidade_id}"]`;
  ok((await page.locator(`#interessado ${link1}`).count()) === 1 && (await page.locator(`#manual ${link1}, #respostas ${link1}`).count()) === 0, "fila: saiu de “Depende de mim” e está em “Aguardando o interessado”");

  await page.goto(`${B}/leads/o/${env1.oportunidade_id}`);
  await page.fill('form:has(button:has-text("Registrar resposta recebida")) textarea[name="corpo"]', "Pode ser amanhã às 15h?");
  await acao(page, 'button:has-text("Registrar resposta recebida")');
  [o1] = await sql`select * from crm_oportunidades where id = ${env1.oportunidade_id}`;
  ok(o1.etapa === "em_conversa" && o1.aguardando === "nos", "registrar resposta: etapa Em conversa, aguardando o nosso retorno");
  await page.goto(`${B}/leads`);
  ok(/Marina Albuquerque/.test(await page.locator("#respostas").innerText()) && /Disse: Pode ser amanhã às 15h\?/.test(await page.locator("#respostas").innerText()), "fila: aparece em “Respostas aguardando seu retorno”, com a última mensagem");

  await page.goto(`${B}/leads/o/${env1.oportunidade_id}`);
  await page.fill('input[name="texto"]', "Ligar para confirmar o escopo");
  await page.fill('input[name="quando"]', "2026-01-05T10:00");
  await acao(page, 'button:has-text("Salvar retorno")');
  [o1] = await sql`select proxima_acao, proxima_acao_em from crm_oportunidades where id = ${env1.oportunidade_id}`;
  ok(new Date(o1.proxima_acao_em).toISOString() === "2026-01-05T13:00:00.000Z", `próxima ação gravada no fuso de Brasília (${new Date(o1.proxima_acao_em).toISOString()})`);
  await page.goto(`${B}/leads`);
  // a resposta ainda espera retorno, então o item continua em “Respostas”; ao responder, passa a aparecer pelo retorno vencido
  await page.goto(`${B}/leads/o/${env1.oportunidade_id}`);
  await acao(page, 'button:has-text("Registrar como enviada")');
  await page.goto(`${B}/leads`);
  ok(/Retorno vencido/.test(await page.locator("#vencidos").innerText()) && /Ligar para confirmar o escopo/.test(await page.locator("#vencidos").innerText()), "fila: retorno com data passada aparece em “Retornos vencidos”");

  await page.goto(`${B}/leads/o/${env1.oportunidade_id}`);
  await page.selectOption('select[name="etapa"]', "proposta_enviada");
  await page.fill('input[name="valorProposta"]', "4.800,00");
  await acao(page, 'button:has-text("Salvar etapa e valores")');
  [o1] = await sql`select * from crm_oportunidades where id = ${env1.oportunidade_id}`;
  ok(o1.etapa === "proposta_enviada" && Number(o1.valor_proposta) === 4800 && o1.proposta_em && o1.fechado_em === null && o1.valor_fechado === null, "proposta: valor 4.800,00 gravado como proposta, sem virar venda");
  await page.selectOption('select[name="etapa"]', "ganho");
  await page.fill('input[name="valorFechado"]', "4500");
  await acao(page, 'button:has-text("Salvar etapa e valores")');
  [o1] = await sql`select * from crm_oportunidades where id = ${env1.oportunidade_id}`;
  ok(o1.etapa === "ganho" && Number(o1.valor_fechado) === 4500 && Number(o1.valor_proposta) === 4800 && o1.fechado_em && o1.proxima_acao_em === null, "ganho: valor fechado separado do valor da proposta; retorno pendente encerrado");
  // perdido com motivo (segunda oportunidade da Marina)
  const [opLoja] = await sql`select oportunidade_id from crm_envios where id = ${r4.body.id}`;
  await page.goto(`${B}/leads/o/${opLoja.oportunidade_id}`);
  ok((await page.locator("body").innerText()).includes("Outras oportunidades deste contato"), "ficha mostra as outras oportunidades do mesmo contato");
  await page.selectOption('select[name="etapa"]', "perdido");
  await page.fill('input[name="motivoPerda"]', "Sem orçamento agora");
  await acao(page, 'button:has-text("Salvar etapa e valores")');
  const [oLoja] = await sql`select etapa, motivo_perda, perdido_em from crm_oportunidades where id = ${opLoja.oportunidade_id}`;
  ok(oLoja.etapa === "perdido" && oLoja.motivo_perda === "Sem orçamento agora" && oLoja.perdido_em, "perdido: motivo e data gravados");

  // cadastro manual
  await page.goto(`${B}/leads/novo`);
  await page.fill('input[name="nome"]', "Otávio Brandão");
  await page.fill('input[name="whatsapp"]', "(41) 92222-0009");
  await page.fill('input[name="instagram"]', "@otavio.brandao");
  await page.selectOption('select[name="canal"]', "instagram");
  await page.fill('input[name="servico"]', "Automação da rotina");
  await page.fill('textarea[name="mensagem"]', "Perguntou no Direct sobre automação de orçamentos.");
  await page.click('button:has-text("Cadastrar contato")');
  await page.waitForURL(/\/leads\/o\/.*msg=criado/);
  const [man] = await sql`select o.registro, o.canal, o.etapa, c.instagram, (select count(*) from crm_envios e where e.oportunidade_id = o.id)::int as envios from crm_oportunidades o join crm_contatos c on c.id = o.contato_id where c.nome = 'Otávio Brandão'`;
  ok(man.registro === "manual" && man.canal === "instagram" && man.instagram === "otavio.brandao" && man.envios === 0, "cadastro manual: marcado como manual, canal Instagram, sem envio de formulário associado");
  ok((await page.locator("body").innerText()).includes("Cadastro manual") && (await page.locator('a:has-text("Abrir o Direct")').count()) === 0, "ficha do cadastro manual indica a origem manual");
  await page.click('button[role="tab"]:has-text("Instagram")');
  ok((await page.locator('a:has-text("Abrir o Direct")').getAttribute("href")) === "https://ig.me/m/otavio.brandao", "Instagram: botão abre o Direct da pessoa (envio manual)");
  ok(meta.length === 0 && (await page.evaluate(() => typeof window.fbq)) === "undefined", "cadastro manual, mudança de etapa e navegação no CRM não geram nenhum evento para a Meta");
  await page.goto(`${B}/leads/novo`);
  await page.fill('input[name="nome"]', "Otávio B.");
  await page.fill('input[name="whatsapp"]', "41 92222 0009");
  await page.selectOption('select[name="canal"]', "whatsapp");
  await page.click('button:has-text("Cadastrar contato")');
  await page.waitForURL(/msg=contato-existente/);
  ok((await sql`select count(*)::int as n from crm_contatos where whatsapp = '5541922220009'`)[0].n === 1, "cadastro manual com WhatsApp já existente liga ao contato existente (não duplica)");

  // lista, funil, exportação
  await page.goto(`${B}/leads/lista?q=Furtado`);
  ok(/Bianca Furtado/.test(await page.locator("#conteudo").innerText()) && !/Rogério/.test(await page.locator("#conteudo").innerText()), "lista: busca por empresa encontra só o contato certo");
  await page.goto(`${B}/leads/lista?q=97777-0002`);
  ok(/Rogério Tavares/.test(await page.locator("#conteudo").innerText()), "lista: busca por telefone encontra o contato");
  await page.goto(`${B}/leads/lista`);
  ok(!/TESTE — formulário/.test(await page.locator("#conteudo").innerText()), "lista: envios de teste ficam ocultos por padrão");
  await page.goto(`${B}/leads/lista?etapa=ganho`);
  ok(/Marina Albuquerque/.test(await page.locator("#conteudo").innerText()) && /1 oportunidade /.test(await page.locator("#conteudo").innerText()), "lista: filtro por etapa");
  await page.goto(`${B}/leads/funil`);
  const funilTxt = await page.locator("#conteudo").innerText();
  ok(/Ganho \(1\)/.test(funilTxt) && /Fechado: R\$\s4\.500,00/.test(funilTxt) && /Perdido \(1\)/.test(funilTxt), "funil: colunas com contagem; Ganho soma o valor fechado (R$ 4.500,00), não o da proposta");
  const csv = await page.evaluate(() => fetch("/api/leads/exportar").then((r) => r.text()));
  ok(csv.includes('"Marina Albuquerque"') && csv.includes('"Anúncio na Meta"') && !csv.includes("TESTE — formulário"), "exportação CSV com sessão traz as oportunidades (sem testes)");

  // indicadores e custos
  await page.goto(`${B}/leads/indicadores`);
  let ind = await page.locator("#conteudo").innerText();
  const reais = (await sql`select count(*)::int as n from crm_oportunidades where not teste`)[0].n;
  ok(new RegExp(`Contatos recebidos\\s+${reais}\\b`).test(ind), `indicadores: contatos recebidos = ${reais} (testes fora)`);
  ok(/Ganhos\s+1 /.test(ind) && /Vendas fechadas: R\$\s4\.500,00/.test(ind) && /Valor em propostas: R\$\s4\.800,00/.test(ind), "indicadores: proposta (R$ 4.800,00) e venda fechada (R$ 4.500,00) separadas");
  ok(/Sem custos informados para este período/.test(ind), "indicadores: sem custo informado aparece como sem dado, não como zero");
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  await page.fill('#custos input[name="inicio"]', hoje);
  await page.fill('#custos input[name="fim"]', hoje);
  await page.fill('#custos input[name="valor"]', "80,00");
  await page.click('#custos button:has-text("Registrar")');
  await page.waitForURL(/msg=custo-salvo/);
  ind = await page.locator("#custos").innerText();
  ok(/Verba de anúncios na Meta\s+R\$\s80,00/.test(ind) && /Verba da Meta por contato de anúncio\s+R\$\s80,00/.test(ind), "custo informado à mão entra nos indicadores; custo por contato usa só contatos com anúncio declarado na URL (1)");
  ok(/Custo total por cliente\s+R\$\s80,00/.test(ind) && !/Taxa do Autopilot \(Crush\)\s+R\$/.test(ind), "taxa da Crush não é calculada automaticamente (só aparece se informada)");

  // integrações: estado verdadeiro
  await page.goto(`${B}/leads/integracoes`);
  const integ = await page.locator("#conteudo").innerText();
  ok(/Formulários do site\s+Conectado/.test(integ) && /WhatsApp \(YCloud[^)]*\)\s+Não conectado/.test(integ) && /Configuração no servidor:\s*incompleta/.test(integ) && /Instagram Direct\s+Manual/.test(integ) && /Campanhas da Meta[^\n]*\s+Não conectado/.test(integ) && /Crush\s+Não conectado/.test(integ), "integrações: formulários conectados; WhatsApp não conectado (configuração incompleta); Instagram manual; Meta Ads e Crush não conectados");
  ok(/Recebimento: não conectado/.test(integ), "integrações: recebimento de e-mail declarado como não conectado");

  /* ───────────────────────────── mensagens por e-mail ───────────────────────────── */
  secao("Primeiro contato por e-mail, falha e reprocessamento");
  const paraCliente = (email) => emails.filter((e) => e.to?.[0] === email);
  ok(paraCliente("marina@validacao.local").length === 0 && paraCliente("bianca@validacao.local").length === 0 && (await sql`select count(*)::int as n from crm_mensagens where automatica`)[0].n === 0, "automação desligada (padrão): nenhum e-mail automático saiu para os interessados");
  await page.goto(`${B}/leads/configuracoes`);
  await page.check('input[name="canal"][value="whatsapp"]');
  await acao(page, 'button:has-text("Salvar canal")');
  ok(/o WhatsApp ainda não está configurado no servidor/.test(await page.locator("#conteudo").innerText()), "sem credenciais do provedor, o canal WhatsApp não pode ser ligado");
  await page.check('input[name="canal"][value="email"]');
  await acao(page, 'button:has-text("Salvar canal")');
  ok(/Agora: E-mail/.test(await page.locator("#automacao").innerText()), "primeiro contato automático ligado no canal e-mail pela tela de configurações");

  const a1 = await post(lead({ nome: "Helena Prado", empresa: "Prado Arquitetura", whatsapp: "(51) 91111-0010", email: "helena@validacao.local" }));
  const auto1 = await ate(async () => (await sql`select m.* from crm_mensagens m join crm_envios e on e.oportunidade_id = m.oportunidade_id where e.id = ${a1.body.id} and m.status = 'enviada'`)[0]);
  ok(!!auto1 && auto1.automatica && auto1.modo === "sistema" && paraCliente("helena@validacao.local").length === 1, "lead com e-mail: 1 e-mail automático de primeiro contato, aceito pelo provedor");
  const eh = paraCliente("helena@validacao.local")[0];
  ok(eh?.reply_to === "comercial@teste.local" && eh.text.startsWith("Olá, Helena.") && eh.text.includes("Site ou landing page") && eh.idem === `crm-mensagem-${auto1.id}`, "e-mail automático usa o modelo, o endereço de resposta comercial e chave de idempotência");
  const [oh] = await sql`select o.etapa, o.aguardando, o.primeiro_contato_em, o.assumida_em from crm_oportunidades o where o.id = ${auto1.oportunidade_id}`;
  ok(oh.etapa === "aguardando_resposta" && oh.aguardando === "cliente" && oh.primeiro_contato_em && oh.assumida_em === null, "depois do e-mail automático o contato aguarda o interessado, sem contar como atendimento humano");
  await post(lead({ nome: "Helena Prado", whatsapp: "(51) 91111-0010", email: "helena@validacao.local", mensagem: "Reenviando para garantir." }));
  await espera(1500);
  ok(paraCliente("helena@validacao.local").length === 1, "a mesma pessoa reenviando o formulário NÃO recebe outro e-mail automático");
  await post(lead({ nome: "TESTE automação", whatsapp: "(11) 90000-0011", email: "teste.auto@validacao.local" }));
  await espera(1500);
  ok(paraCliente("teste.auto@validacao.local").length === 0, "envio de teste não recebe e-mail automático");

  // falha no envio automático → nova tentativa pela rotina, sem duplicar
  mode = "fail";
  const a2 = await post(lead({ nome: "Caio Menezes", empresa: "Menezes Contabilidade", whatsapp: "(61) 91212-0012", email: "caio@validacao.local" }));
  const auto2 = await ate(async () => (await sql`select m.* from crm_mensagens m join crm_envios e on e.oportunidade_id = m.oportunidade_id where e.id = ${a2.body.id} and m.status = 'falhou'`)[0]);
  ok(!!auto2 && auto2.tentativas === 1, `falha do provedor no e-mail automático: mensagem marcada como falhou (${auto2?.erro})`);
  await page.goto(`${B}/leads`);
  ok(/Caio Menezes/.test(await page.locator("#manual").innerText()), "fila: a falha aparece em “Falhas e contatos que pedem ação manual”");
  mode = "ok";
  await cron();
  await ate(async () => (await sql`select status from crm_mensagens where id = ${auto2.id}`)[0].status === "enviada");
  const tc = paraCliente("caio@validacao.local");
  ok((await sql`select status, tentativas from crm_mensagens where id = ${auto2.id}`)[0].status === "enviada" && tc.filter((e) => e.aceito).length === 1 && tc.every((e) => e.idem === `crm-mensagem-${auto2.id}`), "a rotina reenvia: 1 e-mail aceito, mesma chave de idempotência nas tentativas");
  await cron();
  await espera(600);
  ok(paraCliente("caio@validacao.local").filter((e) => e.aceito).length === 1 && (await sql`select count(*)::int as n from crm_mensagens where oportunidade_id = ${auto2.oportunidade_id}`)[0].n === 1, "reprocessar não duplica a mensagem");
  ok((await sql`select status from crm_tarefas where oportunidade_id = ${auto2.oportunidade_id}`)[0].status === "concluida", "a tarefa de primeiro contato fica concluída quando o e-mail sai na nova tentativa");

  // falha → pessoa assume → automação para
  mode = "fail";
  const a3 = await post(lead({ nome: "Lívia Santoro", empresa: "Santoro Eventos", whatsapp: "(71) 91313-0013", email: "livia@validacao.local" }));
  const auto3 = await ate(async () => (await sql`select m.* from crm_mensagens m join crm_envios e on e.oportunidade_id = m.oportunidade_id where e.id = ${a3.body.id} and m.status = 'falhou'`)[0]);
  mode = "ok";
  await page.goto(`${B}/leads/o/${auto3.oportunidade_id}`);
  await page.click('button:has-text("Assumir atendimento")');
  await ate(async () => (await sql`select assumida_em from crm_oportunidades where id = ${auto3.oportunidade_id}`)[0].assumida_em);
  await cron();
  await espera(800);
  ok((await sql`select status from crm_mensagens where id = ${auto3.id}`)[0].status === "cancelada" && paraCliente("livia@validacao.local").filter((e) => e.aceito).length === 0, "ao assumir o atendimento, a mensagem automática pendente é cancelada e não sai mais");
  await post(lead({ nome: "Lívia Santoro", whatsapp: "(71) 91313-0013", email: "livia@validacao.local", mensagem: "Alguma novidade?" }));
  await espera(1500);
  ok(paraCliente("livia@validacao.local").filter((e) => e.aceito).length === 0 && (await sql`select aguardando from crm_oportunidades where id = ${auto3.oportunidade_id}`)[0].aguardando === null, "depois de assumida, novo envio da pessoa não reinicia a automação");

  // e-mail manual pelo CRM: uma vez, mesmo com envio repetido
  let acaoEmail = null;
  page.on("request", (rq) => {
    if (rq.method() === "POST" && rq.headers()["next-action"] && rq.postDataBuffer()?.toString("latin1").includes('chave"')) acaoEmail = { url: rq.url(), headers: rq.headers(), body: rq.postDataBuffer() };
  });
  await page.goto(`${B}/leads/o/${auto3.oportunidade_id}`);
  await page.click('button[role="tab"]:has-text("E-mail")');
  await page.click('button:has-text("Enviar pelo CRM")');
  await page.waitForURL(/msg=email-enviado/);
  ok(paraCliente("livia@validacao.local").filter((e) => e.aceito).length === 1, "e-mail manual pelo CRM: 1 e-mail aceito para o interessado");
  await fetch(acaoEmail.url, { method: "POST", headers: acaoEmail.headers, body: acaoEmail.body, redirect: "manual" });
  await espera(800);
  ok(paraCliente("livia@validacao.local").filter((e) => e.aceito).length === 1 && (await sql`select count(*)::int as n from crm_mensagens where oportunidade_id = ${auto3.oportunidade_id} and not automatica`)[0].n === 1, "repetir o mesmo envio (clique duplo, reenvio do formulário) não manda o e-mail de novo");
  const [ol] = await sql`select etapa, aguardando from crm_oportunidades where id = ${auto3.oportunidade_id}`;
  ok(ol.etapa === "aguardando_resposta" && ol.aguardando === "cliente", "depois do e-mail manual a oportunidade aguarda a resposta do interessado");

  /* ───────────────────────────── evento Lead ───────────────────────────── */
  secao("Evento Lead preservado (com o CRM ligado)");
  const { ctx: ctxPub } = await contexto();
  const pub = await ctxPub.newPage();
  await pub.goto(`${B}/diagnostico-site?utm_source=meta&utm_campaign=leads-gerais&fbclid=IwAR0xyz`);
  await pub.waitForFunction(() => (window.__fb ?? []).some((a) => a[1] === "PageView"));
  const fb = () => pub.evaluate(() => window.__fb ?? []);
  ok((await fb()).filter((a) => a[1] === "Lead").length === 0, "abrir a página não gera Lead");
  await pub.fill("#diag-site", "validacao-crm.com.br");
  await pub.fill('input[autocomplete="name"]', "Paula Nogueira");
  await pub.fill('input[type="tel"]', "11955550014");
  ok((await fb()).filter((a) => a[1] === "Lead").length === 0 && (await fb()).filter((a) => a[1] === "FormStart").length === 1, "iniciar o formulário gera FormStart (1), não Lead");
  const [resp] = await Promise.all([pub.waitForResponse((r) => r.url().endsWith("/api/lead")), pub.click('#solicitar button[type="submit"]')]);
  const idLead = (await resp.json()).id;
  await pub.waitForFunction(() => (window.__fb ?? []).some((a) => a[1] === "Lead"));
  const leadsFb = (await fb()).filter((a) => a[1] === "Lead");
  ok(leadsFb.length === 1 && leadsFb[0][3]?.eventID === idLead, "envio aceito: exatamente 1 Lead, com eventID = id do lead");
  const [envPub] = await sql`select e.id, o.utm, o.origem from crm_envios e join crm_oportunidades o on o.id = e.oportunidade_id where e.id = ${idLead}`;
  ok(envPub?.id === idLead && envPub.utm.fbclid === "IwAR0xyz" && envPub.origem === "diagnostico-site", "o mesmo id está gravado no CRM, com origem e UTMs");
  ok(!JSON.stringify(await fb()).match(/Paula|11955550014|validacao-crm/), "nenhum dado pessoal nos eventos do Pixel");
  await ctxPub.close();
  await page.goto(`${B}/leads/o/${(await sql`select oportunidade_id from crm_envios where id = ${idLead}`)[0].oportunidade_id}`);
  const fichaPub = await page.locator("#conteudo").innerText();
  ok(/Declarado na URL: utm_source=meta/.test(fichaPub), "ficha: fonte lida da UTM declarada");
  const soFb = await post(lead({ nome: "Diego Farias", whatsapp: "(85) 91414-0015", email: "diego@validacao.local", utm: { fbclid: "IwAR0so" } }));
  await page.goto(`${B}/leads/o/${(await sql`select oportunidade_id from crm_envios where id = ${soFb.body.id}`)[0].oportunidade_id}`);
  const fichaFb = await page.locator("#conteudo").innerText();
  ok(/Clique vindo da Meta/.test(fichaFb) && /Não identifica campanha nem comprova que foi anúncio/.test(fichaFb) && !/Anúncio na Meta/.test(fichaFb), "fbclid sozinho NÃO é tratado como anúncio nem como campanha identificada");
  ok(meta.length === 0, "nenhuma requisição à Meta saiu das páginas do CRM durante todo o teste");

  /* ───────────────────────────── celular ───────────────────────────── */
  secao("Celular (390 px)");
  const { ctx: ctxM } = await contexto({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctxM.addCookies([{ name: "spolaor_crm", value: cookie.value, url: B }]);
  const m = await ctxM.newPage();
  for (const p of ["/leads", "/leads/lista", "/leads/funil", "/leads/indicadores", "/leads/integracoes", "/leads/configuracoes", "/leads/novo", `/leads/o/${env1.oportunidade_id}`]) {
    await m.goto(`${B}${p}`);
    const larg = await m.evaluate(() => {
      // maior borda direita de qualquer elemento do conteúdo, fora das faixas feitas para rolar de lado
      let max = 0;
      for (const el of document.querySelectorAll("#conteudo *")) {
        if (el.closest(".overflow-x-auto")) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > max) max = r.right;
      }
      return { doc: document.documentElement.scrollWidth, borda: Math.round(max), tela: window.innerWidth };
    });
    ok(larg.doc <= larg.tela + 1 && larg.borda <= larg.tela + 1, `${p.replace(/\/o\/.*/, "/o/[id]")}: nada passa da borda da tela no celular (conteúdo até ${larg.borda} px de ${larg.tela})`);
  }
  await m.goto(`${B}/leads`);
  ok(await m.locator('nav[aria-label="Seções do CRM"] >> visible=true').first().isVisible(), "navegação fixa no rodapé visível no celular");
  await ctxM.close();

  /* ───────────────────────────── pedido, ficha e fila ───────────────────────────── */
  secao("Pedido: contexto antes das ações (formulário → ficha → fila)");
  // Automação de primeiro contato desligada nesta seção (o padrão em produção), para ver a situação “Novo pedido”.
  await sql`insert into crm_config (chave, valor) values ('automacao:primeiro-contato', ${sql.json({ canal: "desligado" })}) on conflict (chave) do update set valor = excluded.valor`;
  const dado = async (pg, rotulo) => (await pg.locator(`#pedido [data-dado="${rotulo}"]`).first().innerText().catch(() => "")).replace(/\s+/g, " ");
  const UTM_AD = { utm_source: "facebook", utm_medium: "paid", utm_campaign: "Teste pedido", utm_content: "video_v2", campaign_id: "120200000000000011", adset_id: "120200000000000012", ad_id: "120200000000000013" };

  // validação do pedido geral
  const semResp = await post({ tipo: "analise", formulario: "pedido", pedido: "loja", origem: "home", pagina: "/", nome: "Paula Teixeira", empresa: "", whatsapp: "(74) 99100-2001", email: "", mensagem: "  " });
  const semPedido = await post({ tipo: "analise", formulario: "pedido", origem: "home", pagina: "/", nome: "Paula Teixeira", empresa: "", whatsapp: "(74) 99100-2001", email: "", mensagem: "Quero vender online" });
  const pedidoInvalido = await post({ tipo: "analise", formulario: "pedido", pedido: "foguete", origem: "home", pagina: "/", nome: "Paula Teixeira", empresa: "", whatsapp: "(74) 99100-2001", email: "", mensagem: "Quero vender online" });
  ok(semResp.status === 422 && !!semResp.body.errors?.mensagem && semPedido.status === 422 && !!semPedido.body.errors?.pedido && pedidoInvalido.status === 422, "pedido geral: resposta da pergunta e serviço são obrigatórios; serviço fora da lista é recusado (422)");

  // pedido completo pela home, vindo de anúncio: sem negócio (começando), com Instagram, sem e-mail
  const rp = await post({ tipo: "analise", formulario: "pedido", pedido: "loja", origem: "home", pagina: "/", nome: "Paula Teixeira", empresa: "", semEmpresa: true, whatsapp: "(74) 99100-2001", email: "", site: "@Paula.Doces", semSite: false, mensagem: "Vendo doces pelo Instagram e anoto as encomendas no caderno.", referrer: "https://instagram.com/", utm: UTM_AD });
  ok(rp.status === 200 && !!rp.body.id, `pedido geral aceito sem nome do negócio e sem e-mail (${rp.status})`);
  const [op] = await sql`select o.*, c.instagram, c.site as c_site, c.empresa as c_empresa from crm_envios e join crm_oportunidades o on o.id = e.oportunidade_id join crm_contatos c on c.id = o.contato_id where e.id = ${rp.body.id}`;
  ok(op?.categoria === "lojas" && op.servico === "Pedido: Loja virtual" && op.dados.pedido === "loja" && op.dados.pergunta === "O que você vende e como quer receber os pedidos?" && op.dados.formulario === "pedido", `serviço vem da resposta: categoria=${op?.categoria}, pergunta gravada com a resposta`);
  ok(op?.instagram === "paula.doces" && op.c_site === null && op.c_empresa === null && op.dados.semEmpresa === true, "@ do Instagram vai para o Instagram do contato (não vira site); negócio vazio fica “começando”");
  await page.goto(`${B}/leads/o/${op.id}`);
  ok(/Loja virtual/.test(await dado(page, "Serviço solicitado")) && /Resposta do visitante/.test(await dado(page, "Serviço solicitado")), "ficha: serviço solicitado é a resposta do visitante, dita como tal");
  ok(/Lojas virtuais/.test(await dado(page, "Classificação interna")) && /Pela resposta do visitante/.test(await dado(page, "Classificação interna")), "ficha: classificação interna separada, com o motivo");
  const objetivo = await page.locator("#pedido").innerText();
  ok(objetivo.includes("O que você vende e como quer receber os pedidos?") && objetivo.includes("Vendo doces pelo Instagram e anoto as encomendas no caderno."), "ficha: pergunta mostrada e resposta original, sem resumo");
  ok(/Ainda está começando/.test(await dado(page, "Negócio (informado)")) && /@paula\.doces/.test(await dado(page, "Instagram (informado)")) && /Paula Teixeira/.test(await dado(page, "Nome (informado)")), "ficha: nome, negócio (começando) e Instagram informados");
  ok(/^Página do envio \/ /.test(await dado(page, "Página do envio") + " ") && /Pedido: o que você precisa/.test(await dado(page, "Formulário")), "ficha: página e formulário de entrada");
  ok(/campanha 120200000000000011 · conjunto 120200000000000012 · anúncio 120200000000000013/.test(await dado(page, "Identificadores do anúncio")) && /Teste pedido/.test(await dado(page, "Campanha")) && /video_v2/.test(await dado(page, "Anúncio (utm_content)")) && /Anúncio na Meta/.test(await dado(page, "Fonte")), "ficha: origem com campanha e identificadores do anúncio");
  ok(/Recebido em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/.test(await page.locator("#pedido").innerText()), "ficha: data completa do pedido");
  const ordem = await page.evaluate(() => {
    const pedido = document.querySelector("#pedido");
    const falar = [...document.querySelectorAll("h2, h3, p, span")].find((e) => /^Falar com /.test(e.textContent?.trim() ?? ""));
    return pedido && falar ? pedido.getBoundingClientRect().top < falar.getBoundingClientRect().top : false;
  });
  ok(ordem, "ficha (computador): o pedido vem antes das ações de atendimento");

  // registro antigo, como os do Aldair: diagnóstico da home sem mensagem, sem site, sem serviço escolhido
  const ANTIGO = { tipo: "analise", origem: "home", pagina: "/", nome: "Contato Antigo", empresa: "Negócio Antigo", whatsapp: "(74) 99100-3003", email: "antigo@validacao.local", segmento: "Clínica ou consultório", problema: "Contatos espalhados entre WhatsApp, planilha e e-mail", mensagem: "", referrer: "https://instagram.com/", utm: UTM_AD };
  const ra = await post(ANTIGO);
  // 70 s depois (mesma visita), pela /analise, com outro segmento: antes abria uma segunda oportunidade
  const rb = await post({ ...ANTIGO, origem: "pagina-analise", pagina: "/analise", entrada: "/", segmento: "Corretor de imóveis" });
  const [oa] = await sql`select o.* from crm_envios e join crm_oportunidades o on o.id = e.oportunidade_id where e.id = ${ra.body.id}`;
  const [ob] = await sql`select oportunidade_id from crm_envios where id = ${rb.body.id}`;
  ok(ra.status === 200 && rb.status === 200 && oa.categoria === "a-classificar" && oa.servico === "Diagnóstico geral (home)", "envio no formato antigo continua aceito; rótulo da página gravado como antes");
  ok(ob.oportunidade_id === oa.id && (await sql`select count(*)::int as n from crm_envios where oportunidade_id = ${oa.id}`)[0].n === 2, "mesmo pedido pela home e pela /analise: segundo envio entra na MESMA oportunidade (antes abria outra)");
  await page.goto(`${B}/leads/o/${oa.id}`);
  ok(/Não informado/.test(await dado(page, "Serviço solicitado")) && /não perguntava qual serviço/.test(await dado(page, "Serviço solicitado")), "registro antigo: serviço solicitado “Não informado”, com o motivo");
  ok(/Serviço não identificado/.test(await dado(page, "Classificação interna")) && /Rótulo antigo da página: “Diagnóstico geral \(home\)” \(valor fixo, não foi escolha do visitante\)/.test(await dado(page, "Classificação interna")), "registro antigo: “Serviço não identificado”, e “Diagnóstico geral” explicado como valor fixo da página");
  const txtAntigo = await page.locator("#pedido").innerText();
  ok(txtAntigo.includes("O que mais pesa hoje? (escolha da lista)") && txtAntigo.includes("Contatos espalhados entre WhatsApp, planilha e e-mail"), "registro antigo: objetivo = a escolha da lista, dita como escolha");
  ok(/Não informado/.test(await dado(page, "Conte mais, se quiser (opcional)")) && /Não informado/.test(await dado(page, "Site ou Instagram (informado)")) && /versão anterior/.test(await dado(page, "Formulário")), "registro antigo: mensagem e site ausentes aparecem como “Não informado”; formulário antigo identificado");
  ok((await page.locator("#pedido [data-dado]").evaluateAll((els) => els.filter((e) => e.textContent.trim() === "" ).length)) === 0, "registro antigo: nenhum campo vazio sem rótulo na ficha");
  ok((await page.content()).includes("/analise") && (await page.locator("li", { hasText: "/analise" }).count()) > 0, "ficha lista os dois envios, cada um com a página");
  ok(!(await page.locator("#pedido").innerText()).includes("Diagnóstico geral (home)  ") && !(await page.locator("header").first().innerText()).includes("Diagnóstico geral"), "cabeçalho da ficha não apresenta “Diagnóstico geral” como pedido");

  // dois pedidos diferentes da mesma pessoa em poucos minutos: oportunidades separadas, com aviso de proximidade
  const rc = await post({ tipo: "analise", formulario: "pedido", pedido: "site", origem: "home", pagina: "/", nome: "Paula Teixeira", empresa: "", whatsapp: "(74) 99100-2001", email: "", mensagem: "Também quero um site simples." });
  const [oc] = await sql`select oportunidade_id from crm_envios where id = ${rc.body.id}`;
  ok(oc.oportunidade_id !== op.id, "mesma pessoa, outro serviço escolhido: oportunidade separada (nada é unido sozinho)");
  await page.goto(`${B}/leads/o/${oc.oportunidade_id}`);
  ok((await page.locator("[data-pedido-vizinho]").count()) === 1 && /não une registros sozinho/.test(await page.locator("[data-pedido-vizinho]").innerText()), "ficha avisa que há outro pedido da mesma pessoa a menos de 30 minutos");

  // fila: serviço, prévia útil e situação (novo pedido, aguardando atendimento, falha de envio com o motivo)
  await page.goto(`${B}/leads`);
  const itemNovo = page.locator(`[data-oportunidade="${op.id}"]`).first();
  ok((await itemNovo.locator('[data-estado="novo"]').innerText()) === "Novo pedido" && /Loja virtual/.test(await itemNovo.locator("[data-fila-servico]").innerText()) && /Vendo doces pelo Instagram/.test(await itemNovo.locator("[data-fila-previa]").innerText()), "fila: “Novo pedido”, serviço pedido e prévia com as palavras da pessoa");
  const itemAntigo = page.locator(`[data-oportunidade="${oa.id}"]`).first();
  ok(/Serviço não identificado/.test(await itemAntigo.locator("[data-fila-servico]").innerText()) && /Escolheu “Contatos espalhados/.test(await itemAntigo.locator("[data-fila-previa]").innerText()), "fila: registro antigo mostra “Serviço não identificado” e a escolha da lista como prévia");
  await sql`update crm_envios set aviso_status = 'falhou', aviso_erro = 'Provedor de e-mail recusou o envio (HTTP 500)' where id = ${ra.body.id}`;
  await sql`update crm_oportunidades set aguardando = 'nos', pendencia = 'resposta', etapa = 'em_conversa', primeiro_contato_em = now() where id = ${oc.oportunidade_id}`;
  await page.goto(`${B}/leads`);
  const itemFalha = page.locator(`[data-oportunidade="${oa.id}"]`).first();
  ok((await itemFalha.locator('[data-estado="falha"]').innerText()) === "Falha de envio" && /Aviso interno por e-mail não enviado: Provedor de e-mail recusou o envio \(HTTP 500\)/.test(await itemFalha.locator("[data-falha-motivo]").innerText()), "fila: “Falha de envio” com o motivo visível");
  ok((await page.locator(`[data-oportunidade="${oc.oportunidade_id}"] [data-estado="aguardando"]`).first().innerText()) === "Aguardando atendimento", "fila: “Aguardando atendimento” separado de novo pedido e de falha");
  await page.goto(`${B}/leads/lista`);
  ok(/Pedido: Vendo doces pelo Instagram/.test(await page.locator("#conteudo").innerText()) && (await page.locator('[data-estado="falha"]').count()) >= 1, "lista: prévia do pedido e situação também na lista");
  await sql`update crm_envios set aviso_status = 'enviado', aviso_erro = null where id = ${ra.body.id}`;

  // celular: o pedido vem logo no começo da ficha, antes de "Falar com"
  {
    const { ctx: ctxP } = await contexto({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctxP.addCookies([{ name: "spolaor_crm", value: cookie.value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
    const mp = await ctxP.newPage();
    await mp.goto(`${B}/leads/o/${op.id}`);
    const pos = await mp.evaluate(() => {
      const pedido = document.querySelector("#pedido");
      const falar = [...document.querySelectorAll("h2, h3, p, span")].find((e) => /^Falar com /.test(e.textContent?.trim() ?? ""));
      return { pedido: pedido?.getBoundingClientRect().top ?? -1, falar: falar?.getBoundingClientRect().top ?? -1, largura: document.documentElement.scrollWidth };
    });
    ok(pos.pedido > 0 && pos.pedido < pos.falar && pos.largura <= 391, `ficha no celular: pedido (${Math.round(pos.pedido)} px) antes de “Falar com” (${Math.round(pos.falar)} px), sem rolagem lateral`);
    await ctxP.close();
  }

  // sair encerra a sessão
  await page.click('button:has-text("Sair")');
  await page.waitForURL(`${B}/leads/entrar`);
  const depois = await fetch(`${B}/leads`, { redirect: "manual", headers: { cookie: `spolaor_crm=${cookie.value}` } });
  ok(depois.status === 307 && (await sql`select count(*)::int as n from crm_sessoes`)[0].n === 0, "sair apaga a sessão no banco: o cookie antigo não serve mais");
  // teto diário de erros: com 25 erros nas últimas 24 h, nenhum código novo é emitido nem aceito
  await sql`update crm_login_codigos set tentativas = 25 where id = (select id from crm_login_codigos where email = ${DONO} order by criado_em desc limit 1)`;
  const codigosAntes = (await sql`select count(*)::int as n from crm_login_codigos`)[0].n;
  const emailsAntes = emails.filter((e) => e.to?.[0] === DONO).length;
  await page.goto(`${B}/leads/entrar`);
  await page.fill('input[name="email"]', DONO);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="codigo"]');
  await espera(500);
  ok((await sql`select count(*)::int as n from crm_login_codigos`)[0].n === codigosAntes && emails.filter((e) => e.to?.[0] === DONO).length === emailsAntes, "teto diário de códigos errados: depois de 25 erros em 24 h, nenhum código novo é emitido para o e-mail");
  ok(erros.length === 0, `sem erros de JavaScript nas páginas do CRM${erros.length ? `: ${erros.join(" | ")}` : ""}`);
} catch (e) {
  falhas++;
  out.push(`FALHA erro inesperado: ${e.stack ?? e}`);
} finally {
  await browser.close();
  await sql.end();
  provedor.close();
}
out.push(`\n${out.filter((l) => l.startsWith("OK")).length} OK · ${falhas} falha(s)`);
console.log(out.join("\n"));
process.exit(falhas ? 1 : 0);
