import type { Metadata } from "next";
import { SegmentHero } from "@/components/segment/segment-hero";
import { BrokerPhone } from "@/components/segment/hero-scenes";
import { SituationsDay, type Situation } from "@/components/segment/situations-day";
import { Chat, Ledger, Notice, Reminders } from "@/components/segment/artifacts";
import { Division, JourneySection, Statement } from "@/components/segment/sections";
import type { JourneyStep } from "@/components/segment/journey";
import type { Flow } from "@/components/sections/automation-flow";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq, type QA } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

export const metadata: Metadata = {
  title: "Para corretores de imóveis: pare de perder leads enquanto está em visita",
  description:
    "Você paga pelo lead e pode perdê-lo porque estava ocupado quando ele chegou. Resposta imediata, qualificação, registro no CRM e follow-up automáticos até o momento em que você assume a conversa. Diagnóstico gratuito para corretores.",
  alternates: { canonical: "/corretores" },
  openGraph: { title: "Enquanto você mostra um imóvel, quem responde o próximo interessado?", url: "/corretores" },
};

const situations: Situation[] = [
  {
    time: "10:15",
    where: "dirigindo para a visita",
    text: "Chega um lead do portal. Você está no trânsito e vai responder quando chegar.",
    outcome: "Ele já mandou mensagem para outros três corretores.",
    artifact: <Notice app="Portal de imóveis" from="Novo lead · Juliana" text="Tenho interesse no apto de 2 quartos. Ainda está disponível?" meta="há 18 min" />,
  },
  {
    time: "14:40",
    where: "mostrando um imóvel",
    text: "Enquanto você apresenta a sala para um casal, outro interessado pergunta se consegue visitar hoje.",
    outcome: "Quando você viu, ele já tinha visita marcada com outro corretor.",
    artifact: (
      <Chat
        lines={[
          { from: "them", text: "Oi! Vi o anúncio da casa no Jardim. Consigo ver ainda hoje?", meta: "14:40" },
          { from: "me", text: "Oi! Desculpa a demora, estava em visita. Consegue amanhã?", meta: "16:55" },
        ]}
        footer="2h15 sem resposta"
      />
    ),
  },
  {
    time: "17:30",
    where: "no cartório",
    text: "Dois leads chegaram pelo Instagram, um pelo portal e um pelo WhatsApp. Cada um numa aba, nenhum anotado.",
    outcome: "No fim da semana, você não lembra quem era quem.",
    artifact: (
      <Ledger
        head={["Nome", "Imóvel", "Faixa", "Retorno"]}
        rows={[
          ["Juliana", "Apto 2q", "até 600 mil", null],
          ["Carlos", null, null, "liguei?"],
          ["@marcos.r", "casa Jardim", null, null],
        ]}
        note="anotado de cabeça"
      />
    ),
  },
  {
    time: "20:10",
    where: "em casa",
    text: "Você lembra que alguém disse “vou pensar e te aviso” na semana passada. Mas não lembra quem.",
    outcome: "Quem disse “vou pensar” comprou com quem lembrou de chamar.",
    artifact: (
      <Reminders
        items={[
          { text: "Enviar fotos do apto para a Juliana", done: true },
          { text: "Chamar de novo quem disse “vou pensar”", lost: true },
          { text: "Retornar o lead do portal de terça", lost: true },
          { text: "Confirmar visita de sábado", lost: true },
        ]}
        note="depende de você lembrar"
      />
    ),
  },
];

const steps: JourneyStep[] = [
  { title: "O lead chega", detail: "Pelo portal, pelo WhatsApp, pelo Instagram ou pelo site. Não importa o canal.", owner: "auto" },
  { title: "Resposta imediata", detail: "O interessado recebe retorno em segundos, com o seu nome, mesmo que você esteja em visita.", owner: "auto" },
  { title: "Qualificação", detail: "Tipo de imóvel, região, faixa de preço, se é compra ou aluguel e qual a urgência.", owner: "auto" },
  { title: "Registro no CRM", detail: "O lead entra organizado, com origem, interesse e histórico. Nada anotado de cabeça.", owner: "auto" },
  { title: "Follow-up", detail: "Quem disse “vou pensar” recebe um novo contato no momento certo, sem você precisar lembrar.", owner: "auto" },
  { title: "Aviso para você", detail: "Quando o interessado está pronto, você recebe o resumo da conversa e o que ele quer.", owner: "auto" },
  { title: "Você assume a conversa", detail: "Agenda a visita, negocia e fecha. É aqui que a sua habilidade comercial faz diferença.", owner: "human" },
];

