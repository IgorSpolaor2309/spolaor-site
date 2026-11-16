# CRM: WhatsApp pela API oficial, primeiro contato e fila "Depende de mim"

Segunda etapa do CRM (`/leads`). O código está pronto e testado contra um provedor simulado. **Nada disto prova que a integração real funciona**: o número, a conta no provedor, o modelo aprovado e o webhook ainda precisam ser conectados e validados (seções 9 e 10).

Provedor: **YCloud**, com **coexistência** (o mesmo número continua no aplicativo WhatsApp Business do celular e passa a ter API). A 360dialog é a alternativa documentada; não foi implementada.

## 1. O que muda no CRM

| Parte | Como funciona |
|---|---|
| Primeiro contato | Cada oportunidade nova de formulário nasce com uma tarefa, na mesma transação do lead. A tarefa é publicada no QStash logo após a resposta ao visitante e executada em seguida; a rotina de 15 minutos só recupera o que ficou pendente. |
| Canal | Um só: desligado (padrão), WhatsApp ou e-mail. A mesma recepção nunca sai pelos dois. |
| Mensagens recebidas | Webhook da YCloud com assinatura conferida, evento gravado como chegou e processado depois. |
| Respostas pelo celular | O eco do aplicativo entra na conversa, assume o atendimento e cancela automação pendente. |
| Respostas pelo CRM | Texto livre dentro da janela de 24 h; fora dela, só o modelo aprovado. |
| Fila | "Depende de mim": respostas, retornos vencidos, falhas e ação manual, sem responsável, conversas sem associação. "Aguardando o interessado" fica fora. |
| Filtros | Por serviço (categoria) na fila, na lista e no funil. |
| Atualização | A tela confere o servidor a cada 20 s enquanto está visível e em uso. |

## 2. Arquitetura

- `src/lib/crm/whatsapp/ycloud.ts`: único arquivo que conhece os formatos da YCloud (envio, modelos, número, assinatura e tradução dos eventos). Conferido contra a documentação e o OpenAPI v2 em 16/11/2026.
- `src/lib/crm/conversa.ts`: regras da conversa, independentes do provedor.
- `src/lib/crm/tarefas.ts`: tarefa de primeiro contato e disparo pelo QStash.
- `src/lib/crm/whatsapp/envio.ts`: envio de uma mensagem já gravada e tratamento do resultado.
- `src/lib/crm/whatsapp/webhook.ts` e `src/app/api/leads/webhooks/ycloud`: recebimento.
- `src/app/api/leads/tarefas`: execução chamada pelo QStash (Bearer `CRON_SECRET`).
- `src/app/api/leads/pulso`: carimbo para a atualização automática (privado).

Banco (acréscimos idempotentes em `db/crm.sql`): `crm_tarefas`, `crm_webhook_eventos`; colunas novas em `crm_contatos`, `crm_oportunidades` e `crm_mensagens`. Mensagens passam a pertencer ao **contato** (uma conversa por número) e, quando dá para saber, a uma oportunidade.

## 3. Primeiro contato automático

A tarefa confere tudo de novo no momento de enviar. **Não envia** quando:

- o canal está desligado;
- é envio de teste;
- alguém já assumiu o atendimento ou a etapa não é mais "Novo";
- a pessoa já escreveu;
- o contato passou da idade máxima (12 horas por padrão; ligar a automação não dispara nada para trás);
- a pessoa já recebeu uma recepção automática dentro do intervalo entre recepções (72 horas por padrão), ou já está em conversa em outra oportunidade. Nesses dois casos o novo pedido vai direto para "Depende de mim".

Os dois limites de tempo estão detalhados logo abaixo.

No canal WhatsApp, também **não envia e pede ação manual** (o contato aparece na fila com o motivo) quando: não há WhatsApp válido, o número pediu para parar, o formulário não registrou o pedido de retorno, a configuração está incompleta, não há modelo escolhido ou o modelo não está aprovado.

Depois do envio aceito, a oportunidade vai para "Aguardando resposta", com a vez do interessado. Mensagem automática não conta como atendimento humano.

### Os dois limites de tempo: 12 horas e 72 horas

Editáveis em `/leads/configuracoes` ("Limites de tempo do envio automático"), guardados em `crm_config` (chave `automacao:limites`) e lidos por `limitesAutomacao()` em `src/lib/crm/whatsapp/config.ts`. Valem para WhatsApp e para e-mail. Valor fora da faixa é recusado pelo servidor, sem ajuste silencioso.

