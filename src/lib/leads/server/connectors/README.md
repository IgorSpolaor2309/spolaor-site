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

O `LeadRecord` entregue a cada conector contém: `id`, `createdAt`, `tipo`, `origem`, `pagina`,
`entrada`, `segmento`, `problema`, `nome`, `empresa`, `whatsapp`, `email`, `site`, `semSite`,
`mensagem`, `urgencia`, `melhorias`, `servicos`, `referrer`, `utm` e `userAgent`.

### Origem do lead (para medir qual página converte)

- `origem` é a página que gerou o lead: `home`, `corretores`, `clinicas`, `orcamentos`,
  `pagina-analise` (/analise), `sites` ou `contato`. O formulário informa o valor; a API só aceita
  os da lista `LEAD_ORIGENS` (`src/lib/leads/schema.ts`) e, se vier outro, deduz pelo `pagina`.
- `pagina` é o caminho onde o formulário foi enviado; `entrada` é a primeira página da visita
  (guardada em `sessionStorage`), preenchida só quando é diferente de `pagina`. Assim um visitante
  que entrou por `/corretores` e enviou em `/analise` continua atribuído à landing.
- `utm` traz os parâmetros da URL atual ou, se não houver, os da página de entrada.
- `segmento` e `problema` são as escolhas do passo 1 do diagnóstico. Nas landings o segmento já
  vem fixo (`SEGMENTO_DA_ORIGEM` em `src/lib/segments.ts`).

## Esboço de tabela (se o destino escolhido for um banco Postgres, ex. Supabase)

Referência apenas, não aplicada em lugar nenhum:

```sql
create table leads (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  tipo        text not null,          -- analise | projeto
  origem      text not null,          -- home | corretores | clinicas | orcamentos | pagina-analise | sites | contato
  pagina      text,
  entrada     text,                   -- primeira página da visita, se diferente de pagina
  segmento    text,
  problema    text,
  nome        text not null,
  empresa     text not null,
  whatsapp    text not null,
  email       text,                   -- opcional no diagnóstico
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
