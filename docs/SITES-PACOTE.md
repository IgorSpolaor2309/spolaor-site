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

## Conta do Mercado Pago: o que foi lido e o que falta (bloqueio real)

**Leitura de 09/11/2026, sem alterar nada** (Seu negócio > Taxas e parcelas, aba Checkout):
- a conta oferece **"parcelado cliente"**: em 2× ou mais o Mercado Pago soma juros ao total do comprador
  (2× +9,64%, 3× +11,23%, 6× +14,32%, 12× +22,11%; o 12× de R$ 574,80 sairia ≈ R$ 701,89);
- com isso, hoje só **Pix** e **cartão 1×** saem pelo total aprovado. A pré-checagem do checkout recusa 2×, 3×, 6×
  e 12× (ninguém paga a mais, mas o 12× do anúncio não é vendável);
- para vender 2×–12× pelo total aprovado é preciso ativar **"Parcelado vendedor" → Oferecer** na aba **Checkout**
  (o vendedor paga a taxa de parcelamento; o comprador paga exatamente o total);
- taxas lidas (recebimento "na hora"): crédito 1× 4,98%; 2×–6× 2,99% e 7×–12× 3,09%, mais a taxa de parcelamento
  do parcelado vendedor (2× 4,52%, 3× 6,61%, 6× 11,95%, 12× 19,17%); Pix 0,99%.

Ainda a conferir no painel de desenvolvedor (pede validação de telefone da conta): Webhooks da aplicação (tópico
Pagamentos e segredo) e as credenciais de teste.

Outros pré-requisitos: chave Pix cadastrada (Pix via API) e a Public Key da mesma aplicação do Access Token
(`NEXT_PUBLIC_MP_PUBLIC_KEY`).

**Como validar o parcelamento sem cobrar nada:** `scripts/sondar-parcelamento.mjs` só lê
`GET /v1/payment_methods/installments`, a mesma consulta do formulário de cartão. Com a Public Key de produção
(APP_USR-, que é pública e vai no próprio site) ele mostra o que o comprador real pagaria em cada condição e
bandeira; sai com erro se alguma não bater com o total aprovado.

```bash
# .env.parcelas.local (fora do git) com NEXT_PUBLIC_MP_PUBLIC_KEY=APP_USR-...  ou  TEST-...
node --no-warnings scripts/sondar-parcelamento.mjs --env .env.parcelas.local
```

Se o parcelado vendedor não for ativado, o anúncio de 12× não pode rodar. Em nenhum caso o preço é alterado em
silêncio; a decisão de preço é do Igor.

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
essas variáveis existem só em Production). Por isso a prévia do PR mostra a oferta com a contratação fechada, e o
teste real com o Mercado Pago roda nesta máquina:

1. Criar `.env.sandbox.local` (fora do git) com `MP_ACCESS_TOKEN=TEST-...` e `NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-...`
   (painel do Mercado Pago > Suas integrações > aplicação > Credenciais de teste).
2. `bash scripts/sandbox-local.sh` sobe em `http://localhost:3230` com banco em memória, sem e-mail, com Pixel
   falso e sem notificação (a página do pedido confere o pagamento sozinha). Recusa credenciais que não sejam TEST-.
3. **Cartão:** cada condição com os cartões de teste do Mercado Pago (titular APRO aprovado, OTHE recusado, CONT
   pendente; CPF 12345678909). A recusa por acréscimo aparece como "o Mercado Pago cobraria mais que R$ …".
4. **Pix:** gerar o Pix de R$ 449,90 e conferir o QR Code.
5. Só liste em `SITES_CONDICOES` de produção as condições aprovadas no teste **e** confirmadas pela sondagem com a
   Public Key de produção.

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