| | Idade máxima do contato | Intervalo entre recepções |
|---|---|---|
| Padrão | 12 horas | 72 horas |
| Faixa aceita | 1 a 48 horas | 1 a 720 horas |
| O que mede | Da chegada do formulário (`recebido_em`) até o momento em que a tarefa é executada. | Da recepção automática anterior enviada à mesma pessoa até a execução da tarefa do novo pedido. |
| Para que serve | Impedir mensagem atrasada e disparo retroativo. | Impedir que a mesma pessoa receba duas recepções por pedir serviços diferentes. |
| Quando age | Só quando a tarefa atrasa: fila ou banco fora do ar, deploy, reprocessamento. Em operação normal a tarefa roda em segundos. | Quando a mesma pessoa (mesmo WhatsApp ou e-mail) envia outro formulário que cria uma oportunidade nova. |
| Passou do limite | Nada é enviado. A tarefa é encerrada com o motivo e o contato aparece em "Depende de mim" como novo sem primeiro atendimento. | Dentro do intervalo: sem nova recepção; o pedido vai para "Depende de mim" como "novo pedido de quem já está em conversa". Fora dele: o novo pedido recebe recepção normalmente. |

O que conta como "recepção anterior" no intervalo de 72 horas:

- conta: mensagem automática do CRM, por WhatsApp ou e-mail, que saiu ou pode ter saído (aceita, enviada, entregue, lida, em envio ou de resultado incerto), e mensagem automática do aplicativo reconhecida pelo texto cadastrado;
- não conta: mensagem automática que falhou ou foi cancelada, e respostas de pessoas.

Regras que **não dependem** do intervalo:

- quem **já está em conversa** nunca recebe outra recepção, com qualquer intervalo. "Em conversa" é ter outra oportunidade aberta em que a pessoa respondeu ou alguém assumiu o atendimento. Uma oportunidade que só recebeu a mensagem automática e ficou sem resposta não é conversa: para ela vale o intervalo;
- reenvio do **mesmo** serviço com a oportunidade ainda aberta não cria oportunidade nova nem tarefa, então não há recepção;
- a validação com número de controle (seção 9) ignora o intervalo de 72 horas, porque quem dispara é a própria equipe. A idade máxima continua valendo.

Revisão feita nesta entrega: antes, qualquer outra oportunidade em "Aguardando resposta" já contava como "em conversa". Como toda oportunidade que recebe a mensagem automática vai para essa etapa, o intervalo de 72 horas nunca chegava a decidir nada enquanto a primeira oportunidade ficasse aberta. Agora "em conversa" exige resposta da pessoa ou atendimento assumido.

Consequência a conhecer da idade máxima: uma tarefa que atrasa várias horas ainda envia, na hora em que for executada, que pode ser de madrugada. Se isso for indesejado, reduza a idade máxima.

Outros tempos do sistema, que não são configuráveis:

| Tempo | Onde | Para quê |
|---|---|---|
| 24 horas | Envio pelo CRM | Janela de atendimento da Meta: texto livre só até 24 h depois da última mensagem da pessoa. |
| 45 segundos | Rotina | Idade mínima de uma tarefa pendente para a rotina executá-la (antes disso a fila ainda pode entregar). |
| 3 minutos | Tarefa | Tempo para considerar interrompida uma execução que não terminou. |
| 2 minutos | Tarefa | Espera antes de tentar de novo depois de limite de requisições do provedor (429). |
| 6 horas | Webhook | Tolerância do horário da assinatura (a YCloud tenta de novo por até cerca de 5h40). |
| 90 dias | Rotina | Retenção das notificações já processadas. |

### Autorização registrada no formulário

Os três formulários mostram, junto ao botão: "Ao enviar, você pede que a Spolaor Tecnologia responda pelo WhatsApp informado." O texto e a versão ficam em `AVISO_RETORNO` (`src/lib/leads/schema.ts`). O formulário envia a versão, a API só aceita a vigente e ela é gravada na oportunidade com a data. Envios sem versão (formulário antigo, cadastro manual) **não** recebem primeiro contato automático pelo WhatsApp. Ao mudar o texto, mude a versão.

### Modelo e textos

Para iniciar conversa pela API a Meta exige um modelo aprovado. O texto é criado e aprovado no painel da YCloud; em `/leads/configuracoes` escolhe-se o modelo, o que entra em cada variável e a frase de cada serviço (editável sem nova aprovação). Texto sugerido:

> Olá, {{1}}! Aqui é a Spolaor Tecnologia. Recebemos {{2}} pelo nosso site. Posso continuar seu atendimento por aqui?

