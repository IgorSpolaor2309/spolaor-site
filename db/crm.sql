-- CRM comercial (/leads): contatos, oportunidades, envios dos formulários, mensagens, histórico e acesso.
-- Mesmo banco das tabelas ia_* e site_* (DATABASE_URL), sem tocar nelas. O site acessa só pelo servidor;
-- RLS ligado sem políticas: nenhum papel além do dono das tabelas lê ou grava.
-- Este arquivo é aplicado automaticamente (idempotente) na primeira conexão do servidor (src/lib/crm/schema.ts
-- tem o mesmo conteúdo; scripts/teste-crm.mjs confere que estão iguais).

create table if not exists crm_usuarios (
  id               uuid primary key,
  email            text not null unique,                 -- minúsculas
  nome             text not null,
  criado_em        timestamptz not null default now(),
  ultimo_acesso_em timestamptz
);

-- Códigos de acesso enviados por e-mail (uso único, validade curta). Só o hash é guardado.
create table if not exists crm_login_codigos (
  id          uuid primary key,
  email       text not null,
  codigo_hash text not null,
  tentativas  integer not null default 0,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  usado_em    timestamptz
);
create index if not exists crm_login_codigos_email on crm_login_codigos (email, criado_em desc);

create table if not exists crm_sessoes (
  token_hash text primary key,                           -- hash do cookie; o valor nunca é guardado
  usuario_id uuid not null references crm_usuarios(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null,
  visto_em   timestamptz not null default now()
);
create index if not exists crm_sessoes_usuario on crm_sessoes (usuario_id);

-- Pessoa ou empresa. Um contato pode ter várias oportunidades (serviços diferentes).
create table if not exists crm_contatos (
  id            uuid primary key,
  nome          text not null,
  empresa       text,
  whatsapp      text,                                    -- só dígitos, com DDI
  email         text,                                    -- minúsculas
  instagram     text,                                    -- usuário, sem @
  site          text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists crm_contatos_whatsapp on crm_contatos (whatsapp) where whatsapp is not null;
create index if not exists crm_contatos_email on crm_contatos (email) where email is not null;

create table if not exists crm_oportunidades (
  id                  uuid primary key,
  contato_id          uuid not null references crm_contatos(id),
  etapa               text not null check (etapa in ('novo', 'aguardando_resposta', 'em_conversa', 'proposta_enviada', 'ganho', 'perdido')),
  aguardando          text check (aguardando in ('nos', 'cliente')),  -- de quem é a vez: nos = a pessoa respondeu e espera retorno
  servico             text,                              -- serviço de interesse
  canal               text not null check (canal in ('formulario', 'whatsapp', 'instagram', 'email', 'telefone', 'indicacao', 'outro')),
  origem              text,                              -- origem do formulário (home, sites...) ou descrição livre no cadastro manual
  registro            text not null check (registro in ('automatico', 'manual')),
  tipo                text,
  mensagem            text,                              -- mensagem original
  dados               jsonb not null default '{}',       -- demais respostas do formulário (segmento, problema, urgência...)
  pagina              text,
  entrada             text,
  referrer            text,
  utm                 jsonb not null default '{}',
  meta_campaign_id    text,                              -- só quando o identificador veio de fato na URL do anúncio
  meta_adset_id       text,
  meta_ad_id          text,
  responsavel_id      uuid references crm_usuarios(id),
  proxima_acao        text,
  proxima_acao_em     timestamptz,
  primeiro_contato_em timestamptz,                       -- primeira mensagem ou ligação nossa (automática ou manual)
  ultimo_contato_em   timestamptz,
  assumida_em         timestamptz,                       -- atendimento humano assumiu: a automação da conversa para
  valor_proposta      numeric(12,2),
  proposta_em         timestamptz,
  valor_fechado       numeric(12,2),
  fechado_em          timestamptz,
  motivo_perda        text,
  perdido_em          timestamptz,
  teste               boolean not null default false,    -- envio de teste: fora dos indicadores
  recebido_em         timestamptz not null,              -- quando o contato chegou (pode ser anterior ao cadastro manual)
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index if not exists crm_oportunidades_contato on crm_oportunidades (contato_id);
create index if not exists crm_oportunidades_responsavel on crm_oportunidades (responsavel_id) where responsavel_id is not null;
create index if not exists crm_oportunidades_etapa on crm_oportunidades (etapa, recebido_em desc);
create index if not exists crm_oportunidades_recebido on crm_oportunidades (recebido_em desc);
create index if not exists crm_oportunidades_retorno on crm_oportunidades (proxima_acao_em) where proxima_acao_em is not null;

-- Cada envio aceito de um formulário do site, como chegou. O id é o mesmo devolvido ao navegador
-- (eventID do evento Lead): o mesmo envio nunca é gravado duas vezes.
create table if not exists crm_envios (
  id               uuid primary key,
  oportunidade_id  uuid not null references crm_oportunidades(id),
  payload          jsonb not null,
  recebido_em      timestamptz not null,
  aviso_status     text not null default 'pendente' check (aviso_status in ('pendente', 'enviando', 'enviado', 'falhou', 'desligado')),
  aviso_tentativas integer not null default 0,
  aviso_tentado_em timestamptz,
  aviso_enviado_em timestamptz,
  aviso_erro       text
);
create index if not exists crm_envios_oportunidade on crm_envios (oportunidade_id);
create index if not exists crm_envios_aviso on crm_envios (aviso_status) where aviso_status in ('pendente', 'enviando', 'falhou');

-- Mensagens da conversa. modo = sistema: enviada por uma integração do CRM (com estado de envio);
-- modo = manual: registrada à mão (o CRM não enviou nem recebeu, só anotou).
create table if not exists crm_mensagens (
  id              uuid primary key,
  oportunidade_id uuid not null references crm_oportunidades(id) on delete cascade,
  canal           text not null check (canal in ('whatsapp', 'instagram', 'email', 'telefone', 'outro')),
  direcao         text not null check (direcao in ('saida', 'entrada')),
  modo            text not null check (modo in ('sistema', 'manual')),
  automatica      boolean not null default false,        -- disparada pela automação de primeiro contato
  assunto         text,
  corpo           text not null,
  status          text not null check (status in ('pendente', 'enviando', 'enviada', 'falhou', 'cancelada', 'registrada')),
  chave           text unique,                           -- idempotência: a mesma mensagem não entra duas vezes
  tentativas      integer not null default 0,
  tentado_em      timestamptz,
  enviado_em      timestamptz,
  erro            text,
  provedor_id     text,
  usuario_id      uuid references crm_usuarios(id),
  criado_em       timestamptz not null default now()
);
create index if not exists crm_mensagens_oportunidade on crm_mensagens (oportunidade_id, criado_em);
create index if not exists crm_mensagens_fila on crm_mensagens (status) where status in ('pendente', 'enviando', 'falhou');
create index if not exists crm_mensagens_usuario on crm_mensagens (usuario_id) where usuario_id is not null;

-- Histórico da oportunidade (criação, etapa, anotações, contatos, avisos...).
create table if not exists crm_eventos (
  id              uuid primary key,
  oportunidade_id uuid not null references crm_oportunidades(id) on delete cascade,
  tipo            text not null,
  texto           text,
  dados           jsonb not null default '{}',
  usuario_id      uuid references crm_usuarios(id),
  criado_em       timestamptz not null default now()
);
create index if not exists crm_eventos_oportunidade on crm_eventos (oportunidade_id, criado_em);
create index if not exists crm_eventos_usuario on crm_eventos (usuario_id) where usuario_id is not null;

-- Modelos de mensagem editados e chaves de automação (os padrões ficam no código).
create table if not exists crm_config (
  chave         text primary key,
  valor         jsonb not null,
  atualizado_em timestamptz not null default now(),
  usuario_id    uuid references crm_usuarios(id)
);

-- Custos de mídia informados à mão (verba da Meta, taxa do Autopilot da Crush, assinatura). Nunca somados entre si
-- sem rótulo; estimado = valor ainda não conferido em fatura.
create table if not exists crm_custos (
  id         uuid primary key,
  tipo       text not null check (tipo in ('meta_verba', 'crush_taxa', 'crush_assinatura', 'outro')),
  inicio     date not null,
  fim        date not null,
  valor      numeric(12,2) not null check (valor >= 0),
  estimado   boolean not null default false,
  nota       text,
  usuario_id uuid references crm_usuarios(id),
  criado_em  timestamptz not null default now(),
  check (fim >= inicio)
);
create index if not exists crm_custos_periodo on crm_custos (inicio, fim);

alter table crm_usuarios enable row level security;
alter table crm_login_codigos enable row level security;
alter table crm_sessoes enable row level security;
alter table crm_contatos enable row level security;
alter table crm_oportunidades enable row level security;
alter table crm_envios enable row level security;
alter table crm_mensagens enable row level security;
alter table crm_eventos enable row level security;
alter table crm_config enable row level security;
alter table crm_custos enable row level security;
