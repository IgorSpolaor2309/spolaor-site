# Atendimento com IA no WhatsApp (`/atendimento-ia`)

Oferta de **autoatendimento**: o cliente assina pelo site, paga a Spolaor pelo Mercado Pago e, com a
primeira cobrança aprovada, o acesso é criado automaticamente no ZappMillion (modalidade Cartão e API).
O próprio ZappMillion envia o convite por e-mail; o comprador configura o agente no painel e conecta o
próprio WhatsApp autorizando na Meta. Não há implantação manual da Spolaor na entrega.

## Fluxo

1. **Contratação** (`POST /api/atendimento-ia/contratar`): valida empresa, responsável, e-mail, telefone e
   aceite; cria a contratação no banco e uma assinatura no Mercado Pago (`POST /preapproval`, sem plano
   associado, `status: pending`, `external_reference` = id da contratação, valor e ciclo definidos pelo
   servidor). Devolve o `init_point` (checkout hospedado). O navegador nunca define preço.
2. **Retorno do checkout** (`back_url` → `/atendimento-ia/acompanhar?c=…&t=…`): só mostra o andamento.
   Não confirma nada; o token do link fica guardado apenas como hash.
3. **Notificações** (`POST /api/atendimento-ia/webhook`): valida `x-signature` com o validador oficial do
   SDK (`WebhookSignatureValidator`: HMAC-SHA256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
   tolerância de 5 min). Entregas repetidas (mesmo `x-request-id`) são ignoradas; cada notificação relê o
   recurso no Mercado Pago (`/preapproval/{id}`, `/authorized_payments/{id}`, `/v1/payments/{id}`,
   `/v1/chargebacks/{id}`) e confere vínculo (`preapproval_id`/`external_reference`), valor e moeda (BRL).
   - Assinatura `authorized` = meio de pagamento autorizado, **não** é pagamento aprovado.
   - Cobrança com `payment.status = approved` = pagamento aprovado. A primeira dispara a criação do acesso.
4. **Criação do acesso** (`POST /v1/provisioning/clients`): `externalId` estável `spolaor-ia-<id>` (repetir
   devolve o mesmo cliente, sem nova cobrança), `planId` conferido em `GET /plans`, usuário com e-mail e
   telefone E.164, playbooks opcionais. Salva `organizationId`, `workspaceId`, `userId`, período do
   fornecedor e WhatsApp. A API não devolve um id de assinatura separado; a assinatura do fornecedor fica
   em `subscription` do cliente.
   - Falha: etapa **ativação pendente**, aviso por e-mail à operação, novas tentativas automáticas para
     429/5xx (espera crescente) e tentativa manual segura (`acao: retentar`) para os demais erros.
5. **Andamento para o comprador**: pagamento confirmado → acesso liberado (convite enviado) → configure o
   agente no painel → conecte o WhatsApp. "WhatsApp conectado" vem de `messagingAccount.status = CONNECTED`.
   A configuração do agente não é exposta pela API: aparece como tarefa no painel, nunca como concluída.

## Preço, plano e ciclo

- **Venda:** R$ 297,00 a cada 30 dias (`IA_PRECO_MENSAL=297.00`, `IA_MP_FREQUENCIA=30:days`, padrão). O mesmo
  texto aparece na página, na descrição da assinatura no checkout e no aceite.
- **Fornecedor (confirmado em `GET /v1/provisioning/plans`, 05/11/2026):** plano **PRO**, id
  `01JZ0000000000000000000PRO`, **R$ 97,00** no cartão da agência, **2.000 respostas** do agente por ciclo,
  `billingCycleDays: 30`. É o único plano da conta. `IA_ZM_PLAN_ID=01JZ0000000000000000000PRO`, `IA_LIMITE_RESPOSTAS=2000`.
- **Ciclo de 30 dias no Mercado Pago:** `frequency: 30, frequency_type: "days"` não aparece nas páginas de
  assinatura lidas (os exemplos usam meses). **Validar no ambiente de teste antes de abrir.** Se não for
  aceito, a alternativa é `1:months` (R$ 297,00 por mês): o período do cliente passa a variar de 28 a 31 dias
  contra os 30 do fornecedor, e nos meses de 31 dias o fornecedor renova antes do fim do período pago
  (custo de até um ciclo extra, R$ 97,00, por cliente que cancelar ou não pagar). Nesse caso a página e o
  checkout devem dizer "por mês" — mudar só com aprovação.

## Período pago, renovação e cancelamento (regra implementada)

**O comprador recebe o período inteiro.** O período começa quando o acesso é criado e termina junto com o
período do fornecedor (acesso + 30 dias). Cada renovação aprovada soma 30 dias ao fim anterior. **Nada é
suspenso antes do fim do período pago** — nem por cancelamento, nem por cobrança pendente.