`{{1}}` = primeiro nome; `{{2}}` = frase do serviço (ex.: "seu pedido sobre loja virtual"). Sem oferta, preço ou pergunta já feita no formulário.

## 4. De quem é a vez

Decidido pela **hora real das mensagens**, não pela ordem em que as notificações chegam:

- depende de nós quando a última mensagem do interessado é mais nova que a última resposta de uma pessoa;
- resposta humana = enviada pelo CRM, enviada pelo aplicativo (eco) ou registrada à mão;
- entrega, leitura, eco da nossa própria automação e histórico importado nunca mudam a vez;
- uma notificação antiga que chega atrasada não apaga uma resposta nova;
- abrir ou ler a conversa não é responder.

A etapa comercial é separada: um contato pode estar em "Proposta enviada" e depender de nós.

Casos tratados:

- **Eco da nossa automação:** reconhecido pelos identificadores (ou, se eles ainda não chegaram, por ser a mesma mensagem recém-enviada à mesma pessoa). Não vira atendimento humano.
- **Saudação ou ausência do aplicativo:** veja "Quem enviou pelo aplicativo", logo abaixo.
- **Pedido para parar** ("parar", "sair", "não quero mais receber", "sem interesse"...): bloqueia novos contatos automáticos para o número e aparece para conferência, sem resposta automática.
- **Áudio, imagem, vídeo, documento, botão:** geram pendência. O CRM guarda texto e referência, nunca o arquivo; a mídia é vista no aplicativo.
- **Conteúdo não suportado:** aparece como tal, com orientação de conferir no aplicativo.
- **Reação:** registrada, sem gerar pendência.
- **Número fora do CRM:** mensagem recebida cria o contato (pelo telefone), sem oportunidade; fica em "Conversas sem associação". Mensagem enviada pelo aplicativo a quem não está no CRM é ignorada.
- **Telefone ausente:** a YCloud pode omitir o telefone; o contato também é reconhecido pelo identificador do usuário no WhatsApp.
- **Histórico do aplicativo:** os eventos são gravados e não viram mensagem, pendência, contato, oportunidade nem janela de atendimento.

### Quem enviou pelo aplicativo: evidência, não tempo

Uma mensagem sincronizada do aplicativo (eco) pode ter sido escrita por uma pessoa ou enviada sozinha pelo aplicativo (saudação, ausência). O provedor não informa qual das duas. O CRM decide **só por evidência**, nesta ordem:

1. identificadores do provedor iguais aos de uma mensagem nossa → é a nossa mensagem (CRM);
2. envio nosso ainda sem identificador do WhatsApp (em curso ou de resultado incerto), com o mesmo texto para a mesma pessoa → é a nossa mensagem (CRM); o envio incerto fica resolvido;
3. texto igual a uma mensagem automática cadastrada em Configurações (saudação, ausência ou aprendida pela correção na ficha), ignorando maiúsculas e espaços → automática do aplicativo: não conta como resposta humana e não tira a pendência;
4. qualquer outra → escrita por uma pessoa pelo aplicativo: assume o atendimento e cancela automação pendente.

**O intervalo entre a mensagem da pessoa e a resposta não entra na decisão.** Uma resposta em 1 segundo pode ser humana (alguém com a conversa aberta, resposta rápida salva) e uma resposta em 2 minutos pode ser automática. A regra anterior, que tratava como automática toda resposta em menos de 5 segundos, foi removida.

Quando a regra 4 erra (saudação ligada no aplicativo e não cadastrada), quem atende corrige na ficha: "Não fui eu: é mensagem automática do aplicativo". A pendência volta, se a pessoa ainda espera, e o texto passa a ser reconhecido nas próximas vezes. O caminho inverso ("Fui eu que escrevi esta mensagem") também existe. A correção é a palavra de quem atende, registrada no histórico.

O recomendado continua sendo desligar saudação e ausência no aplicativo, para ninguém receber duas recepções.

### Duas oportunidades da mesma pessoa

A conversa é uma só por número. Uma mensagem vai para: a oportunidade da mensagem citada; senão, a única aberta; senão, a única aberta que já tem conversa no WhatsApp. Fora disso entra **uma vez**, sem oportunidade, em "Conversas sem associação", para alguém escolher. A pessoa nunca recebe duas recepções por ter pedido serviços diferentes.

## 5. Confiabilidade

