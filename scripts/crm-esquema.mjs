// Gera src/lib/crm/schema.ts a partir de db/crm.sql (fonte única do esquema do CRM).
// Uso: node scripts/crm-esquema.mjs   (rode depois de editar db/crm.sql e aumente a versão abaixo)
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const sql = readFileSync(new URL("../db/crm.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const versao = createHash("sha256").update(sql).digest("hex").slice(0, 12);
const out =
  "// GERADO por scripts/crm-esquema.mjs a partir de db/crm.sql. Não edite à mão.\n" +
  "// Aplicado automaticamente (idempotente) na primeira conexão; a versão evita reaplicar a cada início a frio.\n" +
  `export const CRM_SCHEMA_VERSAO = ${JSON.stringify(versao)};\n` +
  `export const CRM_SCHEMA_SQL = ${JSON.stringify(sql)};\n`;
writeFileSync(new URL("../src/lib/crm/schema.ts", import.meta.url), out);
console.log(`schema.ts gerado (versão ${versao})`);
