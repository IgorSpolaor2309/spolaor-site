import { createHash, randomBytes, randomUUID } from "node:crypto";

// Pedidos do pacote "Site de uma página" (venda avulsa). Tabelas próprias (site_*), no mesmo banco da IA, sem tocar
// nas tabelas ia_*. Fonte de verdade do pagamento: cada notificação e cada conferência relê o pagamento no Mercado
// Pago e grava aqui. Duas implementações, como na IA: Postgres (DATABASE_URL) e memória (SITES_STORE=memory ou
// IA_STORE=memory, só para testes locais; recusada na Vercel por sitesReadiness).

/**
 * Estado do pedido:
 * - criado: dados aceitos, nenhum pagamento iniciado ainda (ex.: comprador no formulário do cartão);
 * - pagamento_pendente: há um pagamento no Mercado Pago aguardando (Pix gerado, cartão em análise);
 * - pago: pagamento aprovado e conferido (valor, moeda e parcelas iguais à condição aprovada);
 * - recusado: a última tentativa foi recusada (pode tentar de novo);
 * - expirado: o Pix venceu ou foi cancelado sem pagamento (pode gerar outro);
 * - estornado: o pagamento aprovado foi devolvido ou contestado;
 * - divergente: aprovado com valor/parcelas diferentes do esperado — NÃO conta como pago; a operação é avisada.
 */
export type StatusPedido = "criado" | "pagamento_pendente" | "pago" | "recusado" | "expirado" | "estornado" | "divergente";

