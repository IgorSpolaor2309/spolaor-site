import { randomBytes, randomUUID, createHash } from "node:crypto";
import { SCHEMA_SQL } from "./schema";

// Persistência das contratações. Fonte de verdade do fluxo: cada webhook relê o recurso no
// Mercado Pago e grava o estado aqui. Duas implementações:
// - Postgres (DATABASE_URL): produção e prévia. Esquema em db/atendimento-ia.sql.
// - Memória (IA_STORE=memory): só para testes locais; recusada em produção (config.readiness).

/** Etapas comerciais, na ordem em que acontecem. */
export type Etapa =
  | "aguardando_pagamento" // assinatura criada, cliente ainda no checkout
  | "assinatura_autorizada" // meio de pagamento autorizado, sem cobrança aprovada ainda
  | "pagamento_confirmado" // primeira cobrança aprovada e conferida; criando o acesso
  | "ativacao_pendente" // pago, mas a criação no ZappMillion falhou (nova tentativa segura)
  | "acesso_criado" // cliente criado no ZappMillion; convite por e-mail enviado por eles
  | "suspensa" // acesso suspenso (inadimplência, estorno ou contestação)
  | "cancelada"; // assinatura cancelada; acesso mantido até o fim do período pago

export type Contratacao = {
  id: string;
  /** externalId estável no ZappMillion: impede criação e cobrança duplicadas */
  externalId: string;
  tokenHash: string;
  etapa: Etapa;
  empresa: string;
  responsavel: string;
  email: string;
  telefone: string;
  segmento: string | null;
  precoMensal: number;
  zmPlanId: string;
  utm: Record<string, string>;
  mpPreapprovalId: string | null;
  mpStatus: string | null;
  pagoAte: string | null; // fim do período coberto pela última cobrança aprovada
  primeiroPagamentoEm: string | null;
  zmStatus: string | null; // ACTIVE | SUSPENDED | CANCELED
  zmOrganizationId: string | null;
  zmWorkspaceId: string | null;
  zmUserId: string | null;
  zmPeriodoFim: string | null; // currentPeriodEnd da assinatura no fornecedor
  whatsappStatus: string | null; // messagingAccount.status
  ultimoErro: string | null;
  tentativas: number;
  proximaTentativa: string | null;
  motivoSuspensao: string | null;
  /** fim de período (pagoAte) para o qual a operação já recebeu o pré-aviso de risco de custo */
  preAvisoPara: string | null;
  /** fim de período para o qual a operação já foi avisada de que o fornecedor renovou sem recebimento */
  avisoFornecedorPara: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type Cobranca = {
  id: string; // id do authorized_payment no Mercado Pago
  contratacaoId: string;
  status: string; // status do authorized_payment
  pagamentoId: string | null; // payment.id
  pagamentoStatus: string | null; // approved | refunded | charged_back | rejected ...
  valor: number;
  moeda: string;
  dataDebito: string | null;
  /** quando a aprovação foi aplicada (período estendido); null = ainda não */
  aprovadaEm?: string | null;
  atualizadoEm: string;
};

export interface Store {
  create(c: Omit<Contratacao, "id" | "externalId" | "tokenHash" | "criadoEm" | "atualizadoEm">): Promise<{ contratacao: Contratacao; token: string }>;
  get(id: string): Promise<Contratacao | null>;
  byPreapproval(preapprovalId: string): Promise<Contratacao | null>;
  update(id: string, patch: Partial<Contratacao>): Promise<Contratacao>;
  list(filter: { etapas?: Etapa[] }): Promise<Contratacao[]>;
  upsertCobranca(c: Cobranca): Promise<{ previous: Cobranca | null }>;
  /**
   * Marca a cobrança como aprovada UMA vez. Devolve true só para quem marcou primeiro: notificações
   * simultâneas da mesma cobrança não estendem o período nem criam o acesso duas vezes.
   */
  claimApproval(cobrancaId: string): Promise<boolean>;
  cobrancaByPagamento(pagamentoId: string): Promise<Cobranca | null>;
  cobrancas(contratacaoId: string): Promise<Cobranca[]>;
  /** Registra o evento; false se já tinha sido processado (notificação repetida). */
  markEvent(key: string): Promise<boolean>;
  unmarkEvent(key: string): Promise<void>;
}

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const now = () => new Date().toISOString();

function newRecord(c: Parameters<Store["create"]>[0]) {
  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  const contratacao: Contratacao = { ...c, id, externalId: `spolaor-ia-${id}`, tokenHash: hashToken(token), criadoEm: now(), atualizadoEm: now() };
  return { contratacao, token };
}

/* ───────────────────────────── memória (testes) ───────────────────────────── */

type Mem = { c: Map<string, Contratacao>; cob: Map<string, Cobranca>; ev: Set<string> };
const g = globalThis as unknown as { __iaMem?: Mem };
const mem = (): Mem => (g.__iaMem ??= { c: new Map(), cob: new Map(), ev: new Set() });

const memoryStore: Store = {
  async create(c) {
    const r = newRecord(c);
    mem().c.set(r.contratacao.id, r.contratacao);
    return r;
  },
  async get(id) {
    return mem().c.get(id) ?? null;
  },
  async byPreapproval(pid) {
    return [...mem().c.values()].find((c) => c.mpPreapprovalId === pid) ?? null;
  },
  async update(id, patch) {
    const cur = mem().c.get(id);
    if (!cur) throw new Error("Contratação não encontrada");
    const next = { ...cur, ...patch, atualizadoEm: now() };
    mem().c.set(id, next);
    return next;
  },
  async list({ etapas }) {
    return [...mem().c.values()].filter((c) => !etapas || etapas.includes(c.etapa));
  },
  async upsertCobranca(c) {
    const previous = mem().cob.get(c.id) ?? null;
    mem().cob.set(c.id, { ...c, aprovadaEm: previous?.aprovadaEm ?? null });
    return { previous };
  },
  async claimApproval(id) {
    const cur = mem().cob.get(id);
    if (!cur || cur.aprovadaEm) return false;
    cur.aprovadaEm = now();
    return true;
  },
  async cobrancaByPagamento(pid) {
    return [...mem().cob.values()].find((c) => c.pagamentoId === pid) ?? null;
  },
  async cobrancas(cid) {
    return [...mem().cob.values()].filter((c) => c.contratacaoId === cid);
  },
  async markEvent(key) {
    if (mem().ev.has(key)) return false;
    mem().ev.add(key);
    return true;
  },
  async unmarkEvent(key) {
    mem().ev.delete(key);
  },
};

/* ───────────────────────────────── Postgres ───────────────────────────────── */

// Colunas em snake_case; conversão automática para camelCase.
const toSnake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, m) => m.toUpperCase());
function fromRow<T>(row: Record<string, unknown>): T {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) o[toCamel(k)] = v instanceof Date ? v.toISOString() : typeof v === "string" && /^-?\d+\.\d+$/.test(v) && (k === "preco_mensal" || k === "valor") ? Number(v) : v;
  return o as T;
}

