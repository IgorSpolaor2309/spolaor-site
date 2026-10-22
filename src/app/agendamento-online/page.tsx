import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { SegmentHero } from "@/components/segment/segment-hero";
import { BookingScene } from "@/components/offers/scenes";
import { RequestSection } from "@/components/offers/request-section";
import { SituationsDay, type Situation } from "@/components/segment/situations-day";
import { Chat, Reminders, Schedule } from "@/components/segment/artifacts";
import { Division, JourneySection, Statement } from "@/components/segment/sections";
import type { JourneyStep } from "@/components/segment/journey";
import type { Flow } from "@/components/sections/automation-flow";
import { ContactForm } from "@/components/forms/contact-form";
import { Faq, type QA } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import { leadsAvailable } from "@/lib/leads/server/pipeline";

export const metadata: Metadata = {
  title: "Agendamento online para prestadores de serviço",
  description:
    "Seu cliente escolhe o serviço e o horário, recebe a confirmação e os lembretes, e você para de agendar por mensagem. Para profissionais e negócios que atendem com hora marcada: beleza, bem-estar, aulas, consultoria, serviços técnicos e mais. Peça um orçamento.",
  alternates: { canonical: "/agendamento-online" },
  openGraph: { title: "Agendamento online: o cliente escolhe o horário sem esperar resposta", url: "/agendamento-online" },
};

const situations: Situation[] = [
  {
    time: "Segunda",
    where: "entre um atendimento e outro",
    text: "“Tem horário na quinta?”. Você responde com três opções, ele escolhe uma, você confirma, ele agradece.",
    outcome: "Seis mensagens para marcar um horário.",
    artifact: (
      <Chat
        lines={[
          { from: "them", text: "Tem horário na quinta à tarde?", meta: "13:05" },
          { from: "me", text: "Tenho 14h ou 16h. Qual prefere?", meta: "14:30" },
          { from: "them", text: "16h! Ah, pode ser 15h?", meta: "14:41" },
        ]}
        footer="e a conversa continua"
      />
    ),
  },
  {
    time: "Terça",
    where: "esperando o cliente",
    text: "O horário das 10h chegou e o cliente não apareceu. Ninguém lembrou de avisar, e ele também esqueceu.",
    outcome: "Uma hora de trabalho que não volta.",
    artifact: (
      <Schedule
        slots={[
          { time: "09:00", who: "Atendido", state: "ok" },
          { time: "10:00", who: "Não veio · sem lembrete", state: "empty" },
          { time: "11:00", who: "Atendido", state: "ok" },
        ]}
        note="sem confirmação nem lembrete"
      />
    ),
  },
  {
    time: "Quarta",
    where: "na agenda de papel",
    text: "Dois clientes marcados para o mesmo horário. A agenda está no caderno, no celular e na cabeça.",
    outcome: "Um deles vai ficar chateado.",
    artifact: (
      <Reminders
        items={[
          { text: "Conferir agenda de quinta", lost: true },
          { text: "Responder pedido de remarcação", lost: true },
          { text: "Confirmar clientes de amanhã", lost: true },
          { text: "Atender 15h", done: true },
        ]}
        note="três lugares, nenhum atualizado"
      />
    ),
  },
  {
    time: "Quinta",
    where: "à noite, fora do expediente",
    text: "Alguém quer marcar às 21h. Ninguém responde até amanhã, e ele escolhe quem tiver horário disponível agora.",
    outcome: "O cliente quer marcar quando ele pode, não quando você responde.",
    artifact: (
      <Chat
        lines={[
          { from: "them", text: "Boa noite! Quero marcar uma sessão, qual o próximo horário?", meta: "21:10" },
          { from: "me", text: "Bom dia! Temos sexta às 10h.", meta: "08:20" },
          { from: "them", text: "Já marquei em outro lugar, obrigado.", meta: "08:35" },
        ]}
      />
    ),
  },
];

const steps: JourneyStep[] = [
  { title: "O cliente abre o link", detail: "No Instagram, no WhatsApp ou no Google, a qualquer hora, direto do celular.", owner: "auto" },
  { title: "Escolhe o serviço", detail: "Cada serviço com duração, descrição e, se quiser, o profissional.", owner: "auto" },
  { title: "Escolhe o horário", detail: "Só aparecem horários livres, de acordo com a sua agenda e as suas regras.", owner: "auto" },
  { title: "Confirma", detail: "Recebe a confirmação na hora, e o horário já fica registrado para você.", owner: "auto" },
  { title: "Recebe lembretes", detail: "Aviso na véspera e no dia. Se não puder ir, remarca pelo mesmo caminho.", owner: "auto" },
  { title: "Você atende", detail: "Chega ao horário com o cliente, o serviço e a observação na tela.", owner: "human" },
];

