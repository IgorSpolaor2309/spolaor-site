# CRM de leads (`/leads`)

Área privada do site para acompanhar contatos comerciais: entrada, primeiro atendimento, retornos, propostas e vendas. Fica no próprio projeto, usa o banco que o site já tinha e não altera campanhas, orçamento nem configurações da Meta ou da Crush.

## 1. O que existe hoje

| Parte | Estado |
|---|---|
| Formulários do site → banco | **Funciona.** Todo envio aceito por `/api/lead` é gravado antes do aviso por e-mail. |
| Aviso "Novo lead" por e-mail (Resend) | **Funciona**, agora com estado (pendente, enviado, falhou) e nova tentativa. |
| Acesso privado | **Funciona.** Código de uso único por e-mail, sessão em cookie `httpOnly`. |
| Fila "Depende de mim", lista, funil, ficha, histórico, retornos, cadastro manual, indicadores, exportação CSV | **Funciona.** Filtro por serviço na fila, na lista e no funil; a tela se atualiza sozinha. |
| E-mail ao interessado enviado pelo CRM (Resend) | **Funciona** quando há endereço de resposta configurado. |
| Primeiro contato automático | **Desligado por padrão.** Um canal só (WhatsApp ou e-mail), tarefa gravada com o lead. Veja `docs/CRM-WHATSAPP.md`. |
| Recebimento de e-mails | **Não conectado.** Resposta registrada à mão. |
| WhatsApp | **Código pronto, não conectado.** Integração com a YCloud (API oficial, com o aplicativo no celular) implementada e testada com provedor simulado; falta conectar número, modelo e webhook. Sem isso, segue manual. Veja `docs/CRM-WHATSAPP.md`. |
| Instagram Direct | **Manual.** Abre o Direct e registra à mão. Sem API. |
| Leitura de campanhas e gasto da Meta | **Não conectado.** Custos informados à mão. |
| Crush | **Sem integração possível** (não há API, webhooks nem exportação oficial; pesquisa de 15/11/2026). |

A tela `/leads/integracoes` mostra esse mesmo estado lido da configuração e do banco no momento. "Conectado" só aparece quando o CRM de fato recebe ou envia pelo canal.

## 2. Arquitetura

- **Banco:** o Postgres do site (`DATABASE_URL`, o mesmo das tabelas `ia_*` e `site_*`). Tabelas novas com prefixo `crm_`, definidas em `db/crm.sql`. O esquema é aplicado sozinho na primeira conexão do servidor, uma vez por versão (`src/lib/crm/db.ts`); não há passo manual de migração. Depois de editar `db/crm.sql`, rode `node scripts/crm-esquema.mjs` para regerar `src/lib/crm/schema.ts`. Só acrescente (`create ... if not exists`, `add column if not exists`): o arquivo roda de novo inteiro a cada versão.
- **Sem banco** (ex.: prévia sem `DATABASE_URL`): o CRM fica indisponível e os formulários se comportam exatamente como antes (o e-mail é o registro).
- **Código:** `src/lib/crm/` (dados e regras), `src/app/leads/` (telas e ações), `src/components/crm/` (interface), `src/app/api/leads/exportar` (CSV).

### Modelo de dados

- `crm_contatos`: pessoa ou empresa.
- `crm_oportunidades`: um interesse comercial de um contato (um serviço). Guarda etapa, de quem é a vez (separado da etapa), categoria do serviço, próxima ação, valores, origem e atribuição.
- `crm_tarefas`: intenção de primeiro contato, gravada com o lead. `crm_webhook_eventos`: notificações do provedor de WhatsApp, como chegaram.
- `crm_envios`: cada envio de formulário como chegou. O `id` é o mesmo devolvido ao navegador e usado como `eventID` do evento Lead. Guarda também o estado do aviso por e-mail.
- `crm_mensagens`: conversa. `modo = sistema` (enviada por integração, com estado de envio) ou `modo = manual` (registrada à mão, sem estado de entrega).
- `crm_eventos`: histórico e anotações.
- `crm_config`: modelos editados e a chave da automação. `crm_custos`: custos informados à mão.
- `crm_usuarios`, `crm_login_codigos`, `crm_sessoes`: acesso.

Todas com RLS ligado e sem políticas: só o dono das tabelas (a conexão do servidor) lê e grava.

### Quem é a mesma pessoa

Dois registros são o mesmo contato só quando o **WhatsApp** (dígitos, com DDI) ou o **e-mail** (minúsculas) são idênticos. Nome igual ou parecido nunca une registros. Um formulário completa campos vazios do contato, mas não sobrescreve nome, WhatsApp ou e-mail já gravados.

