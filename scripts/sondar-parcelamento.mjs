// Confere, SÓ LENDO, se o Mercado Pago cobra do comprador exatamente o total aprovado em cada parcelamento do
// pacote "Site de uma página". Faz apenas GET /v1/payment_methods/installments (a mesma consulta que o formulário
// de cartão faz no navegador): não cria pagamento, não cobra nada e não muda configuração.
//
// Uso:
//   node scripts/sondar-parcelamento.mjs --env .env.sandbox.local
//
// O arquivo (fica fora do git: .env*.local) precisa de UMA destas credenciais:
//   NEXT_PUBLIC_MP_PUBLIC_KEY=...   (Public Key: TEST- mostra o ambiente de teste; APP_USR- mostra o que o
//                                    comprador real veria. É a chave pública que vai no próprio site.)
//   MP_ACCESS_TOKEN=TEST-...        (alternativa; só credencial de TESTE)
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
if (publicKey) auth = { tipo: `Public Key ${publicKey.startsWith("TEST-") ? "de TESTE" : "de PRODUÇÃO"}`, query: `public_key=${encodeURIComponent(publicKey)}`, headers: {} };
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
        console.log(`   ${b.padEnd(10)} HTTP ${r.status}${corpo?.message ? ` (${corpo.message})` : ""}`);
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
    for (const opcao of corpo) {
      const pc = (opcao.payer_costs ?? []).find((x) => x.installments === c.parcelas);
      const emissor = opcao.issuer?.name ? ` (${opcao.issuer.name})` : "";
      if (!pc) {
        console.log(`   ${b.padEnd(10)} ✗ não oferece ${c.parcelas}×${emissor}`);
        falhas++;
        continue;
      }
      const ok = Number(pc.installment_rate) === 0 && Math.abs(Number(pc.total_amount) - c.total) < 0.005;
      if (!ok) falhas++;
      console.log(
        `   ${b.padEnd(10)} ${ok ? "✓" : "✗"} comprador pagaria ${c.parcelas}× de R$ ${reais(pc.installment_amount)} = R$ ${reais(pc.total_amount)} (acréscimo ${reais(pc.installment_rate)}%)${emissor}`,
      );
    }
  }
}

console.log(falhas ? `\n${falhas} combinação(ões) NÃO batem com o total aprovado.` : "\nTodas as condições batem com o total aprovado.");
process.exit(falhas ? 1 : 0);
