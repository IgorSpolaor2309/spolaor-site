---
{
  "titulo": "Meu site está lento? Como conferir sem ser técnico e o que os números do Google querem dizer",
  "descricao": "Como usar o PageSpeed Insights do Google, ler as três métricas principais e conferir no celular se o site está atrapalhando o contato.",
  "status": "publicado",
  "publicadoEm": "2026-11-16T23:03:33-03:00",
  "atualizadoEm": "2026-11-16T23:03:33-03:00",
  "turno": "2026-11-16-manha",
  "servicos": ["diagnostico-site", "sites"],
  "fontes": [
    {
      "titulo": "Sobre o PageSpeed Insights (Google for Developers, documentação oficial, atualizada em 2025)",
      "url": "https://developers.google.com/speed/docs/insights/v5/about?hl=pt-br",
      "consultadoEm": "2026-11-16",
      "trecho": "O PSI informa as experiências de First Contentful Paint (FCP), Interaction to Next Paint (INP), Largest Contentful Paint (LCP) e Cumulative Layout Shift (CLS) de usuários reais durante o período de coleta anterior de 28 dias."
    },
    {
      "titulo": "Web Vitals (Philip Walton, web.dev, atualizado em 31 de outubro de 2024)",
      "url": "https://web.dev/articles/vitals?hl=pt-br",
      "consultadoEm": "2026-11-16",
      "trecho": "Para proporcionar uma boa experiência do usuário, o LCP deve ocorrer dentro de 2,5 segundos após o início do carregamento da página. [...] as páginas devem ter um tempo de INP de 200 milissegundos ou menos. [...] devem manter um CLS de 0,1 ou menos."
    },
    {
      "titulo": "O impacto comercial das Principais métricas da Web (Saurabh Rajpal e Swetha Gopalakrishnan, web.dev, atualizado em 2021)",
      "url": "https://web.dev/case-studies/vitals-business-impact?hl=pt-br",
      "consultadoEm": "2026-11-16",
      "trecho": "A Vodafone (Itália) melhorou o LCP em 31% e aumentou as vendas em 8% . [...] O teste A/B é a melhor maneira de medir o impacto significativo."
    },
    {
      "titulo": "Por que a velocidade é importante? (web.dev, curso Aprendizado de desempenho, atualizado em 2023)",
      "url": "https://web.dev/learn/performance/why-speed-matters?hl=pt-br",
      "consultadoEm": "2026-11-16",
      "trecho": "Por exemplo, a BBC descobriu que perdeu 10% de usuários a mais para cada segundo a mais que o site levou para carregar ."
    }
  ],
  "historico": [
    { "em": "2026-11-16T23:03:33-03:00", "turno": "2026-11-16-manha", "tipo": "publicacao", "resumo": "Publicação." }
  ]
}
---
Dá para saber se o site está lento sem entender de programação: a ferramenta gratuita [PageSpeed Insights](https://pagespeed.web.dev/), do Google, mostra como a página carrega para quem a visita. O número que mais importa ali não é a nota de 0 a 100, e sim o bloco com a experiência de **usuários reais**, quando ele existe. E velocidade é só metade da conferência: a outra metade é abrir o site no seu celular e tentar entrar em contato como um cliente faria.

## Por que isso importa para quem vende serviço ou produto

O Google reúne estudos de caso sobre velocidade no site web.dev. Numa página de resumo desses estudos (atualizada em 2021), consta que a [Vodafone na Itália melhorou em 31% o tempo de carregamento do conteúdo principal e aumentou as vendas em 8%](https://web.dev/case-studies/vitals-business-impact?hl=pt-br); a mesma página aponta o teste A/B como a melhor forma de medir esse tipo de impacto. Num texto do curso de desempenho do mesmo site (atualizado em 2023), o web.dev cita, sem informar o ano do levantamento, que a [BBC perdia 10% a mais de usuários a cada segundo extra de carregamento](https://web.dev/learn/performance/why-speed-matters?hl=pt-br).

São empresas grandes, com muito tráfego, e os números não se transferem para um site pequeno. O que dá para levar deles é a direção: página que demora a aparecer ou que trava ao tocar perde parte das pessoas antes do contato. Num site de empresa que vende por orçamento ou por WhatsApp, cada visitante que desiste pode ser um pedido que não chegou, e você nem fica sabendo.

## Como fazer o teste em cinco minutos

1. Abra o [PageSpeed Insights](https://pagespeed.web.dev/) e cole o endereço da página que mais recebe visitas (em geral, a inicial ou a página de um serviço que você anuncia).
2. Confira o resultado para **dispositivos móveis** (celular), não só o de computador. Em muitos negócios, boa parte dos clientes chega pelo telefone, e é onde uma página pesada tende a pesar mais.
3. Olhe primeiro o bloco de cima, sobre a experiência dos usuários reais. Depois, a nota de desempenho mais abaixo.

## Como ler o resultado

A página tem dois tipos de dado, e a [documentação do PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/about?hl=pt-br) explica a diferença:

- **Dados de campo (usuários reais):** vêm do relatório de experiência do usuário do Chrome (CrUX), com visitas reais dos últimos 28 dias. Mostram como o site se comportou de verdade, em celulares e conexões variados.
- **Dados de laboratório (incluindo a nota de desempenho, de 0 a 100):** são uma simulação feita na hora, num único aparelho e numa única conexão. Servem para achar a causa do problema. A própria documentação avisa que uma nota boa no laboratório não garante que a experiência real também seja boa, e que a nota pode mudar de um teste para outro mesmo sem nenhuma alteração no site.

Nos dados de campo, três métricas formam as chamadas Core Web Vitals. Os limites considerados bons, segundo o [web.dev](https://web.dev/articles/vitals?hl=pt-br), são:

| Métrica | O que mede, em linguagem simples | Bom |
|---|---|---|
| LCP (Largest Contentful Paint) | Quanto tempo o conteúdo principal leva para aparecer | até 2,5 segundos |
| INP (Interaction to Next Paint) | Quanto a página demora para reagir quando a pessoa toca ou clica | até 200 milissegundos |
| CLS (Cumulative Layout Shift) | Quanto a página "pula" enquanto carrega, tirando o botão do lugar | até 0,1 |

O PageSpeed Insights pinta cada resultado de verde (bom), âmbar (precisa melhorar) ou vermelho (ruim) e usa o percentil 75: o valor que representa 75% das visitas, justamente para não esconder as experiências mais lentas. Se as três estiverem boas, a página passa na avaliação (se faltar dado de INP, bastam LCP e CLS).

**E se aparecer que não há dados suficientes?** É comum em site de empresa pequena. Segundo a documentação, isso acontece quando a página tem poucas visitas, foi publicada há pouco tempo ou não é pública e indexável; nesse caso a ferramenta tenta mostrar os dados do site inteiro e, se também não houver, fica só a simulação. Aí a nota de laboratório é a referência disponível: abaixo de 50 é considerada ruim, de 50 a 89 precisa melhorar, e 90 ou mais é bom.

## A conferência que nenhuma ferramenta faz

Um site pode ser rápido e ainda assim atrapalhar o contato. Recomendamos fazer, no seu próprio celular e fora do Wi-Fi da empresa, o caminho de um cliente novo:

- **O botão de WhatsApp abre a conversa certa?** Com o número atual e, se houver, uma mensagem inicial que faça sentido.
- **O telefone é clicável?** Número em imagem ou sem link obriga a pessoa a decorar e digitar.
- **O formulário chega?** Envie um pedido de teste e confira se ele aparece no e-mail ou no sistema de quem atende, e em quanto tempo alguém responderia.
- **Dá para entender o que você faz e onde atende sem rolar muito?** Se a primeira tela é só uma imagem bonita, o visitante precisa procurar.
- **Algo cobre a tela?** Aviso de cookies, janela de promoção ou botão flutuante em cima do botão de contato.
- **A página "pula" na hora de tocar?** É o problema que o CLS mede, e no celular faz a pessoa tocar no lugar errado.

Anote o que encontrou. Na nossa avaliação, esses itens muitas vezes são mais simples de corrigir do que a velocidade em si, e alguns podem recuperar contatos que hoje se perdem.

## O que fazer com o resultado

- **Tudo verde e o contato funcionou no teste:** o site provavelmente não é o gargalo. Vale olhar outros pontos, como o tempo de resposta a quem chama.
- **Métricas em âmbar ou vermelho, ou nota baixa:** entre as técnicas que aparecem nos estudos de caso do web.dev estão otimizar imagens, reduzir o código que atrasa a exibição da página e cuidar dos scripts de terceiros (como anúncios). Na prática, recomendamos começar por esses pontos. A correção depende de como o site foi feito: em alguns construtores de site há pouco a ajustar; num site próprio, em geral há mais margem.
- **Contato quebrado ou difícil:** corrija primeiro. Não adianta uma página rápida que leva a um botão que não funciona.

Se preferir que alguém olhe por você, a Spolaor faz um [diagnóstico de site](https://www.spolaortecnologia.com.br/diagnostico-site): olhamos como o site funciona, o que está dificultando o contato e o que vale corrigir primeiro. O diagnóstico é gratuito, e as melhorias são contratadas à parte. Se a conclusão for refazer a página, veja também nossos [sites e landing pages](https://www.spolaortecnologia.com.br/sites).

## Em resumo

- Use o PageSpeed Insights no resultado para celular e olhe primeiro os dados de usuários reais.
- LCP até 2,5 s, INP até 200 ms e CLS até 0,1 são os limites considerados bons.
- Sem dados reais suficientes, a nota de laboratório serve de referência, mas varia de um teste para outro.
- Faça você mesmo o caminho do cliente no celular: WhatsApp, telefone, formulário e o que cobre a tela.