Comportamento do fornecedor (documentação do ZappMillion; o modo de teste não renova, então não dá para
observar a renovação em teste):
- renova sozinho a cada 30 dias desde a criação, no cartão da agência, sem nova tentativa se recusar;
- `suspend` encerra a assinatura na hora, bloqueia o acesso e **não devolve** o restante do período;
- `reactivate` cobra um ciclo novo na hora e abre 30 dias a partir dali;
- `DELETE` é definitivo (não reutiliza o `externalId`).
Por isso suspender antes do fim tiraria tempo pago, e suspender depois que o fornecedor renovou não devolve
o valor. A regra:

| Situação no fim do período pago | O que acontece |
|---|---|
| Renovação aprovada antes | Soma 30 dias; o fornecedor renova (pago pelo cliente) |
| Cancelada | Suspende no fim do período (sem novas cobranças nossas) |
| Cobrança não aprovada e o fornecedor ainda não renovou | Suspende no fim do período (evita a cobrança do fornecedor); volta com reativação quando o pagamento for aprovado |
| Cobrança não aprovada e o fornecedor já renovou | Mantém o acesso por `IA_CARENCIA_DIAS` (padrão 10) enquanto o Mercado Pago tenta; se aprovar, segue sem custo extra; se não, suspende |
| Estorno ou contestação | Suspende na hora |

**Custo possível para a Spolaor (valores confirmados):** como o fim do período pago coincide com a renovação
do fornecedor, se o fornecedor cobrar antes de a suspensão rodar, a Spolaor paga **R$ 97,00** por um ciclo
sem receita:
- cliente cancela: recebeu R$ 297,00 pelo último período; se o fornecedor renovar primeiro, a margem desse
  cliente cai de R$ 200,00 para R$ 103,00 (antes das tarifas do Mercado Pago, não confirmadas aqui);
- cliente não paga a renovação e não regulariza na tolerância: perda de R$ 97,00 se o fornecedor renovou
  primeiro; nenhuma se a suspensão rodou antes.
Para reduzir isso sem tirar tempo pago, o agendador deve rodar **a cada minuto** (a rotina só consulta o
fornecedor para quem está a 10 minutos do fim, respeitando o limite de 60 requisições/min). **A confirmar
com o ZappMillion:** em que momento exato a renovação é cobrada (no instante de `currentPeriodEnd` ou em
lote depois dele). Se for em lote, a suspensão no fim do período evita o custo na prática.

## Agendador

O cron da Vercel Hobby roda uma vez por dia (`vercel.json`), o que basta para novas tentativas e
sincronização, mas não para agir no fim do período. Recomendado: um agendador externo **a cada minuto**
chamando `GET https://<domínio>/api/atendimento-ia/cron` com o cabeçalho `Authorization: Bearer <CRON_SECRET>`.
Opções sem custo: cron-job.org (gratuito, intervalo de 1 min) ou Upstash QStash (plano gratuito com limite
diário que comporta 1.440 chamadas/dia — conferir o limite atual). A Vercel Pro permite cron por minuto, mas
é pago. Criar a conta no agendador fica com você.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

Cadastre **separado por ambiente**: *Preview* com credenciais de teste e *Production* com as de
produção. Nada disso vai para o navegador; nunca coloque valores no repositório nem em logs.

| Variável | O que é | Onde obter |
|---|---|---|
| `ZM_API_KEY` | Chave da API de provisionamento. `zm_test_…` em Preview, `zm_live_…` em Production (o site recusa a mistura) | ZappMillion → Minha agência → Cartão e API → Chaves de API (Modo de teste liga/desliga) |
| `MP_ACCESS_TOKEN` | Access Token do Mercado Pago (servidor) | Suas integrações → aplicação → Credenciais (teste ou produção) |
| `MP_WEBHOOK_SECRET` | Assinatura secreta das notificações | Suas integrações → aplicação → Webhooks → Configurar notificações |
| `DATABASE_URL` | Postgres das contratações (aplicar `db/atendimento-ia.sql`) | Vercel Marketplace (Neon) ou outro Postgres |
| `IA_PRECO_MENSAL` | Preço por ciclo: `297.00` | Definido |
| `IA_LIMITE_RESPOSTAS` | Limite exibido; deve ser o `agentReplyLimit` do plano | `GET /v1/provisioning/plans` |
| `IA_ZM_PLAN_ID` | Plano do fornecedor | `GET /v1/provisioning/plans` |
| `IA_PAINEL_URL` | Endereço do painel com a marca (ex.: `https://spolaortecnologia.agencyzm.com`) | ZappMillion |
| `IA_ADMIN_TOKEN` / `CRON_SECRET` | Segredos aleatórios das rotas internas | Gerar (32+ caracteres) |
| `IA_OPERACAO_EMAIL` | Destino dos avisos (padrão `LEAD_EMAIL_TO`) | — |
| `IA_CONTRATACAO_ATIVA` | `true` abre a contratação | Só depois dos testes |
| opcionais | `IA_ZM_PLAYBOOK_IDS`, `IA_ZM_PLAYBOOK_VARIAVEIS` (JSON), `IA_MP_FREQUENCIA` (padrão `30:days`), `IA_CARENCIA_DIAS` (padrão 10) | — |

