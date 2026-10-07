import type { Metadata } from "next";
import { SegmentHero } from "@/components/segment/segment-hero";
import { QuoteRace } from "@/components/segment/hero-scenes";
import { SituationsDay, type Situation } from "@/components/segment/situations-day";
import { Chat, Ledger, Notice, Reminders } from "@/components/segment/artifacts";
import { Division, JourneySection, Statement } from "@/components/segment/sections";
import type { JourneyStep } from "@/components/segment/journey";
import type { Flow } from "@/components/sections/automation-flow";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq, type QA } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

export const metadata: Metadata = {
  title: "Para empresas que vendem por orçamento: venda mais dos orçamentos que já recebe",
  description:
    "Seu cliente pediu orçamento para você e para mais três empresas. Resposta rápida, coleta das informações, organização do lead, acompanhamento e follow-up automáticos até a negociação. Para ar-condicionado, energia solar, móveis planejados, reformas, instalação, manutenção e serviços B2B.",
  alternates: { canonical: "/orcamentos" },
  openGraph: { title: "Você está perdendo vendas por preço, ou porque ninguém fez o segundo contato?", url: "/orcamentos" },
};

const situations: Situation[] = [
  {
    time: "Segunda",
    where: "9h, começando a semana",
    text: "Chega um pedido de orçamento pelo site. Faltam medidas, endereço e prazo. Alguém precisa ligar para perguntar.",
    outcome: "Enquanto isso, outra empresa já mandou o preço.",
    artifact: <Notice app="Formulário do site" from="Pedido de orçamento" text="Quero instalar ar-condicionado. Quanto fica?" meta="faltam dados" />,
  },
  {
    time: "Terça",
    where: "14h, no cliente",
    text: "O vendedor está em visita técnica. Três pedidos novos ficam esperando no WhatsApp até o fim do dia.",
    outcome: "Quem pediu de manhã já fechou com quem respondeu de manhã.",
    artifact: (
      <Chat
        lines={[
          { from: "them", text: "Boa tarde! Preciso de um orçamento para 3 ambientes. Conseguem passar hoje?", meta: "14:05" },
          { from: "me", text: "Boa tarde! Conseguimos sim. Me passa o endereço?", meta: "18:40" },
        ]}
        footer="4h35 sem resposta"
      />
    ),
  },
  {
    time: "Quarta",
    where: "enviando propostas",
    text: "O orçamento vai por WhatsApp. O cliente diz “vou analisar”. E a conversa fica ali, no meio de outras cinquenta.",
    outcome: "Mandar o orçamento não significa que o trabalho acabou.",
    artifact: (
      <Ledger
        head={["Cliente", "Valor", "Enviado", "Retorno"]}
        rows={[
          ["Casa Vila Nova", "R$ ••••", "qua", null],
          ["Escritório 3º and.", "R$ ••••", "qua", "vou analisar"],
          ["Loja centro", null, "?", null],
        ]}
        note="controle no WhatsApp e numa planilha"
      />
    ),
  },
  {
    time: "Sexta",
    where: "17h, fechando a semana",
    text: "Doze orçamentos enviados. Ninguém sabe ao certo quantos receberam um segundo contato.",
    outcome: "Você perde pelo preço, ou porque ninguém chamou de novo?",
    artifact: (
      <Reminders
        items={[
          { text: "Enviar orçamento da casa Vila Nova", done: true },
          { text: "Retornar escritório: disse “vou analisar”", lost: true },
          { text: "Perguntar à loja do centro se recebeu", lost: true },
          { text: "Chamar de novo os 9 orçamentos da semana passada", lost: true },
        ]}
        note="depende do vendedor lembrar"
      />
    ),
  },
];

