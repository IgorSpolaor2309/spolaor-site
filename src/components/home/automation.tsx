import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { ButtonLink } from "@/components/ui/button";
import { AutomationFlow } from "@/components/sections/automation-flow";
import { HiringVsAutomation } from "@/components/sections/hiring-vs-automation";

export function Automation() {
  return (
    <section className="relative overflow-hidden border-t border-line py-24 md:py-32" aria-labelledby="auto-title">
      <div aria-hidden className="absolute left-1/2 top-0 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgb(215_255_58/0.06),transparent_65%)]" />
      <div className="container-x relative">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-8">
            <SectionLabel index="03" tone="ember">Automação</SectionLabel>
            <h2 id="auto-title" className="mt-6 text-h2 font-medium">
              Quanto custa continuar fazendo <span className="serif-accent text-ember">à mão</span> o que poderia acontecer sozinho?
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-4">
            <p className="text-lg leading-relaxed text-muted">
              Automação não é abstrata. É o lead que recebe resposta em segundos, a cobrança que não depende de lembrança e o
              relatório que se monta sozinho.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-14">
          <AutomationFlow />
        </Reveal>

        <div className="mt-28 grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <h3 className="text-h3 font-medium">
              Antes de contratar mais uma pessoa, veja o que ainda pode ser automatizado.
            </h3>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5">
            <p className="text-muted">
              Pessoas são o ativo mais valioso da sua empresa. Por isso não faz sentido ocupá-las com trabalho que uma máquina
              faz melhor.
            </p>
          </Reveal>
        </div>
        <div className="mt-10">
          <HiringVsAutomation />
        </div>
        <Reveal className="mt-10 flex flex-col items-start justify-between gap-6 rounded-[28px] border border-line p-7 md:flex-row md:items-center md:p-8">
          <p className="max-w-2xl text-xl font-medium tracking-tight md:text-2xl">
            Não é sobre substituir pessoas. <span className="text-muted">É sobre não contratar gente para fazer trabalho de máquina.</span>
          </p>
          <ButtonLink href="/automacao" variant="secondary" arrow>
            Ver exemplos de automação
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}
