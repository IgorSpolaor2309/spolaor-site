import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { AutomationFlow, type Flow } from "@/components/sections/automation-flow";
import { Journey, type JourneyStep } from "./journey";

/** Uma pergunta grande, sozinha na tela, e a resposta curta embaixo. Momento de respiro. */
export function Statement({ kicker, children, answer }: { kicker?: string; children: React.ReactNode; answer?: React.ReactNode }) {
  return (
    <section className="relative border-t border-line py-28 md:py-40">
      <div className="container-x">
        {kicker && (
          <Reveal>
            <p className="eyebrow">{kicker}</p>
          </Reveal>
        )}
        <Reveal delay={0.05}>
          <p className="mt-8 max-w-[22ch] font-[family-name:var(--font-display)] text-[clamp(2rem,1.1rem+3.4vw,4.2rem)] font-light leading-[1.08] tracking-[-0.035em]">
            {children}
          </p>
        </Reveal>
        {answer && (
          <Reveal delay={0.12} className="mt-10 max-w-2xl">
            <div className="grid gap-4 text-lg leading-relaxed text-muted">{answer}</div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/** A jornada de um contato + a demonstração da conversa e do registro, com dados fictícios. */
export function JourneySection({
  index,
  title,
  intro,
  steps,
  humanLabel,
  flows,
  flowHumanLabel,
  aside,
}: {
  index?: string;
  title: React.ReactNode;
  intro: React.ReactNode;
  steps: JourneyStep[];
  humanLabel?: string;
  flows: Record<string, Flow>;
  flowHumanLabel?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section id="como-funciona" className="relative border-t border-line py-24 md:py-32" aria-labelledby="journey-title">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <SectionLabel index={index} tone="signal">
              Como funciona
            </SectionLabel>
            <h2 id="journey-title" className="mt-8 text-h2 font-semibold">
              {title}
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <div className="grid gap-4 text-[1.05rem] leading-relaxed text-muted">{intro}</div>
          </Reveal>
        </div>

        <div className="mt-16">
          <Journey steps={steps} humanLabel={humanLabel} />
        </div>

        <div className="mt-20 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-3">
            <div className="lg:sticky lg:top-32">
              {aside}
              <p className="mt-8 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">Demonstração · dados fictícios</p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-9">
            <AutomationFlow flows={flows} humanLabel={flowHumanLabel} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/**
 * Quem faz o quê: o que pode ficar com a automação e o que continua com as pessoas.
 * Lista editorial em duas colunas, sem cards. O rodapé deixa claro que nada é pacote fechado.
 */
export function Division({
  index,
  title,
  autoTitle = "A automação pode cuidar",
  humanTitle,
  auto,
  human,
  footnote,
}: {
  index?: string;
  title: React.ReactNode;
  autoTitle?: string;
  humanTitle: string;
  auto: { title: string; text: string }[];
  human: { title: string; text: string }[];
  footnote?: string;
}) {
  return (
    <section className="relative border-t border-line py-24 md:py-32" aria-labelledby="division-title">
      <div className="container-x">
        <Reveal className="max-w-4xl">
          <SectionLabel index={index}>Quem faz o quê</SectionLabel>
          <h2 id="division-title" className="mt-8 text-h2 font-semibold">
            {title}
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-14 lg:grid-cols-2 lg:gap-0">
          {[
            { head: autoTitle, items: auto, tone: "text-signal", cls: "lg:pr-14" },
            { head: humanTitle, items: human, tone: "text-fg", cls: "lg:border-l lg:border-line lg:pl-14" },
          ].map((col, c) => (
            <Reveal key={col.head} delay={c * 0.08} className={col.cls}>
              <p className={`font-mono text-[0.7rem] uppercase tracking-[0.14em] ${col.tone}`}>{col.head}</p>
              <ul className="mt-6 border-t border-line-strong">
                {col.items.map((it) => (
                  <li key={it.title} className="grid gap-1 border-b border-line py-4 md:grid-cols-[13rem_1fr] md:gap-6">
                    <span className="font-semibold">{it.title}</span>
                    <span className="text-[0.95rem] leading-relaxed text-muted">{it.text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
        {footnote && (
          <Reveal className="mt-10">
            <p className="max-w-2xl text-sm leading-relaxed text-dim">{footnote}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
