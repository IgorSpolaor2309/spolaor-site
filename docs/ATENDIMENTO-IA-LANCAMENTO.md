# Atendimento com IA — preparação do teste e plano de lançamento

Complementa `docs/ATENDIMENTO-IA.md`. A contratação pública (`IA_CONTRATACAO_ATIVA`) continua desligada
até os bloqueios da parte 1 estarem resolvidos.

## 0. Ambiente de teste na prévia da Vercel (Preview)

O que já está feito no código:
- **URL de notificação com bypass, montada no servidor.** Na prévia (`VERCEL_ENV=preview`), a assinatura é
  criada com `notification_url = https://<VERCEL_BRANCH_URL>/api/atendimento-ia/webhook?x-vercel-protection-bypass=<segredo>`.
  O segredo vem de `VERCEL_AUTOMATION_BYPASS_SECRET`, que a Vercel injeta no servidor; ninguém digita nem
  copia o segredo, ele não vai para o navegador, para o repositório nem para os logs do site.
  A validação `x-signature` do Mercado Pago continua igual (o parâmetro do bypass não entra na assinatura).
- **Retorno do checkout** na prévia usa a URL estável do branch (`VERCEL_BRANCH_URL`).
- **Esquema do banco aplicado sozinho** na primeira conexão (idempotente, pela conexão direta
  `DATABASE_URL_UNPOOLED` da Neon). Testado contra um Postgres real local (PGlite): tabelas criadas e as 46
  verificações do teste simulado passaram no banco.
- **Diagnóstico** sem valores secretos: `POST /api/atendimento-ia/admin` com `{"acao":"saude"}` mostra o que
  falta, o banco (tabelas), se a URL de notificação com bypass está ativa, o modo das chaves (teste/produção)
  e se o plano do ZappMillion existe.

O que só você consegue fazer (acesso à conta da Vercel, aceite de termos e credenciais):
1. **Segredo do bypass:** Vercel → projeto `spolaor-site` → Settings → Deployment Protection →
   *Protection Bypass for Automation* → gerar o segredo. Em Settings → Environment Variables, confira que
   *Automatically expose System Environment Variables* está marcado. Não copie o segredo para lugar nenhum.
2. **Banco Neon:** Vercel → projeto → Storage → Create Database → Neon → plano gratuito → aceitar os termos →
   Connect Project: `spolaor-site`, ambiente **Preview** (Production depois). Deixe *Create database branch
   for deployment* desmarcado (um banco só para o teste).
3. **Credenciais de teste, só no ambiente Preview** (Settings → Environment Variables, marcar *Sensitive*):
   `ZM_API_KEY` (`zm_test_…`), `MP_ACCESS_TOKEN` (teste), `MP_WEBHOOK_SECRET` (modo teste). Digitadas
   direto no painel da Vercel, nunca no chat.
4. **Login da Vercel CLI nesta máquina** (uma vez, no seu terminal): `npx vercel@latest login`. Com isso eu
   cadastro as demais variáveis do Preview (preço, plano, meios, URL do painel, `IA_ADMIN_TOKEN` e
   `CRON_SECRET` gerados aleatoriamente sem exibir), faço o redeploy da prévia e rodo o diagnóstico.
   Sem o login, as variáveis da lista abaixo também podem ser cadastradas por você.

Variáveis do Preview (além dos itens 1–3): `IA_PRECO_MENSAL=297.00`, `IA_LIMITE_RESPOSTAS=2000`,
`IA_ZM_PLAN_ID` (o id do plano no **modo de teste**, mostrado pelo diagnóstico), `IA_MEIOS_PAGAMENTO=cartao`
(e `pix` depois de validado), `IA_PAINEL_URL=https://spolaortecnologia.agencyzm.com`, `IA_ADMIN_TOKEN`,
`CRON_SECRET`, `IA_CONTRATACAO_ATIVA=true` **só no Preview**.

Cuidado conhecido: a documentação da Vercel não diz se os logs de requisição registram a query string. Restrinja
o acesso aos logs da prévia e **gere um novo segredo de bypass ao fim dos testes** (Deployment Protection).

No painel do Mercado Pago, se as notificações de assinatura não chegarem pela URL enviada na criação, a URL de
teste em Suas integrações → Webhooks precisaria do segredo: nesse caso copie o segredo direto da Vercel para o
campo do Mercado Pago, sem passar por chat ou arquivo.

## Resultado do teste nos fornecedores (05/11/2026, prévia do branch oferta-ia-whatsapp)

