import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { ButtonLink } from "@/components/ui/button";
import { CaseShowcase } from "@/components/sections/case-showcase";
import { caseModules } from "@/lib/content";

const facts = [
  ["10", "módulos integrados em uma única plataforma"],
  ["1", "lugar só para clientes, contratos, cobranças e atendimento"],
  ["IA", "aplicada ao atendimento por WhatsApp e aos fluxos internos"],
];

export function Case() {
  return (
    <section className="relative overflow-hidden border-t border-line py-24 md:py-32" aria-labelledby="case-title">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel index="05" tone="signal">Projeto em destaque</SectionLabel>
            <h2 id="case-title" className="mt-6 text-h2 font-medium">
              Uma plataforma de gestão e atendimento, <span className="serif-accent text-muted">construída do zero.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5">
            <p className="text-lg leading-relaxed text-muted">
              CRM, portal do cliente, financeiro, pagamentos, contratos, WhatsApp e IA trabalhando juntos. O tipo de sistema que
              tira uma operação inteira de planilhas e mensagens soltas.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 md:mt-20">
          <CaseShowcase />
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <ul className="flex flex-wrap gap-2" aria-label="Módulos da plataforma">
              {caseModules.map((m) => (
                <li key={m} className="rounded-full border border-line-strong bg-white/[0.02] px-4 py-2 text-sm text-fg/85">
                  {m}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5">
            <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line">
              {facts.map(([n, t]) => (
                <div key={t} className="flex items-baseline gap-5 bg-ink-950 p-5">
                  <dt className="w-16 shrink-0 font-mono text-2xl text-signal">{n}</dt>
                  <dd className="text-muted">{t}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6">
              <ButtonLink href="/projetos" variant="secondary" arrow>
                Ver o projeto completo
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
