import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/sections/page-hero";
import { ManualTasksDemo } from "@/components/home/leak-demos";
import { AutomationFlow } from "@/components/sections/automation-flow";
import { HiringVsAutomation } from "@/components/sections/hiring-vs-automation";
import { ManualCost } from "@/components/sections/manual-cost";
import { FeatureGrid, SectionIntro } from "@/components/sections/feature-grid";
import { SectionLabel } from "@/components/ui/section-label";
import { Reveal } from "@/components/ui/reveal";
import { Faq, type QA } from "@/components/sections/faq";
import { AnalysisBlock } from "@/components/sections/analysis-block";

export const metadata: Metadata = {
  title: "Automação de processos",
  description:
    "Menos tarefa manual e atendimentos acompanhados até o fim: orçamentos que não ficam sem retorno, informações coletadas no primeiro atendimento e dados preenchidos uma vez só. Peça um diagnóstico do seu processo.",
  alternates: { canonical: "/automacao" },
};

// O que melhora no trabalho, não a ferramenta usada. Cada item é uma entrega que já fazemos.
const areas = [
  {
    tag: "Orçamentos",
    title: "Nenhum orçamento esquecido",
    text: "Os orçamentos enviados ficam numa lista com data e responsável. Quando o cliente não responde, a equipe recebe um lembrete para fazer o segundo contato.",
  },
  {
    tag: "Primeiro atendimento",
    title: "As informações certas desde o início",
    text: "Quem chama já responde o básico (o que precisa, onde, para quando) e a equipe assume a conversa sabendo do que se trata.",
  },
  {
    tag: "Retrabalho",
    title: "Preencher uma vez só",
    text: "O que o cliente informou no formulário ou no WhatsApp vai para a planilha ou o sistema da empresa, sem alguém redigitar.",
  },
  {
    tag: "Acompanhamento",
    title: "Cada atendimento com dono",
    text: "Em que etapa está, quem está cuidando e qual é o próximo passo, num lugar só, sem depender da memória de ninguém.",
  },
  {
    tag: "Avisos",
    title: "Lembretes na hora certa",
    text: "Confirmação de horário, documento pendente, retorno combinado: o aviso sai sozinho para o cliente ou para a equipe.",
  },
  {
    tag: "Visão da semana",
    title: "Saber o que está parado",
    text: "Quantos pedidos chegaram, quantos foram respondidos e quais estão esperando alguém, sem montar relatório à mão.",
  },
];

const steps = [
  ["Mapear", "Entendemos como o trabalho acontece hoje, passo a passo."],
  ["Priorizar", "Começamos pelo que mais consome tempo ou gera erro."],
  ["Construir", "Automações sob medida, aproveitando as ferramentas que você já usa quando possível."],
  ["Validar com a equipe", "Ajustamos com quem vai usar no dia a dia."],
  ["Acompanhar", "Monitoramos e evoluímos conforme a empresa cresce."],
];

const faq: QA[] = [
  {
    q: "Preciso fazer o diagnóstico antes de contratar?",
    a: "Não. O diagnóstico é para quem sente o problema mas ainda não sabe o que automatizar. Se você já sabe o que quer, fale direto sobre o projeto e seguimos para o orçamento.",
  },
  {
    q: "Vocês garantem quanto vou vender a mais?",
    a: "Não. A automação garante que pedidos e retornos não dependam de alguém lembrar; o resultado comercial depende também do seu produto, preço e atendimento. No diagnóstico mostramos o que dá para melhorar e o que não depende de tecnologia.",
  },
  {
    q: "A automação vai substituir minha equipe?",
    a: "Não é esse o objetivo. Ela tira das pessoas o trabalho repetitivo para que elas foquem no que exige gente: atender bem, negociar e decidir.",
  },
  {
    q: "Preciso trocar os sistemas que já uso?",
    a: "Na maioria dos casos, não. Aproveitamos o que sua empresa já usa sempre que possível. Quando algo realmente atrapalha, explicamos o porquê antes de sugerir qualquer troca.",
  },
  {
    q: "O cliente vai falar com um robô?",
    a: "Só onde fizer sentido, como na confirmação de um pedido ou na coleta das informações básicas. A conversa de verdade continua com a sua equipe, que pode assumir a qualquer momento.",
  },
  {
    q: "Quanto custa automatizar um processo?",
    a: "Depende do processo, das ferramentas envolvidas e do volume. Cada projeto tem orçamento próprio, definido depois do diagnóstico ou da conversa sobre o projeto.",
  },
];