- Mesma pessoa, **outro serviço** → nova oportunidade no mesmo contato.
- Mesma pessoa, **mesmo serviço com oportunidade aberta** → o envio entra no histórico dessa oportunidade e ela volta para a fila de quem aguarda retorno. Não cria oportunidade nova.
- Envios simultâneos da mesma pessoa não duplicam o contato (trava por chave dentro da transação).

## 3. Entrada dos formulários e evento Lead

`/api/lead` não mudou para o navegador: mesmas validações, mesma resposta, mesmo `id`. Por dentro (`src/lib/leads/server/pipeline.ts`):

1. Com banco, o lead é gravado primeiro. Gravado, está aceito: a API responde 200 com o `id`.
2. O aviso por e-mail sai em seguida. Se o provedor falhar, o lead **continua aceito**, o aviso fica como `falhou`, aparece em "Falhas de comunicação" e é tentado de novo pela rotina (até 6 vezes, com a mesma chave de idempotência no Resend).
3. Se o **banco** não responder, vale a regra antiga: o e-mail precisa ser aceito, senão a API responde 502. Esse e-mail avisa que o contato não entrou no CRM.

**Mudança de comportamento, de propósito:** antes, falha do provedor de e-mail derrubava o envio (502, sem Lead). Agora, com o banco ligado, o contato fica salvo, o visitante vê sucesso e o evento Lead dispara, porque existe um lead registrado com `id`. Sem banco, nada mudou.

O que **não** gera Lead: abrir página, iniciar formulário, clicar no WhatsApp, envio inválido, envio descartado pelo anti-spam, cadastro manual no CRM, mudança de etapa, reenvio de aviso, rotina. As páginas de `/leads` não carregam o Pixel (`src/lib/pixel-head.ts` e `SiteOnly` em `src/app/layout.tsx`).

A rotina do CRM roda dentro da rotina já agendada do site (`/api/atendimento-ia/cron`, a cada 15 minutos pelo QStash) e não depende das chaves do Atendimento IA.

## 4. Atribuição

Guardado por oportunidade: origem do formulário, página do envio, primeira página da visita, página anterior (`referrer`) e os parâmetros da URL (`utm_*`, `utm_id`, `gclid`, `fbclid`, `campaign_id`, `adset_id`, `ad_id`).

- A fonte mostrada vem do que a URL **declarou**. "Anúncio na Meta" só aparece com `utm_source` da Meta e mídia paga ou campanha.
- `fbclid` sozinho aparece como "Clique vindo da Meta", com a ressalva de que não identifica campanha nem comprova anúncio.
- Identificadores reais de campanha, conjunto e anúncio entram quando a URL do anúncio os trouxer. Na Meta, isso é feito nos parâmetros de URL do anúncio:
  `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`
  O CRM não configura isso: é uma alteração nos anúncios, feita por quem os gerencia (você ou a Crush).

## 5. Acesso

- Não há cadastro. Entra quem está em `CRM_ACESSO_EMAILS` (separados por vírgula). **Se a variável estiver vazia, valem os destinatários de `LEAD_EMAIL_TO`**, que já recebem todos os contatos por e-mail. Defina `CRM_ACESSO_EMAILS` para escolher exatamente quem entra.
- Login: código de 6 dígitos enviado ao e-mail (Resend), válido por 10 minutos, uso único, 5 tentativas por código, 4 pedidos a cada 15 minutos, 15 pedidos e 25 erros por dia por e-mail. O banco guarda só os hashes do código e da sessão.
- A resposta ao pedido de código é igual para e-mail autorizado ou não.
- Sessão de 30 dias em cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção. Tirar o e-mail da lista encerra o acesso na hora.
- Toda página, toda ação do servidor e a rota de exportação conferem a sessão. `/leads` é sempre renderizada por requisição, com `noindex`, `X-Robots-Tag` e `Cache-Control: private, no-store`.

## 6. Primeiro contato e mensagens

