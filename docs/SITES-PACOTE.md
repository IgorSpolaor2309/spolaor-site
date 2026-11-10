# Pacote "Site de uma página" (`/sites/pacote`)

Venda avulsa (pagamento único, não é assinatura) da criação de um site de uma página. Fluxo próprio, separado do
"Atendimento com IA no WhatsApp": tabelas, rotas, avisos e eventos próprios. Da IA, só reaproveita as credenciais do
Mercado Pago, o banco, o e-mail interno e o segredo das rotinas. Nada da IA muda.

## Oferta (aprovada pelo Igor em 09/11/2026)

**O que entra no pacote:**
- site de uma página, adaptado ao celular, com a identidade visual e os serviços da empresa e botão de WhatsApp;
- seções flexíveis conforme o negócio: acrescentar ou tirar um bloco simples faz parte da personalização.

**O que não entra** (orçamento separado): várias páginas, loja virtual, login, sistema de agendamento e integrações.

**Processo:**
1. Conversa pelo WhatsApp para entender a empresa e reunir informações e materiais.
2. Nós organizamos e revisamos os textos. Reunião online só quando necessária.
3. Primeira versão em até 5 dias úteis após receber tudo o que é necessário.
4. Uma rodada de ajustes, entregue em até 5 dias úteis após receber a lista consolidada do cliente.

São duas etapas, criação e uma rodada de ajustes; não anunciar duas rodadas de alterações.

**Domínio e hospedagem:** contratados e pagos à parte pelo cliente. A Spolaor orienta a escolha, conecta e publica,
sem mensalidade da Spolaor.

| Condição | Parcela | Total |
|---|---|---|
| Pix | — | R$ 449,90 |
| Cartão 1× | R$ 449,90 | R$ 449,90 |
| Cartão 2× | R$ 234,90 | R$ 469,80 |
| Cartão 3× | R$ 159,90 | R$ 479,70 |
| Cartão 6× | R$ 84,90 | R$ 509,40 |
| Cartão 12× | R$ 47,90 | R$ 574,80 |

São preços comerciais, cada condição com o seu total. A tabela fica em `src/lib/sites/oferta.ts`, fonte única: a
página, o checkout, a API e os avisos leem dali. O navegador manda só o id da condição; o servidor nunca aceita valor
vindo dele.

## Por que Checkout Transparente (e não Checkout Pro)

O Mercado Pago foi conferido na documentação oficial em 09/11/2026.

**Checkout Pro (preferência) não serve.** Na preferência, `payment_methods.installments` é só o máximo de parcelas;
não há mínimo. Uma preferência de R$ 479,70 "em até 3×" deixaria o comprador pagar esse total em 1× ou 2×. Além disso,
os juros do parcelamento seguem a configuração da conta.

**Checkout Transparente garante a condição:**
- **Cartão:** o formulário seguro do Mercado Pago (Card Payment Brick) gera um token no navegador. O Brick é aberto
  com `amount` = total da condição e `minInstallments = maxInstallments = parcelas`.
- **Antes de cobrar no cartão**, o servidor:
  - confere se as parcelas do formulário são as da condição;
  - consulta `GET /v1/payment_methods/installments` (valor, bandeira e emissor) e só cobra se a parcela tiver
    `installment_rate` 0 **e** `total_amount` igual ao total aprovado.
  - Se o Mercado Pago indicar acréscimo ao comprador, nada é cobrado e o comprador é avisado.
- O servidor cria o pagamento (`POST /v1/payments`) com `transaction_amount` e `installments` da tabela e
  `X-Idempotency-Key` por tentativa.
- **Pix:** `POST /v1/payments` com `payment_method_id: "pix"`. O QR Code e o copia e cola aparecem na página do
  pedido; a validade é de 60 min (`SITES_PIX_MINUTOS`).
- **Depois de aprovado**, o pedido só vira "pago" se valor, moeda, `total_paid_amount` e parcelas baterem com a
  condição. Se não baterem, vira "divergente": não conta como pago e a operação recebe um aviso para estornar no
  painel.

## Conta do Mercado Pago: parcelamento (resolvido em 10/11/2026)

- **Até 09/11** a conta oferecia "parcelado cliente": em 2× ou mais o comprador pagava juros (12× de R$ 574,80
  sairia ≈ R$ 701,89).
