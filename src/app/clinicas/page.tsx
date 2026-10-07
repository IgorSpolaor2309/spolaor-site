import type { Metadata } from "next";
import { SegmentHero } from "@/components/segment/segment-hero";
import { ReceptionDesk } from "@/components/segment/hero-scenes";
import { SituationsDay, type Situation } from "@/components/segment/situations-day";
import { Chat, Reminders, Schedule } from "@/components/segment/artifacts";
import { Division, JourneySection, Statement } from "@/components/segment/sections";
import type { JourneyStep } from "@/components/segment/journey";
import type { Flow } from "@/components/sections/automation-flow";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq, type QA } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

export const metadata: Metadata = {
  title: "Para clínicas e consultórios: atendimento que não deixa paciente sem resposta",
  description:
    "O paciente chamou enquanto a recepção atendia outra pessoa e marcou em outro lugar. Resposta inicial, agendamento, confirmação, lembrete e reativação de contatos automáticos, com a recepção humana onde precisa ser. Diagnóstico gratuito para clínicas.",
  alternates: { canonical: "/clinicas" },
  openGraph: { title: "A recepção continua humana onde precisa ser humana. A automação cuida do repetitivo.", url: "/clinicas" },
};

const situations: Situation[] = [
  {
    time: "08:50",
    where: "no balcão da recepção",
    text: "Um paciente novo chama no WhatsApp enquanto a recepcionista atende quem acabou de chegar.",
    outcome: "Quando ela respondeu, ele já tinha marcado em outro lugar.",
    artifact: (
      <Chat
        lines={[
          { from: "them", text: "Bom dia! Vocês têm horário para avaliação esta semana?", meta: "08:50" },
          { from: "me", text: "Bom dia! Temos sim. Qual período prefere?", meta: "10:20" },
          { from: "them", text: "Obrigado, já consegui em outro lugar.", meta: "10:34" },
        ]}
        footer="1h30 sem resposta"
      />
    ),
  },
  {
    time: "11:30",
    where: "entre um paciente e outro",
    text: "Alguém pergunta o valor da consulta. A recepção responde. A pessoa some.",
    outcome: "Ninguém chama de novo. O contato se perde.",
    artifact: (
      <Chat
        lines={[
          { from: "them", text: "Quanto custa a primeira consulta?", meta: "11:30" },
          { from: "me", text: "Olá! A primeira consulta é R$ ••• e inclui avaliação. Quer agendar?", meta: "11:41" },
        ]}
        footer="sem resposta há 9 dias · ninguém retornou"
      />
    ),
  },
  {
    time: "14:00",
    where: "respondendo o WhatsApp",
    text: "“Aceita convênio?”, “Qual o endereço?”, “Tem estacionamento?”. As mesmas perguntas, dezenas de vezes por dia.",
    outcome: "Horas da recepção por semana repetindo o que poderia estar pronto.",
    artifact: (
      <Reminders
        items={[
          { text: "Vocês atendem convênio?", done: true },
          { text: "Qual o endereço?", done: true },
          { text: "Tem estacionamento?", done: true },
          { text: "Qual o valor da consulta?", done: true },
          { text: "Preciso levar exames?", lost: true },
        ]}
        note="as mesmas 5 perguntas · todos os dias"
      />
    ),
  },
  {
    time: "16:00",
    where: "olhando a agenda",
    text: "Dois horários da tarde ficaram vazios: um paciente esqueceu, outro cancelou em cima da hora.",
    outcome: "Horários que tinham gente na lista de espera. Ninguém chamou.",
    artifact: (
      <Schedule
        slots={[
          { time: "14:00", who: "Confirmado", state: "ok" },
          { time: "15:00", who: "Não veio · sem lembrete", state: "empty" },
          { time: "16:00", who: "Cancelou às 15h40", state: "empty" },
          { time: "17:00", who: "Confirmado", state: "ok" },
        ]}
        note="3 pessoas na lista de espera"
      />
    ),
  },
];

