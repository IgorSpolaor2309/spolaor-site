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

## Meios de pagamento

Desejados: cartão e Pix. Só aparecem e são aceitos os meios listados em `IA_MEIOS_PAGAMENTO` (`cartao`, `pix`)
depois de validados no ambiente de teste; sem nenhum, a contratação não abre. Os textos de renovação mudam
pelo meio: cartão = cobrança automática a cada 30 dias; Pix = o comprador paga um novo Pix a cada vencimento
e, sem esse pagamento, o acesso termina no fim do período já pago.
- A documentação de assinaturas lista Pix entre os meios, mas **não descreve** como a renovação por Pix
  funciona. No modelo usado (assinatura sem plano, pendente), as cobranças "dependem que o usuário busque uma
  forma de concluir o pagamento", o que é coerente com o Pix pago a cada vencimento — confirmar no teste.
- Restringir os meios no checkout só está documentado na assinatura **com plano** (`preapproval_plan`,
  `payment_methods_allowed`); no modelo sem plano não há campo documentado. Se o checkout oferecer um meio
  ainda não validado, será preciso migrar para assinatura com plano para restringir.

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
| Cancelada | Suspende no fim do período quitado, **sem carência** (mesmo se o fornecedor já tiver renovado; a operação é avisada do custo) |
| Cobrança não aprovada e a cobrança do novo ciclo do fornecedor **não** está confirmada como paga | Suspende no fim do período pago (nunca provoca uma renovação); volta com reativação quando o pagamento for aprovado |
| Cobrança não aprovada e a cobrança do novo ciclo do fornecedor **confirmada como paga** (`GET /clients/{externalId}/charges`, `status: PAID`, período a partir do fim do período pago) | Avisa a operação ao entrar na carência e mantém o acesso por `IA_CARENCIA_DIAS` (**10 dias**, decidido em 05/11/2026); se o Mercado Pago aprovar, segue sem custo extra; ao terminar sem pagamento, suspende e avisa |
| Estorno ou contestação | Suspende na hora |

**Cancelamento agendado no fornecedor: não existe.** A documentação do ZappMillion (API e painel) não tem
"cancelar no fim do período" nem "desligar a renovação": `PATCH` só aceita `name` e `planId` (troca de plano
agendada para a próxima renovação, sem parar a renovação); `suspend` e `DELETE` valem na hora e não devolvem
o restante do período. Também não há webhook de renovação, e o horário exato da cobrança de renovação não é
documentado (só "a cada 30 dias, na mesma data do primeiro pagamento"). Perguntar ao suporte do ZappMillion
se existe cancelamento no fim do período e em que momento a renovação é cobrada.

**Custo possível para a Spolaor (valores confirmados):** o fim do período pago coincide com a renovação do
fornecedor. Se o fornecedor cobrar antes de a suspensão rodar, a Spolaor paga **R$ 97,00** por um ciclo sem
receita:
- cliente cancela: recebeu R$ 297,00 pelo último período; se o fornecedor renovar primeiro, a margem desse
  cliente cai de R$ 200,00 para R$ 103,00 (antes das tarifas do Mercado Pago, não confirmadas aqui);
- cliente não paga a renovação: perda de R$ 97,00 se o fornecedor renovou primeiro e o cliente não regulariza.
A operação recebe um pré-aviso 24 h antes do fim de uma assinatura cancelada e um aviso no momento em que a
rotina encontra uma renovação do fornecedor sem recebimento (antes de suspender ou ao entrar na carência).

**Carência (IA_CARENCIA_DIAS=10, decidida):** só para renovação não paga pelo cliente quando a cobrança do novo
ciclo do ZappMillion já está **confirmada como paga** na lista de cobranças do cliente — a mudança de
`currentPeriodEnd` sozinha não basta (cobrança `PENDING` não conta). Motivo: nesse caso suspender não devolve
os R$ 97,00 e uma reativação depois cobraria outros R$ 97,00. Não vale para cancelamento, estorno ou
contestação, e a rotina nunca provoca uma renovação para conceder a carência.

## Agendador

Um agendador frequente faz a suspensão rodar logo depois do fim do período pago, mas **não garante** evitar a
cobrança extra do fornecedor: se o ZappMillion cobrar no instante exato de `currentPeriodEnd`, nenhuma
frequência chega antes sem tirar tempo pago. Ele só reduz a exposição se a renovação acontecer depois desse
instante (o que precisa ser confirmado com o ZappMillion).

O cron da Vercel Hobby roda uma vez por dia (`vercel.json`), o que basta para novas tentativas e
sincronização, mas não para agir no fim do período. Recomendado (reduz, não garante): um agendador externo **a cada minuto**
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

As credenciais recebidas do Mercado Pago são de **produção** (conta sem a marca de teste) e a chave do
ZappMillion é `zm_live_`: nenhuma serve para teste sem gerar cobranças reais.

**O que falta para executar**
1. ZappMillion: chave `zm_test_…` (Minha agência → Cartão e API → Chaves de API, com **Modo de teste** ligado).
   No modo de teste nada é cobrado, o cliente é simulado, não há e-mail de convite e **não há renovação**.
2. Mercado Pago: Access Token de teste e contas de teste (vendedor e comprador do Brasil) em Suas integrações;
   assinatura secreta das notificações do modo teste.
3. Onde colocar: ambiente *Preview* da Vercel ou `.env.local` na cópia local (o git ignora).
4. URL pública para receber as notificações do teste (prévia da Vercel sem proteção de login para
   `/api/atendimento-ia/webhook`, ou um túnel temporário para a máquina local).
5. Banco: `DATABASE_URL` de um Postgres de teste com `db/atendimento-ia.sql` aplicado (a memória não serve na Vercel).
6. Uma pessoa para pagar no checkout com a conta de comprador de teste (o site não entra na conta do comprador).

**Roteiro (o que validar)**
- O checkout aceita `frequency: 30, frequency_type: "days"` e mostra R$ 297,00 a cada 30 dias.
- Quais meios o checkout oferece no modelo sem plano; se aparecer Pix ou outro meio não validado, decidir
  entre aceitar ou migrar para assinatura com plano (`payment_methods_allowed`).
- Cartão: aprovado, recusado e pendente → aprovado; notificações `subscription_preapproval`,
  `subscription_authorized_payment` e `payment`; o vínculo pelo `external_reference`; a criação do cliente no
  ZappMillion em modo de teste com o plano PRO.
- Pix: a primeira cobrança e como o Mercado Pago gera a do vencimento seguinte (prazo, aviso ao comprador,
  status da cobrança até o pagamento).
- Só a notificação de `payment` chegando: os campos reais que ligam o pagamento à assinatura
  (`metadata.preapproval_id`, `point_of_interaction`, `external_reference`) e a busca
  `/authorized_payments/search?preapproval_id=`.
- Cancelamento pela página (`status: cancelled`) e pelo Mercado Pago; reenvio de notificação pelo painel
  (repetida); estorno e contestação (o que o ambiente de teste permitir).
- Renovação e pagamento atrasado: o ambiente de teste do ZappMillion não renova; o comportamento na
  renovação real depende da resposta do suporte (momento da cobrança).