A Public Key do Mercado Pago **não** é usada (checkout hospedado, tudo pelo servidor).

## Mercado Pago: aplicação e notificações

1. Em https://www.mercadopago.com.br/developers/panel/app → **Criar aplicação** (ou abra a existente).
   Produto: pagamentos online / assinaturas.
2. **Credenciais de teste**: copie o Access Token de teste para o ambiente *Preview*. Crie contas de
   teste (comprador e vendedor do Brasil) em **Contas de teste** para simular o checkout.
3. **Webhooks → Configurar notificações**: URL de teste e de produção
   `https://<domínio>/api/atendimento-ia/webhook`; eventos **Planos e assinaturas** (assinaturas e
   pagamentos recorrentes), **Pagamentos** e **Contestações**. Revele a assinatura secreta e cadastre em
   `MP_WEBHOOK_SECRET`. A documentação de assinaturas diz em um trecho que a configuração por "Suas
   integrações" não vale para assinaturas; se as notificações de assinatura não chegarem no teste, esse é
   o primeiro ponto a verificar.
4. **Produção**: ative o ambiente de produção na aplicação e cadastre o Access Token de produção apenas
   em *Production*.

## Operação

- `POST /api/atendimento-ia/admin` com `Authorization: Bearer IA_ADMIN_TOKEN`:
  `listar`, `retentar`, `sincronizar`, `atualizar`, `reenviar-convite`.
- Cancelamento pelo comprador: botão na página de acompanhamento (`POST /api/atendimento-ia/cancelar`), que envia `status: cancelled` ao Mercado Pago.
- Cron (`vercel.json`): `GET /api/atendimento-ia/cron`, diário, mais o agendador externo a cada minuto (seção Agendador).
- Teste local sem fornecedores reais: `node scripts/teste-atendimento-ia.mjs` (instruções no arquivo).

## Medição

`Purchase` (Pixel) e `purchase` (GA4) disparam só na página de acompanhamento, quando o servidor confirma
a primeira cobrança aprovada, com o id da contratação como `eventID`/`transaction_id` e trava local para
não repetir. Enquanto a contratação estiver fechada, o formulário de interesse usa o `Lead` existente
(origem `atendimento-ia`).

## Sugestões de anúncios (destino `https://www.spolaortecnologia.com.br/atendimento-ia`)

Use UTMs próprias (ex.: `?utm_source=meta&utm_medium=cpc&utm_campaign=atendimento-ia&utm_content=<criativo>`)
para não misturar com as campanhas atuais. Sem promessas de resultado; só depois de abrir a contratação.

- **"Mensagem às 22h, resposta às 22h."** Um agente de IA responde no WhatsApp da sua empresa e passa a
  negociação para a sua equipe. Assine, configure no painel e conecte o seu número.
- **"Quem pergunta preço quer resposta agora."** Atendimento com IA no WhatsApp: tira dúvidas com as
  informações da sua empresa e encaminha para quem vende. Mensal, sem fidelidade.
- **Vídeo de tela (15 s):** a conversa ilustrativa da página (dados fictícios) + "Assine, configure,
  conecte". Legenda "exemplo ilustrativo".

## Teste nos fornecedores (antes de abrir as vendas)

Pendente: as credenciais recebidas do Mercado Pago são de **produção** (conta sem a marca de teste), e a
chave do ZappMillion recebida é `zm_live_` — nenhuma das duas serve para o teste sem gerar cobranças reais.
Com as credenciais de teste no ambiente *Preview* (ou num `.env.local` da cópia local, que o git ignora):

1. `ZM_API_KEY=zm_test_…` (Cartão e API → Chaves de API, com **Modo de teste** ligado). No modo de teste nada é
   cobrado, o cliente é simulado e não há e-mail de convite real; renovação não acontece.
2. `MP_ACCESS_TOKEN` de teste e contas de teste (vendedor e comprador do Brasil) em Suas integrações.
3. URL de notificação de teste apontando para o ambiente de teste; `MP_WEBHOOK_SECRET` do modo teste.
4. Roteiro: contratar com o e-mail do comprador de teste → pagar no checkout com cartão de teste (aprovado,
   pendente e recusado) → conferir notificações (`subscription_preapproval`, `subscription_authorized_payment`,
   `payment`), o ciclo `30 days` aceito e a criação no ZappMillion em modo de teste; cancelar pela página;
   repetir uma notificação pelo painel do Mercado Pago. O pagamento no checkout é feito por uma pessoa com a
   conta de comprador de teste.
