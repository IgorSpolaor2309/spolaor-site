# Spolaor Tecnologia — Arquitetura do site

## 1. Leitura do briefing

O que o site precisa resolver, em ordem de importância:

1. **Ser a prova do serviço.** O visitante compara o próprio site com o da Spolaor nos primeiros segundos. A qualidade visual é argumento comercial, não decoração.
2. **Nomear dois prejuízos invisíveis.** Clientes perdidos por apresentação fraca e dinheiro perdido em trabalho manual. São dois "vazamentos" que o empresário não vê no caixa, mas paga todos os dias.
3. **Converter para a análise gratuita.** É o mecanismo de aquisição principal: baixo atrito, alto valor percebido. "Falar sobre meu projeto" é o caminho para quem já sabe o que quer.
4. **Parecer uma empresa que entende negócio**, não um estúdio que entrega layout. Por isso a linguagem fala em custo, cliente, equipe, escala; não em "soluções inovadoras".
5. **Gerar confiança sem preço.** Sem tabela de valores, a confiança vem de processo claro, transparência (domínio é do cliente, desenvolvimento separado da hospedagem) e de um case técnico robusto.

Conceito central da página: **"Dois vazamentos. Uma empresa que fecha os dois."**
A metáfora visual acompanha a página inteira: no topo, partículas escapando de um núcleo (o que se perde sem perceber); ao longo do scroll, elas se organizam (tecnologia colocando ordem).

## 2. Arquitetura definitiva da homepage

| # | Seção | Intenção |
|---|-------|----------|
| 0 | **Header** fixo, translúcido | Navegação curta (Sites, Automação, Sistemas, Projetos, Consultoria, Contato) e o CTA "Analisar meu site" sempre visível. No mobile, menu em tela cheia e barra de CTA fixa no rodapé. |
| 1 | **Hero — "Sua empresa pode estar perdendo dinheiro agora. E ninguém está vendo."** | Provocar antes de explicar. Três linhas de apoio nomeiam os dois prejuízos e a saída. Núcleo 3D com partículas escapando; dois "sinais" flutuantes ilustram os vazamentos (visitante saindo sem contato; planilha atualizada à mão). CTA primário + secundário. |
| 2 | **Os dois vazamentos** | Dividir o problema em dois painéis lado a lado: *Perda de clientes* e *Desperdício operacional*. Cada painel tem sintomas concretos e uma micro-demo interativa. O empresário se reconhece em pelo menos um. |
| 3 | **Mesmo produto, escolha diferente** | A dor de sites, mostrada e não dita: duas empresas fictícias com o mesmo produto. O scroll revela, ponto a ponto, por que o cliente escolheu uma delas (clareza, prova, CTA, mobile, velocidade). Inclui o recado "Instagram não substitui site". |
| 4 | **Quanto custa continuar fazendo à mão?** | Automação concreta: fluxo animado (lead entra → CRM → WhatsApp → responsável → follow-up → oportunidade acompanhada) com log de eventos em tempo real. Depois, o comparativo honesto "antes de contratar mais uma pessoa" (salário, encargos, treinamento, equipamento, gestão, capacidade) sem discurso de substituir gente. |
| 5 | **O que fazemos** | Bento grid de serviços com hierarquia clara: Sites e conversão, Automação, Sistemas (grandes); Consultoria, E-commerce, Identidade visual (menores). Cada card leva para sua página. |
| 6 | **Case: Plataforma de gestão e atendimento** | Prova técnica. Mockup 3D de dashboard que se endireita com o scroll, cercado pelos módulos (CRM, portal, financeiro, pagamentos, contratos, automações, WhatsApp, IA, fluxos, dashboards). Sem citar o cliente. |
| 7 | **Consultoria** | "Você entende seu negócio. Nós entendemos como a tecnologia pode trabalhar nele." Para quem sente o problema mas não sabe o nome da solução. |
| 8 | **Como funciona + Sem amarras** | Processo em 8 etapas (análise → publicação) e três garantias de transparência: domínio sempre seu, desenvolvimento separado de hospedagem, você escolhe quem mantém. Reduz o medo de contratar. |
| 9 | **Análise gratuita** | O bloco de conversão principal: o que será avaliado (9 critérios, com visual de "varredura") + formulário em 2 passos. Passo 1 pede só o site, o que melhorar e urgência (baixo atrito); passo 2 pede contato. |
| 10 | **Perguntas diretas** | FAQ que derruba objeções: preço, prazo, "já tenho Instagram", hospedagem, "meu site é recente". |
| 11 | **CTA final + rodapé** | Última provocação e os dois caminhos de conversão. |

