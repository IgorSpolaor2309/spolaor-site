---
{
  "titulo": "Mensagens de serviço na API do WhatsApp voltaram a ser cobradas: como saber se você passa das 1.000 gratuitas",
  "descricao": "Desde 1º de outubro de 2026 a Meta cobra as mensagens de serviço da API do WhatsApp a partir da 1.001ª do mês em cada número. Como estimar e o que ajustar.",
  "status": "publicado",
  "publicadoEm": "2026-11-17T18:40:00-03:00",
  "atualizadoEm": "2026-11-17T18:40:00-03:00",
  "turno": "2026-11-17-tarde",
  "servicos": ["atendimento", "automacao"],
  "fontes": [
    {
      "titulo": "Pricing on the WhatsApp Business Platform (Meta for Developers, documentação oficial, atualizada em 30/9/2026)",
      "url": "https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing",
      "consultadoEm": "2026-11-17",
      "trecho": "As Meta resumes charging for service messages, Meta provides every business phone number with a free tier of 1,000 service messages per month. Each business phone number has one free tier of 1,000 delivered service messages per month. Meta charges as of the 1,001st service message per month, after the free tier has been used."
    }
  ],
  "historico": [
    { "em": "2026-11-17T18:40:00-03:00", "turno": "2026-11-17-tarde", "tipo": "publicacao", "resumo": "Publicação." }
  ]
}
---
Se a sua empresa responde clientes no WhatsApp por um sistema de atendimento ligado à API oficial (a WhatsApp Business Platform), as respostas deixaram de ser todas gratuitas. Desde 1º de outubro de 2026, cada número de WhatsApp da empresa tem **1.000 mensagens de serviço gratuitas por mês**; a partir da 1.001ª, a Meta cobra por mensagem entregue. Para quem envia poucas respostas livres, a faixa gratuita tende a cobrir o mês; já os modelos de utilidade enviados em resposta ao cliente (como confirmações) passaram a ser cobrados desde a primeira mensagem. Para quem atende muito, vale fazer a conta agora, antes de a fatura mostrar a diferença.

Tudo o que está neste texto vem da [página oficial de preços da WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), na documentação da Meta para desenvolvedores, atualizada em 30 de setembro de 2026 e consultada em 17 de novembro de 2026. Essa página trata dos preços da plataforma usada por sistemas de atendimento (a Cloud API e a API de mensagens de marketing); o aplicativo WhatsApp Business instalado no celular não é assunto dela.

## O que mudou em 1º de outubro

Segundo a Meta, voltaram a ser cobradas, por mensagem, duas coisas que estavam gratuitas:

- **Mensagens de serviço**, que eram gratuitas desde 1º de novembro de 2024. Junto com a volta da cobrança, a Meta criou a faixa gratuita de 1.000 por mês para cada número.
- **Mensagens de utilidade enviadas em resposta ao cliente**, isto é, modelos de utilidade mandados dentro da janela de atendimento aberta pela mensagem do cliente. Elas eram gratuitas desde 1º de julho de 2025.

A Meta também avisou que, para quem não tivesse forma de pagamento cadastrada até 30 de setembro de 2026, as mensagens de serviço deixariam de ser entregues quando passassem a ser cobradas. Na prática, segundo a página: sem forma de pagamento, a Meta entrega as mensagens de serviço dentro da faixa gratuita, mas não entrega as que passam dela.

## Que mensagem é "de serviço"

A Meta separa as mensagens que a empresa envia em cinco categorias. Quatro delas aparecem no atendimento do dia a dia: serviço e as três categorias de modelos.

- **Serviço**: qualquer mensagem livre (texto, imagem, áudio etc., sem ser modelo aprovado) enviada para responder ao cliente. Ela só pode ser mandada dentro da janela de atendimento de 24 horas, que abre e recomeça a cada mensagem do cliente. Vale tanto para a resposta escrita por um atendente quanto para a de um robô ou IA de outro fornecedor.
- **Modelos (templates)**: mensagens pré-aprovadas, que podem ser enviadas a qualquer momento, inclusive para iniciar a conversa. Dividem-se em marketing, utilidade (confirmação, lembrete, aviso de pedido) e autenticação (código de verificação). A faixa de 1.000 mensagens gratuitas não vale para modelos: fora da janela gratuita de anúncio descrita abaixo, eles são cobrados pela tabela da Meta.

A quinta categoria é a do agente de IA da própria Meta (Meta Business Agent), cobrado por consumo de tokens, sem faixa gratuita.

Pontos que costumam confundir:

- **A cobrança é por mensagem, não por conversa.** Cinco respostas do atendente são cinco mensagens de serviço.
- **Só conta o que a empresa envia.** A Meta não cobra as mensagens que o cliente manda para a empresa.
- **Só conta mensagem entregue**, não a enviada que não chegou.
- **A faixa é por número de telefone da empresa**, não por empresa nem por atendente. Ela não acumula: o que sobra em outubro não passa para novembro.

