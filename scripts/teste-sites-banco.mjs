// Teste da trava de tentativa de cobrança no BANCO (src/lib/sites/store.ts, abrirTentativaCartao), sem servidor web e
// sem Mercado Pago. Prova que requisições simultâneas ao mesmo pedido nunca abrem tentativas independentes e que a
// tentativa incerta é retomada com a mesma chave.
//
//   node --no-warnings scripts/teste-sites-banco.mjs --memoria
//   SITES_TESTE_DATABASE_URL=postgres://postgres:teste@localhost:5432/postgres node --no-warnings scripts/teste-sites-banco.mjs
//
// Com Postgres, só aceita banco em localhost/127.0.0.1 (cria as tabelas site_* e grava pedidos de teste).
import postgres from "postgres";

const memoria = process.argv.includes("--memoria");
const url = process.env.SITES_TESTE_DATABASE_URL ?? "";
if (memoria) process.env.SITES_STORE = "memory";
else {
  if (!/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    console.error("Use --memoria ou SITES_TESTE_DATABASE_URL apontando para um Postgres em localhost (nunca o banco de produção).");
    process.exit(2);
  }
  delete process.env.SITES_STORE;
  delete process.env.IA_STORE;
  process.env.DATABASE_URL = url;
  delete process.env.DATABASE_URL_UNPOOLED;
  process.env.SITES_DB_POOL_MAX = "10"; // conexões de verdade em paralelo
}
const { sitesStore, SITES_SCHEMA_SQL } = await import("../src/lib/sites/store.ts");

const out = [];
const ok = (c, m) => out.push(`${c ? "OK   " : "FALHA"} ${m}`);
const s = sitesStore();
const base = { chavePedido: null, nome: "Teste Banco", email: "banco@exemplo.test", whatsapp: "11987654321", utm: {} };
const pedidoCartao = async (cond = "cartao-12x", parcelas = 12) =>
  (await s.create({ ...base, condicao: cond, meio: "cartao", parcelas, valorParcela: 47.9, total: 574.8 })).pedido;
const juntos = (n, f) => Promise.all(Array.from({ length: n }, f));

let raw = null;
if (!memoria) {
  raw = postgres(url, { max: 2, onnotice: () => {} });
  await raw.unsafe(SITES_SCHEMA_SQL);
  await raw.unsafe(SITES_SCHEMA_SQL); // o esquema é idempotente (alter table … add column if not exists)
  const cols = await raw`select column_name from information_schema.columns where table_name = 'site_pedidos' and column_name like 'tentativa_%' order by 1`;
  ok(cols.map((c) => c.column_name).join(",") === "tentativa_chave,tentativa_em,tentativa_estado", "esquema: colunas da tentativa criadas, e o DDL roda duas vezes sem erro");
}

// 1. 20 requisições simultâneas a um pedido novo → só uma abre a tentativa
{
  const p = await pedidoCartao();
  const r = await juntos(20, () => s.abrirTentativaCartao(p.id, 90));
  const abertas = r.filter(Boolean);
  const depois = await s.get(p.id);
  ok(
    abertas.length === 1 && abertas[0].retomada === false && abertas[0].chave === `site-${p.id}-cartao-1` && depois.tentativas === 1 && depois.tentativaEstado === "em_curso",
    `20 abrirTentativaCartao simultâneos → 1 tentativa aberta (chave -cartao-1), 19 recusados (${abertas.length} abertas)`,
  );

  // 2. resultado incerto → 10 retomadas simultâneas: só uma, com a MESMA chave e o mesmo número
  await s.update(p.id, { status: "pagamento_pendente", tentativaEstado: "incerta" });
  const r2 = (await juntos(10, () => s.abrirTentativaCartao(p.id, 90))).filter(Boolean);
  const d2 = await s.get(p.id);
  ok(
    r2.length === 1 && r2[0].retomada === true && r2[0].chave === `site-${p.id}-cartao-1` && d2.tentativas === 1,
    `tentativa incerta + 10 retomadas simultâneas → 1 retomada com a mesma chave e o mesmo número (${r2.length})`,
  );

  // 3. recusa definitiva (tentativa fechada) → nova tentativa com chave nova; a order recusada sai do pedido
  await s.update(p.id, { status: "recusado", tentativaEstado: null, mpPaymentId: "ORDRECUSADA1" });
  const r3 = (await juntos(5, () => s.abrirTentativaCartao(p.id, 90))).filter(Boolean);
  const d3 = await s.get(p.id);
  ok(
    r3.length === 1 && r3[0].retomada === false && r3[0].chave === `site-${p.id}-cartao-2` && d3.tentativas === 2 && d3.mpPaymentId === null,
    "depois de recusa definitiva → 1 tentativa nova (chave -cartao-2), sem a order recusada como atual",
  );

  // 4. em_curso recente não é retomada; parada há mais de 90 s (ex.: servidor caiu) é retomada com a mesma chave
  ok((await s.abrirTentativaCartao(p.id, 90)) === null, "tentativa em curso recente → nova requisição recusada");
  if (raw) await raw`update site_pedidos set tentativa_em = now() - interval '200 seconds' where id = ${p.id}`;
  else await s.update(p.id, { tentativaEm: new Date(Date.now() - 200_000).toISOString() });
  const r4 = await s.abrirTentativaCartao(p.id, 90);
  ok(r4?.retomada === true && r4.chave === `site-${p.id}-cartao-2`, "tentativa em curso parada há 200 s → retomada com a mesma chave");

  // 5. pedido pago não abre tentativa
  await s.update(p.id, { status: "pago", tentativaEstado: null });
  ok((await s.abrirTentativaCartao(p.id, 90)) === null, "pedido pago → nenhuma tentativa");
}
// 6. pedido de Pix não abre tentativa de cartão
{
  const p = (await s.create({ ...base, condicao: "pix", meio: "pix", parcelas: 1, valorParcela: 449.9, total: 449.9 })).pedido;
  ok((await s.abrirTentativaCartao(p.id, 90)) === null, "pedido de Pix → nenhuma tentativa de cartão");
}

if (raw) await raw.end({ timeout: 5 });
const falhas = out.filter((l) => l.startsWith("FALHA")).length;
console.log(`Banco: ${memoria ? "memória" : "Postgres"}\n${out.join("\n")}\n\n${out.length - falhas}/${out.length} conferências OK`);
process.exit(falhas ? 1 : 0);