const steps: JourneyStep[] = [
  { title: "Pedido de orçamento", detail: "Pelo site, pelo WhatsApp, pelo telefone ou pelo Instagram. Resposta imediata em qualquer um.", owner: "auto" },
  { title: "Coleta das informações", detail: "O que precisa ser feito, onde, quando, medidas, fotos. O pedido chega completo para quem orça.", owner: "auto" },
  { title: "Organização do lead", detail: "Cada pedido registrado com origem, dados e responsável. Nada se perde entre WhatsApp e planilha.", owner: "auto" },
  { title: "Orçamento", detail: "Quem orça recebe o pedido completo e envia a proposta. O cliente é avisado de que ela chegou.", owner: "human" },
  { title: "Acompanhamento", detail: "Confirmação de que o cliente recebeu e abertura para dúvidas. Registrado, sem depender de memória.", owner: "auto" },
  { title: "Lembrete e follow-up", detail: "Quem disse “vou analisar” recebe um novo contato no momento certo. O vendedor é avisado quando responde.", owner: "auto" },
  { title: "Negociação e fechamento", detail: "A conversa volta para o vendedor com o histórico inteiro na mão. Condições, ajustes e fechamento.", owner: "human" },
];

const flows: Record<string, Flow> = {
  pedido: {
    label: "Pedido pelo site",
    contact: { name: "Fernanda Souza", meta: "veio pelo site · ar-condicionado", initials: "FS" },
    chat: [
      { at: 0, from: "them", text: "Quero instalar ar-condicionado em 2 ambientes. Quanto fica?", time: "09:02" },
      { at: 1, from: "auto", text: "Oi, Fernanda! Recebemos seu pedido. Para orçar certinho: qual o tamanho dos ambientes (aprox. em m²) e o endereço? Se puder, mande uma foto da parede.", time: "09:02" },
      { at: 2, from: "them", text: "Sala 25m² e quarto 14m². Rua das Acácias, 120. Segue foto.", time: "09:10" },
      { at: 3, from: "auto", text: "Perfeito. O Marcos vai montar o orçamento e te enviar ainda hoje. Tem preferência de data para a instalação?", time: "09:10" },
      { at: 5, from: "human", text: "Fernanda, Marcos aqui. Segue o orçamento com os dois equipamentos e instalação. Posso agendar para quinta.", time: "11:20" },
    ],
    record: {
      kind: "Orçamento",
      title: "Fernanda Souza",
      fields: [
        { at: 1, label: "Origem", value: "Site" },
        { at: 2, label: "Serviço", value: "Instalação · 2 ambientes" },
        { at: 2, label: "Dados", value: "25 m² + 14 m² · foto" },
        { at: 3, label: "Responsável", value: "Marcos" },
        { at: 4, label: "Prazo", value: "orçamento até hoje" },
      ],
      stages: ["Pedido", "Completo", "Orçado"],
      stageAt: [0, 2, 5],
    },
    log: [
      "Pedido recebido · site",
      "Resposta automática enviada · 3s",
      "Informações coletadas: medidas, endereço, foto",
      "Lead registrado com responsável",
      "Marcos avisado com o pedido completo",
      "Orçamento enviado · acompanhamento programado",
    ],
  },
  analisar: {
    label: "“Vou analisar”",
    contact: { name: "Ricardo Alves", meta: "orçamento enviado há 4 dias", initials: "RA" },
    chat: [
      { at: 0, from: "them", text: "Recebi o orçamento, obrigado. Vou analisar e te retorno.", time: "há 4 dias" },
      { at: 2, from: "auto", text: "Oi, Ricardo! Aqui é da equipe do Marcos. Ficou alguma dúvida sobre o orçamento dos móveis? Se quiser, ele pode ajustar algo ou passar aí para rever as medidas.", time: "hoje · 10:00" },
      { at: 3, from: "them", text: "Na verdade recebi outro mais barato. Vocês fecham por menos?", time: "10:26" },
      { at: 5, from: "human", text: "Ricardo, Marcos aqui. Me manda o que o outro incluiu? Às vezes a diferença está no material ou na garantia. Te ligo às 14h.", time: "10:40" },
    ],
    record: {
      kind: "Orçamento",
      title: "Ricardo Alves",
      fields: [
        { at: 0, label: "Serviço", value: "Móveis planejados · cozinha" },
        { at: 0, label: "Enviado", value: "há 4 dias" },
        { at: 1, label: "Follow-up", value: "disparado hoje" },
        { at: 3, label: "Objeção", value: "preço · concorrente" },
        { at: 4, label: "Tarefa", value: "ligar às 14h · Marcos" },
      ],
      stages: ["Orçado", "Follow-up", "Negociação"],
      stageAt: [0, 2, 5],
    },
    log: [
      "Orçamento sem retorno há 4 dias",
      "Follow-up disparado automaticamente",
      "Mensagem enviada em nome do Marcos",
      "Ricardo respondeu: objeção de preço",
      "Marcos avisado com o histórico",
      "Marcos assumiu a negociação",
    ],
  },
};

