# CRM: WhatsApp pela API oficial, primeiro contato e fila "Depende de mim"

Segunda etapa do CRM (`/leads`). O código está pronto e testado contra um provedor simulado. **Nada disto prova que a integração real funciona**: o número, a conta no provedor, o modelo aprovado e o webhook ainda precisam ser conectados e validados (seção 9).

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
- o contato chegou há mais de 12 horas (ligar a automação não dispara nada para trás);
- a pessoa já recebeu uma recepção nas últimas 72 horas ou já está em conversa em outra oportunidade. Nesse caso o novo pedido vai direto para "Depende de mim".

No canal WhatsApp, também **não envia e pede ação manual** (o contato aparece na fila com o motivo) quando: não há WhatsApp válido, o número pediu para parar, o formulário não registrou o pedido de retorno, a configuração está incompleta, não há modelo escolhido ou o modelo não está aprovado.

Depois do envio aceito, a oportunidade vai para "Aguardando resposta", com a vez do interessado. Mensagem automática não conta como atendimento humano.

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
- **Saudação ou ausência do aplicativo:** resposta do número comercial menos de 5 segundos depois da pessoa é registrada como automática do aplicativo e não tira a pendência. O recomendado é desligar essas mensagens.
- **Pedido para parar** ("parar", "sair", "não quero mais receber", "sem interesse"...): bloqueia novos contatos automáticos para o número e aparece para conferência, sem resposta automática.
- **Áudio, imagem, vídeo, documento, botão:** geram pendência. O CRM guarda texto e referência, nunca o arquivo; a mídia é vista no aplicativo.
- **Conteúdo não suportado:** aparece como tal, com orientação de conferir no aplicativo.
- **Reação:** registrada, sem gerar pendência.
- **Número fora do CRM:** mensagem recebida cria o contato (pelo telefone), sem oportunidade; fica em "Conversas sem associação". Mensagem enviada pelo aplicativo a quem não está no CRM é ignorada.
- **Telefone ausente:** a YCloud pode omitir o telefone; o contato também é reconhecido pelo identificador do usuário no WhatsApp.
- **Histórico do aplicativo:** os eventos são gravados e não viram mensagem, pendência, contato, oportunidade nem janela de atendimento.

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

`scripts/teste-crm-whatsapp.mjs`: YCloud, QStash e e-mail simulados, Postgres local. Cobre formulário → tarefa → primeiro contato, resposta → fila, resposta pelo aplicativo e pelo CRM, duplicação, concorrência, eventos fora de ordem, envio incerto, janela, modelo indisponível, integração desconectada, duas oportunidades, formulários e Pixel, filtros, atualização automática e celular.

## 9. Ativação (depende do Igor)

Ordem sugerida. Nenhuma credencial deve ser enviada por mensagem ou escrita em documento: elas vão direto para a Vercel.

1. **Chip e aplicativo:** instalar o WhatsApp Business (não o pessoal) no celular extra com o número novo. Desligar mensagem de saudação e de ausência. Usar o número normalmente.
2. **Conta na YCloud:** criar a conta e confirmar com o suporte os itens da seção 7. Não ativar agentes de IA, campanhas nem sequências do provedor. Não habilitar recarga automática sem decidir.
3. **Conectar por coexistência:** no painel, "WhatsApp Business APP Coexistence", por QR code. Não cadastrar o número como exclusivo de API nem desconectar o aplicativo.
4. **Modelo:** criar o modelo de primeiro contato (seção 3), em `pt_BR`, e aguardar a aprovação. Conferir a categoria atribuída pela Meta.
5. **Webhook:** cadastrar `https://www.spolaortecnologia.com.br/api/leads/webhooks/ycloud` com os eventos `whatsapp.inbound_message.received`, `whatsapp.message.updated`, `whatsapp.smb.message.echoes`, `whatsapp.smb.message.created`, `whatsapp.template.reviewed`, `whatsapp.template.category_updated`, `whatsapp.phone_number.quality_updated`, `whatsapp.business_account.updated` e `whatsapp.business_account.deleted`.
6. **Vercel (Production):** `YCLOUD_API_KEY`, `YCLOUD_WEBHOOK_SECRET` e `WHATSAPP_NUMERO`; Redeploy.
7. **Conferir em `/leads/integracoes`:** número `CONNECTED`, modelo aprovado.
8. **Validação real, só com números de teste definidos por você** (por exemplo o seu pessoal), com a automação desligada:
   - cadastrar à mão uma oportunidade com esse número e enviar o modelo pela ficha; conferir entrega e leitura;
   - responder do número de teste e ver o item em "Depende de mim";
   - responder pelo aplicativo do celular comercial e ver a mensagem entrar sozinha;
   - responder pelo CRM dentro da janela.
9. **Ligar a automação** em Configurações e fazer um envio real de formulário com o número de teste (esse envio conta um Lead no Pixel).
10. **Número público do site:** só trocar depois de tudo validado.