- **Em 10/11/2026**, com autorização do Igor, foi ativado em Taxas e parcelas > aba **Checkout** > Por parcelamento
  > **Parcelado vendedor até 12×**:
  - a tela grava ao mexer na opção, sem botão de salvar;
  - o recebimento continua "na hora";
  - link de pagamento, maquininha Point, Tap e QR Code continuam em "parcelado cliente";
  - de 13× em diante, o comprador volta a pagar juros (o checkout do site nunca oferece 13× ou mais).
- **Custo para a Spolaor** (taxa por venda + taxa de parcelamento, recebendo na hora):
  1× 4,98%; 2× 7,51%; 3× 9,60%; 6× 14,94%; 12× 22,26%; Pix 0,99%.
- **Líquido por venda:**
  - Pix ≈ R$ 445,45; 1× ≈ R$ 427,49; 2× ≈ R$ 434,52; 3× ≈ R$ 433,65; 6× ≈ R$ 433,30; 12× ≈ R$ 446,85.
- **A assinatura de IA não muda:** é cobrança recorrente em 1×.

**Consulta real em 10/11/2026:** `scripts/sondar-parcelamento.mjs` com a Public Key de produção. É só leitura
(`GET /v1/payment_methods/installments`) e não cobra nada.
- Em Mastercard, Visa, Elo e Amex, o comprador paga exatamente R$ 449,90 (1×), R$ 469,80 (2×), R$ 479,70 (3×),
  R$ 509,40 (6×) e R$ 574,80 (12×), com 0% de acréscimo.
- Exceções do próprio cartão:
  - pré-pago só 1×;
  - cartão de loja Pernambucanas até 10×.

  Nesses casos o checkout recusa sem cobrar e explica.

```bash
# .env.parcelas.local (fora do git) com NEXT_PUBLIC_MP_PUBLIC_KEY=<Public Key de produção>
node --no-warnings scripts/sondar-parcelamento.mjs --env .env.parcelas.local
```

Rode de novo se alguém mexer na configuração de parcelamento da conta.

Outros pré-requisitos: chave Pix cadastrada (Pix via API) e a Public Key da mesma aplicação do Access Token
(`NEXT_PUBLIC_MP_PUBLIC_KEY`).

## Variáveis de ambiente (Vercel, por ambiente)

| Variável | Para quê |
|---|---|
| `SITES_CONTRATACAO_ATIVA=true` | abre a contratação (sem ela, a página mostra a oferta e um contato) |
| `SITES_CONDICOES` | condições liberadas no checkout, só as VALIDADAS: `pix,cartao-1x,cartao-2x,cartao-3x,cartao-6x,cartao-12x` |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public Key (TEST- na prévia, APP_USR- em produção) para o formulário de cartão |
| `SITES_PIX_MINUTOS` | validade do Pix em minutos (padrão 60; de 30 a 1440) |
| `SITES_MP_NOTIFICATION_URL` | opcional: `off` (usar só a URL do painel) ou uma URL própria. Na prévia, a rota é montada com o bypass da Vercel |
| `SITES_URL_PUBLICA` | opcional: endereço público (padrão: `IA_URL_PUBLICA`, `VERCEL_BRANCH_URL` na prévia ou `NEXT_PUBLIC_SITE_URL`) |
| reaproveitadas | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `LEAD_EMAIL_FROM`, `IA_OPERACAO_EMAIL`/`LEAD_EMAIL_TO`, `CRON_SECRET` |

As tabelas `site_pedidos`, `site_pagamentos` e `site_eventos` são criadas sozinhas, de forma idempotente, na primeira
conexão. Elas não tocam nas tabelas `ia_*`. Esquema em `src/lib/sites/store.ts`.

## Fluxo e estados

1. **Página `/sites/pacote`:** a primeira tela mostra o que é, 12× de R$ 47,90 (total R$ 574,80), R$ 449,90 no Pix
   ou cartão à vista e o botão "Contratar meu site".
2. **Checkout `/sites/pacote/checkout`:**
   - pede nome, e-mail, WhatsApp, a condição e o aceite das condições;
   - mostra a parcela e o total da condição escolhida;
   - `POST /api/sites-pacote/pedido` cria o pedido. A chave do navegador evita pedido duplicado em clique duplo ou
     recarga.
3. **Página do pedido `/sites/pacote/pedido?p=&t=`:**
   - Pix com QR Code, ou o formulário de cartão (`POST /api/sites-pacote/cartao`);
   - acompanhamento por `GET /api/sites-pacote/status`, que confere no Mercado Pago no máximo a cada ~12 s;
   - depois de pago, explica que a coleta das informações é pelo WhatsApp e que o prazo conta a partir dos materiais.