- **Lead e intenção juntos:** a tarefa é gravada na mesma transação do lead. Falha na publicação da fila não a apaga.
- **Uma execução por vez:** reserva no banco. Seis execuções simultâneas da mesma tarefa resultam em um envio.
- **Uma mensagem por oportunidade:** chave única.
- **Webhooks repetidos:** barrados pelo id do evento e pelos identificadores da mensagem.
- **Envio incerto:** a YCloud **não tem idempotência** (`externalId` é só correlação) nem busca por `externalId`. Sem resposta, erro 5xx ou execução interrompida, a mensagem fica "resultado incerto" e não é reenviada sozinha. Resolve-se pela notificação do provedor (que traz o `externalId`), pelo eco, ou por uma pessoa que confere no aplicativo e marca "saiu" ou "não saiu".
- **Limite de requisições (429):** nada saiu; a tarefa volta para a fila (até 3 tentativas).
- **Estados separados:** na fila, aceita pelo provedor, enviada, entregue, lida, falhou, resultado incerto.
- **Retenção:** as notificações já processadas são apagadas depois de 90 dias.
- **Assinatura:** `YCloud-Signature: t=<unix>,s=<hex>`, HMAC-SHA256 de `<t>.<corpo cru>`. Tolerância de 6 horas no horário, porque a YCloud tenta de novo por até cerca de 5h40 e não documenta se reassina.

## 6. Variáveis de ambiente (servidor)

| Variável | Para quê |
|---|---|
| `YCLOUD_API_KEY` | Chave da API da YCloud. |
| `YCLOUD_WEBHOOK_SECRET` | Segredo do endpoint de webhook. Sem ele o webhook responde 503. |
| `WHATSAPP_NUMERO` | Número comercial conectado, com DDI. |
| `QSTASH_TOKEN`, `CRON_SECRET` | Já existem em produção; usados para acionar a tarefa. |

`NEXT_PUBLIC_WHATSAPP_NUMBER` (número público do site) **não muda** nesta entrega.

## 7. O que a pesquisa confirmou e o que falta confirmar

Confirmado na documentação oficial (16/11/2026):

- envio por API, mensagens recebidas, estados de entrega e eco das mensagens enviadas pelo aplicativo (`whatsapp.smb.message.echoes`);
- coexistência exige WhatsApp Business 2.24.17 ou superior e o número já no aplicativo Business (não no pessoal);
- a conexão é feita no painel da YCloud, por QR code; não há API para isso;
- mensagens pelo aplicativo continuam gratuitas; pela API são cobradas;
- a Meta desconecta o número se o aplicativo ficar inativo (cerca de 14 dias pela Meta; a 360dialog recomenda abrir a cada 13);
- preços da Meta para o Brasil desde 01/10/2026: utilidade R$ 0,035, marketing R$ 0,3217, serviço R$ 0,035 depois de 1.000 gratuitas por número por mês. A YCloud declara não acrescentar margem. A Meta pode reclassificar um modelo de utilidade como marketing.

**Não confirmado** (perguntar à YCloud ou observar no primeiro teste):

1. Se o plano gratuito inclui API, webhooks e coexistência, e se contas em teste só enviam para números verificados.
2. Elegibilidade de um número brasileiro e de uma conta Business recém-criada. A Meta pode recusar com "More activity on the WhatsApp Business app is needed"; não há prazo publicado.
3. Moeda de cobrança e recarga mínima.
4. Se novas tentativas de webhook vêm reassinadas.
5. Se mensagens enviadas pela API também geram eco, e se saudação ou ausência do aplicativo geram eco.
6. Se a coexistência exige verificação da empresa no caminho por QR code.

## 8. Testes

`scripts/teste-crm-whatsapp.mjs`: YCloud, QStash e e-mail simulados, Postgres local. 161 verificações. Cobre formulário → tarefa → primeiro contato, resposta → fila, resposta pelo aplicativo e pelo CRM, classificação por evidência, duplicação, concorrência, eventos fora de ordem, envio incerto, janela, modelo indisponível, integração desconectada, duas oportunidades, limites de tempo nas bordas, validação com número de controle, formulários e Pixel, filtros, atualização automática e celular.

## 9. Validação com número de controle

**Número de controle** é um telefone da própria equipe, cadastrado em `/leads/configuracoes` (até 5). Serve para exercitar o fluxo real sem abordar cliente e **sem gerar conversão publicitária**.

Para um número de controle:

