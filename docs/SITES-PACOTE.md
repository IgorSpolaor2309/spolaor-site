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
- O servidor cria a cobrança pela **API de Orders** (`POST /v1/orders`, ver a seção "Por que Orders e não
  Payments"): `total_amount`, `installments` e o tipo do cartão saem da tabela e do formulário seguro. Vai também
  `statement_descriptor` "SPOLAOR", `external_reference` `site_<pedido>` e `X-Idempotency-Key` por tentativa.
- **Cartão recusado:** o Mercado Pago responde HTTP 402 com a order `failed` no corpo; o pedido vira "recusado", com
  o motivo legível, e aceita nova tentativa (nova chave). Cartão de débito só em 1×.
- **Pix:** order com `payment_method` `pix`/`bank_transfer` e `expiration_time` de 60 min (`SITES_PIX_MINUTOS`). O
  QR Code e o copia e cola aparecem na página do pedido.
- **Depois de aprovada** (order `processed`), o pedido só vira "pago" se valor, moeda, `total_paid_amount` e parcelas
  baterem com a condição. Se não baterem, vira "divergente": não conta como pago e a operação recebe um aviso para
  estornar no painel.

## Por que Orders e não Payments (10/11/2026)

A primeira versão usava a API de Payments (`/v1/payments`). Ela não pôde ser testada no sandbox, e a cobrança de
sites foi migrada para Orders. **A assinatura de IA continua na API dela (`/preapproval`), sem mudança.**

**De onde vêm as credenciais de teste usadas.** O painel da aplicação real "Spolaor Tecnologia" (1210226582734013),
em Credenciais de teste, mostra as chaves de um **usuário de teste vendedor** (3819411964, marca `test_user`). Elas
pertencem à aplicação automática dele, "TestApp-7edf2da2" (5990120057297828), com `certification_status`
`not_certified` e `sandbox_mode` `false`.

Public Key, Access Token e tokenização são do mesmo contexto, sem mistura:
- `GET /applications/1210226582734013` com esse token: 403;
- token de cartão criado com a Public Key de teste: lido pelo Access Token de teste (200), mas não pela Public Key de
  produção (403);
- 12× visa: 22,11% com a Public Key e com o Access Token de teste; 0% com a Public Key de produção.

**O erro de Payments.** Com essas credenciais, `POST /v1/payments` (Pix e cartão) responde **HTTP 401
"Unauthorized use of live credentials" (cause 7)**, com qualquer pagador, inclusive a conta de teste compradora.

**Orientação oficial** ([Credenciais](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials)):
- **Checkout Transparente e Checkout Pro com Orders:** as credenciais de teste são criadas automaticamente junto com
  a aplicação. São exatamente as que o painel entrega.
- **Outros produtos (Payments):** as credenciais de teste precisam ser ativadas em Credenciais de teste, com aceite
  dos termos, reCAPTCHA e "Ativar credenciais".
  - O painel desta aplicação não oferece esse caminho.
  - reCAPTCHA e login na conta de teste não são feitos por automação.

Com as mesmas credenciais, a API de Orders funciona: Pix, cartão aprovado, recusado e em análise, e consulta da
order. Os resultados estão na seção do sandbox.

**O que mudou na migração (só o checkout de sites):**
- `src/lib/sites/mercadopago.ts` usa `/v1/orders`:
  - cria Pix e cartão;
  - lê por id;
  - busca pela referência (exige período);
  - cancela;
  - normaliza a order para os estados do pedido.
- `src/lib/sites/notificacao.ts` trata o tópico **"Order (Mercado Pago)"**.
- **Rotas de notificação:**
  - `POST /api/sites-pacote/webhook` aceita só `type` `order`.
  - Orders não aceita URL de notificação por pedido. O Mercado Pago manda o tópico para a URL de Webhooks da
    aplicação, que em produção é a rota da IA. Por isso `POST /api/atendimento-ia/webhook` ganhou uma linha: depois de
    validar a assinatura, repassa o `type` `order` para a rotina de sites.
  - Nada mais da IA mudou (assinatura, pagamentos, cobranças e provisionamento).
- `external_reference` passou a `site_<pedido>`: Orders recusa ":".
- O formulário de cartão envia o tipo do cartão (`additionalData.paymentTypeId`), exigido por Orders.

## Proteção contra cobrança em dobro no cartão

A proteção fica no servidor e no banco, não no botão do navegador (`pagarCartao` em `src/lib/sites/process.ts` e
`abrirTentativaCartao` em `src/lib/sites/store.ts`).

1. **A tentativa é reservada no banco antes de chamar o Mercado Pago.**
   - Um único `UPDATE`, com a linha do pedido travada (`for update`), abre a tentativa: `tentativas + 1`, chave de
     idempotência `site-<pedido>-cartao-<n>` gravada em `tentativa_chave` e `tentativa_estado` = `em_curso`.
   - Duas submissões simultâneas ao mesmo pedido nunca abrem tentativas independentes. A segunda recebe 409
     `pagamento_em_andamento`: "Já existe um pagamento deste pedido sendo processado. Não pague de novo".
2. **Resultado desconhecido.** Rede, timeout, 5xx, 409, 423 e 429 do Mercado Pago, ou falha nossa depois de chamar,
   não fecham a tentativa:
   - ela fica `incerta`, com a mesma chave;
   - o pedido fica `pagamento_pendente`, e a página mostra **"Pagamento em verificação"** (não "nada foi cobrado"),
     sem formulário e sem convite a outro pedido.
3. **Conciliar ou retomar com a mesma identidade.** Uma nova submissão do comprador, ou a conferência da página e da
   rotina:
   - primeiro procura a order pela referência do pedido (`site_<pedido>`) e adota a que ainda não está no histórico;
   - se a busca ainda não a enxerga (ela demora alguns segundos), a nova submissão cria com a MESMA chave.
   - Comportamento medido no sandbox em 10/11/2026: a mesma chave com o mesmo corpo devolve a mesma order; a mesma
     chave com outro token de cartão devolve 409 `idempotency_key_already_used`, sem criar outra. Ou seja, nunca há
     duas orders para uma tentativa.
4. **Recusa definitiva.** O Mercado Pago responde 402 com a order `failed`, ou 400/401/403/404/422 sem criar nada.
   A tentativa é fechada e a próxima abre outra, com chave nova. A order recusada fica só no histórico
   (`site_pagamentos`).
5. **Nada é liberado por tempo.** Uma busca vazia não prova que nada foi cobrado: a busca do Mercado Pago pode
   demorar a enxergar uma order nova. A tentativa incerta mantém a chave e o "Pagamento em verificação", bloqueando
   qualquer cobrança independente, até que algo esclareça:
   - a order aparece na busca: é adotada;
   - a notificação da order chega: é adotada;
   - o comprador submete de novo e o Mercado Pago cria a única order daquela chave, ou responde 409 porque ela já
     existe.

   O pedido nunca mostra "nada foi cobrado" sem essa confirmação.
6. **Tentativa `em_curso` parada há mais de 90 s** (ex.: o servidor caiu no meio da chamada): é tratada como incerta
   e retomada com a mesma chave.
7. **Notificação de uma order que o pedido ainda não conhecia,** durante uma tentativa aberta ou incerta: é a order
   dessa tentativa. Ela passa a ser a atual, e a tentativa fecha.

O Pix já tem a mesma garantia: a chave `site-<pedido>-pix-<n>` só avança depois de gravar o Pix, e o corpo é sempre o
mesmo. Uma resposta perdida, ou duas chamadas juntas, recebe do Mercado Pago a mesma order.

Testes:
- `scripts/teste-sites-pacote.mjs` (Mercado Pago simulado, com o comportamento de idempotência medido no sandbox):
  - order criada e resposta perdida, seguida de nova submissão: concilia, sem nova chamada de cobrança;
  - o mesmo caso com a busca atrasada: retoma com a mesma chave, 409, sem nova order;
  - falha de rede antes de chegar: retoma com a mesma chave e cria a única order;
  - order que existe no Mercado Pago mas fica invisível na busca por mais de 15 min: o pedido continua em
    verificação, sem liberar e sem "nada foi cobrado"; nova submissão usa a mesma chave (409, nenhuma order nova);
    a notificação, ou a order aparecendo na busca, confirma normalmente;
  - duas submissões simultâneas: uma tentativa e uma order;
  - recusa definitiva seguida de nova tentativa aprovada;
  - página "em verificação".
- `scripts/teste-sites-banco.mjs`: a mesma trava direto no banco. Em memória (`--memoria`) ou em um Postgres local
  (`SITES_TESTE_DATABASE_URL`, só localhost):
  - 20 reservas simultâneas, só 1 abre;
  - 10 retomadas simultâneas de uma incerta, só 1, com a mesma chave;
  - nova chave depois de recusa;
  - em curso parada é retomada;
  - pedido pago ou Pix não abre tentativa.

  Em 10/11/2026, num Postgres 16.15 local (contêiner `postgres:16-alpine` em 127.0.0.1): **8/8**, incluindo o
  esquema idempotente. O teste completo do checkout contra um servidor usando esse Postgres deu **111/111**; ficaram
  de fora só as 2 conferências de "oferta fechada", que precisam de um segundo servidor e não usam o banco.

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
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | Public Key da mesma aplicação do `MP_ACCESS_TOKEN`, para o formulário de cartão (em teste, a do usuário de teste; em produção, a da aplicação real) |
| `SITES_PIX_MINUTOS` | validade do Pix em minutos (padrão 60; de 30 a 1440) |
| `SITES_URL_PUBLICA` | opcional: endereço público (padrão: `IA_URL_PUBLICA`, `VERCEL_BRANCH_URL` na prévia ou `NEXT_PUBLIC_SITE_URL`) |
| reaproveitadas | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `LEAD_EMAIL_FROM`, `IA_OPERACAO_EMAIL`/`LEAD_EMAIL_TO`, `CRON_SECRET` |

As tabelas `site_pedidos`, `site_pagamentos` e `site_eventos` são criadas sozinhas, de forma idempotente, na primeira
conexão. Elas não tocam nas tabelas `ia_*`. Esquema em `src/lib/sites/store.ts`.

## Fluxo e estados

1. **Página `/sites/pacote`:** a primeira tela mostra:
   - o que é;
   - "12× de R$ 47,90" em destaque e, abaixo, menor, "Ou R$ 449,90 no Pix ou cartão à vista";
   - o botão "Quero meu site", também no cabeçalho e na barra fixa do celular.

   O total de cada parcelamento fica na tabela de condições e no checkout.
2. **Checkout `/sites/pacote/checkout`:**
   - pede nome, e-mail, WhatsApp, a condição e o aceite das condições;
   - mostra a parcela e o total da condição escolhida;
   - `POST /api/sites-pacote/pedido` cria o pedido. A chave do navegador evita pedido duplicado em clique duplo ou
     recarga.
3. **Página do pedido `/sites/pacote/pedido?p=&t=`:**
   - Pix com QR Code, ou o formulário de cartão (`POST /api/sites-pacote/cartao`);
   - acompanhamento por `GET /api/sites-pacote/status`, que confere no Mercado Pago no máximo a cada ~12 s;
   - depois de pago, explica que a coleta das informações é pelo WhatsApp e que o prazo conta a partir dos materiais.
4. **Confirmação:**
   - notificações do tópico "Order (Mercado Pago)", que chegam pela URL de Webhooks da aplicação (rota da IA, que
     repassa) ou por `POST /api/sites-pacote/webhook`;
   - a assinatura é validada, entregas repetidas são ignoradas e a order é relida no Mercado Pago;
   - a página do pedido também confere sozinha;
   - a rotina `GET /api/sites-pacote/rotina` (Bearer `CRON_SECRET`) confere os pendentes e pode ser chamada pelo
     agendador já usado pela IA.

**Estados do pedido:**
- `criado`: dados aceitos, sem pagamento;
- `pagamento_pendente`: Pix gerado, cartão em análise ou cartão em verificação (resultado desconhecido);
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

A rota de notificações da IA só repassa o `type` `order`. Os tipos da IA (`payment`, `subscription_*`,
chargebacks) seguem como antes. Uma order sem referência `site_<id>` é ignorada.

## Para abrir em produção (autorizado pelo Igor em 10/11/2026)

1. No painel do Mercado Pago, aplicação "Spolaor Tecnologia" > Webhooks > **modo produção** (a URL atual, que é a
   rota da IA): marcar também o evento **"Order (Mercado Pago)"** e salvar. Os eventos da IA continuam marcados.
2. Na Vercel, Production:
   - `NEXT_PUBLIC_MP_PUBLIC_KEY` com a Public Key de produção, da mesma aplicação do `MP_ACCESS_TOKEN` atual;
   - `SITES_CONTRATACAO_ATIVA=true`;
   - `SITES_CONDICOES=pix,cartao-1x,cartao-2x,cartao-3x,cartao-6x,cartao-12x`.

   O banco e o `MP_WEBHOOK_SECRET` já existem.
3. Merge do PR #23 e conferência em produção (Pix gerado; formulário de cartão abrindo com a parcela certa). Sem
   cobrança real, salvo autorização explícita.
4. Rodar de novo `scripts/sondar-parcelamento.mjs` com a Public Key de produção se a configuração de parcelamento
   mudar.

## Pedido em "Pagamento em verificação": como identificar e conferir à mão

O pedido fica assim quando uma tentativa de cartão foi enviada ao Mercado Pago e a resposta não chegou (rede, timeout,
erro 5xx/409/423/429 ou falha nossa depois da chamada). Pode ter cobrado ou não. **O sistema nunca libera outra
cobrança por prazo.** A tentativa mantém a mesma chave até algo esclarecer.

**Como identificar**
- **Comprador:** a página do pedido mostra "Pagamento em verificação", sem formulário de cartão e sem convite a outro
  pedido.
- **E-mail da operação:** chega o "Sites · Novo pedido — pagamento pendente" de sempre, com nome, WhatsApp e o id do
  pedido. Não existe aviso próprio para "em verificação".
- **Banco (Neon, somente leitura):**

  ```sql
  select id, criado_em, nome, email, whatsapp, condicao, total, tentativas,
         tentativa_chave, tentativa_estado, tentativa_em, mp_payment_id, ultimo_erro
  from site_pedidos
  where status = 'pagamento_pendente' and tentativa_estado in ('incerta', 'em_curso')
  order by tentativa_em;
  ```

  `tentativa_estado = 'incerta'` (ou `em_curso` há mais de 90 s) é o caso. `ultimo_erro` começa com "resultado
  desconhecido". `tentativa_chave` é `site-<pedido>-cartao-<n>`.

**Como conferir no Mercado Pago**
- A referência da cobrança é `site_<id do pedido>`.
- Na conta (Atividade), procure pagamentos de cartão do valor da condição (ex.: R$ 574,80 em 12×) a partir do
  horário de `tentativa_em` e abra o detalhe para ver a referência.
- A busca do Mercado Pago pode levar alguns minutos para enxergar uma cobrança nova. Uma busca vazia logo em seguida
  NÃO prova que nada foi cobrado: confira de novo depois de 30 minutos.

**O que fazer**
1. **Achou pagamento aprovado com essa referência:** foi cobrado. O sistema adota o pagamento sozinho quando chega a
   notificação "Order", quando o comprador reabre o link do pedido ou na próxima conferência. Pode falar com o
   comprador normalmente; o aviso "Pagamento confirmado" sai quando o sistema adotar.
2. **Achou pagamento recusado:** nada foi cobrado. O comprador pode tentar de novo pelo mesmo link; a próxima tentativa
   abre com chave nova.
3. **Não achou nada, mesmo depois de 30 minutos:** fale com o comprador pelo WhatsApp e peça que **reabra o mesmo link
   do pedido e envie o cartão de novo**.
   - A nova submissão usa a MESMA chave: o Mercado Pago cria a única cobrança dessa chave, ou responde que ela já
     existe.
   - Nunca saem duas cobranças.
   - Não crie outro pedido e não ofereça Pix para o mesmo comprador enquanto a tentativa estiver em verificação: seria
     uma cobrança independente.
4. **Não edite o banco à mão** para "liberar" a tentativa (`tentativa_estado`, `tentativa_chave`, `status`): isso
   desliga a proteção contra cobrança em dobro.

**Limitação atual:** em produção não há agendamento da rotina `GET /api/sites-pacote/rotina`; só a rotina da IA está
no `vercel.json`. A conciliação automática acontece:
- pela notificação "Order (Mercado Pago)";
- pela página do pedido aberta (confere a cada ~12 s);
- por uma chamada manual da rotina com `Authorization: Bearer <CRON_SECRET>`.

## Duas validações diferentes

| | Consulta de parcelamento (produção) | Testes de cobrança (sandbox) |
|---|---|---|
| O que prova | quanto o comprador real paga em cada condição | que o checkout cobra, recusa, confirma e não duplica |
| Conta | a real (Public Key de produção) | a de teste (usuário de teste vendedor) |
| Cobra algo? | não: só `GET /v1/payment_methods/installments` | não: dinheiro de teste |
| Script | `scripts/sondar-parcelamento.mjs` | `scripts/teste-sandbox-mp.mjs` |
| Resultado (10/11/2026) | 1×, 2×, 3×, 6× e 12× pelos totais aprovados, 0% de acréscimo | ver abaixo |

A conta de teste tem configuração de parcelamento própria ("parcelado cliente": 12× com 22,11% ao comprador). Por
isso, no sandbox, o checkout recusa 2×, 3×, 6× e 12× antes de cobrar. A cobrança parcelada sem acréscimo só existe na
conta real, e é a consulta de produção que a confirma.

## Teste real no sandbox do Mercado Pago (localhost, credenciais de teste)

O ambiente Preview da Vercel **não tem** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` nem banco (essas variáveis existem só
em Production). Por isso o teste real roda nesta máquina:

```bash
# .env.sandbox.local (fora do git): MP_ACCESS_TOKEN e NEXT_PUBLIC_MP_PUBLIC_KEY das credenciais de teste do painel
bash scripts/sandbox-local.sh                      # checkout em http://localhost:3230
node --no-warnings scripts/teste-sandbox-mp.mjs    # SANDBOX_CENARIOS=1,6 roda só alguns cenários
```

- O launcher só sobe se o Access Token for de um usuário de teste (`/users/me` com a marca `test_user`) e se a Public
  Key não for a de produção. Ele usa banco em memória, nenhum e-mail e um Pixel falso.
- O cartão é digitado no **formulário seguro do próprio Mercado Pago** (Card Payment Brick, SDK JS v2), dentro do
  checkout do PR, com os cartões de teste de Orders:
  - Mastercard 5480 8328 0103 3311 ou Visa 4235 6477 2802 5682, CVV 123, validade 11/30;
  - titular APRO aprova, OTHE recusa, CONT fica em análise;
  - CPF 12345678909.
- O Pix de teste com o nome "APRO …" é aprovado sozinho pelo sandbox, entre alguns segundos e cerca de 2 minutos.
- Capturas e ids das orders: `../previa-pacote-site/sandbox-orders/` (`RESULTADO.txt`).

**Resultado em 10/11/2026 (orders reais no sandbox):**

29/29 conferências numa única rodada completa (`RESULTADO.txt`):

| Cenário | Resultado |
|---|---|
| Pix pelo checkout no navegador | QR Code e copia e cola na página; uma order de R$ 449,90 com referência `site_<pedido>` e validade de 60 min; aprovada pelo sandbox, a página confirmou sozinha |
| Cartão 1× aprovado (Mastercard, APRO, Brick) | pedido pago; order `processed`/`accredited`, R$ 449,90 pagos, 1× no crédito, SPOLAOR na fatura |
| Segunda cobrança no pedido pago | recusada (409 `pedido_encerrado`), continua uma order só |
| Cartão recusado (Visa, OTHE, Brick) | pedido recusado, com "O banco emissor recusou o pagamento. Nada foi cobrado…" na página |
| Nova tentativa no mesmo pedido (APRO) | pago; orders `failed` → `processed` |
| Cartão em análise (Mastercard, CONT, Brick) | "Pagamento em análise", não conta como pago; nova cobrança bloqueada (409 `pagamento_em_analise`) |
| 12× pelo Brick na conta de teste | o Brick mostrou 12× de R$ 58,49 (R$ 701,89, juros da conta de teste); o servidor recusou ANTES de cobrar ("o Mercado Pago cobraria mais que R$ 574,80 em 12×"); zero orders |
| 2×, 3× e 6× (token da Public Key de teste) | recusados antes de cobrar; zero orders |
| Notificação com assinatura inválida | 401 |
| `type` `payment` na rota de sites | ignorado (só `order`) |
| Notificação `order` pela rota de Webhooks da aplicação (a da IA, a de produção) | Pix pendente → pedido pago, sem consultar o status antes |
| A mesma entrega repetida | ignorada; nova entrega não muda nada |
| Order inexistente (ex.: simulação do painel) | 200 e ignorada, sem novas tentativas |
| Mesmo envio do checkout repetido (clique duplo) | mesmo pedido e um Pix só |

**O que este teste não cobre:**
- **A entrega das notificações pelo próprio Mercado Pago:** ele não alcança localhost. As notificações do teste têm
  assinatura `x-signature` válida, gerada com o segredo local, e apontam para orders reais do sandbox, que o servidor
  relê no Mercado Pago. Em produção, a entrega depende do evento "Order (Mercado Pago)" marcado no painel (ver "Para
  abrir em produção"); o painel tem "Simular notificação" para conferir.
- **Os avisos internos por e-mail:** o sandbox roda sem provedor de e-mail. Estão cobertos com provedor simulado em
  `scripts/teste-sites-pacote.mjs`.
- **O Pixel:** coberto em `scripts/teste-sites-pacote.mjs`, com `Purchase` só depois de pago e sem `Subscribe`.

## Testes locais (provedores simulados, nada sai da máquina)

```bash
NEXT_PUBLIC_META_PIXEL_ID=000000000000001 npm run build
# servidor em :3220 com as variáveis do cabeçalho de scripts/teste-sites-pacote.mjs
node scripts/teste-sites-pacote.mjs
```

O Mercado Pago simulado do teste responde no formato da API de Orders. Em 10/11/2026, depois da migração, rodando
contra servidores locais (`bash ../servidores-teste.sh`):
- `teste-sites-pacote`: 115/115 (inclui a proteção contra cobrança em dobro; com `SITES_TESTE_INVISIVEL_SEG=960`, a order fica invisível na busca por 16 min reais);
- `teste-sites-banco`: memória 7/7; Postgres 16 local 8/8;
- `teste-sites-pacote` contra servidor com Postgres: 111/111 (sem as 2 conferências de oferta fechada);
- `teste-atendimento-ia`: 114/114;
- `teste-medicao-funil`: 27/27;
- `teste-ofertas-local`: 63/63;
- `teste-medicao-leads`: 52/52.
