// Teste local do WhatsApp no CRM com provedor SIMULADO: YCloud falsa (:4040), QStash falso (:4030), e-mail falso
// (:4010) e Postgres local. Nada sai da máquina: nenhuma mensagem real, nenhum número real, nenhum evento para a Meta.
// Passar aqui NÃO prova que a integração real funciona; prova as regras do CRM contra o contrato documentado.
//
// Preparação: a mesma de scripts/teste-crm.mjs (container spolaor-crm-teste-pg e build com Pixel e e-mail falsos).
// Servidor:
//   DATABASE_URL=postgres://postgres:teste-local@127.0.0.1:15433/postgres CRM_ACESSO_EMAILS=dono@teste.local
//   CRM_EMAIL_REPLY_TO=comercial@teste.local CRON_SECRET=teste-cron RESEND_API_KEY=teste LEAD_EMAIL_TO=destino@teste.local
//   LEAD_EMAIL_FROM="Site <site@teste.local>" RESEND_API_URL=http://localhost:4010/
//   YCLOUD_API_KEY=teste-ycloud YCLOUD_API_URL=http://localhost:4040 YCLOUD_WEBHOOK_SECRET=whsec_teste
//   WHATSAPP_NUMERO=5547900000000 QSTASH_TOKEN=teste-qstash QSTASH_URL=http://localhost:4030 IA_URL_PUBLICA=http://localhost:3100
//   node node_modules/next/dist/bin/next start --port 3100
// Uso: CRM_TESTE_DATABASE_URL=postgres://postgres:teste-local@127.0.0.1:15433/postgres node scripts/teste-crm-whatsapp.mjs
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { chromium } from "playwright-core";

const B = "http://localhost:3100";
const DB = process.env.CRM_TESTE_DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):/.test(DB)) {
  console.error("Defina CRM_TESTE_DATABASE_URL apontando para um Postgres LOCAL (127.0.0.1). O teste apaga os dados das tabelas crm_*.");
  process.exit(2);
}
const DONO = "dono@teste.local";
const SEGREDO = "whsec_teste";
const NUMERO = "+5547900000000";
const AVISO = "2026-11-16";
const MODELO = "primeiro_contato_site";
const sql = postgres(DB, { max: 3, onnotice: () => {} });

const out = [];
let falhas = 0;
const ok = (c, m) => {
  if (!c) falhas++;
  out.push(`${c ? "OK   " : "FALHA"} ${m}`);
};
const secao = (t) => out.push(`\n── ${t} ──`);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function ate(fn, ms = 10000) {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v || Date.now() - t > ms) return v;
    await espera(120);
  }
}
const ler = (req) =>
  new Promise((res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => res(b));
  });

/* ── e-mail falso ── */
const emails = [];
const resend = http
  .createServer(async (req, res) => {
    emails.push(JSON.parse((await ler(req)) || "{}"));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(`{"id":"fake-${emails.length}"}`);
  })
  .listen(4010);

/* ── YCloud falsa ── */
const yc = { envios: [], modo: "ok", modeloStatus: "APPROVED", modeloCategoria: "UTILITY", numeroStatus: "CONNECTED", seq: 0 };
const TEXTO_MODELO = "Olá, {{1}}! Aqui é a Spolaor Tecnologia. Recebemos {{2}} pelo nosso site. Posso continuar seu atendimento por aqui?";
const ycloud = http
  .createServer(async (req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers["x-api-key"] !== "teste-ycloud") return json(401, { error: { status: 401, code: "UNAUTHORIZED" } });
    if (req.method === "GET" && req.url.startsWith("/whatsapp/templates")) {
      return json(200, { items: [{ name: MODELO, language: "pt_BR", status: yc.modeloStatus, category: yc.modeloCategoria, qualityRating: "UNKNOWN", components: [{ type: "BODY", text: TEXTO_MODELO }] }] });
    }
    if (req.method === "GET" && req.url.startsWith("/whatsapp/phoneNumbers")) {
      return json(200, { items: [{ phoneNumber: NUMERO, status: yc.numeroStatus, qualityRating: "GREEN", messagingLimit: "TIER_250", verifiedName: "Spolaor Tecnologia" }] });
    }
    if (req.method === "POST" && req.url === "/whatsapp/messages/sendDirectly") {
      const body = JSON.parse((await ler(req)) || "{}");
      const modo = yc.modo;
      const reg = { ...body, modo, id: null, wamid: null };
      yc.envios.push(reg);
      if (modo === "queda") return req.socket.destroy(); // o provedor "aceitou" e a resposta se perdeu
      if (modo === "500") return json(500, { error: { status: 500, code: "INTERNAL_SERVER_ERROR" } });
      if (modo === "429") return json(429, { error: { status: 429, code: "TOO_MANY_REQUESTS" } });
      if (modo === "janela") return json(400, { error: { status: 400, code: "BAD_REQUEST", whatsappApiError: { code: "131047", message: "Re-engagement message" } } });
      if (modo === "numero") return json(403, { error: { status: 403, code: "WHATSAPP_PHONE_NUMBER_UNAVAILABLE", message: "unavailable" } });
      if (modo === "modelo") return json(403, { error: { status: 403, code: "WHATSAPP_TEMPLATE_UNAVAILABLE", message: "missing" } });
      reg.id = `yc_${++yc.seq}`;
      reg.wamid = `wamid.API${yc.seq}`;
      return json(200, { id: reg.id, wamid: reg.wamid, status: "accepted", from: body.from, to: body.to, type: body.type, externalId: body.externalId });
    }
    json(404, { error: { status: 404, code: "NOT_FOUND" } });
  })
  .listen(4040);
const enviosPara = (digitos) => yc.envios.filter((e) => e.to === `+${digitos}`);

/* ── QStash falso: publica e entrega logo em seguida ── */
const qs = { publicados: [], modo: "ok" };
const qstash = http
  .createServer(async (req, res) => {
    const corpo = await ler(req);
    const destino = decodeURIComponent(req.url.replace("/v2/publish/", ""));
    qs.publicados.push({ destino, corpo, dedup: req.headers["upstash-deduplication-id"], auth: req.headers["upstash-forward-authorization"], modo: qs.modo });
    if (req.headers.authorization !== "Bearer teste-qstash") {
      res.writeHead(401);
      return res.end("{}");
    }
    if (qs.modo === "falha") {
      res.writeHead(500);
      return res.end("{}");
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"messageId":"msg_fake"}');
    if (qs.modo === "some") return; // aceitou e nunca entregou
    setTimeout(() => fetch(destino, { method: "POST", headers: { authorization: req.headers["upstash-forward-authorization"], "content-type": "application/json" }, body: corpo }).catch(() => {}), 30);
  })
  .listen(4030);

/* ── ajudantes ── */
let evSeq = 0;
async function webhook(type, payload, { id, t, segredo = SEGREDO, assinatura } = {}) {
  const corpo = JSON.stringify({ id: id ?? `evt_${++evSeq}_${Date.now()}`, type, apiVersion: "v2", createTime: new Date().toISOString(), ...payload });
  const ts = t ?? Math.floor(Date.now() / 1000);
  const s = assinatura ?? createHmac("sha256", segredo).update(`${ts}.${corpo}`).digest("hex");
  const r = await fetch(`${B}/api/leads/webhooks/ycloud`, { method: "POST", headers: { "content-type": "application/json", "ycloud-signature": `t=${ts},s=${s}` }, body: corpo });
  return r.status;
}
let waSeq = 0;
const novaWamid = () => `wamid.IN${++waSeq}_${Date.now()}`;
const recebida = (de, texto, x = {}) =>
  webhook(x.evento ?? "whatsapp.inbound_message.received", {
    ...(x.topo ?? {}),
    whatsappInboundMessage: { id: x.id ?? `in_${++waSeq}_${Date.now()}`, wamid: x.wamid ?? novaWamid(), wabaId: "waba", from: de ? `+${de}` : undefined, fromUserId: x.usuario, to: NUMERO, customerProfile: { name: x.nome ?? "Perfil WhatsApp" }, sendTime: x.em ?? new Date().toISOString(), type: x.tipo ?? "text", ...(x.tipo && x.tipo !== "text" ? (x.conteudo ?? {}) : { text: { body: texto } }), ...(x.contexto ? { context: { id: x.contexto } } : {}) },
  }, x.opcoes);