- o envio do formulário público é gravado normalmente, mas a API responde `medir: false` e o navegador **não dispara o evento Lead** nem a conversão do Google. `PageView` e `FormStart` continuam, como em qualquer visita, e não são conversões;
- a oportunidade fica marcada como validação: aparece na fila (com a marca "validação"), fica fora dos indicadores e da exportação;
- o primeiro contato automático roda pelo WhatsApp **mesmo com a automação desligada** para todos os outros contatos, e só enquanto o número estiver na lista;
- cada validação nova encerra a anterior do mesmo número; o intervalo de 72 horas não se aplica.

Duas formas de começar, com o mesmo caminho depois:

1. **Pelo CRM**, em `/leads/integracoes`, "Iniciar validação": o lead nasce no servidor, pela mesma função dos formulários. Não há navegador público, então nenhum evento de Pixel existe.
2. **Pelo formulário público do site**, informando o número de controle: percorre também a página e a API reais.

O roteiro em `/leads/integracoes` mostra cada passo como "comprovado" só com evidência gravada:

| Passo | Evidência |
|---|---|
| Sem conversão publicitária | Origem da validação (CRM ou formulário com `medir: false`). |
| Tarefa gravada junto com o lead | Linha em `crm_tarefas` criada na mesma transação. |
| Tarefa acionada logo em seguida | Horário da publicação na fila e da execução. |
| Primeira mensagem aceita pelo provedor | Id devolvido pela YCloud. |
| Entrega confirmada pelo WhatsApp | Notificação de entrega recebida pelo webhook. |
| Leitura confirmada (opcional) | Notificação de leitura. Não chega se o número de controle desligou a confirmação de leitura. |
| Resposta do número de controle recebida | Mensagem recebida pelo webhook; a conversa aparece em "Depende de mim". |
| Resposta pelo aplicativo sincronizada | Eco da mensagem enviada pelo WhatsApp Business do celular comercial. |
| Resposta pelo CRM aceita pelo provedor | Mensagem enviada pela ficha, dentro da janela. |

A validação só aparece como "completa" quando todos os passos obrigatórios têm evidência. Enquanto isso, Integrações diz "nunca feita" ou "incompleta" e lista o que falta.

Nunca cadastre como número de controle o telefone de um cliente: ele deixaria de contar como conversão e receberia mensagem com a automação desligada.

## 10. Ativação (depende do Igor)

Ordem sugerida. Nenhuma credencial deve ser enviada por mensagem ou escrita em documento: elas vão direto para a Vercel.

1. **Chip e aplicativo:** instalar o WhatsApp Business (não o pessoal) no celular extra com o número novo. Desligar mensagem de saudação e de ausência. Usar o número normalmente.
2. **Conta na YCloud:** criar a conta e confirmar com o suporte os itens da seção 7. Não ativar agentes de IA, campanhas nem sequências do provedor. Não habilitar recarga automática sem decidir.
3. **Conectar por coexistência:** no painel, "WhatsApp Business APP Coexistence", por QR code. Não cadastrar o número como exclusivo de API nem desconectar o aplicativo.
4. **Modelo:** criar o modelo de primeiro contato (seção 3), em `pt_BR`, e aguardar a aprovação. Conferir a categoria atribuída pela Meta.
5. **Webhook:** cadastrar `https://www.spolaortecnologia.com.br/api/leads/webhooks/ycloud` com os eventos `whatsapp.inbound_message.received`, `whatsapp.message.updated`, `whatsapp.smb.message.echoes`, `whatsapp.smb.message.created`, `whatsapp.template.reviewed`, `whatsapp.template.category_updated`, `whatsapp.phone_number.quality_updated`, `whatsapp.business_account.updated` e `whatsapp.business_account.deleted`.
6. **Vercel (Production):** `YCLOUD_API_KEY`, `YCLOUD_WEBHOOK_SECRET` e `WHATSAPP_NUMERO`; Redeploy.
7. **Conferir em `/leads/integracoes`:** número `CONNECTED`, modelo aprovado.
8. **Cadastrar o número de controle** (o seu, não o de um cliente) em Configurações. Se a saudação ou a ausência do aplicativo ficarem ligadas, cadastrar o texto exato delas.
9. **Validar com a automação desligada** (seção 9): iniciar a validação em Integrações, responder do número de controle, responder pelo aplicativo do celular comercial e responder pela ficha, até o roteiro mostrar "completa". Repetir pelo formulário público com o número de controle, para percorrer também a página real. Nenhum desses envios gera conversão nos anúncios.
10. **Ligar a automação** em Configurações, só depois da validação completa.
11. **Número público do site:** só trocar depois de tudo validado.