const steps: JourneyStep[] = [
  { title: "O paciente chama", detail: "Pelo WhatsApp, pelo site, pelo Instagram ou pelo telefone. Em qualquer horário.", owner: "auto" },
  { title: "Resposta inicial", detail: "Retorno imediato, mesmo com a recepção ocupada. Convênio, endereço, valores e dúvidas frequentes já respondidas.", owner: "auto" },
  { title: "Coleta de informações", detail: "Nome, procedimento ou especialidade, convênio ou particular, preferência de horário.", owner: "auto" },
  { title: "Agendamento", detail: "Horários disponíveis oferecidos na hora, integrados à agenda que a clínica já usa quando possível.", owner: "auto" },
  { title: "Confirmação e lembrete", detail: "Confirmação na véspera e lembrete no dia. Quem cancela abre espaço para a lista de espera.", owner: "auto" },
  { title: "Follow-up e reativação", detail: "Quem perguntou o preço e sumiu recebe novo contato. Quem não volta há meses é lembrado.", owner: "auto" },
  { title: "A recepção assume", detail: "Casos que pedem gente, dúvidas específicas e o acolhimento quando o paciente chega.", owner: "human" },
];

const flows: Record<string, Flow> = {
  novo: {
    label: "Paciente novo",
    contact: { name: "Renata Lima", meta: "paciente nova · WhatsApp", initials: "RL" },
    chat: [
      { at: 0, from: "them", text: "Bom dia! Vocês têm horário para avaliação esta semana? Atendem convênio?", time: "08:50" },
      { at: 1, from: "auto", text: "Bom dia, Renata! Atendemos sim, e também particular. Para avaliação temos quinta às 10h e sexta às 15h. Qual prefere?", time: "08:50" },
      { at: 2, from: "them", text: "Quinta às 10h. Convênio.", time: "08:53" },
      { at: 3, from: "auto", text: "Agendado: quinta, 10h, avaliação. Pode trazer carteirinha e documento. Confirmamos na véspera por aqui.", time: "08:53" },
      { at: 5, from: "human", text: "Renata, aqui é a Camila, da recepção. Qualquer dúvida antes da consulta, é só falar comigo.", time: "09:30" },
    ],
    record: {
      kind: "Paciente",
      title: "Renata Lima",
      fields: [
        { at: 1, label: "Origem", value: "WhatsApp" },
        { at: 2, label: "Atendimento", value: "Avaliação · convênio" },
        { at: 3, label: "Agendado", value: "quinta · 10h" },
        { at: 4, label: "Confirmação", value: "quarta · automática" },
        { at: 5, label: "Responsável", value: "Camila (recepção)" },
      ],
      stages: ["Novo", "Agendado", "Confirmado"],
      stageAt: [0, 3, 5],
    },
    log: [
      "Mensagem recebida · WhatsApp",
      "Resposta automática enviada · 3s",
      "Horários oferecidos",
      "Consulta agendada para quinta",
      "Confirmação programada para a véspera",
      "Camila assumiu o contato",
    ],
  },
  reativar: {
    label: "Reativação",
    contact: { name: "Paulo Andrade", meta: "última consulta há 7 meses", initials: "PA" },
    chat: [
      { at: 0, from: "auto", text: "Oi, Paulo! Aqui é da Clínica. Faz um tempinho desde a sua última consulta. Quer agendar um retorno? Temos horários na próxima semana.", time: "09:00" },
      { at: 2, from: "them", text: "Oi! Pode ser. Tem algo na terça de manhã?", time: "09:47" },
      { at: 3, from: "auto", text: "Tem sim: terça às 9h ou às 11h. Qual prefere?", time: "09:47" },
      { at: 4, from: "them", text: "9h.", time: "09:50" },
      { at: 5, from: "auto", text: "Agendado para terça às 9h. Te lembramos na véspera. Até lá!", time: "09:50" },
    ],
    record: {
      kind: "Paciente",
      title: "Paulo Andrade",
      fields: [
        { at: 0, label: "Último retorno", value: "há 7 meses" },
        { at: 0, label: "Reativação", value: "disparada hoje" },
        { at: 2, label: "Resposta", value: "quer terça de manhã" },
        { at: 5, label: "Agendado", value: "terça · 9h" },
        { at: 5, label: "Lembrete", value: "segunda · automático" },
      ],
      stages: ["Inativo", "Em contato", "Agendado"],
      stageAt: [0, 2, 5],
    },
    log: [
      "Paciente sem retorno há 7 meses",
      "Mensagem de reativação enviada",
      "Paulo respondeu: quer agendar",
      "Horários oferecidos",
      "Retorno agendado para terça",
      "Lembrete programado",
    ],
  },
};

