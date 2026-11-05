-- Atendimento com IA no WhatsApp: contratações, cobranças e eventos processados.
-- Aplicar uma vez no banco apontado por DATABASE_URL (Postgres: Neon pela Vercel Marketplace,
-- Supabase ou outro). O site acessa só pelo servidor; não há acesso público a estas tabelas.

create table if not exists ia_contratacoes (
  id                    uuid primary key,
  external_id           text not null unique,           -- externalId no ZappMillion (estável)
  token_hash            text not null,                  -- hash do link de acompanhamento
  etapa                 text not null,
  empresa               text not null,
  responsavel           text not null,
  email                 text not null,
  telefone              text not null,                  -- telefone do responsável (não é o WhatsApp do atendimento)
  segmento              text,
  preco_mensal          numeric(10,2) not null,         -- preço definido pelo servidor na contratação
  zm_plan_id            text not null,
  utm                   jsonb not null default '{}',
  mp_preapproval_id     text unique,
  mp_status             text,
  pago_ate              timestamptz,
  primeiro_pagamento_em timestamptz,
  zm_status             text,
  zm_organization_id    text,
  zm_workspace_id       text,
  zm_user_id            text,
  zm_periodo_fim        timestamptz,
  whatsapp_status       text,
  ultimo_erro           text,
  tentativas            integer not null default 0,
  proxima_tentativa     timestamptz,
  motivo_suspensao      text,
  criado_em             timestamptz not null,
  atualizado_em         timestamptz not null
);
create index if not exists ia_contratacoes_etapa on ia_contratacoes (etapa);

create table if not exists ia_cobrancas (
  id               text primary key,                     -- authorized_payment.id (Mercado Pago)
  contratacao_id   uuid not null references ia_contratacoes(id),
  status           text not null,
  pagamento_id     text unique,                          -- payment.id
  pagamento_status text,
  valor            numeric(10,2) not null,
  moeda            text not null,
  data_debito      timestamptz,
  atualizado_em    timestamptz not null
);

create table if not exists ia_eventos (
  chave        text primary key,                          -- x-request-id da notificação
  recebido_em  timestamptz not null default now()
);

alter table ia_contratacoes enable row level security;
alter table ia_cobrancas enable row level security;
alter table ia_eventos enable row level security;