export type Pedido = {
  id: string;
  chavePedido: string | null;
  tokenHash: string;
  status: StatusPedido;
  nome: string;
  email: string;
  whatsapp: string;
  condicao: string;
  meio: "pix" | "cartao";
  parcelas: number;
  valorParcela: number;
  total: number;
  utm: Record<string, string>;
  mpPaymentId: string | null;
  mpStatus: string | null;
  mpStatusDetail: string | null;
  pixCopiaCola: string | null;
  pixQrBase64: string | null;
  pixExpiraEm: string | null;
  tentativas: number;
  /**
   * Tentativa de cobrança no cartão (identidade + estado), gravada ANTES de chamar o Mercado Pago:
   * - tentativaChave: chave de idempotência da tentativa aberta; é a mesma ao retomar uma tentativa incerta;
   * - tentativaEstado: "em_curso" (chamada em andamento) | "incerta" (o resultado não chegou: pode ter cobrado) | null;
   * - tentativaEm: quando a tentativa foi aberta/retomada.
   */
  tentativaChave: string | null;
  tentativaEstado: "em_curso" | "incerta" | null;
  tentativaEm: string | null;
  pagoEm: string | null;
  confirmadoPor: string | null;
  avisoPendenteEm: string | null;
  avisoPagoEm: string | null;
  ultimoErro: string | null;
  mpConferidoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export const SITES_SCHEMA_SQL = `
create table if not exists site_pedidos (
  id                uuid primary key,
  chave_pedido      text,
  token_hash        text not null,
  status            text not null,
  nome              text not null,
  email             text not null,
  whatsapp          text not null,
  condicao          text not null,
  meio              text not null,
  parcelas          integer not null,
  valor_parcela     numeric(10,2) not null,
  total             numeric(10,2) not null,
  utm               jsonb not null default '{}',
  mp_payment_id     text,
  mp_status         text,
  mp_status_detail  text,
  pix_copia_cola    text,
  pix_qr_base64     text,
  pix_expira_em     timestamptz,
  tentativas        integer not null default 0,
  pago_em           timestamptz,
  confirmado_por    text,
  aviso_pendente_em timestamptz,
  aviso_pago_em     timestamptz,
  ultimo_erro       text,
  mp_conferido_em   timestamptz,
  criado_em         timestamptz not null,
  atualizado_em     timestamptz not null
);
create unique index if not exists site_pedidos_chave on site_pedidos (chave_pedido) where chave_pedido is not null;
create index if not exists site_pedidos_status on site_pedidos (status);
create table if not exists site_pagamentos (
  id            text primary key,
  pedido_id     uuid not null references site_pedidos(id),
  status        text not null,
  status_detail text,
  meio          text,
  parcelas      integer,
  valor         numeric(10,2),
  atualizado_em timestamptz not null
);
create table if not exists site_eventos (
  chave       text primary key,
  recebido_em timestamptz not null default now()
);
alter table site_pedidos add column if not exists tentativa_chave text;
alter table site_pedidos add column if not exists tentativa_estado text;
alter table site_pedidos add column if not exists tentativa_em timestamptz;
alter table site_pedidos enable row level security;
alter table site_pagamentos enable row level security;
alter table site_eventos enable row level security;
`;

export type PagamentoRegistro = { id: string; pedidoId: string; status: string; statusDetail: string | null; meio: string | null; parcelas: number | null; valor: number | null; atualizadoEm: string };

export interface SitesStore {
  create(p: Omit<Pedido, "id" | "tokenHash" | "criadoEm" | "atualizadoEm" | "status" | "mpPaymentId" | "mpStatus" | "mpStatusDetail" | "pixCopiaCola" | "pixQrBase64" | "pixExpiraEm" | "tentativas" | "tentativaChave" | "tentativaEstado" | "tentativaEm" | "pagoEm" | "confirmadoPor" | "avisoPendenteEm" | "avisoPagoEm" | "ultimoErro" | "mpConferidoEm">): Promise<{ pedido: Pedido; token: string }>;
  get(id: string): Promise<Pedido | null>;
  byChave(chave: string): Promise<Pedido | null>;
  /** grava só os campos informados (sempre com atualizadoEm) */
  update(id: string, patch: Partial<Pedido>): Promise<Pedido>;
  /** reserva atômica: marca o campo de aviso se ainda estiver vazio; devolve true só para quem marcou */
  claimAviso(id: string, campo: "avisoPendenteEm" | "avisoPagoEm"): Promise<boolean>;
  releaseAviso(id: string, campo: "avisoPendenteEm" | "avisoPagoEm"): Promise<void>;
  /**
   * Abre (ou retoma) a tentativa de cobrança no cartão, de forma atômica no banco. Só uma requisição por vez consegue:
   * - abre uma tentativa NOVA (tentativas + 1, chave nova) se o pedido está "criado" ou "recusado" e sem tentativa;
   * - RETOMA a tentativa incerta (mesma chave, mesmo número) se o resultado anterior não chegou, ou se uma tentativa
   *   "em_curso" ficou parada há mais de `retomarAposSeg` (ex.: o servidor caiu no meio da chamada).
   * Devolve null se outra requisição já está com a tentativa (concorrência) ou se o pedido não aceita cobrança.
   */
  abrirTentativaCartao(id: string, retomarAposSeg: number): Promise<{ pedido: Pedido; chave: string; retomada: boolean } | null>;
  /** reserva atômica de uma conferência no Mercado Pago (no máximo uma a cada `segundos`) */
  claimConferencia(id: string, segundos: number): Promise<boolean>;
  upsertPagamento(p: PagamentoRegistro): Promise<void>;
  pagamentos(pedidoId: string): Promise<PagamentoRegistro[]>;
  markEvent(key: string): Promise<boolean>;
  unmarkEvent(key: string): Promise<void>;
  /** pedidos com pagamento pendente (para a conferência de rotina) */
  pendentes(limite: number): Promise<Pedido[]>;
}

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const nowIso = () => new Date().toISOString();

function novo(p: Parameters<SitesStore["create"]>[0]) {
  const token = randomBytes(24).toString("base64url");
  const agora = nowIso();
  const pedido: Pedido = {
    ...p,
    id: randomUUID(),
    tokenHash: hashToken(token),
    status: "criado",
    mpPaymentId: null,
    mpStatus: null,
    mpStatusDetail: null,
    pixCopiaCola: null,
    pixQrBase64: null,
    pixExpiraEm: null,
    tentativas: 0,
    tentativaChave: null,
    tentativaEstado: null,
    tentativaEm: null,
    pagoEm: null,
    confirmadoPor: null,
    avisoPendenteEm: null,
    avisoPagoEm: null,
    ultimoErro: null,
    mpConferidoEm: null,
    criadoEm: agora,
    atualizadoEm: agora,
  };
  return { pedido, token };
}

/* ───────────────────────────────── memória (testes locais) ───────────────────────────────── */

type Mem = { pedidos: Map<string, Pedido>; pagamentos: Map<string, PagamentoRegistro>; eventos: Set<string> };
const g = globalThis as unknown as { __sitesMem?: Mem };
const mem = () => (g.__sitesMem ??= { pedidos: new Map(), pagamentos: new Map(), eventos: new Set() });

const memStore: SitesStore = {
  async create(p) {
    if (p.chavePedido) {
      const ja = [...mem().pedidos.values()].find((x) => x.chavePedido === p.chavePedido);
      if (ja) throw Object.assign(new Error("chave duplicada"), { code: "23505" });
    }
    const r = novo(p);
    mem().pedidos.set(r.pedido.id, r.pedido);
    return { pedido: { ...r.pedido }, token: r.token };
  },
  async get(id) {
    const p = mem().pedidos.get(id);
    return p ? { ...p } : null;
  },
  async byChave(chave) {
    const p = [...mem().pedidos.values()].find((x) => x.chavePedido === chave);
    return p ? { ...p } : null;
  },
  async update(id, patch) {
    const atual = mem().pedidos.get(id);
    if (!atual) throw new Error("pedido inexistente");
    const novoP = { ...atual, ...patch, atualizadoEm: nowIso() };
    mem().pedidos.set(id, novoP);
    return { ...novoP };
  },
  async claimAviso(id, campo) {
    const p = mem().pedidos.get(id);
    if (!p || p[campo]) return false;
    p[campo] = nowIso();
    return true;
  },
  async releaseAviso(id, campo) {
    const p = mem().pedidos.get(id);
    if (p) p[campo] = null;
  },
  async abrirTentativaCartao(id, retomarAposSeg) {
    // sem await entre ler e gravar: atômico no laço de eventos do Node (equivale ao UPDATE condicional do Postgres)
    const p = mem().pedidos.get(id);
    if (!p || p.meio !== "cartao") return null;
    const parada = p.tentativaEstado === "em_curso" && !!p.tentativaEm && Date.now() - Date.parse(p.tentativaEm) > retomarAposSeg * 1000;
    const retomar = p.tentativaEstado === "incerta" || parada;
    if (!retomar && !(["criado", "recusado"].includes(p.status) && p.tentativaEstado === null)) return null;
    if (!retomar) {
      p.tentativas += 1;
      p.tentativaChave = `site-${p.id}-cartao-${p.tentativas}`;
      p.mpPaymentId = null; // a order da tentativa anterior (recusada) fica só no histórico de pagamentos
    }
    p.tentativaEstado = "em_curso";
    p.tentativaEm = nowIso();
    p.atualizadoEm = p.tentativaEm;
    return { pedido: { ...p }, chave: p.tentativaChave!, retomada: retomar };
  },
  async claimConferencia(id, segundos) {
    const p = mem().pedidos.get(id);
    if (!p) return false;
    if (p.mpConferidoEm && Date.now() - Date.parse(p.mpConferidoEm) < segundos * 1000) return false;
    p.mpConferidoEm = nowIso();
    return true;
  },
  async upsertPagamento(p) {
    mem().pagamentos.set(p.id, { ...p });
  },
  async pagamentos(pedidoId) {
    return [...mem().pagamentos.values()].filter((x) => x.pedidoId === pedidoId);
  },
  async markEvent(key) {
    if (mem().eventos.has(key)) return false;
    mem().eventos.add(key);
    return true;
  },
  async unmarkEvent(key) {
    mem().eventos.delete(key);
  },
  async pendentes(limite) {
    return [...mem().pedidos.values()].filter((p) => p.status === "pagamento_pendente").slice(0, limite);
  },
};

/* ───────────────────────────────── Postgres ───────────────────────────────── */

const toSnake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, m) => m.toUpperCase());
const NUMERICOS = new Set(["valor_parcela", "total", "valor"]);
function fromRow<T>(row: Record<string, unknown>): T {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) o[toCamel(k)] = v instanceof Date ? v.toISOString() : NUMERICOS.has(k) && v != null ? Number(v) : v;
  return o as T;
}