type Sql = import("postgres").Sql;
let sqlPromise: Promise<Sql> | null = null;
async function sql(): Promise<Sql> {
  sqlPromise ??= (async () => {
    const { default: postgres } = await import("postgres");
    // Esquema idempotente na primeira conexão, pela conexão direta (DATABASE_URL_UNPOOLED, da Neon) quando houver.
    const ddl = postgres(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
    try {
      await ddl.unsafe(SCHEMA_SQL);
    } finally {
      await ddl.end({ timeout: 5 });
    }
    return postgres(process.env.DATABASE_URL!, { max: Number(process.env.IA_DB_POOL_MAX) || 3, idle_timeout: 20, prepare: false });
  })().catch((e) => {
    sqlPromise = null; // permite nova tentativa na próxima requisição
    throw e;
  });
  return sqlPromise;
}

/** Saúde do banco para a operação: conecta, garante o esquema e conta as contratações. */
export async function dbHealth(): Promise<{ ok: boolean; tabelas?: string[]; contratacoes?: number; erro?: string }> {
  if (process.env.IA_STORE === "memory") return { ok: true, tabelas: ["(memória)"] };
  if (!process.env.DATABASE_URL) return { ok: false, erro: "DATABASE_URL não definida" };
  try {
    const db = await sql();
    const t = await db`select table_name from information_schema.tables where table_schema = 'public' and table_name like 'ia\_%' order by 1`;
    const [{ n }] = await db`select count(*)::int as n from ia_contratacoes`;
    return { ok: true, tabelas: t.map((r) => r.table_name as string), contratacoes: n };
  } catch (e) {
    return { ok: false, erro: (e as Error).message.slice(0, 200) };
  }
}

const pgStore: Store = {
  async create(c) {
    const r = newRecord(c);
    const db = await sql();
    const row = Object.fromEntries(Object.entries(r.contratacao).map(([k, v]) => [toSnake(k), v]));
    await db`insert into ia_contratacoes ${db(row as Record<string, never>)}`;
    return r;
  },
  async get(id) {
    const db = await sql();
    const [row] = await db`select * from ia_contratacoes where id = ${id}`;
    return row ? fromRow<Contratacao>(row) : null;
  },
  async byPreapproval(pid) {
    const db = await sql();
    const [row] = await db`select * from ia_contratacoes where mp_preapproval_id = ${pid}`;
    return row ? fromRow<Contratacao>(row) : null;
  },
  async update(id, patch) {
    const db = await sql();
    const row = Object.fromEntries(Object.entries({ ...patch, atualizadoEm: now() }).map(([k, v]) => [toSnake(k), v]));
    const [res] = await db`update ia_contratacoes set ${db(row as Record<string, never>)} where id = ${id} returning *`;
    if (!res) throw new Error("Contratação não encontrada");
    return fromRow<Contratacao>(res);
  },
  async list({ etapas }) {
    const db = await sql();
    const rows = etapas?.length ? await db`select * from ia_contratacoes where etapa in ${db(etapas)}` : await db`select * from ia_contratacoes`;
    return rows.map((r) => fromRow<Contratacao>(r));
  },
  async upsertCobranca(c) {
    const db = await sql();
    const [prev] = await db`select * from ia_cobrancas where id = ${c.id}`;
    const row = Object.fromEntries(Object.entries(c).map(([k, v]) => [toSnake(k), v]));
    await db`insert into ia_cobrancas ${db(row as Record<string, never>)}
      on conflict (id) do update set ${db(row as Record<string, never>, Object.keys(row).filter((k) => k !== "id") as never[])}`;
    return { previous: prev ? fromRow<Cobranca>(prev) : null };
  },
  async claimApproval(id) {
    const db = await sql();
    const res = await db`update ia_cobrancas set aprovada_em = now() where id = ${id} and aprovada_em is null returning id`;
    return res.length > 0;
  },
  async cobrancaByPagamento(pid) {
    const db = await sql();
    const [row] = await db`select * from ia_cobrancas where pagamento_id = ${pid}`;
    return row ? fromRow<Cobranca>(row) : null;
  },
  async cobrancas(cid) {
    const db = await sql();
    const rows = await db`select * from ia_cobrancas where contratacao_id = ${cid} order by data_debito`;
    return rows.map((r) => fromRow<Cobranca>(r));
  },
  async markEvent(key) {
    const db = await sql();
    const res = await db`insert into ia_eventos (chave) values (${key}) on conflict do nothing returning chave`;
    return res.length > 0;
  },
  async unmarkEvent(key) {
    const db = await sql();
    await db`delete from ia_eventos where chave = ${key}`;
  },
};

export function store(): Store {
  if (process.env.IA_STORE === "memory") {
    if (process.env.VERCEL_ENV === "production") throw new Error("IA_STORE=memory não é permitido em produção");
    return memoryStore;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não definida");
  return pgStore;
}