Ambiente: credenciais de TESTE do Mercado Pago (conta test_user) e chave zm_test_ do ZappMillion; banco Neon de
teste. Nenhuma cobrança real.

| Validação | Resultado |
|---|---|
| Criação da assinatura (R$ 297,00, frequency 30 / days) | OK — aceita pelo Mercado Pago |
| Descrição no checkout | OK — "Atendimento IA WhatsApp · R$ 297,00 a cada 30 dias" (limite de 60 caracteres corrigido) |
| Meios no checkout | Só cartão de crédito (Pix não apareceu) |
| Pagamento com o comprador de teste | OK — cobrança `processed` / `approved` (`accredited`), R$ 297,00 BRL, 05/11 13:48 (Brasília) |
| Confirmação pelo provedor | OK — conferida na API (assinatura `authorized`, próxima cobrança 05/12 13:48) |
| Webhook do Mercado Pago | **Não chegou** à prévia (nenhuma requisição registrada na Vercel) — ver pendências |
| Conciliação direta (sem webhook) | OK — aplicou o pagamento e liberou o acesso |
| Banco Neon | OK — contratação gravada; período pago até 05/12 14:00 (Brasília) |
| ZappMillion (modo teste) | OK — cliente ACTIVE com o plano PRO; convite por e-mail não é enviado no modo teste |
| Duplicidade | OK — conferências repetidas não estenderam o período nem recriaram o acesso |
| Página de acompanhamento | OK — "Pagamento confirmado e acesso liberado"; agente e WhatsApp como tarefas do painel |
| Cancelamento pela página | OK — `cancelled` no Mercado Pago; acesso mantido até 05/12 14:00; rotina não suspendeu |
| Rotina e conciliação com o ZappMillion | OK — sem divergências |
| Alinhamento dos ciclos | Próxima cobrança do cliente 12 min antes do fim do período/renovação do fornecedor |
| Conversão Purchase | Não enviada (Pixel só existe em Production) |

Correções feitas durante o teste: descrição dentro de 60 caracteres; motivo dos erros do Mercado Pago no log (sem
dados pessoais); conciliação direta com o Mercado Pago (ação `verificar-mp`, rotina e página de acompanhamento);
uma leitura por recurso e nova tentativa no HTTP 429 do Mercado Pago; rotina não falha sem as chaves dos
fornecedores (produção antes das vendas).

## Diagnóstico do webhook (05/11/2026, tarde)

Ação `{"acao":"webhook","id":"<contratação>"}` do admin (sem segredos na resposta), na prévia:

| Verificação | Resultado |
|---|---|
| URL enviada na criação da assinatura | `https://spolaor-site-git-oferta-ia-whatsapp-spolaor.vercel.app/api/atendimento-ia/webhook` com bypass |
| URL gravada na assinatura pelo Mercado Pago | **Ausente** na resposta de `GET /preapproval/{id}` |
| Notificações válidas registradas (`ia_eventos`) | **0** desde a criação do banco |
| Requisições ao webhook nos logs (últimos 30 min; o Hobby só guarda 1 h) | **0** — nem recusadas: uma notificação recusada (401) seria reenviada a cada 15 min |
| Autoteste assinado com `MP_WEBHOOK_SECRET` → URL pública com bypass | **HTTP 200 em 352 ms**, passou pela proteção da Vercel, pela validação `x-signature` e pelo registro |

Conclusão: do nosso lado a rota funciona de ponta a ponta. O Mercado Pago não enviou nenhuma notificação: o
campo `notification_url` não faz parte dos campos documentados da criação de assinatura e não aparece na
assinatura criada, então as notificações de assinatura dependem da URL e dos eventos configurados na aplicação,
em Suas integrações → Webhooks (com campos separados de "modo teste" e "modo produção"). Esse painel não pôde ser
conferido porque o Mercado Pago pediu nova verificação da conta.

Correções feitas: o `data.id` alfanumérico entra em minúsculas na validação da assinatura (regra do Mercado
Pago; o SDK não converte); registro de chegada de cada notificação no log (tipo, data.id e request-id, sem
cabeçalhos nem query); diagnóstico com autoteste assinado na ação `webhook` do admin.

`MP_WEBHOOK_SECRET` precisa ser a "assinatura secreta" mostrada pelo Mercado Pago na mesma tela de Webhooks da
aplicação usada nas vendas; um valor diferente faz todas as notificações reais serem recusadas com 401.

## Tempo até a liberação e proteções (05/11/2026, noite)