## Quando a Meta não cobra

Pela página oficial, há duas situações em que a mensagem da empresa não é cobrada:

1. **As 1.000 primeiras mensagens de serviço do mês**, em cada número.
2. **A janela gratuita de anúncio** (chamada pela Meta de *free entry point window*). Quando o cliente chega por um anúncio que leva ao WhatsApp, usando o aplicativo no Android ou no iPhone, e a empresa responde dentro da janela de atendimento, abre-se uma janela de até 7 dias em que as mensagens de marketing, utilidade, autenticação e serviço não são cobradas. As mensagens do agente de IA da Meta continuam cobradas nesse período.

## Como estimar se você passa das 1.000

Uma conta simples resolve. Imagine, como ilustração, uma clínica com um único número de WhatsApp que atende 40 conversas por dia útil, com cerca de cinco respostas da recepção em cada uma. São 200 mensagens de serviço por dia; em 22 dias úteis, cerca de 4.400 no mês. A faixa gratuita cobre as primeiras 1.000; as outras 3.400 seriam cobradas pela tabela da Meta (salvo as que caírem numa janela gratuita de anúncio). Já um escritório que troca 15 mensagens por dia fica abaixo da faixa.

Para fazer a sua conta com dados reais, e não com estimativa:

1. **Peça ao fornecedor do sistema de atendimento** quantas mensagens de serviço cada número entregou em outubro e quantas foram cobradas. Nas informações de entrega que a Meta envia aos sistemas, cada mensagem de serviço vem marcada como gratuita ou cobrada; pergunte se o seu fornecedor guarda e mostra esse dado.
2. **Confira se há forma de pagamento cadastrada** na conta da Meta (ou com o fornecedor, conforme o contrato). Sem ela, as mensagens de serviço acima da faixa gratuita não são entregues, e o cliente fica sem retorno.
3. **Confira as tarifas na tabela oficial.** O preço varia conforme a categoria e o país do número do cliente; a Meta publica as tabelas na mesma página e diz que só altera preços no primeiro dia de cada trimestre. Pergunte também ao fornecedor como ele repassa esse custo.

## O que ajustar no atendimento

Algumas recomendações, sem mudar a qualidade do atendimento:

- **Respostas mais completas, menos fragmentadas.** Três mensagens curtas ("Oi!", "Tudo bem?", "Como posso ajudar?") custam como três. Uma mensagem que já cumprimenta e pergunta o que o cliente precisa resolve o mesmo com uma.
- **Revise as mensagens automáticas.** Avisos de "estamos verificando", "aguarde um momento" e mensagens de encerramento também são mensagens enviadas. Veja quais delas realmente ajudam o cliente.
- **Lembretes e confirmações têm custo próprio.** Eles costumam ser modelos de utilidade, que já eram cobrados quando enviados fora da janela de atendimento e, desde 1º de outubro, também são cobrados dentro dela. Se a sua agenda usa lembretes, vale ver quantos são enviados e se cada um tem função. Escrevemos sobre isso em [como reduzir faltas em horário marcado](/como-reduzir-faltas-horario-marcado).
- **Separe números, se fizer sentido.** Como a faixa gratuita é por número, empresas com áreas bem diferentes (vendas e suporte, por exemplo) às vezes já operam com mais de um. Isso não é motivo, sozinho, para criar números novos; é só um fator a considerar na conta.

Um ponto de equilíbrio: cortar respostas para economizar pode sair mais caro, se o cliente desistir por falta de retorno. O objetivo é tirar mensagens sem função, não deixar perguntas sem resposta.

## Atendimento com IA também entra na conta

Se as respostas vêm de um robô ou de uma IA de outro fornecedor ligada à API, cada resposta dela é uma mensagem de serviço como qualquer outra e entra na mesma faixa de 1.000. Já o agente de IA oferecido pela própria Meta é cobrado de outra forma, por tokens, e não usa a faixa gratuita.

Na Spolaor, montamos [atendimento com IA no WhatsApp](https://www.spolaortecnologia.com.br/atendimento-ia) que responde interessados e passa a negociação para a equipe, e [automações](https://www.spolaortecnologia.com.br/automacao) para avisos e acompanhamento de atendimentos. Nesses fluxos, recomendamos considerar desde o início quantas mensagens cada etapa envia e quais são realmente necessárias. Se você quer revisar o seu atendimento com isso em mente, [fale com a Spolaor](https://www.spolaortecnologia.com.br/contato).

## O que ainda depende de cada empresa

A regra da faixa gratuita é a mesma para todos: 1.000 mensagens de serviço gratuitas por número a cada mês, cobrança por mensagem entregue a partir daí e as tarifas publicadas na tabela oficial. O que muda de uma empresa para outra é o volume, a quantidade de números e o contrato com o fornecedor do sistema de atendimento. Por isso a primeira providência é sempre a mesma: pedir os números de outubro e fazer a conta.