const flows: Record<string, Flow> = {
  marcar: {
    label: "Cliente marca",
    contact: { name: "Cliente exemplo", meta: "agendou pelo link", initials: "CE" },
    chat: [
      { at: 0, from: "auto", text: "Horário agendado: sessão, quinta às 16h. Para remarcar, é só usar o link desta mensagem.", time: "21:10" },
      { at: 3, from: "auto", text: "Lembrete: sua sessão é amanhã, às 16h. Confirma presença?", time: "quarta · 10:00" },
      { at: 4, from: "them", text: "Confirmo!", time: "quarta · 10:12" },
      { at: 5, from: "human", text: "Até amanhã! Pode chegar 5 minutos antes.", time: "quarta · 10:20" },
    ],
    record: {
      kind: "Agendamento",
      title: "Quinta · 16h · cliente exemplo",
      fields: [
        { at: 0, label: "Serviço", value: "Sessão" },
        { at: 0, label: "Origem", value: "link do Instagram" },
        { at: 1, label: "Horário", value: "quinta, 16h" },
        { at: 3, label: "Lembrete", value: "enviado na véspera" },
        { at: 4, label: "Presença", value: "confirmada" },
      ],
      stages: ["Agendado", "Lembrado", "Confirmado"],
      stageAt: [0, 3, 4],
    },
    log: [
      "Cliente escolheu serviço e horário",
      "Horário reservado na agenda",
      "Confirmação enviada ao cliente",
      "Lembrete enviado na véspera",
      "Cliente confirmou presença",
      "Profissional avisado do dia",
    ],
  },
  remarcar: {
    label: "Remarcação",
    contact: { name: "Cliente exemplo", meta: "pediu para remarcar", initials: "CE" },
    chat: [
      { at: 0, from: "them", text: "Preciso remarcar a sessão de quinta.", time: "quarta · 08:15" },
      { at: 1, from: "auto", text: "Sem problema! Estes são os próximos horários livres: sexta 10h, sexta 15h, segunda 9h.", time: "quarta · 08:15" },
      { at: 2, from: "them", text: "Sexta 10h.", time: "quarta · 08:17" },
      { at: 3, from: "auto", text: "Remarcado para sexta às 10h. O horário de quinta foi liberado.", time: "quarta · 08:17" },
    ],
    record: {
      kind: "Agendamento",
      title: "Remarcado · cliente exemplo",
      fields: [
        { at: 0, label: "Pedido", value: "remarcar quinta 16h" },
        { at: 1, label: "Opções", value: "3 horários livres" },
        { at: 2, label: "Escolha", value: "sexta, 10h" },
        { at: 3, label: "Quinta 16h", value: "liberado na agenda" },
        { at: 4, label: "Lembrete", value: "reprogramado" },
      ],
      stages: ["Pedido", "Opções", "Remarcado"],
      stageAt: [0, 1, 3],
    },
    log: [
      "Pedido de remarcação recebido",
      "Horários livres oferecidos",
      "Cliente escolheu novo horário",
      "Agenda atualizada e horário antigo liberado",
      "Lembrete reprogramado",
      "Profissional avisado da mudança",
    ],
  },
};

const faq: QA[] = [
  {
    q: "Para quais tipos de negócio serve?",
    a: "Para quem atende com hora marcada: profissionais de beleza e bem-estar, personal trainers, professores, fotógrafos, consultores, técnicos de manutenção, entre outros. Para clínicas e consultórios, temos uma página específica com as particularidades do segmento.",
  },
  {
    q: "O cliente precisa baixar um aplicativo?",
    a: "Não. O agendamento funciona por um link, aberto no navegador do celular, que você divulga no Instagram, no WhatsApp ou no Google.",
  },
  {
    q: "Dá para integrar com a agenda que eu já uso?",
    a: "Depende da ferramenta. Em muitos casos é possível; em outros, a agenda nova passa a ser a principal. O que vale a pena entra no escopo depois que entendemos como você trabalha hoje.",
  },
  {
    q: "Os lembretes são enviados por onde?",
    a: "Pelo canal definido no projeto, como WhatsApp ou e-mail, conforme a disponibilidade e as regras de cada canal. Esse formato é combinado antes de começar.",
  },
  {
    q: "Dá para cobrar na hora de marcar?",
    a: "Pode ser previsto no projeto, com um provedor de pagamento, para serviços em que isso faz sentido. Não é obrigatório, e os custos do provedor são separados do nosso trabalho.",
  },
  {
    q: "Quanto custa?",
    a: "Cada projeto tem orçamento próprio, definido pelo número de serviços, profissionais, regras de agenda e integrações. O formulário desta página é o caminho para chegar a um valor realista.",
  },
];