export default function AutomacaoPage() {
  return (
    <>
      <PageHero
        aside={<div className="rounded-[16px] border border-line bg-ink-900/80 p-4 backdrop-blur md:p-6"><ManualTasksDemo /></div>}
        eyebrow="Automação"
        title={
          <>
            Menos tarefa manual. <span className="serif-accent text-ember">Mais atendimentos acompanhados até o fim.</span>
          </>
        }
        text="Para empresas que querem reduzir tarefas manuais, organizar informações e acompanhar atendimentos e oportunidades comerciais. Começamos entendendo o seu processo e automatizamos só o que faz diferença nele."
        primary={{ href: "#analise", label: "Pedir diagnóstico do processo" }}
        secondary={{ href: "/contato?interesse=Automação", label: "Já sei o que quero automatizar" }}
      />

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="flow-title">
        <div className="container-x">
          <SectionIntro
            id="flow-title"
            label={<SectionLabel index="01" tone="signal">Na prática</SectionLabel>}
            title={<>Automação concreta, <span className="serif-accent text-muted">não abstrata.</span></>}
            text="Dois exemplos ilustrativos, com dados fictícios: um comercial, outro operacional. As etapas que hoje dependem de alguém lembrar acontecem sozinhas, e a equipe assume onde precisa de gente."
          />
          <Reveal className="mt-14">
            <AutomationFlow />
          </Reveal>
        </div>
      </section>

      <section id="calculadora" className="scroll-mt-24 border-t border-line py-24 md:py-32" aria-labelledby="calc-title">
        <div className="container-x">
          <SectionIntro
            id="calc-title"
            label={<SectionLabel index="02" tone="ember">O custo invisível</SectionLabel>}
            title={<>Quanto o trabalho manual <span className="serif-accent text-ember">custa por ano?</span></>}
            text="Ajuste os valores para a realidade da sua empresa."
          />
          <Reveal className="mt-14">
            <ManualCost />
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="areas-title">
        <div className="container-x">
          <SectionIntro
            id="areas-title"
            label={<SectionLabel index="03">O que entregamos</SectionLabel>}
            title={<>O que muda <span className="serif-accent text-muted">no dia a dia da equipe.</span></>}
          />
          <div className="mt-14">
            <FeatureGrid items={areas} />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="hire-title">
        <div className="container-x">
          <SectionIntro
            id="hire-title"
            label={<SectionLabel index="04">Antes de contratar</SectionLabel>}
            title={<>Não é sobre substituir pessoas. <span className="serif-accent text-muted">É sobre não contratar gente para fazer trabalho de máquina.</span></>}
          />
          <div className="mt-14">
            <HiringVsAutomation />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="impl-title">
        <div className="container-x">
          <SectionIntro id="impl-title" label={<SectionLabel index="05">Como implantamos</SectionLabel>} title="Do processo atual à rotina automatizada." />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[16px] border border-line bg-line md:grid-cols-5">
            {steps.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 0.06} className="bg-ink-950 p-6">
                <span className="font-mono text-xs text-signal">0{i + 1}</span>
                <p className="mt-5 text-lg font-medium">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <AnalysisBlock
        index="06"
        origem="automacao"
        label="Diagnóstico do processo"
        title={
          <>
            Descubra o que vale <span className="text-ember">automatizar primeiro.</span>
          </>
        }
        text="Você conta como os pedidos chegam e o que a equipe faz à mão. Mostramos onde a automação ajuda, onde não compensa e o que resolver primeiro. Sem custo e sem compromisso."
        items={[
          "Como os pedidos e contatos chegam",
          "Quais informações a equipe pede e anota em cada atendimento",
          "Onde os mesmos dados são digitados mais de uma vez",
          "O que acontece com um orçamento depois de enviado",
          "Como a equipe sabe o que está pendente",
        ]}
        itemsTitle="O que olhamos no processo"
        submitLabel="Pedir diagnóstico do processo"
        note={
          <>
            Já sabe o que quer automatizar?{" "}
            <Link href="/contato?interesse=Automação" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              Fale direto sobre o projeto
            </Link>
            .
          </>
        }
      />
      <Faq items={faq} index="07" />
    </>
  );
}