const eco = (para, texto, x = {}) =>
  webhook(x.evento ?? "whatsapp.smb.message.echoes", {
    whatsappMessage: { id: x.id ?? `eco_${++waSeq}_${Date.now()}`, wamid: x.wamid ?? `wamid.APP${++waSeq}_${Date.now()}`, wabaId: "waba", from: NUMERO, to: `+${para}`, type: "text", text: { body: texto }, status: "sent", sendTime: x.em ?? new Date().toISOString(), createTime: x.em ?? new Date().toISOString() },
  });
const estado = (m, status, x = {}) =>
  webhook("whatsapp.message.updated", {
    whatsappMessage: { id: m.id ?? undefined, wamid: m.wamid ?? undefined, externalId: m.externalId, wabaId: "waba", from: NUMERO, status, type: "template", sendTime: x.sendTime, deliverTime: x.deliverTime, readTime: x.readTime, ...(x.erro ? { errorCode: x.erro, errorMessage: "erro" } : {}) },
  });
const post = (body) => fetch(`${B}/api/lead`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let pessoa = 0;
const lead = (x = {}) => ({ tipo: "projeto", origem: "sites", pagina: "/sites", nome: `Pessoa ${++pessoa} Validação`, empresa: "Empresa (validação local)", whatsapp: `479${String(90000000 + pessoa)}`, email: `pessoa${pessoa}@validacao.local`, mensagem: "Preciso de um site novo.", utm: {}, aviso: AVISO, ...x });
const fone = (l) => `55${l.whatsapp.replace(/\D/g, "")}`;
/** Hora ISO de `seg` segundos atrás: as mensagens simuladas ficam antes das ações feitas na hora real. */
const ha = (seg) => new Date(Date.now() - seg * 1000).toISOString();
const cron = () => fetch(`${B}/api/atendimento-ia/cron`, { headers: { authorization: "Bearer teste-cron" } }).then((r) => r.status);
const tarefaHttp = (id, auth = "Bearer teste-cron") => fetch(`${B}/api/leads/tarefas`, { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify({ id }) }).then((r) => r.status);
const op = async (envioId) => (await sql`select o.*, c.whatsapp, c.wa_bloqueado_em, c.id as cid from crm_envios e join crm_oportunidades o on o.id = e.oportunidade_id join crm_contatos c on c.id = o.contato_id where e.id = ${envioId}`)[0];
const opId = async (id) => (await sql`select o.*, c.whatsapp, c.wa_bloqueado_em from crm_oportunidades o join crm_contatos c on c.id = o.contato_id where o.id = ${id}`)[0];
const tarefa = async (oportunidadeId) => (await sql`select * from crm_tarefas where oportunidade_id = ${oportunidadeId}`)[0];
const msgs = (oportunidadeId) => sql`select * from crm_mensagens where oportunidade_id = ${oportunidadeId} order by coalesce(ocorrida_em, criado_em), criado_em`;
const tarefaEm = (oportunidadeId, ...status) => ate(async () => { const t = await tarefa(oportunidadeId); return t && status.includes(t.status) ? t : null; });
/** Envia um formulário e espera a tarefa terminar. */
async function novoLead(x = {}, statusEsperado = ["concluida", "cancelada", "falhou", "incerta"]) {
  const l = lead(x);
  const r = await post(l);
  const o = await op(r.body.id);
  let t = o ? await tarefaEm(o.id, ...statusEsperado) : null;
  // "pendente" é também o estado inicial: espera a publicação na fila terminar para a foto ser a definitiva.
  if (t?.status === "pendente") t = (await ate(async () => { const x = await tarefa(o.id); return x.publicada_em || x.tentativas > 0 ? x : null; }, 4000)) ?? (await tarefa(o.id));
  return { l, r, o: o ? await opId(o.id) : null, t, fone: fone(l) };
}

// Esquema aplicado pelo servidor na primeira conexão; depois, dados zerados.
await fetch(`${B}/leads/entrar`).catch(() => {});
await post({ website: "x" });
await post(lead({ nome: "TESTE criação do esquema", whatsapp: "(11) 90000-0000", email: "esquema@validacao.local", aviso: undefined }));
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
yc.envios.length = 0;
qs.publicados.length = 0;
pessoa = 0;

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
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
async function acao(page, seletor) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]), page.click(seletor)]);
  await page.waitForLoadState("networkidle");
  await espera(300);
}
const texto = (page, sel = "#conteudo") => page.locator(sel).evaluate((el) => el.textContent ?? "");

