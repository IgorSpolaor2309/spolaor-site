import { Reveal } from "@/components/ui/reveal";

// A jornada de um contato, etapa por etapa, com o dono de cada uma: a automação cuida do que é
// repetitivo e entrega a conversa para a pessoa no momento em que a habilidade humana importa.

export type JourneyStep = { title: string; detail: string; owner: "auto" | "human" };

export function Journey({ steps, humanLabel = "Você" }: { steps: JourneyStep[]; humanLabel?: string }) {
  const handoff = steps.findIndex((s) => s.owner === "human");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8rem] text-muted" aria-hidden>
        <span className="flex items-center gap-2">
          <span className="h-[3px] w-6 rounded-full bg-signal" /> Automático
        </span>
        <span className="flex items-center gap-2">
          <span className="h-[3px] w-6 rounded-full bg-fg" /> {humanLabel}
        </span>
      </div>

      <ol className="relative mt-8 grid gap-0 lg:mt-12 lg:grid-flow-col lg:auto-cols-fr">
        {steps.map((s, i) => {
          const auto = s.owner === "auto";
          const isHandoff = i === handoff;
          return (
            <Reveal
              as="li"
              key={s.title}
              delay={i * 0.09}
              className="relative grid grid-cols-[1.75rem_1fr] gap-4 pb-8 lg:block lg:pb-0 lg:pr-5"
            >
              {/* trilho */}
              <span
                aria-hidden
                className={`absolute left-[13px] top-7 bottom-0 w-[3px] lg:left-7 lg:right-0 lg:top-[13px] lg:bottom-auto lg:h-[3px] lg:w-auto ${
                  i === steps.length - 1 ? "hidden" : auto && steps[i + 1]?.owner === "auto" ? "bg-signal" : auto ? "bg-gradient-to-b from-signal to-fg lg:bg-gradient-to-r" : "bg-fg"
                }`}
              />
              <span
                aria-hidden
                className={`relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 font-mono text-[0.66rem] ${
                  auto ? "border-signal bg-ink-950 text-signal" : "border-fg bg-fg text-white"
                }`}
              >
                {i + 1}
              </span>
              <div className="lg:mt-5">
                {isHandoff && (
                  <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-fg">
                    ↓ {humanLabel === "Você" ? "você assume" : `${humanLabel.toLowerCase()} assume`}
                  </p>
                )}
                <p className={`font-semibold leading-snug ${auto ? "text-fg" : "text-fg"}`}>{s.title}</p>
                <p className="mt-1.5 text-[0.88rem] leading-relaxed text-muted lg:pr-2">{s.detail}</p>
                <p className={`mt-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${auto ? "text-signal" : "text-fg/70"}`}>
                  {auto ? "automático" : humanLabel.toLowerCase()}
                </p>
              </div>
            </Reveal>
          );
        })}
      </ol>
    </div>
  );
}
