// Testes REAIS contra o ambiente de teste do Mercado Pago (conta de teste), com o checkout rodando em localhost
// (scripts/sandbox-local.sh). Usa só os cartões de teste publicados pelo Mercado Pago; nenhum dinheiro real.
//
//   bash scripts/sandbox-local.sh            # em outro terminal (porta 3230)
//   node --no-warnings scripts/teste-sandbox-mp.mjs
//
// O que se espera da conta de teste: ela tem configuração de parcelamento própria ("parcelado cliente"), então o
// checkout DEVE recusar 2×, 3×, 6× e 12× sem cobrar (o Mercado Pago somaria juros). O que o comprador real paga na
// conta de produção é conferido à parte por scripts/sondar-parcelamento.mjs com a Public Key de produção.

import { readFileSync } from "node:fs";

const B = process.env.SANDBOX_URL || "http://localhost:3230";
const MP = "https://api.mercadopago.com";
const env = Object.fromEntries(
  readFileSync(".env.sandbox.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const PK = env.NEXT_PUBLIC_MP_PUBLIC_KEY;
const TOKEN = env.MP_ACCESS_TOKEN;

const out = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(path, init = {}) {
  const r = await fetch(B + path, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
let n = 0;
async function pedido(condicao) {
  n++;
  const r = await json("/api/sites-pacote/pedido", {
    method: "POST",
    body: JSON.stringify({
      nome: "Comprador Teste",
      email: `test_user_sandbox${Date.now()}${n}@testuser.com`,
      whatsapp: "(11) 98765-4321",
      condicao,
      aceite: true,
      utm: { utm_source: "sandbox", utm_campaign: "teste-mp" },
    }),
  });
  return { ...r, cred: r.body.id ? { id: r.body.id, t: r.body.token } : null };
}
const status = (c) => json(`/api/sites-pacote/status?p=${c.id}&t=${c.t}`).then((r) => r.body.pedido ?? r.body);

// Cartões de teste do Mercado Pago (Brasil). O nome do titular define o resultado: APRO aprovado, OTHE recusado,
// CONT pendente. CPF de teste 12345678909.
const CARTOES = {
  master: { numero: "5031433215406351", cvv: "123", bin: "503143" },
  visa: { numero: "4235647728025682", cvv: "123", bin: "423564" },
};
async function tokenCartao(bandeira, titular) {
  const c = CARTOES[bandeira];
  const r = await fetch(`${MP}/v1/card_tokens?public_key=${encodeURIComponent(PK)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      card_number: c.numero,
      expiration_month: 11,
      expiration_year: 2030,
      security_code: c.cvv,
      cardholder: { name: titular, identification: { type: "CPF", number: "12345678909" } },
    }),
  });
  const j = await r.json();
  if (!j.id) throw new Error(`token do cartão de teste não criado (HTTP ${r.status})`);
  return j.id;
}
async function emissor(bandeira, valor) {
  const r = await fetch(`${MP}/v1/payment_methods/installments?public_key=${encodeURIComponent(PK)}&amount=${valor}&bin=${CARTOES[bandeira].bin}`);
  const j = await r.json();
  return { paymentMethodId: j[0]?.payment_method_id ?? bandeira, issuerId: j[0]?.issuer?.id ? String(j[0].issuer.id) : null };
}
async function pagarCartao(c, bandeira, titular, parcelas, valor) {
  const { paymentMethodId, issuerId } = await emissor(bandeira, valor);
  const token = await tokenCartao(bandeira, titular);
  return json("/api/sites-pacote/cartao", {
    method: "POST",
    body: JSON.stringify({
      id: c.id,
      t: c.t,
      formData: {
        token,
        payment_method_id: paymentMethodId,
        issuer_id: issuerId,
        installments: parcelas,
        payer: { email: `test_user_pagador${Date.now()}@testuser.com`, identification: { type: "CPF", number: "12345678909" } },
      },
    }),
  });
}
/** pagamentos registrados no Mercado Pago para o pedido (busca pela referência externa, conta de teste) */
async function pagamentosNoMp(pedidoId) {
  const r = await fetch(`${MP}/v1/payments/search?external_reference=${encodeURIComponent(`site:${pedidoId}`)}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  return (await r.json()).results ?? [];
}

/* ─────────────── 0. ambiente ─────────────── */
{
  const me = await fetch(`${MP}/users/me`, { headers: { authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());
  ok((me.tags ?? []).includes("test_user"), `credenciais de um usuário de teste do Mercado Pago (${String(me.nickname).slice(0, 8)}…)`);
  const r = await fetch(`${B}/sites/pacote/checkout`);
  ok(r.status === 200, `checkout local respondendo em ${B}`);
}

/* ─────────────── 1. Pix ─────────────── */
{
  const r = await pedido("pix");
  ok(r.status === 200 && r.cred, `pedido Pix criado (HTTP ${r.status})`);
  const p = await status(r.cred);
  const pix = p?.pix ?? {};
  ok(p?.status === "pagamento_pendente", `Pix gerado no Mercado Pago → pedido "pagamento_pendente" (${p?.status})`);
  ok(typeof pix.copiaCola === "string" && pix.copiaCola.startsWith("000201") && !!pix.qrBase64, `código Pix copia e cola e QR Code devolvidos (validade ${pix.expiraEm})`);
  const pays = await pagamentosNoMp(r.cred.id);
  const pay = pays[0];
  ok(pay && pay.payment_method_id === "pix" && Number(pay.transaction_amount) === 449.9, `pagamento Pix no Mercado Pago com R$ 449,90 (${pay?.transaction_amount})`);
  ok(pay?.status === "pending", `Pix de teste fica pendente até ser pago (${pay?.status})`);
}

/* ─────────────── 2. Cartão 1× ─────────────── */
const resultados = {};
for (const [bandeira, titular, esperado] of [
  ["master", "APRO", "pago"],
  ["visa", "APRO", "pago"],
  ["master", "OTHE", "recusado"],
  ["master", "CONT", "pagamento_pendente"],
]) {
  const r = await pedido("cartao-1x");
  const c = r.cred;
  const pg = await pagarCartao(c, bandeira, titular, 1, "449.90");
  let p = pg.body.pedido ?? (await status(c));
  for (let i = 0; i < 6 && p?.status !== esperado; i++) {
    await espera(2500);
    p = await status(c);
  }
  const pays = await pagamentosNoMp(c.id);
  const pay = pays[0];
  resultados[`${bandeira}-${titular}`] = { pedido: c.id, status: p?.status, mp: pay?.status, total: pay?.transaction_details?.total_paid_amount };
  ok(p?.status === esperado, `cartão 1× ${bandeira} titular ${titular} → "${esperado}" (${p?.status}; Mercado Pago: ${pay?.status}/${pay?.status_detail})`);
  if (esperado === "pago") {
    ok(Number(pay?.transaction_amount) === 449.9 && Number(pay?.transaction_details?.total_paid_amount) === 449.9 && pay?.installments === 1, `  comprador pagou exatamente R$ 449,90 em 1× (${pay?.transaction_details?.total_paid_amount})`);
    ok(pay?.external_reference === `site:${c.id}` && pay?.statement_descriptor === "SPOLAOR", "  referência do pedido e descrição na fatura (SPOLAOR)");
    const de = await pagarCartao(c, bandeira, "APRO", 1, "449.90");
    const depois = await pagamentosNoMp(c.id);
    ok(de.status >= 400 && depois.length === pays.length, `  segundo pagamento no mesmo pedido recusado, sem nova cobrança (HTTP ${de.status}, ${de.body.error})`);
  }
}

/* ─────────────── 3. Parcelado na conta de teste (parcelado cliente) ─────────────── */
for (const [cond, parcelas, total] of [
  ["cartao-2x", 2, "469.80"],
  ["cartao-3x", 3, "479.70"],
  ["cartao-6x", 6, "509.40"],
  ["cartao-12x", 12, "574.80"],
]) {
  const r = await pedido(cond);
  const c = r.cred;
  const pg = await pagarCartao(c, "master", "APRO", parcelas, total);
  const pays = await pagamentosNoMp(c.id);
  ok(
    pg.status === 422 && pg.body.error === "parcelamento_indisponivel" && pays.length === 0,
    `${parcelas}× na conta de teste (com juros ao comprador) → recusado sem cobrar: "${String(pg.body.message ?? pg.body.error).slice(0, 70)}…"`,
  );
  const outra = await pagarCartao(c, "master", "APRO", 1, total);
  ok(outra.status === 422 && outra.body.error === "parcelas_divergentes", `  ${parcelas}× pedido com 1× no formulário → recusado (${outra.body.error})`);
}

const falhas = out.filter((l) => l.startsWith("FALHA")).length;
console.log(out.join("\n"));
console.log(`\n${out.length - falhas}/${out.length} conferências OK · ${new Date().toISOString()}`);
console.log(JSON.stringify(resultados));
process.exit(falhas ? 1 : 0);