const faq: QA[] = [
  {
    q: "Minha empresa não é de ar-condicionado. Isso serve para mim?",
    a: "Serve para qualquer empresa que recebe pedidos de orçamento antes de vender: energia solar, móveis planejados, reformas, manutenção, instalação, serviços residenciais ou B2B. Os exemplos mudam; o problema é o mesmo.",
  },
  {
    q: "O orçamento vai ser feito automaticamente?",
    a: "Não. Orçar continua sendo trabalho de quem conhece o serviço. A automação garante que o pedido chegue completo, que o cliente seja respondido na hora e que ninguém fique sem o segundo contato depois que a proposta sai.",
  },
  {
    q: "Nossos vendedores já usam WhatsApp. O que muda?",
    a: "Eles continuam usando. O que muda é que cada pedido passa a ter registro, responsável e próximo passo, e que o follow-up deixa de depender da memória de cada um.",
  },
  {
    q: "Dá para saber quantos orçamentos viram venda?",
    a: "Sim. Quando cada pedido fica registrado com origem e situação, você passa a ver quantos foram enviados, quantos receberam retorno e quantos fecharam, por canal e por vendedor.",
  },
  {
    q: "Quanto custa?",
    a: "Cada projeto tem orçamento próprio, definido pelo volume de pedidos, pelos canais e pelo que precisa ser integrado. O diagnóstico gratuito é o ponto de partida para chegar a um valor realista.",
  },
];