4. **Confirmação:** notificações em `POST /api/sites-pacote/webhook` (assinatura validada, entregas repetidas
   ignoradas, pagamento relido no Mercado Pago). A rotina `GET /api/sites-pacote/rotina` (Bearer `CRON_SECRET`)
   confere os pendentes; pode ser chamada pelo agendador já usado pela IA.

**Estados do pedido:**
- `criado`: dados aceitos, sem pagamento;
- `pagamento_pendente`: Pix gerado ou cartão em análise;
- `pago`: aprovado e conferido;
- `recusado`: pode tentar de novo;
- `expirado`: o Pix venceu; dá para gerar outro;
- `estornado`;
- `divergente`.

Clique, cadastro e redirecionamento nunca viram "pago".

**Avisos internos** (e-mail para `IA_OPERACAO_EMAIL` ou `LEAD_EMAIL_TO`), com a oferta, a condição, o total e o
contato (com link `wa.me`). Cada tipo sai uma vez por pedido (reserva no banco + chave de idempotência no Resend):
- "Novo pedido — pagamento pendente": logo depois do pedido, se ainda não estiver pago;
- "Pagamento confirmado";
- estorno/contestação e divergência.

Nenhuma mensagem automática vai para o comprador.

**Medição:**
- `InitiateCheckout`: uma vez por abertura do checkout com a contratação aberta, valor = total da condição exibida.
- `Purchase`: só quando o servidor devolve "pago", com o total da condição comprada, uma vez por pedido
  (`eventID site-<id>`).
- Sem `Subscribe` e sem dados pessoais. Os eventos da IA não mudaram.

Pagamentos desta oferta que chegarem à rota de notificações da IA são ignorados lá
(`external_reference` = `site:<id>`).

## Teste real no sandbox do Mercado Pago (localhost, credenciais de TESTE)

O ambiente Preview da Vercel **não tem** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` nem banco (lido em 09/11/2026:
essas variáveis existem só em Production). Por isso o teste real roda nesta máquina:
- `.env.sandbox.local` (fora do git) com as credenciais de teste da aplicação;
- `bash scripts/sandbox-local.sh` sobe o checkout em `http://localhost:3230` com banco em memória, sem e-mail e com
  Pixel falso;
- o script só sobe se o Access Token for de um usuário de teste (`/users/me` com a marca `test_user`) e se a Public
  Key não for a de produção;
- `node --no-warnings scripts/teste-sandbox-mp.mjs` faz Pix, cartão 1× (aprovado, recusado e pendente) e os
  parcelados.

**Resultado em 10/11/2026: o teste de ponta a ponta NÃO roda com a integração atual.**
- Hoje o painel do Mercado Pago entrega como "credenciais de teste" as credenciais de um usuário de teste vendedor
  (APP_USR-…, conta TESTUSER…), não mais as TEST-…;
- com elas, `POST /v1/payments` (a API usada aqui, Pix e cartão) responde **HTTP 401 "Unauthorized use of live
  credentials"**, com qualquer pagador, inclusive a conta de teste compradora;
- com as mesmas credenciais, a **API de Orders** (`POST /v1/orders`) funcionou:
  - Pix criado, aguardando pagamento;
  - cartão de teste Visa aprovado, R$ 449,90 em 1×.
- A conta de teste tem configuração de parcelamento própria ("parcelado cliente"):
  - o checkout deve recusar 2× a 12× nela, sem cobrar;
  - pela API de Orders, 12× de R$ 574,80 voltou "invalid_transaction_amount".

Caminhos para validar a cobrança antes de abrir a venda (decisão do Igor):
- **(a)** migrar `src/lib/sites/mercadopago.ts` para a API de Orders, a recomendada pelo Mercado Pago, e testar aqui
  no sandbox;
- **(b)** manter a API de Payments e fazer um pagamento real de baixo valor em produção, com estorno. Cobrança real:
  só com autorização explícita.

## Testes locais (provedores simulados, nada sai da máquina)

```bash
NEXT_PUBLIC_META_PIXEL_ID=000000000000001 npm run build
# servidor em :3220 com as variáveis do cabeçalho de scripts/teste-sites-pacote.mjs
node scripts/teste-sites-pacote.mjs
```

Na entrega de 09/11/2026, rodando contra servidores locais:
- `teste-sites-pacote`: 92/92;
- `teste-atendimento-ia`: 114/114;
- `teste-medicao-funil`: 27/27;
- `teste-ofertas-local`: 63/63;
- `teste-medicao-leads`: 52/52.
