#!/usr/bin/env node
// Testes sem rede da máscara do campo WhatsApp (lib/leads/schema.ts) e da normalização usada pelo CRM
// (lib/crm/normalizar.ts), incluindo a digitação caractere a caractere, como acontece no formulário.
// Caso real (17/11/2026): "+55 13 99747-2309" digitado no formulário virou "(55) 13997-4723" (a máscara
// cortava em 11 dígitos), o CRM gravou 5555139974723 e o número não foi reconhecido como número de controle.
// Uso: node scripts/teste-telefone.mjs   (Node 24: importa os .ts direto, sem compilar)
import { maskPhone, validateLead } from "../src/lib/leads/schema.ts";
import { normWhatsapp } from "../src/lib/crm/normalizar.ts";

let falhas = 0;
let total = 0;
const ok = (cond, nome, extra = "") => {
  total++;
  if (cond) console.log(`ok   ${nome}`);
  else {
    falhas++;
    console.log(`FALHA ${nome}${extra ? `\n      ${extra}` : ""}`);
  }
};

/** Simula o campo controlado: cada tecla é acrescentada ao valor já mascarado e passa de novo pela máscara. */
function digitar(texto) {
  let valor = "";
  for (const ch of texto) valor = maskPhone(valor + ch);
  return valor;
}
/** Simula colar o texto inteiro de uma vez. */
const colar = (texto) => maskPhone(texto);

const CONTROLE = "5513997472309";
const casos = [
  // [entrada, exibição esperada, normalização esperada]
  ["13997472309", "(13) 99747-2309", CONTROLE],
  ["(13) 99747-2309", "(13) 99747-2309", CONTROLE],
  ["+55 13 99747-2309", "+55 (13) 99747-2309", CONTROLE],
  ["+55 (13) 99747-2309", "+55 (13) 99747-2309", CONTROLE],
  ["55 13 99747 2309", "+55 (13) 99747-2309", CONTROLE],
  ["5513997472309", "+55 (13) 99747-2309", CONTROLE],
  ["013 99747-2309", "(13) 99747-2309", CONTROLE],
  ["1332345678", "(13) 3234-5678", "551332345678"],
  ["+55 13 3234-5678", "+55 (13) 3234-5678", "551332345678"],
  // DDD 55 (RS) continua funcionando sem DDI
  ["55 99123-4567", "(55) 99123-4567", "5555991234567"],
  ["+55 55 99123-4567", "+55 (55) 99123-4567", "5555991234567"],
];

for (const [entrada, exibicao, normal] of casos) {
  for (const [modo, fn] of [["digitando", digitar], ["colando", colar]]) {
    const v = fn(entrada);
    ok(v === exibicao, `${modo} "${entrada}" exibe "${exibicao}"`, `obtido "${v}"`);
    const n = normWhatsapp(v);
    ok(n === normal, `${modo} "${entrada}" normaliza para ${normal}`, `obtido ${n}`);
    const erros = validateLead({ nome: "Teste", empresa: "Empresa", whatsapp: v, email: "a@b.com", tipo: "contato" });
    ok(!erros.whatsapp, `${modo} "${entrada}" passa na validação do formulário`, JSON.stringify(erros));
  }
}

// O número do caso real só é reconhecido como controle se chegar inteiro.
ok(normWhatsapp(digitar("+55 13 99747-2309")) === CONTROLE, "caso real: +55 digitado é reconhecido como número de controle");
ok(normWhatsapp("(55) 13997-4723") === "5555139974723", "registro: o valor antigo cortado continua irrecuperável (5555139974723)");

// Entradas curtas e vazias
ok(maskPhone("") === "", "vazio continua vazio");
ok(maskPhone("1") === "(1", "um dígito");
ok(maskPhone("139") === "(13) 9", "início do número");
ok(normWhatsapp("123") === null, "número curto não normaliza");
ok(digitar("+55 13 99747-2309 999") === "+55 (13) 99747-2309", "dígitos além de 13 são ignorados");

console.log(`\n${total - falhas}/${total} verificações ok`);
process.exit(falhas ? 1 : 0);