Medido no teste de 05/11 (ação `tempos` do admin): aprovação no Mercado Pago 16:48:39 UTC → confirmação no banco
17:00:47 UTC (**729 s**, sem webhook; confirmada pela conferência manual `verificar-mp`) → acesso no ZappMillion
17:00:49 UTC (**2 s** depois da confirmação).

Causa do atraso: (1) nenhuma notificação do Mercado Pago (a conta usada é um **vendedor de teste**, credenciais
APP_USR de usuário de teste: o webhook tem de ser configurado na aplicação dessa conta, no campo de produção);
(2) a conferência pela página de acompanhamento ainda não estava publicada naquele momento.

| Proteção | Situação |
|---|---|
| Webhook real do Mercado Pago (pagamento, assinatura, cobrança recorrente) | **Não validado** — depende da configuração no painel da conta vendedora de teste |
| Página de acompanhamento confere no Mercado Pago a cada ~25–30 s enquanto pendente (reserva atômica no banco, entre instâncias) | **Validado** no teste simulado (4 consultas → 1 leitura; acesso liberado sem webhook) e na tela (localhost) |
| Rotina confere pendentes e libera sem página aberta | **Validado** no teste simulado; chamada na prévia como o workflow faz: HTTP 200 em 3,3 s |
| Rotina a cada 5 min em produção (GitHub Actions) | **Implementada, não operacional** — só roda depois do merge e do segredo `IA_CRON_SECRET` |
| Retomada de execução interrompida (aprovação marcada sem gravação; pago sem acesso) | **Implementada**, sem teste de falha real |
| Medição e canal da confirmação (`pagamento_confirmado_em`, `acesso_liberado_em`, `confirmado_por`) | **Validado** no teste simulado (webhook, acompanhamento, rotina) |
| Tela de confirmação: aviso "Conferindo…", última conferência, Verificar agora, mensagem após 3 min | **Validado** em 375 px (localhost, Mercado Pago simulado) |

## Checklist de publicação

Bloqueios para abrir as vendas (contratação pública):
1. **Webhook do Mercado Pago.** Em Suas integrações → aplicação → Webhooks, confirmar a URL e os eventos
   (Pagamentos e Planos e assinaturas). Produção: `https://www.spolaortecnologia.com.br/api/atendimento-ia/webhook`.
   Copiar a assinatura secreta dessa tela para `MP_WEBHOOK_SECRET` (Production). Validar com a simulação de
   notificação do painel e conferir com a ação `webhook` do admin (`recebidas` sobe; o log mostra
   "notificação recebida"). Mesmo com o webhook validado, a conciliação direta continua ativa como segurança.
2. **Credenciais de produção novas** (as anteriores ficaram no chat): `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` de
   produção, `ZM_API_KEY` `zm_live_` nova — cadastrar em Production (Sensitive).
3. **Variáveis de Production que ainda faltam:** `IA_MEIOS_PAGAMENTO=cartao` e (para a compra controlada)
   `IA_TOKEN_VALIDACAO` aleatório. A gravação por mim foi bloqueada pela política de permissões da sessão.
4. **Agendador da rotina:** sem webhook, o acesso é liberado (a) em até ~30 s enquanto o comprador está na
   página de acompanhamento, para onde o checkout volta; (b) senão, só no cron diário da Vercel (09:00 UTC; o
   plano Hobby não permite cron mais frequente) — até 24 h de atraso. O workflow
   `.github/workflows/atendimento-ia-rotina.yml` chama a rotina a cada 5 min (o GitHub pode atrasar alguns
   minutos; repositório público, sem custo). Ativa-se depois do merge, ao cadastrar no GitHub o segredo
   `IA_CRON_SECRET` com o mesmo valor do `CRON_SECRET` de Production; sem ele, não faz nada.
5. **Merge do PR #5** (autorização sua) — a página aparece com o preço e "Quero ser avisado" enquanto
   `IA_CONTRATACAO_ATIVA` não estiver definida em Production.
6. **Compra controlada em produção** (proposta; exige sua autorização: R$ 297,00 + R$ 97,00) para validar convite
   por e-mail, login no painel e conexão do WhatsApp.
7. Só então `IA_CONTRATACAO_ATIVA=true` em Production e as campanhas.

Higiene depois dos testes: gerar novo segredo de bypass da Vercel; redefinir a senha do comprador de teste.

