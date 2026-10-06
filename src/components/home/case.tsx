import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { ButtonLink } from "@/components/ui/button";
import { CaseShowcase } from "@/components/sections/case-showcase";
import { caseModules } from "@/lib/content";

const facts = [
  ["10", "módulos numa única plataforma, no lugar de planilhas e mensagens soltas"],
  ["1", "lugar para clientes, contratos, cobranças e atendimento"],
  ["IA", "respondendo no WhatsApp e organizando fluxos internos"],
];

export function Case() {
  return (
    <section className="relative overflow-hidden border-t border-line py-24 md:py-36" aria-labelledby="case-title">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-9">
            <SectionLabel index="05" tone="signal">Projeto em destaque</SectionLabel>
            <h2 id="case-title" className="mt-8 text-h2 font-semibold">
              Uma operação inteira que saiu das planilhas.
            </h2>
            <p className="mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-muted">
              Plataforma de gestão e atendimento construída do zero: {caseModules.slice(0, -1).join(", ").toLowerCase()} e{" "}
              {caseModules[caseModules.length - 1].toLowerCase()}, trabalhando juntos.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 md:mt-20">
          <CaseShowcase />
        </div>

        <div className="mt-16 grid gap-10 border-t border-line pt-10 md:grid-cols-3 md:gap-8">
          {facts.map(([n, t], i) => (
            <Reveal key={t} delay={i * 0.06}>
              <p className="font-[family-name:var(--font-display)] text-5xl font-light tracking-[-0.04em] text-signal">{n}</p>
              <p className="mt-3 max-w-[28ch] text-muted">{t}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-12">
          <ButtonLink href="/projetos" variant="secondary" arrow>
            Ver o projeto completo
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}