export default function OrcamentosPage() {
  return (
    <>
      <SegmentHero
        eyebrow="Para empresas que vendem por orçamento"
        title={
          <>
            Seu cliente pediu orçamento para você. <span className="text-ember">E provavelmente para mais três empresas.</span>
          </>
        }
        text={
          <>
            <p className="text-fg">
              Ar-condicionado, energia solar, móveis planejados, reformas, instalação, manutenção, serviços B2B: quem vende por
              orçamento disputa cada pedido com quem responde mais rápido.
            </p>
            <p>E o trabalho não termina quando o preço é enviado. Termina quando alguém faz o segundo contato.</p>
          </>
        }
        cta="Quero vender mais dos orçamentos que já recebo"
        note="Diagnóstico sem custo: você conta como os pedidos chegam hoje, nós mostramos onde as vendas se perdem."
        scene={<QuoteRace />}
      />

      <SituationsDay
        index="01"
        label="Isso acontece na sua empresa?"
        title="Uma semana de orçamentos. E as vendas que ficaram pelo caminho."
        intro="Pedido incompleto, resposta que demora, proposta enviada e esquecida. Cada etapa deixa escapar uma parte dos clientes que já tinham interesse."
        dayLabel="Uma semana"
        scale={["segunda", "sexta"]}
        items={situations}
        closing={
          <>
            Quantos orçamentos sua empresa envia e nunca mais acompanha?{" "}
            <span className="text-muted">Seu vendedor lembra de chamar de novo todo mundo que disse “vou analisar”?</span>
          </>
        }
      />

      <Statement kicker="A pergunta">
        Você está perdendo vendas por preço, <span className="text-sky">ou porque ninguém fez o segundo contato?</span>
      </Statement>

      <JourneySection
        index="02"
        title="Do pedido ao fechamento, sem nenhum orçamento esquecido."
        intro={
          <>
            <p>Site, CRM e automação trabalham juntos: o pedido chega completo, fica registrado e recebe acompanhamento sozinho.</p>
            <p className="text-fg">O vendedor entra para orçar e para negociar. O resto acontece sem ele precisar lembrar.</p>
          </>
        }
        steps={steps}
        humanLabel="Vendedor"
        flows={flows}
        flowHumanLabel="vendedor"
        aside={
          <>
            <p className="text-[1.05rem] leading-relaxed text-muted">
              Um pedido chega pelo site às 9h02, sem medidas nem endereço. Em segundos o cliente é respondido e os dados são
              coletados. O vendedor recebe o pedido completo e só precisa orçar.
            </p>
            <p className="mt-5 text-[1.05rem] leading-relaxed text-fg">Veja também o que acontece com quem disse “vou analisar”.</p>
          </>
        }
      />

      <Division
        index="03"
        title={
          <>
            O que fica com a automação. <span className="text-muted">O que continua com o vendedor.</span>
          </>
        }
        humanTitle="Continua com o vendedor"
        auto={[
          { title: "Primeira resposta", text: "Em segundos, em qualquer canal, antes das outras três empresas." },
          { title: "Coleta de dados", text: "Medidas, endereço, prazo, fotos. O pedido chega pronto para orçar." },
          { title: "Registro", text: "Cada pedido com origem, responsável e situação, num só lugar." },
          { title: "Acompanhamento", text: "Confirmação de que o cliente recebeu a proposta e abertura para dúvidas." },
          { title: "Follow-up", text: "Novo contato com quem disse “vou analisar”, no momento certo." },
          { title: "Aviso", text: "O vendedor sabe na hora quando o cliente responde ou pede ajuste." },
          { title: "Números", text: "Quantos pedidos, quantos orçados, quantos fechados. Por canal e por vendedor." },
        ]}
        human={[
          { title: "O orçamento", text: "Entender o serviço, dimensionar e precificar. Trabalho de quem conhece o ofício." },
          { title: "A visita técnica", text: "Ver o local, ajustar a proposta e ganhar confiança." },
          { title: "A negociação", text: "Objeção de preço, condições, fechamento." },
          { title: "A decisão", text: "Qual pedido merece prioridade hoje, com os números na mão." },
        ]}
        footnote="O que entra em cada projeto depende de como a empresa vende hoje: volume de pedidos, canais, equipe e ferramentas em uso. O diagnóstico define o que vale a pena."
      />

      <AnalysisBlock
        index="04"
        origem="orcamentos"
        label="Diagnóstico gratuito"
        title={
          <>
            Descubra onde seus orçamentos estão <span className="text-ember">deixando de virar venda.</span>
          </>
        }
        text="Você conta como os pedidos chegam e o que acontece depois que o orçamento é enviado. Nós mostramos onde as vendas se perdem e o que resolver primeiro. Sem custo e sem compromisso."
        items={[
          "Por onde os pedidos chegam: site, WhatsApp, telefone, Instagram",
          "Quanto tempo o cliente espera pela primeira resposta",
          "Se o pedido chega completo ou precisa de idas e vindas",
          "Onde cada orçamento fica registrado, e se fica",
          "O que acontece com quem disse “vou analisar”",
          "Quantos orçamentos viram venda, e quais não",
        ]}
        itemsTitle="O que olhamos"
        submitLabel="Quero vender mais dos orçamentos que recebo"
      />

      <Faq items={faq} index="05" title="O que costumam perguntar antes de começar." />

      <FinalCta
        title={
          <>
            Mandar o orçamento não é o fim do trabalho. <span className="text-ember">É o começo da venda.</span>
          </>
        }
        text="Descubra quantos orçamentos sua empresa perde depois de enviados, e o que dá para resolver primeiro."
        primary={{ href: "#analise", label: "Quero vender mais dos orçamentos que recebo" }}
      />
    </>
  );
}
