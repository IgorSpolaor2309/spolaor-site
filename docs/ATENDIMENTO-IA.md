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

## Renovação, cancelamento e inadimplência (política proposta — confirmar antes de abrir)

O ZappMillion cobra o cartão da agência a cada **30 dias** desde a criação, sem nova tentativa: se o
cartão recusar, o cliente é suspenso. O Mercado Pago cobra o cliente no ciclo configurado (padrão
mensal; `IA_MP_FREQUENCIA=30:days` alinha com os 30 dias do fornecedor, **a validar em teste**).

- **Renovação paga**: estende `pago_ate`; não cria cliente nem reativa (o fornecedor renova sozinho).
- **Guarda de renovação** (cron): se o cliente não pagou além da próxima renovação do fornecedor,
  suspende no ZappMillion antes dela (`POST /clients/{externalId}/suspend`), no momento
  `min(pago_ate, renovação − IA_GUARDA_HORAS)`. Assim a Spolaor não paga o fornecedor sem ter recebido.
  Com o cron diário da Vercel Hobby, use `IA_GUARDA_HORAS=36` (padrão): no pior caso o acesso termina até
  36 h antes do fim do período pago **quando esse fim cai logo antes da renovação do fornecedor**. Com
  cron de hora em hora (plano Pro ou agendador externo chamando a rota), reduza para 3.
- **Pagamento atrasado e depois aprovado**: reativa (`POST /reactivate`), o que cobra um novo ciclo do
  fornecedor na hora.
- **Cancelamento** pelo cliente: acesso mantido até o fim do período pago; a guarda suspende antes da
  renovação seguinte. Se o período pago terminar depois da renovação do fornecedor (mês de 31 dias com
  ciclo mensal), a Spolaor paga mais um ciclo do fornecedor para cobrir poucos dias — motivo para avaliar
  o ciclo de 30 dias.
- **Estorno** (`refunded`) e **contestação** (`charged_back` / `in_mediation`): suspensão imediata e aviso.
- Suspensão é preferida a cancelar (`DELETE` é definitivo e impede reutilizar o `externalId`).

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

Cadastre **separado por ambiente**: *Preview* com credenciais de teste e *Production* com as de
produção. Nada disso vai para o navegador; nunca coloque valores no repositório nem em logs.

| Variável | O que é | Onde obter |
|---|---|---|
| `ZM_API_KEY` | Chave da API de provisionamento. `zm_test_…` em Preview, `zm_live_…` em Production (o site recusa a mistura) | ZappMillion → Minha agência → Cartão e API → Chaves de API (Modo de teste liga/desliga) |
| `MP_ACCESS_TOKEN` | Access Token do Mercado Pago (servidor) | Suas integrações → aplicação → Credenciais (teste ou produção) |
| `MP_WEBHOOK_SECRET` | Assinatura secreta das notificações | Suas integrações → aplicação → Webhooks → Configurar notificações |
| `DATABASE_URL` | Postgres das contratações (aplicar `db/atendimento-ia.sql`) | Vercel Marketplace (Neon) ou outro Postgres |
| `IA_PRECO_MENSAL` | Preço cobrado do cliente (ex.: `197.00`) | Decisão comercial |
| `IA_LIMITE_RESPOSTAS` | Limite exibido; deve ser o `agentReplyLimit` do plano | `GET /v1/provisioning/plans` |
| `IA_ZM_PLAN_ID` | Plano do fornecedor | `GET /v1/provisioning/plans` |
| `IA_PAINEL_URL` | Endereço do painel com a marca (ex.: `https://spolaortecnologia.agencyzm.com`) | ZappMillion |
| `IA_ADMIN_TOKEN` / `CRON_SECRET` | Segredos aleatórios das rotas internas | Gerar (32+ caracteres) |
| `IA_OPERACAO_EMAIL` | Destino dos avisos (padrão `LEAD_EMAIL_TO`) | — |
| `IA_CONTRATACAO_ATIVA` | `true` abre a contratação | Só depois dos testes |
| opcionais | `IA_ZM_PLAYBOOK_IDS`, `IA_ZM_PLAYBOOK_VARIAVEIS` (JSON), `IA_MP_FREQUENCIA`, `IA_GUARDA_HORAS` | — |

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
  `listar`, `retentar`, `sincronizar`, `reenviar-convite`.
- Cron (`vercel.json`): `GET /api/atendimento-ia/cron`, diário. A Vercel envia `Authorization: Bearer CRON_SECRET`.
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