Não validado (registrado): convite por e-mail, conexão do WhatsApp, renovação real no dia 30, Pix, estorno e
contestação reais, conversão no Meta (sem CAPI: se o comprador fechar o navegador antes da confirmação, o
Purchase não é registrado).

## 1. Validações necessárias antes de lançar

Bloqueios (sem eles a contratação pública não abre):

| # | Validação | Onde | Situação |
|---|---|---|---|
| 1 | Checkout de assinatura com R$ 297,00 a cada 30 dias aceito (`frequency: 30, frequency_type: days`) | Teste MP | **OK** (05/11) |
| 2 | Notificações chegam à prévia e passam na validação `x-signature`; repetição pelo painel é ignorada | Teste MP | **Falta** — Mercado Pago não enviou (URL da criação ignorada; depende do painel). Nossa rota OK no autoteste assinado (HTTP 200) |
| 3 | Cartão aprovado, recusado e pendente → aprovado; vínculo pelo `external_reference`; só `payment` chegando | Teste MP | Aprovado **OK** (conciliação); recusado/pendente só no teste simulado |
| 4 | Meios oferecidos no checkout = meios validados (`IA_MEIOS_PAGAMENTO`); Pix: como a renovação é cobrada | Teste MP | **OK** cartão; Pix não oferecido no checkout |
| 5 | Criação do cliente no ZappMillion (modo teste) com o plano correto; falha e nova tentativa | Teste ZM | **OK** (modo teste) |
| 6 | Cancelamento pela página: Mercado Pago sem novas cobranças; acesso mantido até o fim | Teste MP + ZM | **OK** (05/11) |
| 7 | Produção configurada: banco Neon em Production, chaves de produção **novas** (as atuais ficaram no chat), URL de notificação de produção e segredo, `IA_ADMIN_TOKEN`, `CRON_SECRET` | Vercel/MP/ZM | Pendente |
| 8 | Entrega real ao comprador: convite por e-mail, login no painel, conexão do WhatsApp (não testável em modo de teste) | Compra controlada | **Proposta — exige sua autorização específica** (R$ 297,00 + R$ 97,00) |

O item 8 é o único que depende de cobrança real. Sem ele, o lançamento é possível aceitando o risco de o
primeiro comprador encontrar um problema no convite; nesse caso, acompanhar manualmente as primeiras
contratações (a operação é avisada a cada etapa) e manter o reenvio de convite (`acao: reenviar-convite`).

Não bloqueiam o lançamento (riscos registrados com controle):
- Renovação do ZappMillion nunca observada (o modo de teste não renova) → parte 2.
- Ausência de cancelamento agendado no ZappMillion → custo possível de R$ 97,00 por cancelamento/inadimplência
  quando o fornecedor cobra antes da suspensão; avisos à operação.
- Respostas pendentes do suporte do ZappMillion (cancelamento no fim do período, momento da cobrança).
- Agendador por minuto: recomendado (reduz, não garante); sem ele, o cron diário ainda faz a conciliação.

## 2. Acompanhamento da primeira renovação real (dia 30)

Registrado como **não observado**. Controles já implementados:
- Pré-aviso 24 h antes do fim de uma assinatura cancelada.
- Aviso quando a cobrança do novo ciclo do ZappMillion aparece como `PAID` sem pagamento do cliente (entrada na
  carência), quando a carência termina e quando o fornecedor suspende um cliente com período pago (cartão da
  agência recusado), com a ação `reativar`.
- Conciliação diária (cron da Vercel às 09:00 UTC, identificado pelo user-agent `vercel-cron`; também com `?conciliar=1`): clientes ativos no ZappMillion sem
  contratação ativa no site e o inverso.
- Diagnóstico `saude` e `listar` para conferência manual.

Roteiro do dia 30 (para cada um dos primeiros clientes):
1. D-1: conferir em `listar` o `pagoAte` e o `zmPeriodoFim`; conferir no Mercado Pago a próxima cobrança.
2. Dia 30: registrar a hora da cobrança do cliente (Mercado Pago) e a hora da cobrança do ZappMillion
   (`GET /clients/{externalId}/charges`: `createdAt`, `paidAt`, `periodStart`).
3. Conferir que `pagoAte` avançou 30 dias e que nenhum aviso de custo foi emitido.
4. Se houver cancelamento ou falta de pagamento: conferir que a suspensão ocorreu no fim do período (nunca
   antes) e se o fornecedor cobrou antes disso (custo R$ 97,00).
5. Com os horários observados, decidir se é preciso ajustar o momento da suspensão ou pedir ao ZappMillion
   cancelamento no fim do período.