const faq: QA[] = [
  {
    q: "A recepção vai ser substituída por um robô?",
    a: "Não. A automação cuida do que é repetitivo: a primeira resposta, as perguntas que se repetem todo dia, a confirmação e o lembrete. A recepção continua fazendo o que exige gente, com mais tempo para isso.",
  },
  {
    q: "Isso funciona com a agenda que a clínica já usa?",
    a: "Depende do sistema. Em muitos casos é possível integrar; em outros, o agendamento acontece de forma assistida e a recepção confirma. O diagnóstico mostra o que é viável com o que vocês já têm.",
  },
  {
    q: "Serve para consultório pequeno, com uma pessoa na recepção?",
    a: "É onde faz mais diferença. Quando uma pessoa só atende o balcão, o telefone e o WhatsApp ao mesmo tempo, sempre alguém fica esperando.",
  },
  {
    q: "E os dados dos pacientes?",
    a: "A automação coleta só o necessário para atender e agendar (nome, contato, especialidade, convênio), e esses dados ficam sob controle da clínica. O que é guardado, por quanto tempo e quem acessa é definido junto com você no projeto, respeitando a LGPD.",
  },
  {
    q: "Quanto custa?",
    a: "Cada projeto tem orçamento próprio, definido pelo volume de atendimento, pelos canais e pelo que precisa ser integrado. O diagnóstico gratuito é o ponto de partida para chegar a um valor realista.",
  },
];

