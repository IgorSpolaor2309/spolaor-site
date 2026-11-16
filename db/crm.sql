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

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- WhatsApp pela API oficial (provedor), tarefa de primeiro contato e fila "Depende de mim" (novembro/2026).
-- Só acréscimos idempotentes: este arquivo roda inteiro de novo a cada versão do esquema.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════

-- Conversa de WhatsApp é por pessoa (um número), não por oportunidade.
alter table crm_contatos add column if not exists wa_ultima_entrada_em timestamptz;      -- última mensagem recebida: abre a janela de 24 h
alter table crm_contatos add column if not exists wa_nome_perfil text;                   -- nome do perfil informado pelo WhatsApp
alter table crm_contatos add column if not exists wa_bloqueado_em timestamptz;           -- pediu para parar: sem novos contatos automáticos
alter table crm_contatos add column if not exists wa_bloqueio_motivo text;
alter table crm_contatos add column if not exists wa_usuario_id text;                  -- identificador do usuário no WhatsApp (BSUID): o telefone pode não vir nas notificações
create index if not exists crm_contatos_wa_usuario on crm_contatos (wa_usuario_id) where wa_usuario_id is not null;

-- Situação do atendimento, separada da etapa comercial.
alter table crm_oportunidades add column if not exists categoria text;                   -- serviço padronizado (filtros); 'a-classificar' quando ambíguo
alter table crm_oportunidades add column if not exists aviso_versao text;                -- versão do texto "retorno pelo WhatsApp" exibido no formulário
alter table crm_oportunidades add column if not exists aviso_em timestamptz;             -- quando a pessoa enviou o formulário com esse texto
alter table crm_oportunidades add column if not exists ultima_entrada_em timestamptz;    -- última mensagem do interessado nesta oportunidade
alter table crm_oportunidades add column if not exists ultima_saida_humana_em timestamptz; -- última resposta de uma pessoa (CRM, aplicativo ou registro à mão)
alter table crm_oportunidades add column if not exists pendencia text;                   -- por que depende de nós: resposta | pediu_parar | novo_envio | novo_pedido | nao_suportado
create index if not exists crm_oportunidades_categoria on crm_oportunidades (categoria);
create index if not exists crm_oportunidades_vez on crm_oportunidades (aguardando) where aguardando is not null;

-- Registros anteriores: categoria pela origem do formulário; sem origem conhecida fica "a classificar".
update crm_oportunidades set categoria = case origem
    when 'sites' then 'sites'
    when 'lojas-virtuais' then 'lojas'
    when 'agendamento-online' then 'agendamento'
    when 'automacao' then 'automacao'
    when 'atendimento-ia' then 'atendimento-ia'
    when 'diagnostico-site' then 'diagnostico'
    else 'a-classificar' end
  where categoria is null;

-- Mensagens passam a pertencer ao contato (conversa) e, quando dá para saber, a uma oportunidade.
alter table crm_mensagens alter column oportunidade_id drop not null;
alter table crm_mensagens add column if not exists contato_id uuid references crm_contatos(id);
update crm_mensagens m set contato_id = o.contato_id from crm_oportunidades o where m.contato_id is null and o.id = m.oportunidade_id;
alter table crm_mensagens add column if not exists via text;               -- api (enviada pelo CRM) | app (enviada pelo aplicativo, sincronizada) | webhook (recebida) | registro (anotada à mão)
alter table crm_mensagens add column if not exists tipo text not null default 'text'; -- text | template | image | audio | video | document | sticker | location | contacts | button | interactive | reaction | unsupported
alter table crm_mensagens add column if not exists midia jsonb;            -- referência da mídia no provedor (nunca o arquivo)
alter table crm_mensagens add column if not exists provedor text;          -- ycloud | resend
alter table crm_mensagens add column if not exists wamid text;             -- id da mensagem no WhatsApp
alter table crm_mensagens add column if not exists modelo text;            -- nome do modelo aprovado usado no envio
alter table crm_mensagens add column if not exists resposta_a text;        -- wamid da mensagem a que esta responde
alter table crm_mensagens add column if not exists ocorrida_em timestamptz; -- hora real da mensagem segundo o provedor (ordem da conversa)
alter table crm_mensagens add column if not exists entregue_em timestamptz;
alter table crm_mensagens add column if not exists lida_em timestamptz;
alter table crm_mensagens add column if not exists conferida_em timestamptz; -- mensagem sem oportunidade marcada como conferida por uma pessoa
alter table crm_mensagens drop constraint if exists crm_mensagens_status_check;
alter table crm_mensagens add constraint crm_mensagens_status_check
  check (status in ('pendente', 'enviando', 'aceita', 'enviada', 'entregue', 'lida', 'falhou', 'incerta', 'cancelada', 'registrada', 'recebida'));
create unique index if not exists crm_mensagens_provedor_id on crm_mensagens (provedor, provedor_id) where provedor is not null and provedor_id is not null;
create unique index if not exists crm_mensagens_wamid on crm_mensagens (wamid) where wamid is not null;
create index if not exists crm_mensagens_contato on crm_mensagens (contato_id, criado_em);
create index if not exists crm_mensagens_sem_oportunidade on crm_mensagens (criado_em) where oportunidade_id is null and conferida_em is null;

-- Intenção de primeiro contato, gravada na MESMA transação do lead. A fila de mensagens (QStash) só acelera:
-- se a publicação falhar, a tarefa continua aqui e a rotina a recupera.
create table if not exists crm_tarefas (
  id              uuid primary key,
  tipo            text not null check (tipo in ('primeiro_contato')),
  oportunidade_id uuid not null references crm_oportunidades(id) on delete cascade,
  envio_id        uuid,
  status          text not null check (status in ('pendente', 'processando', 'concluida', 'cancelada', 'falhou', 'incerta')),
  resultado       text,                                  -- o que aconteceu, em texto legível
  canal           text,
  mensagem_id     uuid references crm_mensagens(id),
  tentativas      integer not null default 0,
  proxima_em      timestamptz not null default now(),
  publicada_em    timestamptz,                           -- quando a fila aceitou a publicação
  tentado_em      timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  unique (tipo, oportunidade_id)                         -- uma por oportunidade: reprocessar não duplica
);
create index if not exists crm_tarefas_fila on crm_tarefas (proxima_em) where status in ('pendente', 'processando');
create index if not exists crm_tarefas_mensagem on crm_tarefas (mensagem_id) where mensagem_id is not null;
create index if not exists crm_tarefas_oportunidade on crm_tarefas (oportunidade_id);

-- Cada notificação do provedor, como chegou. O id do evento é a chave: repetição não processa duas vezes.
create table if not exists crm_webhook_eventos (
  id            text primary key,                        -- provedor:id do evento
  provedor      text not null,
  tipo          text not null,
  payload       jsonb not null,
  recebido_em   timestamptz not null default now(),
  processado_em timestamptz,
  resultado     text,
  erro          text,
  tentativas    integer not null default 0
);
create index if not exists crm_webhook_eventos_pendentes on crm_webhook_eventos (recebido_em) where processado_em is null;
create index if not exists crm_webhook_eventos_tipo on crm_webhook_eventos (tipo, recebido_em desc);

alter table crm_tarefas enable row level security;
alter table crm_webhook_eventos enable row level security;
