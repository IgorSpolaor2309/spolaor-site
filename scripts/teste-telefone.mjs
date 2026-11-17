#!/usr/bin/env node
// Testes sem rede da máscara do campo WhatsApp e da validação (lib/leads/schema.ts) e da normalização usada pelo
// CRM (lib/crm/normalizar.ts), incluindo a digitação caractere a caractere, como acontece no formulário.
// Caso real (17/11/2026): "+55 13 99747-2309" digitado no formulário virou "(55) 13997-4723" (a máscara cortava
// em 11 dígitos), o CRM gravou 5555139974723 e o número não foi reconhecido como número de controle.
// Uso: node scripts/teste-telefone.mjs   (Node 24: importa os .ts direto, sem compilar)
import { maskPhone, validateLead, whatsappNacional } from "../src/lib/leads/schema.ts";
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
const erroWhats = (v) => validateLead({ nome: "Teste", empresa: "Empresa", whatsapp: v, email: "a@b.com", tipo: "projeto" }).whatsapp;

const CONTROLE = "5513997472309";
const validos = [
  // [entrada, exibição esperada, normalização esperada pelo CRM]
  ["13997472309", "(13) 99747-2309", CONTROLE],
  ["(13) 99747-2309", "(13) 99747-2309", CONTROLE],
  ["+55 13 99747-2309", "+55 (13) 99747-2309", CONTROLE],
  ["+55 (13) 99747-2309", "+55 (13) 99747-2309", CONTROLE],
  ["55 13 99747 2309", "+55 (13) 99747-2309", CONTROLE],
  ["5513997472309", "+55 (13) 99747-2309", CONTROLE],
  ["013 99747-2309", "(13) 99747-2309", CONTROLE],
  ["0055 13 99747-2309", "+55 (13) 99747-2309", CONTROLE],
  // fixo
  ["1332345678", "(13) 3234-5678", "551332345678"],
  ["+55 13 3234-5678", "+55 (13) 3234-5678", "551332345678"],
  // DDD 55 (RS), com e sem DDI
  ["55 99123-4567", "(55) 99123-4567", "5555991234567"],
  ["+55 55 99123-4567", "+55 (55) 99123-4567", "5555991234567"],
  ["55 3222-1234", "(55) 3222-1234", "555532221234"],
  ["+55 55 3222-1234", "+55 (55) 3222-1234", "555532221234"],
];

for (const [entrada, exibicao, normal] of validos) {
  for (const [modo, fn] of [["digitando", digitar], ["colando", colar]]) {
    const v = fn(entrada);
    ok(v === exibicao, `${modo} "${entrada}" exibe "${exibicao}"`, `obtido "${v}"`);
    ok(normWhatsapp(v) === normal, `${modo} "${entrada}" normaliza para ${normal}`, `obtido ${normWhatsapp(v)}`);
    ok(!erroWhats(v), `${modo} "${entrada}" passa na validação`, erroWhats(v));
  }
}

// Inválidos: precisam ser RECUSADOS pela validação; nenhum pode virar, sem aviso, outro número aceito.
const invalidos = [
  ["(55) 13997-4723", "resto do +55 cortado pela máscara antiga"],
  ["+55 13 99747-230", "+55 com um dígito a menos"],
  ["13 99747-23099", "nacional com dígitos a mais"],
  ["+55 13 99747-23099", "+55 com dígito a mais"],
  ["13 9974-7230", "10 dígitos começando por 9 (celular sem o 9 inicial)"],
  ["13 89747-2309", "11 dígitos sem o 9 do celular"],
  ["10 99747-2309", "DDD com zero"],
  ["1 99747-2309", "sem um dígito do DDD"],
  ["99747-2309", "sem DDD"],
  ["+1 415 555 1234", "número estrangeiro (formulário aceita só Brasil)"],
];
for (const [entrada, motivo] of invalidos) {
  for (const [modo, fn] of [["digitando", digitar], ["colando", colar]]) {
    const v = fn(entrada);
    ok(!!erroWhats(v), `${modo} "${entrada}" é recusado (${motivo})`, `exibido "${v}", aceito como ${whatsappNacional(v)}`);
    const dEntrada = entrada.replace(/\D/g, "").replace(/^0+/, "");
    const dExibido = v.replace(/\D/g, "");
    ok(dExibido === dEntrada.slice(0, 15), `${modo} "${entrada}" não perde dígitos na tela`, `exibido "${v}"`);
  }
}

// Campo vazio e mensagens
ok(erroWhats("") === "Informe um WhatsApp com DDD.", "vazio pede o WhatsApp");
ok(/Confira/.test(erroWhats("(55) 13997-4723") ?? ""), "número impossível pede para conferir");

// Caso real: o número de controle só é reconhecido se chegar inteiro.
ok(normWhatsapp(digitar("+55 13 99747-2309")) === CONTROLE, "caso real: +55 digitado é reconhecido como número de controle");
ok(normWhatsapp("(55) 13997-4723") === "5555139974723", "registro: o valor antigo cortado continua irrecuperável (5555139974723)");

// Apagar e editar: o campo controlado recebe o texto já editado e reaplica a máscara.
const apagarUltimo = (v) => maskPhone(v.slice(0, -1));
let v = digitar("+55 13 99747-2309");
v = apagarUltimo(v);
ok(v === "+55 (13) 9974-7230", "apagar o último dígito do +55 reformata sem perder os outros", v);
v = apagarUltimo(v);
ok(v === "(55) 13997-4723", "com 11 dígitos volta ao formato nacional (e a validação recusa)", v);
ok(!!erroWhats(v), "esse estado intermediário não é aceito");
v = digitar("(13) 99747-2309");
ok(maskPhone(v.replace("99747", "98747")) === "(13) 98747-2309", "trocar um dígito no meio mantém o resto");
ok(maskPhone(v.replace("99747", "9947")) === "(13) 9947-2309", "apagar um dígito no meio reformata como 10 dígitos");
ok(!!erroWhats(maskPhone(v.replace("99747", "9947"))), "e esse número (celular sem um dígito) é recusado");

// Entradas curtas
ok(maskPhone("1") === "(1", "um dígito");
ok(maskPhone("139") === "(13) 9", "início do número");
ok(normWhatsapp("123") === null, "número curto não normaliza");

console.log(`\n${total - falhas}/${total} verificações ok`);
process.exit(falhas ? 1 : 0);