export default function ClinicasPage() {
  return (
    <>
      <SegmentHero
        eyebrow="Para clínicas e consultórios"
        title={
          <>
            O paciente chamou. <span className="text-ember">A recepção estava ocupada.</span> Ele marcou em outro lugar.
          </>
        }
        text={
          <>
            <p className="text-fg">
              Clínicas médicas, odontológicas, de estética, fisioterapia, psicologia: qualquer consultório que vive de agenda perde
              paciente do mesmo jeito.
            </p>
            <p>
              Mensagem sem resposta, pergunta de preço que some, horário vazio porque alguém esqueceu. Nada disso é falta de cuidado.
              É a recepção fazendo três coisas ao mesmo tempo.
            </p>
          </>
        }
        cta="Quero melhorar meu atendimento"
        note="Diagnóstico sem custo: você conta como os pacientes chegam hoje, nós mostramos onde eles se perdem."
        scene={<ReceptionDesk />}
      />

      <SituationsDay
        index="01"
        label="Isso acontece na sua clínica?"
        title="Um dia normal na recepção. E os pacientes que ficaram pelo caminho."
        intro="A dor aqui não é clínica. É comercial e operacional: quem chamou e não foi atendido, quem perguntou e sumiu, o horário que ficou vazio."
        dayLabel="Um dia na recepção"
        items={situations}
        closing={
          <>
            Quantas pessoas perguntam o preço, somem e nunca recebem um novo contato?{" "}
            <span className="text-muted">Quantos horários ficam vazios por semana?</span>
          </>
        }
      />

      <Statement kicker="A ideia">
        A recepção continua humana onde precisa ser humana. <span className="text-sky">A automação cuida do repetitivo.</span>
      </Statement>

      <JourneySection
        index="02"
        title="Do primeiro contato até a cadeira, sem ninguém ficar sem resposta."
        intro={
          <>
            <p>Resposta inicial, informações, agendamento, confirmação e lembrete acontecem sozinhos, a qualquer hora.</p>
            <p className="text-fg">A recepção entra onde faz diferença: no acolhimento e nos casos que pedem gente.</p>
          </>
        }
        steps={steps}
        humanLabel="Recepção"
        flows={flows}
        flowHumanLabel="recepção"
        aside={
          <>
            <p className="text-[1.05rem] leading-relaxed text-muted">
              Uma paciente nova chama às 8h50, no horário de pico do balcão. Em segundos tem resposta, horários e agendamento. A
              recepção entra depois, com tudo pronto.
            </p>
            <p className="mt-5 text-[1.05rem] leading-relaxed text-fg">Veja também como um paciente antigo volta à agenda.</p>
          </>
        }
      />

      <Division
        index="03"
        title={
          <>
            O que pode ficar com a automação. <span className="text-muted">O que continua com a recepção.</span>
          </>
        }
        humanTitle="Continua com a recepção"
        auto={[
          { title: "Resposta inicial", text: "Retorno em segundos, com as dúvidas frequentes já respondidas." },
          { title: "Coleta de informações", text: "Nome, especialidade, convênio ou particular, preferência de horário." },
          { title: "Agendamento", text: "Horários oferecidos na hora, integrados à agenda quando possível." },
          { title: "Confirmação e lembrete", text: "Na véspera e no dia. Cancelamento abre espaço para a lista de espera." },
          { title: "Follow-up", text: "Quem perguntou o preço e sumiu recebe um novo contato." },
          { title: "Reativação", text: "Pacientes sem retorno há meses são lembrados de agendar." },
          { title: "Organização", text: "Cada contato registrado, com origem e situação, num só lugar." },
        ]}
        human={[
          { title: "O acolhimento", text: "Receber bem quem chega e perceber quando alguém precisa de atenção." },
          { title: "Casos específicos", text: "Dúvidas que fogem do roteiro, encaixes, situações delicadas." },
          { title: "A relação", text: "O paciente que volta porque foi bem tratado, não porque recebeu lembrete." },
          { title: "A decisão", text: "Prioridades da agenda e do atendimento, com os dados na mão." },
        ]}
        footnote="Nem toda clínica precisa de tudo isso. O que entra em cada projeto depende de como a operação funciona hoje: volume de contatos, agenda em uso, equipe na recepção. O diagnóstico define o que vale a pena."
      />

      <AnalysisBlock
        index="04"
        origem="clinicas"
        label="Diagnóstico gratuito"
        title={
          <>
            Descubra onde sua clínica está <span className="text-ember">perdendo pacientes.</span>
          </>
        }
        text="Você conta como os pacientes chegam e o que acontece quando a recepção não consegue responder. Nós mostramos onde estão os pontos de perda e o que resolver primeiro. Sem custo e sem compromisso."
        items={[
          "Por onde os pacientes chegam: WhatsApp, telefone, site, Instagram",
          "Quanto tempo esperam pela primeira resposta",
          "O que acontece com quem pergunta o preço e some",
          "Faltas, cancelamentos e horários vazios",
          "Perguntas que a recepção repete todos os dias",
          "Pacientes antigos que ninguém chamou de volta",
        ]}
        itemsTitle="O que olhamos"
        submitLabel="Quero melhorar meu atendimento"
      />

      <Faq items={faq} index="05" title="O que clínicas costumam perguntar." />

      <FinalCta
        title={
          <>
            Sua recepção não precisa atender tudo ao mesmo tempo. <span className="text-ember">Mas ninguém precisa ficar sem resposta.</span>
          </>
        }
        text="Descubra quantos pacientes sua clínica perde entre o primeiro contato e a consulta, e o que dá para resolver primeiro."
        primary={{ href: "#analise", label: "Quero melhorar meu atendimento" }}
      />
    </>
  );
}
