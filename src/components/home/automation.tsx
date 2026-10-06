import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { ButtonLink } from "@/components/ui/button";
import { AutomationFlow } from "@/components/sections/automation-flow";
import { HiringVsAutomation } from "@/components/sections/hiring-vs-automation";

export function Automation() {
  return (
    <section className="relative border-t border-line py-24 md:py-36" aria-labelledby="auto-title">
      <div className="container-x">
        <Reveal>
          <SectionLabel index="03" tone="signal">Automação</SectionLabel>
          <h2 id="auto-title" className="mt-8 max-w-[22ch] text-h2 font-semibold">
            Antes de aumentar sua equipe, veja o que ainda pode acontecer sozinho.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-3">
            <div className="lg:sticky lg:top-32">
              <p className="text-[1.05rem] leading-relaxed text-muted">
                Um pedido de orçamento chega às 9h41. Em 3 segundos o cliente tem resposta, o lead está no CRM e o vendedor
                certo já sabe com quem vai falar.
              </p>
              <p className="mt-5 text-[1.05rem] leading-relaxed text-fg">Ninguém precisou lembrar de nada.</p>
              <p className="mt-8 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">Demonstração · dados fictícios</p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-9">
            <AutomationFlow />
          </Reveal>
        </div>

        <div className="mt-32 grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <h3 className="font-[family-name:var(--font-display)] text-[1.7rem] font-light leading-[1.2] tracking-[-0.025em] md:text-[2.1rem]">
              Não é sobre substituir pessoas. É sobre não contratar gente para fazer trabalho de máquina.
            </h3>
            <div className="mt-8">
              <ButtonLink href="/automacao" variant="secondary" arrow>
                Ver exemplos de automação
              </ButtonLink>
            </div>
          </Reveal>
          <div className="lg:col-span-7 lg:col-start-6">
            <HiringVsAutomation />
          </div>
        </div>
      </div>
    </section>
  );
}
