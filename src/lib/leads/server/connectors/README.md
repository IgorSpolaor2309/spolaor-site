# Conectores de leads

Os formulários enviam para `/api/lead`, que valida o lead e o entrega aos conectores desta pasta.
**Nenhum destino externo está ativo** — a escolha (Supabase, CRM, n8n, Make, e-mail) ainda não foi feita.

Enquanto a lista em `index.ts` estiver vazia:

- em desenvolvimento, o lead aparece no terminal (`dev-console.ts`);
- em produção, a API responde `503` e o formulário mostra uma mensagem de erro.
  Assim nenhum lead é "aceito" sem ser guardado em lugar algum.

## Como adicionar um destino

1. Crie `meu-destino.ts` exportando um `LeadConnector` (veja `../types.ts`):
   - `persistent: true` para a fonte de verdade (ex.: banco de dados);
   - `persistent: false` para avisos e automações (e-mail, WhatsApp, n8n), que rodam depois da resposta.
2. Leia credenciais e URLs só de variáveis de ambiente em `isConfigured()` e `send()`.
3. Adicione o conector à lista em `index.ts` e documente as variáveis em `.env.example`.

O `LeadRecord` entregue a cada conector contém: `id`, `createdAt`, `tipo`, `origem` (formulário),
`pagina`, `nome`, `empresa`, `whatsapp`, `email`, `site`, `semSite`, `mensagem`, `urgencia`,
`melhorias`, `servicos`, `referrer`, `utm` e `userAgent`.

## Esboço de tabela (se o destino escolhido for um banco Postgres, ex. Supabase)

Referência apenas, não aplicada em lugar nenhum:

```sql
create table leads (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  tipo        text not null,          -- analise | projeto
  origem      text not null,          -- formulário
  pagina      text,
  nome        text not null,
  empresa     text not null,
  whatsapp    text not null,
  email       text not null,
  site        text,
  sem_site    boolean not null default false,
  mensagem    text,
  urgencia    text,
  melhorias   text[] not null default '{}',
  servicos    text[] not null default '{}',
  referrer    text,
  utm         jsonb not null default '{}',
  user_agent  text,
  status      text not null default 'novo'  -- para acompanhamento comercial futuro
);
alter table leads enable row level security;  -- escrita só pelo servidor
```