Páginas internas: `/sites`, `/automacao`, `/sistemas`, `/projetos`, `/consultoria`, `/contato`, `/analise` (formulário dedicado, destino de anúncios futuros). E-commerce e identidade visual vivem dentro de `/sites` e na home, sem disputar destaque.

## 3. Direção visual

- **Base escura grafite** (#07080A → #0E1014), não preto puro. Transmite tecnologia e seriedade e faz luz e profundidade funcionarem.
- **Dois acentos com significado**:
  - **Âmbar-brasa** (#FF6B3D) = prejuízo, vazamento, alerta. Usado só onde há dor.
  - **Lima-sinal** (#D7FF3A) = ação, ganho, CTA. Usado com parcimônia: botão principal, estados "resolvido", números positivos.
  - O resto é escala de cinzas frias + brilhos azulados sutis.
- **Tipografia**: Geist (display e texto) com tracking negativo em tamanhos grandes; **Instrument Serif itálico** para as palavras-chave das provocações ("sem perceber", "à mão"), dando tom editorial e premium; Geist Mono para rótulos técnicos, logs e números.
- **Layout**: tipografia muito grande, bastante respiro, grid de 12 colunas com composições assimétricas. Linhas de grid finas e ruído sutil no fundo, como papel técnico.
- **Superfícies**: cards de vidro escuro com borda de 1px, brilho que segue o cursor e leve inclinação 3D. Nada de gradiente roxo-azul genérico.
- **Movimento**: entradas com profundidade (blur + translate + leve escala), curvas de easing longas, nada que pule ou quique.

## 4. Onde 3D e animação realmente entram

| Elemento | Técnica | Por que existe |
|----------|---------|----------------|
| Núcleo de partículas do hero | Three.js com shader próprio (carregado sob demanda, depois do conteúdo) | É a metáfora central: dinheiro escapando → ordem. Única peça WebGL do site. |
| Fundo com grid e luz | CSS (gradientes + máscara) | Profundidade sem custo de GPU. |
| Comparação "mesmo produto" | Scroll-driven com Motion | O argumento depende de revelar diferenças em sequência. |
| Fluxo de automação | SVG + Motion, ativado por scroll | Precisa parecer concreto: cada etapa acende e gera um evento no log. |
| Mockup do case | CSS 3D (perspective) ligado ao scroll | Sensação de produto real sem modelo 3D pesado. |
| Cards de serviço | Spotlight do cursor + tilt | Microinteração que convida ao clique. |
| Processo | Linha de progresso ligada ao scroll | Mostra que existe um caminho claro. |

**Fora:** cursor customizado, preloader, textos que se embaralham, partículas em todas as seções, scroll-jacking agressivo. Animação que não reforça uma mensagem não entra.

**Degradação**:
- `prefers-reduced-motion`: sem WebGL, sem parallax, entradas viram fade simples.
- Mobile e aparelhos fracos (poucos núcleos, pouca memória, sem WebGL): núcleo em versão leve ou imagem estática; menos partículas; sem tilt.
- O canvas pausa quando sai da tela ou quando a aba fica em segundo plano.
- Todo o conteúdo é HTML renderizado no servidor; o 3D nunca bloqueia a leitura nem o LCP (o H1 é o LCP).

## 5. Stack e componentes principais

**Stack**: Next.js (App Router) + TypeScript + Tailwind CSS 4 + Motion (animações) + Three.js (só o hero, import dinâmico) + Lenis (rolagem suave, só desktop). Sem GSAP e sem React Three Fiber: Motion cobre o scroll e Three.js puro é mais leve para uma única cena.

**Componentes**
- `SiteHeader`, `MobileMenu`, `MobileCtaBar`, `SiteFooter`
- `HeroCore` (WebGL) + `HeroCoreFallback`
- `Reveal`, `SplitHeading`, `SectionLabel` (primitivas de movimento e tipografia)
- `LeakPanels` (os dois vazamentos) com `PresenceDemo` e `ManualTasksDemo`
- `SameProductCompare` (as duas empresas)
- `AutomationFlow` + `EventLog` (reutilizado em `/automacao`)
- `HiringVsAutomation`
- `ServicesBento` + `SpotlightCard`
- `CaseShowcase` + `DashboardMockup`
- `ProcessTimeline`, `NoStringsAttached`
- `AnalysisForm` (2 passos, validação, `/api/lead`)
- `FAQ`, `FinalCta`
- `src/lib/site.ts` centraliza domínio, e-mail e WhatsApp, lidos só de variáveis de ambiente

**Captação de leads**: o formulário envia para `/api/lead`, que valida e entrega o lead a conectores plugáveis (`src/lib/leads/server/connectors`). Nenhum destino externo está definido ainda; Supabase, CRM, n8n, Make ou e-mail entram como um conector novo, sem mudar o formulário. Página, origem e UTMs já vão junto, o que prepara a otimização de conversão futura.

**SEO**: HTML semântico, um H1 por página, metadata e Open Graph por rota, imagem OG gerada dinamicamente, `sitemap.xml`, `robots.txt`, dados estruturados (Organization + ProfessionalService).

## 6. Reposicionamento e landings por segmento (outubro/2026)

A home deixou de vender "sites e automação" e passou a vender o resultado: mais oportunidades aproveitadas, menos leads perdidos, menos trabalho manual, mais controle. A tecnologia aparece só como meio.

**Home** (`src/app/page.tsx`): Hero (pergunta "Quantos clientes sua empresa perde sem perceber?" com as fitas do S) → *Um dia comum* (cinco situações reais com relógio e objetos de cena: notificação sem resposta, funil sem medição, canais sem dono, planilha à mão, lembretes esquecidos) → *O que fazemos* (três capacidades, resultado antes da tecnologia) → demonstração da automação → *Por segmento* (ponte para as landings) → comparação "mesmo produto" → projeto em destaque → *Como trabalhamos* (5 etapas: entender, encontrar, propor, construir, acompanhar) → diagnóstico gratuito → perguntas → CTA final.

**Landings** `/corretores`, `/clinicas`, `/orcamentos` (`src/app/<segmento>/page.tsx`): mesma espinha, conteúdo próprio. Hero com cena do segmento (`segment/hero-scenes.tsx`: celular do corretor em visita, recepção da clínica, disputa de orçamento) → dia/semana de situações → frase de posicionamento → jornada do contato (`segment/journey.tsx`: etapas automáticas em azul, a pessoa assume em marinho) + demonstração da conversa e do CRM com dados fictícios → *Quem faz o quê* (automação × pessoas, com ressalva de que nem tudo entra em todo projeto) → diagnóstico com perguntas do segmento → FAQ própria → CTA final.

**Componentes compartilhados** em `src/components/segment`: `SegmentHero`, `SituationsDay` (+ `artifacts.tsx`), `Journey`, `JourneySection`, `Division`, `Statement`. Reaproveitados da base: `AutomationFlow` (agora aceita fluxos próprios e mensagens "human"), `AnalysisBlock`/`AnalysisForm`, `Faq`, `FinalCta`, `Process`, header, footer, barra mobile.

**Leads**: um único formulário de diagnóstico em todas as páginas. Passo 1 pergunta o segmento (fixo nas landings) e o principal problema, na língua da página; passo 2 pede nome, empresa, WhatsApp e e-mail opcional. A `origem` (`home`, `corretores`, `clinicas`, `orcamentos`, `pagina-analise`, `sites`, `contato`) vai com o lead e é validada na API; a página de entrada da visita e as UTMs também vão, para atribuir o lead à landing mesmo quando o envio acontece em outra página. Detalhes em `src/lib/leads/server/connectors/README.md`. O destino dos leads continua em aberto.