const flows: Record<string, Flow> = {
  portal: {
    label: "Lead do portal",
    contact: { name: "Juliana Reis", meta: "veio pelo portal · apto 2q", initials: "JR" },
    chat: [
      { at: 0, from: "them", text: "Oi! Vi o apartamento de 2 quartos na Vila Mariana. Ainda está disponível?", time: "10:15" },
      { at: 1, from: "auto", text: "Oi, Juliana! Está sim. Aqui é o atendimento do Rafael. Você procura para morar ou investir? E qual faixa de valor está considerando?", time: "10:15" },
      { at: 2, from: "them", text: "Para morar. Até uns 600 mil, com 2 vagas se possível.", time: "10:18" },
      { at: 3, from: "auto", text: "Perfeito. O Rafael está em visita agora e vai te chamar até as 12h com esse e mais dois imóveis parecidos. Pode ser?", time: "10:18" },
      { at: 5, from: "human", text: "Juliana, aqui é o Rafael! Vi que você procura 2q com 2 vagas até 600 mil. Tenho três opções, consegue ver amanhã às 10h?", time: "11:40" },
    ],
    record: {
      kind: "Lead",
      title: "Juliana Reis",
      fields: [
        { at: 1, label: "Origem", value: "Portal · apto 2q" },
        { at: 2, label: "Finalidade", value: "Morar" },
        { at: 2, label: "Faixa", value: "até R$ 600 mil · 2 vagas" },
        { at: 3, label: "Responsável", value: "Rafael" },
        { at: 4, label: "Próximo passo", value: "retorno até 12h" },
      ],
      stages: ["Novo", "Qualificado", "Em atendimento"],
      stageAt: [0, 2, 5],
    },
    log: [
      "Lead recebido · portal",
      "Resposta automática enviada · 4s",
      "Qualificado: morar, até 600 mil, 2 vagas",
      "Registrado no CRM com responsável",
      "Rafael avisado com o resumo",
      "Rafael assumiu a conversa",
    ],
  },
  pensar: {
    label: "“Vou pensar”",
    contact: { name: "Carlos Mendes", meta: "visitou a casa do Jardim há 6 dias", initials: "CM" },
    chat: [
      { at: 0, from: "them", text: "Gostei da casa, mas vou pensar e te aviso.", time: "há 6 dias" },
      { at: 2, from: "auto", text: "Oi, Carlos! O Rafael pediu para te avisar: a casa do Jardim segue disponível e o proprietário aceita proposta. Quer que ele te ligue para conversar sobre condições?", time: "hoje · 09:30" },
      { at: 3, from: "them", text: "Quero sim. Pode ser à tarde?", time: "09:52" },
      { at: 5, from: "human", text: "Carlos, Rafael aqui. Te ligo às 15h. Já conversei com o proprietário sobre condições de pagamento.", time: "10:05" },
    ],
    record: {
      kind: "Lead",
      title: "Carlos Mendes",
      fields: [
        { at: 0, label: "Interesse", value: "Casa · Jardim" },
        { at: 0, label: "Último contato", value: "visita há 6 dias" },
        { at: 1, label: "Follow-up", value: "programado para hoje" },
        { at: 3, label: "Resposta", value: "quer conversar à tarde" },
        { at: 4, label: "Tarefa", value: "ligar às 15h · Rafael" },
      ],
      stages: ["Visitou", "Follow-up", "Negociação"],
      stageAt: [0, 2, 5],
    },
    log: [
      "Lead parado há 6 dias sem retorno",
      "Follow-up disparado automaticamente",
      "Mensagem enviada em nome do Rafael",
      "Carlos respondeu: quer conversar",
      "Tarefa criada: ligar às 15h",
      "Rafael assumiu a conversa",
    ],
  },
};

const faq: QA[] = [
  {
    q: "Isso vai responder os meus clientes no meu lugar?",
    a: "Só a primeira parte: a resposta imediata, as perguntas básicas de qualificação e o lembrete de retorno. Quando o interessado está pronto para visitar ou negociar, a conversa é sua. A ideia é que você nunca mais perca um lead por estar ocupado, não que o atendimento vire robô.",
  },
  {
    q: "Funciona com os leads que eu compro de portal?",
    a: "Sim. É justamente onde a demora custa mais caro, porque o mesmo interessado costuma ser enviado para vários corretores. Dependendo do portal, o lead entra automaticamente; em outros casos, pelo e-mail ou WhatsApp que ele chega.",
  },
  {
    q: "Sou corretor autônomo. Isso é para mim ou só para imobiliária?",
    a: "É pensado para corretor autônomo e pequenas equipes. Quem mais sofre com lead chegando na hora errada é quem está sozinho na rua o dia inteiro.",
  },
  {
    q: "Preciso trocar meu WhatsApp ou meu CRM?",
    a: "Não necessariamente. O diagnóstico mostra o que já funciona e o que precisa mudar. Sempre que fizer sentido, a solução se conecta ao que você já usa.",
  },
  {
    q: "Quanto custa?",
    a: "Cada projeto tem orçamento próprio, definido pelo volume de leads, pelos canais e pelo que precisa ser integrado. O diagnóstico gratuito é o ponto de partida para chegar a um valor realista.",
  },
];