export default function AgendamentoOnlinePage() {
  return (
    <>
      <SegmentHero
        eyebrow="Agendamento online"
        title={
          <>
            Seu cliente quer marcar horário. <span className="text-ember">Quanto tempo ele espera por resposta?</span>
          </>
        }
        text={
          <>
            <p className="text-fg">
              Com agendamento online, o cliente escolhe o serviço e o horário livre, recebe a confirmação e os lembretes, e você
              para de marcar por mensagem.
            </p>
            <p>
              Para profissionais e negócios que atendem com hora marcada, além de clínicas. Para clínicas e consultórios, veja a{" "}
              <Link href="/clinicas" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                página específica
              </Link>
              .
            </p>
          </>
        }
        cta="Quero agendamento online"
        ctaHref="#formulario"
        secondary={{ href: "#como-funciona", label: "Ver como funciona" }}
        note="Orçamento personalizado, sem tabela de preços. Você conta como agenda hoje e respondemos com escopo e prazo."
        scene={<BookingScene />}
      />

      <SituationsDay
        index="01"
        label="Marcar por mensagem"
        title="Uma semana de agenda feita à mão."
        intro="Ida e volta para achar um horário, falta sem aviso, conflito na agenda e cliente que desiste porque ninguém respondeu a tempo."
        dayLabel="Uma semana"
        scale={["segunda", "quinta"]}
        items={situations}
        closing={
          <>
            Quantos horários da sua semana ficaram vazios por falta de lembrete? <span className="text-muted">E quantos clientes escolheram outro lugar porque eles marcaram mais rápido?</span>
          </>
        }
      />

      <Statement kicker="A ideia">
        Quem atende não precisa ser também a secretária. <span className="text-sky">O cliente marca sozinho, e você cuida do atendimento.</span>
      </Statement>

      <JourneySection
        index="02"
        title="Da escolha do horário à chegada do cliente."
        intro={
          <>
            <p>Escolha, confirmação e lembretes acontecem sozinhos, a qualquer hora, sem você parar o atendimento.</p>
            <p className="text-fg">Você entra para atender.</p>
          </>
        }
        steps={steps}
        humanLabel="Você"
        flows={flows}
        flowHumanLabel="você"
        aside={
          <p className="text-[1.05rem] leading-relaxed text-muted">
            O cliente marca às 21h, recebe a confirmação na hora e o lembrete na véspera. Se precisar remarcar, escolhe outro
            horário livre sem falar com você.
          </p>
        }
      />

      <Division
        index="03"
        title={
          <>
            O que pode entrar no agendamento. <span className="text-muted">Conforme a sua rotina.</span>
          </>
        }
        autoTitle="Pode entrar no projeto"
        humanTitle="Continua com você"
        auto={[
          { title: "Escolha do serviço", text: "Cada serviço com duração, descrição e profissional, se houver mais de um." },
          { title: "Horários livres", text: "O cliente só vê o que está disponível, de acordo com as suas regras de agenda." },
          { title: "Confirmação", text: "Mensagem de horário marcado, com o caminho para remarcar ou cancelar." },
          { title: "Lembretes", text: "Aviso na véspera e no dia, pelo canal definido no projeto." },
          { title: "Remarcação", text: "O cliente escolhe outro horário livre, e o antigo volta para a agenda." },
          { title: "Registro", text: "Cada agendamento com cliente, serviço e origem, num só lugar." },
        ]}
        human={[
          { title: "O atendimento", text: "O serviço em si, que é o que o cliente veio buscar." },
          { title: "As regras", text: "Quanto tempo, quando atende, quando abre exceção." },
          { title: "O relacionamento", text: "A conversa que faz o cliente voltar." },
          { title: "Os casos fora do padrão", text: "Encaixes e situações que pedem decisão." },
        ]}
        footnote="Cada negócio tem regras próprias de agenda. O que entra no projeto, como integração com a agenda atual, pagamento antecipado e canais de lembrete, é definido no orçamento."
      />

      <RequestSection
        index="04"
        label="Orçamento"
        title={
          <>
            Quer que o cliente marque sozinho? <span className="text-sky">Conte como você atende.</span>
          </>
        }
        text="Diga que serviços você oferece e como organiza a agenda hoje. Respondemos com perguntas, se faltar algo, e depois com escopo, prazo e investimento."
        steps={["Você conta como atende e agenda hoje", "Tiramos dúvidas pelo WhatsApp, se for preciso", "Você recebe o orçamento com escopo e prazo"]}
        note={
          <>
            Tem clínica ou consultório?{" "}
            <Link href="/clinicas" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              Veja a página para clínicas
            </Link>
            .
          </>
        }
      >
        <Suspense fallback={<div className="h-[720px] rounded-[16px] border border-line bg-ink-900" />}>
          <ContactForm
            origem="agendamento-online"
            interests={["Beleza e bem-estar", "Aulas ou treinos", "Consultoria ou serviços profissionais", "Serviços técnicos", "Outro tipo de atendimento"]}
            interestsLabel="Que tipo de atendimento você oferece?"
            messageLabel="Quais serviços você oferece e como agenda hoje"
            submitLabel="Quero agendamento online"
            formLabel="Pedir orçamento de agendamento online"
            available={leadsAvailable()}
          />
        </Suspense>
      </RequestSection>

      <Faq items={faq} index="05" title="O que costumam perguntar sobre agendamento online." />

      <FinalCta
        title={
          <>
            O cliente quer marcar agora. <span className="text-ember">Deixe que ele escolha o horário sozinho.</span>
          </>
        }
        text="Conte como você atende hoje e receba o orçamento do seu agendamento online."
        primary={{ href: "#formulario", label: "Quero agendamento online" }}
        secondary={{ href: "/clinicas", label: "Tenho clínica ou consultório" }}
      />
    </>
  );
}
