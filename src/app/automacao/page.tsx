import type { Metadata } from "next";
import { PageHero } from "@/components/sections/page-hero";
import { ManualTasksDemo } from "@/components/home/leak-demos";
import { AutomationFlow } from "@/components/sections/automation-flow";
import { HiringVsAutomation } from "@/components/sections/hiring-vs-automation";
import { ManualCost } from "@/components/sections/manual-cost";
import { FeatureGrid, SectionIntro } from "@/components/sections/feature-grid";
import { SectionLabel } from "@/components/ui/section-label";
import { Reveal } from "@/components/ui/reveal";
import { Faq, type QA } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

export const metadata: Metadata = {
  title: "Automação de processos",
  description:
    "Automações de atendimento, comerciais e administrativas, integrações, APIs e IA aplicada aos processos. Faça sua equipe produzir mais sem aumentar a estrutura na mesma proporção.",
  alternates: { canonical: "/automacao" },
};

const areas = [
  { tag: "Atendimento", title: "Respostas que não esperam", text: "Primeiro atendimento no WhatsApp, triagem, agendamentos e encaminhamento para a pessoa certa." },
  { tag: "Comercial", title: "Nenhum lead esquecido", text: "Captação, registro no CRM, follow-up automático e alertas quando uma oportunidade esfria." },
  { tag: "Financeiro", title: "Cobrança sem constrangimento", text: "Lembretes de vencimento, segunda via, confirmação de pagamento e conciliação." },
  { tag: "Administrativo", title: "Papelada que se organiza", text: "Documentos classificados, contratos gerados, status atualizados e relatórios prontos." },
  { tag: "Integrações", title: "Ferramentas que conversam", text: "APIs conectando sistemas, planilhas, ERPs e plataformas que hoje exigem copiar e colar." },
  { tag: "IA", title: "Inteligência dentro do processo", text: "Classificar, resumir, extrair dados e responder com contexto, sempre com supervisão da equipe." },
];

const steps = [
  ["Mapear", "Entendemos como o trabalho acontece hoje, passo a passo."],
  ["Priorizar", "Começamos pelo que mais consome tempo ou gera erro."],
  ["Construir", "Automações sob medida, integradas às ferramentas que você já usa."],
  ["Validar com a equipe", "Ajustamos com quem vai usar no dia a dia."],
  ["Acompanhar", "Monitoramos e evoluímos conforme a empresa cresce."],
];

const faq: QA[] = [
  {
    q: "A automação vai substituir minha equipe?",
    a: "Não é esse o objetivo. Ela tira das pessoas o trabalho repetitivo para que elas foquem no que exige gente: atender bem, negociar e decidir.",
  },
  {
    q: "Preciso trocar os sistemas que já uso?",
    a: "Na maioria dos casos, não. Integramos as ferramentas que sua empresa já usa. Quando algo realmente atrapalha, explicamos o porquê antes de sugerir qualquer troca.",
  },
  {
    q: "A IA responde clientes sozinha?",
    a: "Pode responder dúvidas frequentes e organizar informações, sempre com regras claras e com a equipe podendo assumir a conversa a qualquer momento.",
  },
  {
    q: "Quanto custa automatizar um processo?",
    a: "Depende do processo, das integrações e do volume. Cada projeto tem orçamento personalizado, definido depois do diagnóstico.",
  },
];

export default function AutomacaoPage() {
  return (
    <>
      <PageHero
        aside={<div className="rounded-[28px] border border-line bg-ink-900/80 p-4 backdrop-blur md:p-6"><ManualTasksDemo /></div>}
        eyebrow="Automação"
        title={
          <>
            Quanto custa continuar fazendo à mão <span className="serif-accent text-ember">o que poderia acontecer sozinho?</span>
          </>
        }
        text="Faça sua equipe produzir mais sem aumentar a estrutura na mesma proporção. Antes de contratar mais uma pessoa, veja o que ainda pode ser automatizado."
        primary={{ href: "/contato?interesse=Automação", label: "Falar sobre automação" }}
        secondary={{ href: "#calculadora", label: "Calcular o custo do manual" }}
      />

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="flow-title">
        <div className="container-x">
          <SectionIntro
            id="flow-title"
            label={<SectionLabel index="01" tone="signal">Na prática</SectionLabel>}
            title={<>Automação concreta, <span className="serif-accent text-muted">não abstrata.</span></>}
            text="Veja dois fluxos comuns funcionando: um comercial, outro operacional. Cada etapa que hoje depende de alguém lembrar, acontece sozinha."
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
            label={<SectionLabel index="03">Onde atuamos</SectionLabel>}
            title={<>Onde a automação <span className="serif-accent text-muted">devolve horas.</span></>}
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
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[28px] border border-line bg-line md:grid-cols-5">
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

      <Faq items={faq} index="06" />
      <FinalCta
        title={
          <>
            Antes de contratar mais uma pessoa, <span className="serif-accent text-signal">descubra o que ainda é feito à mão.</span>
          </>
        }
        text="Conte como sua operação funciona hoje. Mostramos onde a automação traz retorno mais rápido."
      />
    </>
  );
}
