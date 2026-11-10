// Confere, SÓ LENDO, se o Mercado Pago cobra do comprador exatamente o total aprovado em cada parcelamento do
// pacote "Site de uma página". Faz apenas GET /v1/payment_methods/installments (a mesma consulta que o formulário
// de cartão faz no navegador): não cria pagamento, não cobra nada e não muda configuração.
//
// Uso:
//   node scripts/sondar-parcelamento.mjs --env .env.sandbox.local
//
// O arquivo (fica fora do git: .env*.local) precisa de UMA destas credenciais:
//   NEXT_PUBLIC_MP_PUBLIC_KEY=...   (Public Key. A de produção mostra o que o comprador real veria; é a chave
//                                    pública que vai no próprio site. A das credenciais de teste mostra a conta
//                                    de teste, que tem configuração de parcelamento própria.)
//   MP_ACCESS_TOKEN=TEST-...        (alternativa; só credencial TEST-)
//
// Nenhum valor de credencial é impresso. Sai com código 1 se alguma condição não bater.

import { readFileSync } from "node:fs";
import { CONDICOES } from "../src/lib/sites/oferta.ts";

const args = process.argv.slice(2);
const arquivo = args.includes("--env") ? args[args.indexOf("--env") + 1] : null;
const vars = { ...process.env };
if (arquivo) {
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

const publicKey = (vars.NEXT_PUBLIC_MP_PUBLIC_KEY || vars.MP_PUBLIC_KEY || "").trim();
const token = (vars.MP_ACCESS_TOKEN || "").trim();
const api = (vars.MP_API_URL || "https://api.mercadopago.com").replace(/\/+$/, "");

let auth;
if (publicKey) auth = { tipo: `Public Key ${publicKey.split("-")[0]}- (${arquivo ?? "variável de ambiente"})`, query: `public_key=${encodeURIComponent(publicKey)}`, headers: {} };
else if (token.startsWith("TEST-")) auth = { tipo: "Access Token de TESTE", query: "", headers: { authorization: `Bearer ${token}` } };
else {
  console.error("Falta credencial: NEXT_PUBLIC_MP_PUBLIC_KEY (TEST- ou APP_USR-) ou MP_ACCESS_TOKEN de TESTE.");
  console.error("Access Token de produção não é aceito aqui: para ver o que o comprador real veria, use a Public Key.");
  process.exit(2);
}

const bandeiras = (args.includes("--bandeiras") ? args[args.indexOf("--bandeiras") + 1] : "master,visa,elo,amex,hipercard").split(",");
const cartao = CONDICOES.filter((c) => c.meio === "cartao");
const reais = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

console.log(`Credencial: ${auth.tipo} · ${new Date().toISOString()}`);
console.log("Somente leitura (GET /v1/payment_methods/installments). Nada é cobrado.\n");

// Uma "falha" é só o que faria o comprador pagar diferente do aprovado: acréscimo, total diferente ou nenhum cartão de
// crédito da bandeira aceitar a parcela. Pré-pago (só 1×) e emissor com limite menor (ex.: cartão de loja até 10×)
// aparecem como informação: nesses cartões o checkout recusa sem cobrar e o comprador escolhe outra condição.
let falhas = 0;
for (const c of cartao) {
  console.log(`${c.parcelas}× de R$ ${reais(c.parcela)} — total aprovado R$ ${reais(c.total)}`);
  for (const b of bandeiras) {
    const qs = [auth.query, `amount=${c.total.toFixed(2)}`, `payment_method_id=${encodeURIComponent(b)}`].filter(Boolean).join("&");
    let corpo;
    try {
      const r = await fetch(`${api}/v1/payment_methods/installments?${qs}`, { headers: auth.headers });
      corpo = await r.json().catch(() => null);
      if (!r.ok) {
        console.log(`   ${b.padEnd(10)} bandeira não disponível na conta (HTTP ${r.status})`);
        continue;
      }
    } catch (e) {
      console.log(`   ${b.padEnd(10)} erro de rede: ${e.message}`);
      falhas++;
      continue;
    }
    if (!Array.isArray(corpo) || !corpo.length) {
      console.log(`   ${b.padEnd(10)} sem opções para esta bandeira`);
      continue;
    }
    const ok = [], acrescimo = [], semParcela = [], soAVista = [];
    for (const opcao of corpo) {
      const emissor = opcao.issuer?.name ?? "?";
      const tipo = opcao.payment_type_id ?? "credit_card";
      const pc = (opcao.payer_costs ?? []).find((x) => x.installments === c.parcelas);
      if (!pc) {
        const max = Math.max(...(opcao.payer_costs ?? []).map((x) => x.installments), 0);
        (tipo === "credit_card" ? semParcela : soAVista).push(`${emissor} (até ${max}×)`);
      } else if (Number(pc.installment_rate) === 0 && Math.abs(Number(pc.total_amount) - c.total) < 0.005) ok.push(tipo);
      else acrescimo.push(`${emissor}: ${c.parcelas}× de R$ ${reais(pc.installment_amount)} = R$ ${reais(pc.total_amount)} (+${reais(pc.installment_rate)}%)`);
    }
    if (acrescimo.length) falhas += acrescimo.length;
    if (!ok.some((t) => t === "credit_card")) falhas++;
    const cred = ok.filter((t) => t === "credit_card").length;
    const outros = ok.length - cred;
    const partes = [cred ? `✓ ${cred} cartão(ões) de crédito${outros ? ` e ${outros} pré-pago(s)` : ""}: R$ ${reais(c.total)} sem acréscimo` : "✗ nenhum cartão de crédito aceita"];
    if (acrescimo.length) partes.push(`✗ COM ACRÉSCIMO: ${acrescimo.join("; ")}`);
    if (semParcela.length) partes.push(`limite do emissor: ${semParcela.join(", ")}`);
    if (soAVista.length && c.parcelas > 1) partes.push(`pré-pago só 1×: ${soAVista.length}`);
    console.log(`   ${b.padEnd(10)} ${partes.join(" · ")}`);
  }
}

console.log("");
console.log(
  falhas
    ? `${falhas} problema(s): há cobrança diferente do total aprovado.`
    : "Nenhuma cobrança acima do total aprovado: onde a parcela existe, o comprador paga exatamente o total.",
);
process.exit(falhas ? 1 : 0);