export default function CorretoresPage() {
  return (
    <>
      <SegmentHero
        eyebrow="Para corretores de imóveis"
        title={
          <>
            Enquanto você mostra um imóvel, <span className="text-ember">quem responde o próximo interessado?</span>
          </>
        }
        text={
          <>
            <p className="text-fg">Você paga pelo lead. E pode perdê-lo simplesmente porque estava ocupado quando ele chegou.</p>
            <p>
              Em visita, no trânsito, no cartório ou falando com outro cliente: o interessado não espera. Ele já está conversando com
              mais dois ou três corretores.
            </p>
          </>
        }
        cta="Quero parar de perder leads"
        note="Diagnóstico sem custo: você conta como seus leads chegam hoje, nós mostramos onde eles se perdem."
        scene={<BrokerPhone />}
      />

      <SituationsDay
        index="01"
        label="Isso acontece com você?"
        title="O lead chega sempre na hora em que você não pode atender."
        intro="Não é falta de dedicação. É que o seu trabalho acontece na rua, e o interessado quer resposta agora."
        dayLabel="Um dia de corretor"
        items={situations}
        closing={
          <>
            Quantos interessados ficaram esquecidos no seu WhatsApp esta semana?{" "}
            <span className="text-muted">Você lembra de todos que disseram “vou pensar e te aviso”?</span>
          </>
        }
      />

      <Statement kicker="A ideia">
        Não é substituir o corretor. <span className="text-sky">É deixar a automação cuidar do repetitivo até chegar a hora em que a sua habilidade comercial importa.</span>
      </Statement>

      <JourneySection
        index="02"
        title="Do primeiro contato até você assumir a conversa."
        intro={
          <>
            <p>Resposta, qualificação, registro e follow-up acontecem sozinhos, em segundos, com o seu nome.</p>
            <p className="text-fg">Você entra quando o interessado está pronto para visitar ou negociar.</p>
          </>
        }
        steps={steps}
        humanLabel="Você"
        flows={flows}
        flowHumanLabel="você"
        aside={
          <>
            <p className="text-[1.05rem] leading-relaxed text-muted">
              Um lead chega às 10h15 enquanto o corretor está em visita. Em segundos ele tem resposta, já está qualificado e
              registrado. O corretor assume com tudo em mãos.
            </p>
            <p className="mt-5 text-[1.05rem] leading-relaxed text-fg">Veja também o que acontece com quem disse “vou pensar”.</p>
          </>
        }
      />

      <Division
        index="03"
        title={
          <>
            O que fica com a automação. <span className="text-muted">O que continua com você.</span>
          </>
        }
        humanTitle="Continua com o corretor"
        auto={[
          { title: "Primeira resposta", text: "Em segundos, em qualquer canal, a qualquer hora, com o seu nome." },
          { title: "Qualificação", text: "Tipo de imóvel, região, faixa de preço, compra ou aluguel, urgência." },
          { title: "Registro", text: "Cada lead no CRM com origem, interesse e histórico da conversa." },
          { title: "Follow-up", text: "Novo contato com quem sumiu ou disse “vou pensar”, no momento certo." },
          { title: "Aviso", text: "Resumo do que o interessado quer, direto no seu WhatsApp." },
        ]}
        human={[
          { title: "A visita", text: "Mostrar o imóvel, ler o cliente e saber o que destacar." },
          { title: "A negociação", text: "Proposta, contraproposta e o momento de fechar." },
          { title: "A relação", text: "A confiança que faz o cliente indicar você para o próximo." },
          { title: "A decisão", text: "Qual lead merece prioridade hoje, com os dados na mão." },
        ]}
        footnote="O que entra em cada projeto depende de como você trabalha hoje: quais portais usa, por onde os leads chegam e se já existe algum CRM. O diagnóstico define o que vale a pena."
      />

      <AnalysisBlock
        index="04"
        origem="corretores"
        label="Diagnóstico gratuito"
        title={
          <>
            Descubra onde seus leads estão <span className="text-ember">se perdendo.</span>
          </>
        }
        text="Você conta por onde seus leads chegam e o que acontece quando você não pode responder. Nós mostramos onde estão os pontos de perda e o que resolver primeiro. Sem custo e sem compromisso."
        items={[
          "Por onde os leads chegam: portais, WhatsApp, Instagram, site",
          "Quanto tempo o interessado espera pela primeira resposta",
          "Onde cada lead fica registrado, e se fica",
          "O que acontece com quem disse “vou pensar”",
          "Quais canais trazem os leads que viram visita",
        ]}
        itemsTitle="O que olhamos"
        submitLabel="Quero parar de perder leads"
      />

      <Faq items={faq} index="05" title="O que corretores costumam perguntar." />

      <FinalCta
        title={
          <>
            O interessado não espera você sair da visita. <span className="text-ember">Mas pode receber resposta mesmo assim.</span>
          </>
        }
        text="Descubra quantos leads você perde por estar ocupado, e o que dá para resolver primeiro."
        primary={{ href: "#analise", label: "Quero parar de perder leads" }}
      />
    </>
  );
}