type Sql = import("postgres").Sql;
let sqlPromise: Promise<Sql> | null = null;
async function sql(): Promise<Sql> {
  sqlPromise ??= (async () => {
    const { default: postgres } = await import("postgres");
    // Esquema idempotente na primeira conexão (só tabelas site_*), pela conexão direta quando houver.
    const ddl = postgres(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
    try {
      await ddl.unsafe(SITES_SCHEMA_SQL);
    } finally {
      await ddl.end({ timeout: 5 });
    }
    return postgres(process.env.DATABASE_URL!, { max: Number(process.env.SITES_DB_POOL_MAX) || 2, idle_timeout: 20, prepare: false });
  })().catch((e) => {
    sqlPromise = null;
    throw e;
  });
  return sqlPromise;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pgStore: SitesStore = {
  async create(p) {
    const r = novo(p);
    const db = await sql();
    const row = Object.fromEntries(Object.entries(r.pedido).map(([k, v]) => [toSnake(k), k === "utm" ? db.json(v as never) : v]));
    await db`insert into site_pedidos ${db(row as Record<string, never>)}`;
    return r;
  },
  async get(id) {
    if (!UUID.test(id)) return null;
    const db = await sql();
    const [row] = await db`select * from site_pedidos where id = ${id}`;
    return row ? fromRow<Pedido>(row) : null;
  },
  async byChave(chave) {
    const db = await sql();
    const [row] = await db`select * from site_pedidos where chave_pedido = ${chave}`;
    return row ? fromRow<Pedido>(row) : null;
  },
  async update(id, patch) {
    const db = await sql();
    const row = Object.fromEntries(
      Object.entries({ ...patch, atualizadoEm: nowIso() })
        .filter(([k]) => k !== "id")
        .map(([k, v]) => [toSnake(k), k === "utm" ? db.json(v as never) : v]),
    );
    const [r] = await db`update site_pedidos set ${db(row as Record<string, never>)} where id = ${id} returning *`;
    if (!r) throw new Error("pedido inexistente");
    return fromRow<Pedido>(r);
  },
  async claimAviso(id, campo) {
    const db = await sql();
    const col = toSnake(campo);
    const r = await db`update site_pedidos set ${db(col)} = now() where id = ${id} and ${db(col)} is null returning id`;
    return r.length === 1;
  },
  async releaseAviso(id, campo) {
    const db = await sql();
    await db`update site_pedidos set ${db(toSnake(campo))} = null where id = ${id}`;
  },
  async abrirTentativaCartao(id, retomarAposSeg) {
    if (!UUID.test(id)) return null;
    const db = await sql();
    // Um único UPDATE com a linha travada (for update): duas requisições ao mesmo pedido nunca abrem tentativas
    // independentes. A segunda espera a trava, relê a linha (já "em_curso") e não casa com o where → 0 linhas.
    const [r] = await db`
      with alvo as (
        select id,
          (tentativa_estado = 'incerta'
            or (tentativa_estado = 'em_curso' and tentativa_em < now() - make_interval(secs => ${retomarAposSeg}))) as retomar
        from site_pedidos where id = ${id} for update
      )
      update site_pedidos p set
        tentativas = case when a.retomar then p.tentativas else p.tentativas + 1 end,
        tentativa_chave = case when a.retomar then p.tentativa_chave else 'site-' || p.id || '-cartao-' || (p.tentativas + 1) end,
        mp_payment_id = case when a.retomar then p.mp_payment_id else null end,
        tentativa_estado = 'em_curso',
        tentativa_em = now(),
        atualizado_em = now()
      from alvo a
      where p.id = a.id and p.meio = 'cartao'
        and (a.retomar or (p.status in ('criado', 'recusado') and p.tentativa_estado is null))
      returning p.*, a.retomar as retomada`;
    if (!r) return null;
    const { retomada, ...row } = r;
    const pedido = fromRow<Pedido>(row);
    return { pedido, chave: pedido.tentativaChave!, retomada: Boolean(retomada) };
  },
  async claimConferencia(id, segundos) {
    const db = await sql();
    const r = await db`update site_pedidos set mp_conferido_em = now()
      where id = ${id} and (mp_conferido_em is null or mp_conferido_em < now() - make_interval(secs => ${segundos})) returning id`;
    return r.length === 1;
  },
  async upsertPagamento(p) {
    const db = await sql();
    await db`insert into site_pagamentos (id, pedido_id, status, status_detail, meio, parcelas, valor, atualizado_em)
      values (${p.id}, ${p.pedidoId}, ${p.status}, ${p.statusDetail}, ${p.meio}, ${p.parcelas}, ${p.valor}, ${p.atualizadoEm})
      on conflict (id) do update set status = excluded.status, status_detail = excluded.status_detail, parcelas = excluded.parcelas,
        valor = excluded.valor, atualizado_em = excluded.atualizado_em`;
  },
  async pagamentos(pedidoId) {
    const db = await sql();
    return (await db`select * from site_pagamentos where pedido_id = ${pedidoId}`).map((r) => fromRow<PagamentoRegistro>(r));
  },
  async markEvent(key) {
    const db = await sql();
    const r = await db`insert into site_eventos (chave) values (${key}) on conflict do nothing returning chave`;
    return r.length === 1;
  },
  async unmarkEvent(key) {
    const db = await sql();
    await db`delete from site_eventos where chave = ${key}`;
  },
  async pendentes(limite) {
    const db = await sql();
    return (await db`select * from site_pedidos where status = 'pagamento_pendente' order by atualizado_em limit ${limite}`).map((r) => fromRow<Pedido>(r));
  },
};

export function sitesStore(): SitesStore {
  return process.env.SITES_STORE === "memory" || process.env.IA_STORE === "memory" ? memStore : pgStore;
}