- **Modelos** editáveis em `/leads/configuracoes`, um por situação (formulário ou recepção) e canal. Na ficha o texto vem preenchido e pode ser ajustado antes de enviar.
- **WhatsApp, Instagram, ligação:** o CRM abre o aplicativo com o texto (ou copia) e a pessoa responsável registra "enviada" e "resposta recebida". A mensagem fica como "registrada à mão", sem estado de entrega.
- **E-mail pelo CRM:** sai pelo Resend com `reply_to` para o e-mail comercial. Estados: na fila, enviando, aceita pelo provedor, falhou, cancelada. Falha é tentada de novo (até 5 vezes) e pode ser reenviada pela ficha. Reenviar o mesmo formulário não manda outro e-mail (chave única por envio).
- **Primeiro contato automático:** desligado por padrão; em `/leads/configuracoes` escolhe-se um canal (WhatsApp ou e-mail). Vale só para envio de formulário que criou oportunidade nova e não seja teste. Uma mensagem por oportunidade. Depois dela o contato fica em "Aguardando resposta", com a vez do interessado, sem contar como atendimento humano. Regras completas em `docs/CRM-WHATSAPP.md`.
- **Assumir:** qualquer ação de atendimento (registrar contato, registrar resposta, mudar etapa, botão "Assumir atendimento") marca a oportunidade como assumida. Mensagem automática que ainda não saiu é cancelada, e a automação não recomeça para aquela oportunidade.
- Não há agente de IA respondendo ou negociando.

## 7. Indicadores

Contam os contatos que chegaram no período (pela data de chegada), acompanhados até hoje, sem os envios de teste (nome iniciado por "TESTE" ou marcados na ficha). Cada número traz embaixo de onde vem.

- Proposta e venda são campos separados. Valor de proposta nunca entra em vendas; "valor vendido" não é lucro.
- **Custos são informados à mão**, em linhas separadas: verba da Meta, taxa do Autopilot da Crush, assinatura da Crush, outros. Cada lançamento cobre um intervalo de datas e é rateado pelos dias que caem no período consultado. Pode ser marcado como estimado.
- A taxa de 5% da Crush **não é calculada**: o CRM não sabe qual parte do gasto foi gerenciada pelo Autopilot.
- Sem custo informado, investimento e custos por resultado aparecem como "Sem dado", não como zero.
- "Verba da Meta por contato de anúncio" divide só pelos contatos cuja URL declarou anúncio na Meta.

## 8. Variáveis de ambiente

Nenhuma é obrigatória além das que o site já tem em produção (`DATABASE_URL`, `RESEND_API_KEY`, `LEAD_EMAIL_TO`, `LEAD_EMAIL_FROM`, `CRON_SECRET`).

| Variável | Para quê |
|---|---|
| `CRM_ACESSO_EMAILS` | Quem entra em `/leads`. Vazia = destinatários de `LEAD_EMAIL_TO`. |
| `CRM_EMAIL_FROM` | Remetente dos e-mails ao interessado. Vazia = `LEAD_EMAIL_FROM`. |
| `CRM_EMAIL_REPLY_TO` | Para onde vão as respostas do interessado. Vazia = `NEXT_PUBLIC_CONTACT_EMAIL`. Sem nenhuma das duas, o CRM não envia e-mail ao interessado. |
| `CRM_DB_POOL_MAX` | Só para testes locais. |

## 9. Testes

`scripts/teste-crm.mjs` roda contra um Postgres local, com provedor de e-mail falso e Pixel falso (preparação no topo do arquivo; recusa banco que não seja local). Cobre acesso, persistência, duplicação, fluxo de atendimento, envio e falha de mensagens, atribuição, evento Lead e layout no celular.

`scripts/teste-medicao-leads.mjs` e `scripts/teste-ofertas-local.mjs` continuam valendo para o caminho **sem banco**. Com `DATABASE_URL` definida, a única verificação que muda neles é "provedor recusa", pelo motivo da seção 3.

`scripts/teste-crm-whatsapp.mjs` cobre o WhatsApp com provedor e fila simulados (veja `docs/CRM-WHATSAPP.md`).

`scripts/previa-crm.mjs` gera capturas das telas em 390 px e 1440 px.

## 10. Próximas entregas (dependem de decisão ou credencial)

1. **Recebimento de e-mail.** Caminho mais simples: encaminhador na caixa comercial (cPanel) para um endereço de recebimento do Resend, que avisa o site por webhook. Alternativa: leitura IMAP periódica. Precisa da escolha e do acesso.
2. **Leitura de campanhas da Meta.** Token `ads_read` de um usuário de sistema do Gerenciador de Negócios; lê gasto por campanha, conjunto e anúncio. Só leitura.
3. **WhatsApp oficial.** Decidido: número comercial próprio, com coexistência, pela YCloud. Código pronto; falta a ativação descrita em `docs/CRM-WHATSAPP.md`.
4. **Instagram Direct.** Aplicativo da Meta com permissão de mensagens, autorizado pela conta profissional.
5. Compras do Atendimento IA e do pacote de site como oportunidades no CRM (hoje ficam só nas tabelas próprias).
