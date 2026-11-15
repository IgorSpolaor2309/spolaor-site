import { CRM_SCHEMA_SQL, CRM_SCHEMA_VERSAO } from "./schema";

// Conexão do CRM com o Postgres do site (DATABASE_URL, o mesmo das tabelas ia_* e site_*).
// O esquema (db/crm.sql) é aplicado na primeira conexão, uma vez por versão, pela conexão direta quando houver.

export type Sql = import("postgres").Sql;
// Dentro de sql.begin o parâmetro é TransactionSql; as consultas aceitam os dois.
export type Db = Sql | import("postgres").TransactionSql;

const g = globalThis as unknown as { __crmSql?: Promise<Sql> };

/** Há banco configurado? Sem ele o CRM não existe e os formulários seguem só com o aviso por e-mail. */
export const crmConfigured = () => !!process.env.DATABASE_URL;

async function open(): Promise<Sql> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(process.env.DATABASE_URL!, { max: Number(process.env.CRM_DB_POOL_MAX) || 3, idle_timeout: 20, prepare: false, onnotice: () => {} });
  const atual = await sql`select valor from crm_config where chave = 'esquema'`.then(
    (r) => r[0]?.valor as string | undefined,
    () => undefined, // tabela ainda não existe
  );
  if (atual !== CRM_SCHEMA_VERSAO) {
    const ddl = postgres(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
    try {
      // Uma instância por vez aplica o esquema (início a frio simultâneo).
      await ddl.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(7420115)`;
        await tx.unsafe(CRM_SCHEMA_SQL);
        await tx`
          insert into crm_config (chave, valor) values ('esquema', ${tx.json(CRM_SCHEMA_VERSAO)})
          on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`;
      });
    } finally {
      await ddl.end({ timeout: 5 });
    }
  }
  return sql;
}

/** Conexão pronta (esquema aplicado). Lança erro se não há DATABASE_URL ou se o banco não respondeu. */
export function db(): Promise<Sql> {
  if (!crmConfigured()) return Promise.reject(new Error("DATABASE_URL não definida"));
  if (!g.__crmSql) {
    g.__crmSql = open().catch((e) => {
      g.__crmSql = undefined; // tenta de novo na próxima chamada
      throw e;
    });
  }
  return g.__crmSql;
}

/** Diagnóstico para a tela de integrações: o banco responde? */
export async function dbStatus(): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!crmConfigured()) return { ok: false, erro: "DATABASE_URL não definida" };
  try {
    const sql = await db();
    await sql`select 1`;
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message.slice(0, 200) };
  }
}