try {
  /* ───────────────────────────── esquema e acesso ───────────────────────────── */
  secao("Esquema, acesso e assinatura do webhook");
  const cols = await sql`select is_nullable from information_schema.columns where table_name = 'crm_mensagens' and column_name = 'oportunidade_id'`;
  ok(cols[0]?.is_nullable === "YES", "esquema novo aplicado por cima do anterior: mensagem pode existir sem oportunidade (conversa por contato)");
  ok((await sql`select count(*)::int as n from pg_class where relname in ('crm_tarefas', 'crm_webhook_eventos') and relrowsecurity`)[0].n === 2, "tabelas novas (tarefas e eventos de webhook) com RLS ligado");
  ok((await fetch(`${B}/api/leads/pulso`)).status === 401, "/api/leads/pulso sem sessão: 401");
  ok((await tarefaHttp(randomUUID(), "Bearer errado")) === 401 && (await fetch(`${B}/api/leads/tarefas`, { method: "POST", body: "{}" })).status === 401, "/api/leads/tarefas sem o segredo: 401");
  const corpoSolto = JSON.stringify({ id: "evt_sem_assinatura", type: "whatsapp.inbound_message.received", whatsappInboundMessage: { id: "x", from: "+5547911110000", type: "text", text: { body: "oi" } } });
  const semAss = await fetch(`${B}/api/leads/webhooks/ycloud`, { method: "POST", headers: { "content-type": "application/json" }, body: corpoSolto });
  const assErrada = await webhook("whatsapp.inbound_message.received", { whatsappInboundMessage: { id: "x2", from: "+5547911110000", type: "text", text: { body: "oi" } } }, { segredo: "outro-segredo" });
  const assVelha = await webhook("whatsapp.inbound_message.received", { whatsappInboundMessage: { id: "x3", from: "+5547911110000", type: "text", text: { body: "oi" } } }, { t: Math.floor(Date.now() / 1000) - 7 * 3600 });
  ok(semAss.status === 401 && assErrada === 401 && assVelha === 401, `webhook sem assinatura, com segredo errado ou com horário de 7 h atrás: 401/401/401 (${semAss.status}/${assErrada}/${assVelha})`);
  ok((await sql`select count(*)::int as n from crm_webhook_eventos`)[0].n === 0 && (await sql`select count(*)::int as n from crm_contatos`)[0].n === 0, "notificação sem assinatura válida não grava nada");

  /* ───────────────────────────── login ───────────────────────────── */
  const { ctx, meta } = await contexto();
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.goto(`${B}/leads/entrar`);
  await page.fill('input[name="email"]', DONO);
  await page.click('button[type="submit"]');
  await page.waitForSelector('input[name="codigo"]');
  const codigo = await ate(() => emails.find((e) => e.to?.[0] === DONO)?.subject?.match(/^(\d{6})/)?.[1]);
  await page.fill('input[name="codigo"]', codigo);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(`${B}/leads`);
  emails.length = 0;

  /* ───────────────────────────── configuração ───────────────────────────── */
  secao("Configuração e estado verdadeiro");
  await page.goto(`${B}/leads/integracoes`);
  let integ = await texto(page);
  ok(/WhatsApp \(YCloud[^)]*\)\s*Parcial/.test(integ) && /estado CONNECTED, nome Spolaor Tecnologia/.test(integ), "integrações: número CONNECTED lido da YCloud, mas estado geral “Parcial” enquanto nenhuma notificação chegou");
  ok(/Notificações recebidas:\s*nenhuma até agora/.test(integ) && /nenhum escolhido em Configurações/.test(integ), "integrações: sem notificação recebida e sem modelo escolhido, dito como tal");
  // antes de ligar: formulário real não dispara nada
  const antes = await novoLead({}, ["cancelada"]);
  ok(antes.t?.status === "cancelada" && /desligado/.test(antes.t.resultado) && yc.envios.length === 0, `automação desligada (padrão): a tarefa é gravada com o lead e encerrada sem envio (“${antes.t?.resultado}”)`);
  await page.goto(`${B}/leads/configuracoes`);
  await page.check('input[name="canal"][value="whatsapp"]');
  await acao(page, 'button:has-text("Salvar canal")');
  ok(/escolha abaixo um modelo que esteja aprovado/.test(await texto(page)) && (await sql`select count(*)::int as n from crm_config where chave = 'automacao:primeiro-contato'`)[0].n === 0, "não dá para ligar o WhatsApp sem um modelo aprovado escolhido");
  await page.fill('#whatsapp input[name="nome"]', MODELO);
  await acao(page, 'button:has-text("Salvar modelo e frases")');
  const cfgTxt = await texto(page, "#whatsapp");
  ok(/Estado na Meta: APPROVED · categoria UTILITY/.test(cfgTxt) && cfgTxt.includes("Recebemos {{2}} pelo nosso site"), `configurações: modelo lido da YCloud com estado, categoria e texto aprovado (${cfgTxt.slice(0, 160).replace(/\s+/g, " ")})`);
  await page.check('input[name="canal"][value="whatsapp"]');
  await acao(page, 'button:has-text("Salvar canal")');
  ok((await sql`select valor from crm_config where chave = 'automacao:primeiro-contato'`)[0]?.valor?.canal === "whatsapp", "primeiro contato automático ligado no canal WhatsApp");
  await cron();
  await espera(500);
  ok(yc.envios.length === 0 && (await opId(antes.o.id)).etapa === "novo", "ligar a automação NÃO dispara mensagem para quem chegou antes (nada retroativo)");

  /* ───────────────────────────── formulário → tarefa → primeiro contato ───────────────────────────── */
  secao("Formulário → tarefa → primeiro contato");
  const a = await novoLead({ nome: "Marina Albuquerque", origem: "lojas-virtuais", pagina: "/lojas-virtuais" });
  ok(a.r.status === 200 && !!a.r.body.id, "formulário aceito com id (contrato de /api/lead preservado)");
  ok(!!a.t && a.t.envio_id === a.r.body.id && a.o.aviso_versao === AVISO && a.o.categoria === "lojas", "tarefa gravada com o lead; categoria “lojas” pela página do formulário; pedido de retorno pelo WhatsApp registrado com versão");
  const publicacao = qs.publicados.find((p) => p.corpo.includes(a.t.id));
  ok(!!publicacao && publicacao.destino === `${B}/api/leads/tarefas` && publicacao.dedup === `crm-tarefa-${a.t.id}` && publicacao.auth === "Bearer teste-cron", "tarefa publicada no QStash logo após o formulário, com chave de deduplicação");
  const envA = enviosPara(a.fone);
  const [mA] = await msgs(a.o.id);
  ok(envA.length === 1 && envA[0].from === NUMERO && envA[0].type === "template" && envA[0].template.name === MODELO && envA[0].template.language.code === "pt_BR", "1 envio ao provedor: modelo aprovado, pelo número comercial");
  ok(JSON.stringify(envA[0].template.components[0].parameters.map((p) => p.text)) === JSON.stringify(["Marina", "seu pedido sobre loja virtual"]), `variáveis do modelo ligadas ao pedido: ${envA[0].template.components[0].parameters.map((p) => p.text).join(" | ")}`);
  ok(envA[0].externalId === mA.id && mA.status === "aceita" && mA.provedor_id === envA[0].id && mA.automatica && mA.via === "api", "identificador externo = id da nossa mensagem; mensagem “aceita pelo provedor”");
  ok(mA.corpo === "Olá, Marina! Aqui é a Spolaor Tecnologia. Recebemos seu pedido sobre loja virtual pelo nosso site. Posso continuar seu atendimento por aqui?", "a conversa guarda o texto exato que foi enviado");
  ok(a.t.status === "concluida" && a.o.etapa === "aguardando_resposta" && a.o.aguardando === "cliente" && a.o.assumida_em === null && a.o.primeiro_contato_em, "depois do envio: etapa Aguardando resposta, vez do interessado, sem contar como atendimento humano");
  ok(emails.filter((e) => e.to?.[0] === a.l.email).length === 0 && emails.filter((e) => e.text?.includes(a.r.body.id)).length === 1, "a mesma recepção não saiu por e-mail; o aviso interno de lead continuou saindo");
  await page.goto(`${B}/leads`);
  ok((await page.locator(`#interessado [href="/leads/o/${a.o.id}"]`).count()) === 1 && (await page.locator(`#respostas [href="/leads/o/${a.o.id}"], #manual [href="/leads/o/${a.o.id}"]`).count()) === 0, "fila: fica em “Aguardando o interessado”, fora de “Depende de mim”");

  // estados fora de ordem
  const refA = { id: mA.provedor_id, wamid: envA[0].wamid, externalId: mA.id };
  const t0 = Date.now();
  await estado(refA, "read", { readTime: new Date(t0 + 3000).toISOString() });
  await estado(refA, "delivered", { deliverTime: new Date(t0 + 2000).toISOString() });
  await estado(refA, "sent", { sendTime: new Date(t0 + 1000).toISOString() });
  let [mA2] = await msgs(a.o.id);
  ok(mA2.status === "lida" && mA2.entregue_em && mA2.lida_em && mA2.wamid === envA[0].wamid, "estados fora de ordem (lida, entregue, enviada): fica “lida”, com as horas de entrega e leitura; nunca rebaixa");
  ok((await opId(a.o.id)).aguardando === "cliente" && (await opId(a.o.id)).assumida_em === null, "entrega e leitura não mudam de quem é a vez nem contam como resposta");
  // eco da nossa própria automação
  await eco(a.fone, mA.corpo, { wamid: envA[0].wamid });
  ok((await msgs(a.o.id)).length === 1 && (await opId(a.o.id)).assumida_em === null, "eco da nossa própria mensagem automática (mesmo identificador) não vira mensagem nova nem atendimento humano");

  /* ───────────────────────────── resposta → depende de mim ───────────────────────────── */
  secao("Resposta → “Depende de mim”");
  const wamidR1 = novaWamid();
  const evR1 = `evt_resposta_${Date.now()}`;
  ok((await recebida(a.fone, "Oi! Pode ser amanhã às 15h?", { wamid: wamidR1, nome: "Marina A.", opcoes: { id: evR1 } })) === 200, "resposta recebida: webhook aceito (200)");
  let oA = await opId(a.o.id);
  ok(oA.aguardando === "nos" && oA.pendencia === "resposta" && oA.etapa === "em_conversa" && oA.ultima_entrada_em, "resposta do interessado: depende de nós, motivo “resposta”, etapa Em conversa");
  await page.goto(`${B}/leads`);
  const item = await texto(page, `#respostas [data-oportunidade="${a.o.id}"]`);
  ok(/Marina Albuquerque/.test(item) && /Respondeu e aguarda retorno/.test(item) && /Disse: Oi! Pode ser amanhã às 15h\?/.test(item) && /Lojas virtuais/.test(item) && /esperando/.test(item) && /sem responsável/.test(item), "fila “Depende de mim”: nome, serviço, motivo, última mensagem, tempo de espera e responsável");
  // repetição
  await recebida(a.fone, "Oi! Pode ser amanhã às 15h?", { wamid: wamidR1, opcoes: { id: evR1 } });
  await recebida(a.fone, "Oi! Pode ser amanhã às 15h?", { wamid: wamidR1 });
  ok((await sql`select count(*)::int as n from crm_mensagens where wamid = ${wamidR1}`)[0].n === 1, "webhook repetido (mesmo evento, e mesma mensagem com outro id de evento) não duplica a mensagem");
  ok((await sql`select count(*)::int as n from crm_webhook_eventos where id = ${`ycloud:${evR1}`}`)[0].n === 1, "o evento fica gravado uma vez, como chegou");
  // abrir a ficha não é responder
  await page.goto(`${B}/leads/o/${a.o.id}`);
  ok((await opId(a.o.id)).aguardando === "nos" && /Depende de você/.test(await texto(page)), "abrir a ficha não muda nada: continua dependendo de nós");
  ok((await page.evaluate(() => typeof window.fbq)) === "undefined" && meta.length === 0, "receber mensagem e abrir o CRM não geram nenhum evento para a Meta");

  /* ───────────────────────────── resposta humana ───────────────────────────── */
  secao("Resposta humana: pelo aplicativo e pelo CRM");
  await espera(5300); // uma pessoa leva mais de 5 s para responder; menos que isso é tratado como resposta automática do aplicativo
  const tEco = new Date().toISOString();
  await eco(a.fone, "Pode sim, Marina. Combinado às 15h.", { em: tEco });
  oA = await opId(a.o.id);
  const ultima = (await msgs(a.o.id)).find((x) => x.corpo === "Pode sim, Marina. Combinado às 15h.");
  ok(ultima.via === "app" && ultima.direcao === "saida" && !ultima.automatica && ultima.status === "enviada", "resposta pelo aplicativo do celular: registrada pela sincronização, como humana");
  ok(oA.aguardando === "cliente" && oA.assumida_em && oA.pendencia === null, "resposta pelo aplicativo: atendimento assumido e vez do interessado");
  // nova mensagem e, depois, um eco ANTIGO atrasado
  await recebida(a.fone, "Mudei de ideia, pode ser 16h?");
  await eco(a.fone, "Mensagem antiga que chegou atrasada", { em: new Date(new Date(tEco).getTime() - 500).toISOString() });
  oA = await opId(a.o.id);
  const antiga = (await msgs(a.o.id)).find((x) => x.corpo === "Mensagem antiga que chegou atrasada");
  ok(oA.aguardando === "nos" && antiga.via === "app" && antiga.automatica === false, "eco antigo que chega depois de uma resposta nova não apaga a pendência (vale a hora real das mensagens)");
  // pelo CRM, dentro da janela
  await page.goto(`${B}/leads/o/${a.o.id}`);
  ok((await page.locator('[data-wa-crm="janela-aberta"]').count()) === 1, "ficha: janela de 24 h aberta, texto livre liberado pelo CRM");
  let acaoWa = null;
  page.on("request", (rq) => {
    if (rq.method() === "POST" && rq.headers()["next-action"] && rq.postDataBuffer()?.toString("latin1").includes('modo"')) acaoWa = { url: rq.url(), headers: rq.headers(), body: rq.postDataBuffer() };
  });
  const nEnv = yc.envios.length;
  await page.fill('[data-wa-crm] textarea[name="corpo"]', "Pode ser 16h sim. Até amanhã!");
  await acao(page, 'button:has-text("Enviar pelo WhatsApp")');
  const envCrm = yc.envios.at(-1);
  ok(yc.envios.length === nEnv + 1 && envCrm.type === "text" && envCrm.text.body === "Pode ser 16h sim. Até amanhã!" && envCrm.to === `+${a.fone}`, "resposta pelo CRM dentro da janela: texto livre enviado pelo provedor");
  oA = await opId(a.o.id);
  const mCrm = (await msgs(a.o.id)).find((m) => m.provedor_id === envCrm.id);
  ok(oA.aguardando === "cliente" && mCrm.status === "aceita" && !mCrm.automatica && mCrm.usuario_id, "resposta pelo CRM: mesma regra do aplicativo, vez do interessado");
  await fetch(acaoWa.url, { method: "POST", headers: acaoWa.headers, body: acaoWa.body, redirect: "manual" });
  await espera(700);
  ok(yc.envios.length === nEnv + 1, "clique duplo ou reenvio do mesmo formulário de resposta não manda a mensagem de novo");

  /* ───────────────────────────── janela e modelo ───────────────────────────── */
  secao("Janela de atendimento, modelo e integração desconectada");
  await sql`update crm_contatos set wa_ultima_entrada_em = now() - interval '25 hours' where id = ${oA.contato_id}`;
  const antesJanela = yc.envios.length;
  const r403 = await fetch(acaoWa.url, { method: "POST", headers: acaoWa.headers, body: Buffer.from(acaoWa.body.toString("latin1").replace(/(chave"\r\n\r\n)[0-9a-f-]{36}/, `$1${randomUUID()}`), "latin1"), redirect: "manual" });
  await espera(600);
  ok(yc.envios.length === antesJanela && /wa-janela/.test(r403.headers.get("x-action-redirect") ?? ""), `fora da janela de 24 h, texto livre é recusado no servidor antes de chegar ao provedor (${r403.headers.get("x-action-redirect")?.split("?")[1]?.split(";")[0]})`);
  await page.goto(`${B}/leads/o/${a.o.id}`);
  ok((await page.locator('[data-wa-crm="janela-fechada"]').count()) === 1 && (await texto(page, "[data-modelo-wa]")).includes("Olá, Marina!"), "ficha: janela fechada mostra só o modelo aprovado, já preenchido");
  await acao(page, 'button:has-text("Enviar o modelo pelo WhatsApp")');
  ok(yc.envios.length === antesJanela + 1 && yc.envios.at(-1).type === "template", "fora da janela, o envio humano pelo CRM usa o modelo aprovado");
  // provedor recusa por janela (corrida: janela fechou entre a tela e o envio)
  await sql`update crm_contatos set wa_ultima_entrada_em = now() where id = ${oA.contato_id}`;
  yc.modo = "janela";
  await page.goto(`${B}/leads/o/${a.o.id}`);
  await page.fill('[data-wa-crm] textarea[name="corpo"]', "Mensagem que o provedor vai recusar");
  await acao(page, 'button:has-text("Enviar pelo WhatsApp")');
  yc.modo = "ok";
  const mRec = (await msgs(a.o.id)).find((x) => x.corpo === "Mensagem que o provedor vai recusar");
  ok(mRec.status === "falhou" && /janela de 24 horas fechou/.test(mRec.erro) && /131047/.test(mRec.erro), `recusa do provedor por janela fechada: mensagem “falhou” com o motivo (“${mRec.erro}”)`);
  ok((await opId(a.o.id)).aguardando === "cliente", "mensagem recusada não muda de quem é a vez");

  // modelo indisponível
  yc.modeloStatus = "PAUSED";
  await webhook("whatsapp.template.reviewed", { whatsappTemplate: { name: MODELO, language: "pt_BR", status: "PAUSED", statusUpdateEvent: "PAUSED" } });
  const nMod = yc.envios.length;
  const semModelo = await novoLead({ nome: "Rogério Tavares" }, ["falhou"]);
  ok(semModelo.t?.status === "falhou" && /não está aprovado \(estado na Meta: PAUSED\)/.test(semModelo.t.resultado) && yc.envios.length === nMod, `modelo pausado: nada é enviado e a tarefa diz por quê (“${semModelo.t?.resultado}”)`);
  await page.goto(`${B}/leads`);
  ok(/Sem primeiro contato automático: O modelo/.test(await texto(page, `#manual [data-oportunidade="${semModelo.o.id}"]`)), "fila: o contato aparece em “ação manual” com o motivo");
  await page.goto(`${B}/leads/integracoes`);
  integ = await texto(page);
  ok(/Modelo do primeiro contato:\s*pendente ou indisponível\. O modelo "primeiro_contato_site" não está aprovado/.test(integ), "integrações: modelo pendente/indisponível dito como tal");
  yc.modeloStatus = "APPROVED";
  await webhook("whatsapp.template.reviewed", { whatsappTemplate: { name: MODELO, language: "pt_BR", status: "APPROVED", statusUpdateEvent: "APPROVED" } });

  // integração desconectada
  yc.numeroStatus = "DISCONNECTED";
  yc.modo = "numero";
  const desc = await novoLead({ nome: "Bianca Furtado" }, ["falhou"]);
  const [mDesc] = await msgs(desc.o.id);
  ok(desc.t?.status === "falhou" && mDesc.status === "falhou" && /número comercial não está disponível/.test(mDesc.erro) && desc.o.etapa === "novo", "número desconectado: o provedor recusa, a mensagem falha com motivo claro e o contato continua novo");
  await page.goto(`${B}/leads/integracoes`);
  integ = await texto(page);
  ok(/WhatsApp \(YCloud[^)]*\)\s*Não conectado/.test(integ) && /estado DISCONNECTED/.test(integ), "integrações: número DISCONNECTED → “Não conectado”, mesmo com a chave definida");
  await webhook("whatsapp.business_account.deleted", { whatsappBusinessAccount: { id: "waba", removedReason: "PRIMARY_INACTIVITY", removedInitiatedBy: "SYSTEM" } });
  await page.goto(`${B}/leads/integracoes`);
  ok(/Aviso da YCloud[^.]*conta PRIMARY_INACTIVITY/.test(await texto(page)), "integrações: aviso de desconexão por inatividade recebido do provedor aparece");
  yc.numeroStatus = "CONNECTED";
  yc.modo = "ok";
  await sql`delete from crm_config where chave like 'whatsapp:evento-%'`;

  /* ───────────────────────────── duplicação e concorrência ───────────────────────────── */
  secao("Duplicação, concorrência e fila que falha");
  const dup = lead({ nome: "Caio Menezes" });
  const [d1, d2] = await Promise.all([post(dup), post(dup)]);
  const oDup = await op(d1.body.id);
  await tarefaEm(oDup.id, "concluida");
  await espera(600);
  ok(d1.status === 200 && d2.status === 200 && (await sql`select count(*)::int as n from crm_tarefas where oportunidade_id = ${oDup.id}`)[0].n === 1 && enviosPara(fone(dup)).length === 1, "duplo envio do formulário: 1 oportunidade, 1 tarefa, 1 mensagem");
  // tarefa pendente (fila aceitou e não entregou) e 6 execuções simultâneas
  qs.modo = "some";
  const conc = await novoLead({ nome: "Helena Prado" }, ["pendente"]);
  ok(conc.t?.status === "pendente" && conc.t.publicada_em && enviosPara(conc.fone).length === 0, "fila aceitou e não entregou: a tarefa continua pendente no banco");
  const sts = await Promise.all(Array.from({ length: 6 }, () => tarefaHttp(conc.t.id)));
  await tarefaEm(conc.o.id, "concluida");
  ok(sts.every((s) => s === 200) && enviosPara(conc.fone).length === 1 && (await msgs(conc.o.id)).length === 1, "6 execuções simultâneas da mesma tarefa: exatamente 1 envio");
  ok((await tarefaHttp(conc.t.id)) === 200 && enviosPara(conc.fone).length === 1, "tarefa já concluída executada de novo: nada sai");
  // rotina recupera tarefa perdida
  const perdida = await novoLead({ nome: "Lívia Santoro" }, ["pendente"]);
  await cron();
  await espera(400);
  ok(enviosPara(perdida.fone).length === 0, "a rotina não atropela uma tarefa recém-criada (a fila ainda pode entregar)");
  await sql`update crm_tarefas set criado_em = now() - interval '2 minutes' where id = ${perdida.t.id}`;
  await cron();
  await tarefaEm(perdida.o.id, "concluida");
  ok(enviosPara(perdida.fone).length === 1, "tarefa que a fila perdeu é recuperada pela rotina: o primeiro contato não desaparece");
  // publicação falha → executa na hora
  qs.modo = "falha";
  const falhaFila = await novoLead({ nome: "Otávio Brandão" }, ["concluida"]);
  ok(falhaFila.t?.status === "concluida" && falhaFila.t.publicada_em === null && enviosPara(falhaFila.fone).length === 1, "publicação na fila falhou: a tarefa roda ali mesmo, sem esperar a rotina");
  // humano assume enquanto a tarefa espera
  qs.modo = "some";
  const assume = await novoLead({ nome: "Paula Nogueira" }, ["pendente"]);
  await page.goto(`${B}/leads/o/${assume.o.id}`);
  ok(/primeiro contato automático está na fila/.test(await texto(page)), "ficha avisa que o primeiro contato automático está na fila");
  await acao(page, 'button:has-text("Assumir atendimento")');
  await tarefaHttp(assume.t.id);
  await espera(400);
  ok((await tarefa(assume.o.id)).status === "cancelada" && enviosPara(assume.fone).length === 0, "atendimento assumido antes do envio: a tarefa é cancelada e nada sai");
  // interessado escreve antes do envio
  const escreve = await novoLead({ nome: "Diego Farias" }, ["pendente"]);
  await recebida(escreve.fone, "Oi, acabei de preencher o formulário");
  await tarefaHttp(escreve.t.id);
  await espera(400);
  const oEsc = await opId(escreve.o.id);
  ok((await tarefa(escreve.o.id)).status === "cancelada" && enviosPara(escreve.fone).length === 0 && oEsc.aguardando === "nos", "a pessoa escreveu antes do envio automático: tarefa cancelada, nada sai, e a conversa depende de nós");
  qs.modo = "ok";

  /* ───────────────────────────── envio incerto ───────────────────────────── */
  secao("Envio de resultado incerto");
  yc.modo = "queda";
  const inc = await novoLead({ nome: "Sofia Bastos" }, ["incerta"]);
  yc.modo = "ok";
  const [mInc] = await msgs(inc.o.id);
  ok(inc.t?.status === "incerta" && mInc.status === "incerta" && enviosPara(inc.fone).length === 1, "o provedor recebeu e a resposta se perdeu: mensagem e tarefa ficam como “resultado incerto”");
  ok(inc.o.etapa === "novo" && inc.o.aguardando === null, "resultado incerto não é tratado como enviado");
  await sql`update crm_tarefas set criado_em = now() - interval '10 minutes', tentado_em = now() - interval '10 minutes' where id = ${inc.t.id}`;
  await cron();
  await cron();
  await tarefaHttp(inc.t.id);
  await espera(500);
  ok(enviosPara(inc.fone).length === 1, "resultado incerto NÃO é reenviado: nem pela rotina, nem pela fila");
  await page.goto(`${B}/leads`);
  ok(/não se sabe se a mensagem saiu/.test(await texto(page, `#manual [data-oportunidade="${inc.o.id}"]`)), "fila: aparece em “ação manual” dizendo que não se sabe se saiu");
  // a notificação do provedor resolve pelo identificador externo
  await estado({ id: "yc_resolvido_1", wamid: "wamid.RESOLVIDO1", externalId: mInc.id }, "sent", { sendTime: new Date().toISOString() });
  const oInc = await opId(inc.o.id);
  const [mInc2] = await msgs(inc.o.id);
  ok(mInc2.status === "enviada" && mInc2.provedor_id === "yc_resolvido_1" && (await tarefa(inc.o.id)).status === "concluida" && oInc.etapa === "aguardando_resposta" && oInc.aguardando === "cliente", "a notificação do provedor (pelo identificador externo) resolve o incerto: enviada, tarefa concluída, aguardando o interessado");
  // resolução humana: não saiu
  yc.modo = "500";
  const inc2 = await novoLead({ nome: "Tiago Rezende" }, ["incerta"]);
  yc.modo = "ok";
  const [mInc3] = await msgs(inc2.o.id);
  ok(mInc3.status === "incerta" && /HTTP 500/.test(mInc3.erro), "erro 500 do provedor também é resultado incerto (não se assume que nada saiu)");
  await page.goto(`${B}/leads/o/${inc2.o.id}`);
  await acao(page, 'button:has-text("Conferi: não saiu")');
  ok((await msgs(inc2.o.id))[0].status === "cancelada" && (await tarefa(inc2.o.id)).status === "falhou" && (await opId(inc2.o.id)).etapa === "novo", "pessoa confere no aplicativo e marca “não saiu”: mensagem cancelada, contato segue como novo para atendimento manual");
  // 429: nada saiu com certeza → volta para a fila
  yc.modo = "429";
  const lim = await novoLead({ nome: "Vera Campos" }, ["pendente"]);
  lim.t = await ate(async () => { const x = await tarefa(lim.o.id); return x.tentativas >= 1 && x.status === "pendente" ? x : null; });
  yc.modo = "ok";
  ok(lim.t?.status === "pendente" && enviosPara(lim.fone).length === 1 && (await msgs(lim.o.id)).length === 0, "limite de requisições do provedor (429): nada saiu com certeza, a tarefa volta para a fila");
  await sql`update crm_tarefas set proxima_em = now(), criado_em = now() - interval '2 minutes' where id = ${lim.t.id}`;
  await cron();
  await tarefaEm(lim.o.id, "concluida");
  ok(enviosPara(lim.fone).filter((e) => e.id).length === 1, "depois do 429 a nova tentativa envia uma vez");

  /* ───────────────────────────── duas oportunidades ───────────────────────────── */
  secao("Duas oportunidades da mesma pessoa");
  const p1 = await novoLead({ nome: "Fernanda Lopes", origem: "sites", pagina: "/sites" });
  const p2l = lead({ nome: "Fernanda Lopes", origem: "automacao", pagina: "/automacao", tipo: "analise", segmento: "Outro", problema: "Outro", whatsapp: p1.l.whatsapp, email: p1.l.email });
  pessoa--;
  const p2r = await post(p2l);
  const o2 = await op(p2r.body.id);
  const t2 = await tarefaEm(o2.id, "cancelada");
  const o2b = await opId(o2.id);
  ok(o2.id !== p1.o.id && o2.contato_id === p1.o.contato_id && o2.categoria === "automacao", "mesma pessoa, outro serviço: mesma pessoa, oportunidade nova (categoria “automacao”)");
  ok(enviosPara(p1.fone).length === 1 && /já recebeu a recepção/.test(t2.resultado), "a pessoa NÃO recebe uma segunda recepção automática pelo segundo serviço");
  ok(o2b.aguardando === "nos" && o2b.pendencia === "novo_pedido", "o segundo pedido vai direto para “Depende de mim” (novo pedido de quem já está em conversa)");
  // resposta sem contexto: só a 1ª tem conversa → vai para ela
  await recebida(p1.fone, "Recebi a mensagem de vocês, obrigada");
  const mSolta = (await sql`select oportunidade_id from crm_mensagens where contato_id = ${p1.o.contato_id} and direcao = 'entrada' order by criado_em desc limit 1`)[0];
  ok(mSolta.oportunidade_id === p1.o.id, "resposta da pessoa vai para a única oportunidade que tem conversa no WhatsApp");
  // agora as duas têm conversa → resposta sem contexto fica sem associação
  await page.goto(`${B}/leads/o/${o2.id}`);
  await page.fill('[data-wa-crm] textarea[name="corpo"]', "Fernanda, sobre a automação: qual processo você quer começar?");
  await acao(page, 'button:has-text("Enviar pelo WhatsApp")');
  const wamidO2 = yc.envios.at(-1).wamid;
  await estado({ id: yc.envios.at(-1).id, wamid: wamidO2 }, "sent", { sendTime: new Date().toISOString() });
  const antesAmb = (await sql`select count(*)::int as n from crm_mensagens where contato_id = ${p1.o.contato_id}`)[0].n;
  const tAmb = new Date(Date.now() + 200_000).toISOString();
  await recebida(p1.fone, "Pode me ligar?", { em: tAmb });
  const amb = (await sql`select oportunidade_id from crm_mensagens where contato_id = ${p1.o.contato_id} and corpo = 'Pode me ligar?'`);
  ok(amb.length === 1 && amb[0].oportunidade_id === null && (await sql`select count(*)::int as n from crm_mensagens where contato_id = ${p1.o.contato_id}`)[0].n === antesAmb + 1, "duas oportunidades com conversa: a mensagem entra UMA vez, sem oportunidade (o CRM não adivinha)");
  await page.goto(`${B}/leads`);
  const solta = await texto(page, `#sem-associacao [data-conversa="${p1.o.contato_id}"]`);
  ok(/Fernanda Lopes/.test(solta) && /2 oportunidades abertas/.test(solta) && /Disse: Pode me ligar\?/.test(solta) && /Associar a “Automação de processos”/.test(solta) && /Associar a “Sites e landing pages”/.test(solta), "fila: “Conversas sem associação” mostra a mensagem e as duas oportunidades para escolher");
  await acao(page, `#sem-associacao [data-conversa="${p1.o.contato_id}"] button:has-text("Automação de processos")`);
  const o2c = await opId(o2.id);
  ok((await sql`select oportunidade_id from crm_mensagens where corpo = 'Pode me ligar?'`)[0].oportunidade_id === o2.id && o2c.aguardando === "nos", "associação humana: a mensagem passa para a oportunidade escolhida, que fica dependendo de nós");
  // resposta citando uma mensagem nossa → oportunidade daquela mensagem
  await recebida(p1.fone, "Sobre o site: quero começar em dezembro", { contexto: enviosPara(p1.fone)[0].wamid, em: new Date(Date.now() + 260_000).toISOString() });
  ok((await sql`select oportunidade_id from crm_mensagens where corpo like 'Sobre o site:%'`)[0].oportunidade_id === p1.o.id, "resposta citando uma mensagem nossa vai para a oportunidade daquela mensagem");
  ok(enviosPara(p1.fone).filter((e) => e.type === "template").length === 1, "em nenhum momento a pessoa recebeu duas recepções automáticas");

  /* ───────────────────────────── desconhecido, parar, mídia, histórico ───────────────────────────── */
  secao("Número desconhecido, pedido para parar, mídia e histórico");
  const estranho = "5548977770001";
  await recebida(estranho, "Olá, vocês fazem site para clínica?", { nome: "Dra. Camila" });
  const [cEst] = await sql`select * from crm_contatos where whatsapp = ${estranho}`;
  ok(cEst?.nome === "Dra. Camila" && (await sql`select count(*)::int as n from crm_oportunidades where contato_id = ${cEst.id}`)[0].n === 0, "mensagem de número que não está no CRM: contato criado pelo telefone, sem criar oportunidade sozinho");
  await page.goto(`${B}/leads`);
  ok(/Número que ainda não tem oportunidade no CRM/.test(await texto(page, `#sem-associacao [data-conversa="${cEst.id}"]`)), "fila: aparece em “Conversas sem associação” para uma pessoa decidir");
  await acao(page, `#sem-associacao [data-conversa="${cEst.id}"] button:has-text("Criar oportunidade nova")`);
  const [oEst] = await sql`select * from crm_oportunidades where contato_id = ${cEst.id}`;
  ok(oEst.canal === "whatsapp" && oEst.categoria === "a-classificar" && oEst.registro === "manual" && oEst.aguardando === "nos" && (await tarefa(oEst.id)) === undefined, "oportunidade criada por decisão humana: canal WhatsApp, “A classificar”, depende de nós, sem tarefa automática");
  ok(enviosPara(estranho).length === 0, "quem escreveu primeiro não recebe recepção automática do CRM");

  // pedido para parar
  const par = await novoLead({ nome: "Gustavo Pires" });
  await recebida(par.fone, "PARAR");
  const oPar = await opId(par.o.id);
  ok(oPar.wa_bloqueado_em && oPar.aguardando === "nos" && oPar.pendencia === "pediu_parar" && oPar.etapa === "aguardando_resposta", "“PARAR”: número bloqueado para automação e conversa aparece para conferência (sem virar “Em conversa”)");
  await page.goto(`${B}/leads`);
  ok(/Pediu para parar/.test(await texto(page, `#respostas [data-oportunidade="${par.o.id}"]`)), "fila: motivo “Pediu para parar” em destaque");
  const nPar = yc.envios.length;
  const par2l = lead({ nome: "Gustavo Pires", origem: "lojas-virtuais", pagina: "/lojas-virtuais", whatsapp: par.l.whatsapp, email: par.l.email });
  pessoa--;
  const par2 = await post(par2l);
  const oPar2 = await op(par2.body.id);
  await tarefaEm(oPar2.id, "cancelada", "falhou");
  ok(yc.envios.length === nPar, "quem pediu para parar não recebe nova abordagem automática, nem com outro formulário");
  const neg = await novoLead({ nome: "Heitor Sampaio" });
  for (const frase of ["não quero perder clientes", "para quando fica pronto?", "quero cancelar meu plano antigo e fazer um site", "pode parar na sexta para conversar?"]) await recebida(neg.fone, frase);
  ok((await opId(neg.o.id)).wa_bloqueado_em === null && (await opId(neg.o.id)).pendencia === "resposta", "frases comuns com “não quero”, “para” ou “cancelar” no meio NÃO são tratadas como pedido para parar");
  await recebida(neg.fone, "sem interesse, obrigado");
  ok(!!(await opId(neg.o.id)).wa_bloqueado_em && (await opId(neg.o.id)).pendencia === "pediu_parar", "“sem interesse, obrigado” é tratado como pedido para parar");

  // mídia, não suportado, reação
  const mid = await novoLead({ nome: "Isabela Rocha" });
  await recebida(mid.fone, null, { tipo: "audio", conteudo: { audio: { id: "123", mime_type: "audio/ogg; codecs=opus", link: "https://api.ycloud.com/v2/whatsapp/media/download/123" } } });
  let oMid = await opId(mid.o.id);
  const mAudio = (await msgs(mid.o.id)).at(-1);
  ok(mAudio.tipo === "audio" && /^\[Áudio\] · abra no aplicativo/.test(mAudio.corpo) && oMid.aguardando === "nos" && !JSON.stringify(mAudio.midia).includes("http"), "áudio: vira pendência humana, com orientação para ouvir no aplicativo; o CRM não guarda o link do arquivo");
  await eco(mid.fone, "Ouvi seu áudio, já respondo", { em: new Date(Date.now() + 30_000).toISOString() });
  await recebida(mid.fone, null, { tipo: "unsupported", conteudo: { errors: [{ code: "131051", title: "Message type unknown" }] }, em: new Date(Date.now() + 60_000).toISOString() });
  oMid = await opId(mid.o.id);
  ok(oMid.aguardando === "nos" && oMid.pendencia === "nao_suportado" && /não mostra/.test((await msgs(mid.o.id)).at(-1).corpo), "conteúdo não suportado: aparece como tal, com pendência “veja no aplicativo”");
  await eco(mid.fone, "Vi no aplicativo, obrigado", { em: new Date(Date.now() + 90_000).toISOString() });
  await recebida(mid.fone, null, { tipo: "reaction", conteudo: { reaction: { emoji: "👍", message_id: "wamid.qualquer" } }, em: new Date(Date.now() + 120_000).toISOString() });
  oMid = await opId(mid.o.id);
  ok(oMid.aguardando === "cliente" && (await msgs(mid.o.id)).at(-1).tipo === "reaction", "reação (👍) fica registrada, mas não vira resposta aguardando retorno");
  await recebida(mid.fone, "Quero o orçamento", { tipo: "button", conteudo: { button: { text: "Quero o orçamento", payload: "orcamento" } }, em: new Date(Date.now() + 150_000).toISOString() });
  ok((await opId(mid.o.id)).aguardando === "nos" && (await msgs(mid.o.id)).at(-1).corpo === "Quero o orçamento", "resposta por botão vira pendência humana com o texto do botão");

  // saudação automática do aplicativo
  const saud = await novoLead({ nome: "Júlia Antunes" });
  const tS = Date.now() + 300_000;
  await recebida(saud.fone, "Oi, tudo bem?", { em: new Date(tS).toISOString() });
  await eco(saud.fone, "Olá! Obrigado por entrar em contato. Em breve retornamos.", { em: new Date(tS + 2000).toISOString() });
  const oSaud = await opId(saud.o.id);
  ok(oSaud.aguardando === "nos" && oSaud.assumida_em === null && (await msgs(saud.o.id)).at(-1).automatica === true, "mensagem de saudação do aplicativo (2 s depois da pessoa) não é tratada como resposta humana: a pendência continua");

  // histórico e eco fora do CRM
  const cAntes = (await sql`select count(*)::int as n from crm_contatos`)[0].n;
  const mAntes = (await sql`select count(*)::int as n from crm_mensagens`)[0].n;
  const nHist = yc.envios.length;
  for (let i = 0; i < 5; i++) await recebida(`554899990${100 + i}`, `mensagem antiga ${i}`, { evento: "whatsapp.smb.history", topo: { phase: 1, progress: 20 * i }, em: new Date(Date.now() - 30 * 86400000).toISOString() });
  await webhook("whatsapp.smb.history", { phase: 1, progress: 100 });
  await eco("5548999901234", "Conversa com fornecedor, fora do CRM");
  ok((await sql`select count(*)::int as n from crm_contatos`)[0].n === cAntes && (await sql`select count(*)::int as n from crm_mensagens`)[0].n === mAntes && yc.envios.length === nHist, "histórico importado do aplicativo e conversa com número fora do CRM: nenhum contato, mensagem, oportunidade ou envio");
  ok((await sql`select count(*)::int as n from crm_webhook_eventos where tipo = 'whatsapp.smb.history' and resultado like 'ignorado%'`)[0].n === 6, "os eventos de histórico ficam gravados como recebidos, marcados como não importados");
  ok((await webhook("whatsapp.call.connect", { whatsappCall: { id: "c1" } })) === 200 && (await webhook("tipo.que.nao.existe", {})) === 200, "tipo de evento não tratado ou desconhecido: aceito e gravado, sem derrubar o recebimento");
  // telefone ausente, usuário conhecido
  await recebida(mid.fone, "com telefone e usuário", { usuario: "BR.123456", em: new Date(Date.now() + 400_000).toISOString() });
  await recebida(null, "agora sem telefone", { usuario: "BR.123456", em: new Date(Date.now() + 430_000).toISOString() });
  ok((await sql`select contato_id from crm_mensagens where corpo = 'agora sem telefone'`)[0]?.contato_id === mid.o.contato_id, "notificação sem telefone (número oculto) é ligada à pessoa pelo identificador do WhatsApp já conhecido");

  /* ───────────────────────────── regras de envio automático ───────────────────────────── */
  secao("Quem não recebe o primeiro contato automático");
  const semAviso = await novoLead({ nome: "Karina Duarte", aviso: undefined }, ["falhou"]);
  ok(semAviso.o.aviso_versao === null && /não registrou o pedido de retorno/.test(semAviso.t.resultado) && enviosPara(semAviso.fone).length === 0, "formulário sem o texto de retorno pelo WhatsApp (versão antiga): sem autorização registrada, sem envio automático");
  const avisoErrado = await novoLead({ nome: "Leandro Maia", aviso: "2020-01-01" }, ["falhou"]);
  ok(avisoErrado.o.aviso_versao === null && enviosPara(avisoErrado.fone).length === 0, "versão de texto que o servidor não reconhece não vale como autorização");
  const teste = await novoLead({ nome: "TESTE formulário" }, ["cancelada"]);
  ok(/teste/i.test(teste.t.resultado) && enviosPara(teste.fone).length === 0, "envio de teste não recebe mensagem automática");
  qs.modo = "some";
  const velho = await novoLead({ nome: "Marcos Vieira" }, ["pendente"]);
  await sql`update crm_oportunidades set recebido_em = now() - interval '13 hours' where id = ${velho.o.id}`;
  await tarefaHttp(velho.t.id);
  await espera(400);
  qs.modo = "ok";
  ok(/mais de 12 horas/.test((await tarefa(velho.o.id)).resultado) && enviosPara(velho.fone).length === 0, "tarefa de um contato com mais de 12 horas não envia (nada de disparo retroativo)");
  // canal e-mail: nunca os dois
  await page.goto(`${B}/leads/configuracoes`);
  await page.check('input[name="canal"][value="email"]');
  await acao(page, 'button:has-text("Salvar canal")');
  const nMail = yc.envios.length;
  const porEmail = await novoLead({ nome: "Natália Reis" }, ["concluida"]);
  ok(emails.filter((e) => e.to?.[0] === porEmail.l.email).length === 1 && yc.envios.length === nMail && porEmail.o.etapa === "aguardando_resposta", "canal e-mail: a recepção sai só por e-mail, nenhuma pelo WhatsApp");
  await page.check('input[name="canal"][value="whatsapp"]');
  await acao(page, 'button:has-text("Salvar canal")');
  const porWa = await novoLead({ nome: "Olívia Teles" }, ["concluida"]);
  ok(emails.filter((e) => e.to?.[0] === porWa.l.email).length === 0 && enviosPara(porWa.fone).length === 1, "canal WhatsApp: a recepção sai só pelo WhatsApp, nenhuma por e-mail");
  const manualAntes = yc.envios.length;
  await page.goto(`${B}/leads/novo`);
  await page.fill('input[name="nome"]', "Pedro Manual");
  await page.fill('input[name="whatsapp"]', "(47) 98888-1234");
  await page.selectOption('select[name="categoria"]', "sistemas");
  await page.click('button:has-text("Cadastrar contato")');
  await page.waitForURL(/\/leads\/o\/.*msg=criado/);
  await espera(500);
  const [oMan] = await sql`select o.* from crm_oportunidades o join crm_contatos c on c.id = o.contato_id where c.nome = 'Pedro Manual'`;
  ok(oMan.categoria === "sistemas" && (await tarefa(oMan.id)) === undefined && yc.envios.length === manualAntes, "cadastro manual: categoria escolhida, nenhuma tarefa e nenhuma mensagem automática");

  /* ───────────────────────────── formulários do site e Pixel ───────────────────────────── */
  secao("Formulários do site e medição preservados");
  const { ctx: ctxPub } = await contexto();
  const pub = await ctxPub.newPage();
  for (const [caminho, form] of [["/contato", "contato"], ["/analise", "diagnóstico"], ["/diagnostico-site", "diagnóstico de site"]]) {
    await pub.goto(`${B}${caminho}`);
    if (caminho === "/analise") {
      // formulário em dois passos: o texto fica no segundo, junto ao botão de envio
      for (const g of await pub.locator('form[aria-label="Solicitar diagnóstico gratuito"] [role="radiogroup"]').all()) await g.locator("label").first().click();
      await pub.click('form[aria-label="Solicitar diagnóstico gratuito"] button:has-text("Continuar")');
      await pub.waitForSelector("[data-aviso-retorno]", { timeout: 5000 }).catch(() => {});
    }
    ok((await pub.locator(`[data-aviso-retorno="${AVISO}"]`).first().innerText()).includes("Ao enviar, você pede que a Spolaor Tecnologia responda pelo WhatsApp informado."), `${caminho}: o texto de retorno pelo WhatsApp aparece junto ao botão de envio (formulário de ${form})`);
  }
  await pub.goto(`${B}/diagnostico-site?utm_source=meta&utm_campaign=leads-gerais`);
  await pub.waitForFunction(() => (window.__fb ?? []).some((x) => x[1] === "PageView"));
  await pub.fill("#diag-site", "validacao-whatsapp.com.br");
  await pub.fill('input[autocomplete="name"]', "Rafaela Moura");
  await pub.fill('input[type="tel"]', "47955550199");
  const nPub = yc.envios.length;
  const [resp] = await Promise.all([pub.waitForResponse((r) => r.url().endsWith("/api/lead")), pub.click('#solicitar button[type="submit"]')]);
  const idLead = (await resp.json()).id;
  await pub.waitForFunction(() => (window.__fb ?? []).some((x) => x[1] === "Lead"));
  const fbs = await pub.evaluate(() => window.__fb ?? []);
  const oPub = await op(idLead);
  await tarefaEm(oPub.id, "concluida");
  ok(fbs.filter((x) => x[1] === "Lead").length === 1 && fbs.find((x) => x[1] === "Lead")[3]?.eventID === idLead, "formulário real pelo navegador: exatamente 1 evento Lead, com eventID = id do lead");
  ok(oPub.aviso_versao === AVISO && oPub.categoria === "diagnostico" && yc.envios.length === nPub + 1 && yc.envios.at(-1).template.components[0].parameters[1].text === "seu pedido de diagnóstico do site", "o formulário real registra o pedido de retorno e dispara o primeiro contato ligado ao serviço");
  await recebida("5547955550199", "Oi, vi a mensagem");
  await espera(600);
  ok((await pub.evaluate(() => (window.__fb ?? []).filter((x) => x[1] === "Lead").length)) === 1 && !JSON.stringify(fbs).match(/Rafaela|47955550199/), "resposta recebida não gera novo Lead; nenhum dado pessoal nos eventos do Pixel");
  await ctxPub.close();

  /* ───────────────────────────── fila: filtro, atualização, celular ───────────────────────────── */
  secao("Fila: filtro por serviço, atualização automática e celular");
  await page.goto(`${B}/leads?servico=lojas`);
  const soLojas = await page.locator("[data-oportunidade]").evaluateAll((els) => els.map((e) => e.textContent));
  ok(soLojas.length > 0 && soLojas.every((t) => /Lojas virtuais/.test(t)), `filtro por serviço na fila: só “Lojas virtuais” (${soLojas.length})`);
  await page.goto(`${B}/leads/lista?servico=diagnostico`);
  ok(/Rafaela Moura/.test(await texto(page)) && !/Marina Albuquerque/.test(await texto(page)), "filtro por serviço na lista");
  await page.goto(`${B}/leads/funil?servico=automacao`);
  ok(/Fernanda Lopes/.test(await texto(page)) && !/Rafaela Moura/.test(await texto(page)) && /depende de você/.test(await texto(page)), "filtro por serviço no funil; cartão indica quando depende de você (etapa e atendimento separados)");
  // etapa comercial x atendimento
  await page.goto(`${B}/leads/o/${porWa.o.id}`);
  await page.selectOption('select[name="etapa"]', "proposta_enviada");
  await page.fill('input[name="valorProposta"]', "3.500,00");
  await acao(page, 'button:has-text("Salvar etapa e valores")');
  await recebida(porWa.fone, "Recebi a proposta, tenho uma dúvida");
  const oProp = await opId(porWa.o.id);
  ok(oProp.etapa === "proposta_enviada" && oProp.aguardando === "nos", "etapa comercial e atendimento são separados: “Proposta enviada” e, ao mesmo tempo, dependendo de nós");
  // atualização sem recarregar
  await page.goto(`${B}/leads`);
  await page.waitForSelector("[data-atualizador]");
  const novo = await novoLead({ nome: "Sérgio Atualiza" });
  await recebida(novo.fone, "Mensagem que chega com a tela aberta");
  const apareceu = await page.waitForSelector(`#respostas [data-oportunidade="${novo.o.id}"]`, { timeout: 30000 }).then(() => true, () => false);
  ok(apareceu && /Mensagem que chega com a tela aberta/.test(await texto(page, `#respostas [data-oportunidade="${novo.o.id}"]`)), "com a tela aberta, a resposta nova aparece sozinha em “Depende de mim” (sem recarregar)");
  await page.goto(`${B}/leads/integracoes`);
  integ = await texto(page);
  ok(/WhatsApp \(YCloud[^)]*\)\s*Conectado/.test(integ) && /Última mensagem recebida: \d/.test(integ) && /Última resposta sincronizada do aplicativo: \d/.test(integ) && /Último estado de entrega: \d/.test(integ), "integrações: com número conectado e notificações recebidas, mostra “Conectado” e a hora do último evento de cada tipo");
  ok(/com resultado incerto:\s*\d/.test(integ), "integrações: falhas e envios incertos recentes aparecem");

  const cookie = (await ctx.cookies()).find((c) => c.name === "spolaor_crm");
  const { ctx: ctxM } = await contexto({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctxM.addCookies([{ name: "spolaor_crm", value: cookie.value, url: B }]);
  const m = await ctxM.newPage();
  for (const p of ["/leads", "/leads?servico=sites", "/leads/funil", "/leads/lista", "/leads/integracoes", "/leads/configuracoes", `/leads/o/${a.o.id}`, `/leads/o/${o2.id}`]) {
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
  await ctxM.close();
  ok(meta.length === 0, "nenhuma requisição à Meta saiu das páginas do CRM durante todo o teste");
  ok(erros.length === 0, `sem erros de JavaScript nas páginas do CRM${erros.length ? `: ${erros.join(" | ")}` : ""}`);
  ok(yc.envios.every((e) => e.to.startsWith("+5547") || e.to.startsWith("+5548")) && yc.envios.every((e) => e.from === NUMERO), "todos os envios do teste foram para números fictícios do próprio teste, pelo provedor simulado");
} catch (e) {
  falhas++;
  out.push(`FALHA erro inesperado: ${e.stack ?? e}`);
} finally {
  await browser.close();
  await sql.end();
  resend.close();
  ycloud.close();
  qstash.close();
}

out.push(`\n${out.filter((l) => l.startsWith("OK")).length} OK · ${falhas} falha(s)`);
console.log(out.join("\n"));
process.exit(falhas ? 1 : 0);
