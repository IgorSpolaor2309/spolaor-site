import { ButtonLink } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";

// Hero das landings de segmento: a dor na língua do segmento à esquerda e, à direita, a cena
// em que ela acontece. O CTA leva ao formulário da própria página, para manter a origem do lead.
export function SegmentHero({
  eyebrow,
  title,
  text,
  cta,
  secondary = { href: "#como-funciona", label: "Ver como funciona" },
  note,
  scene,
}: {
  eyebrow: string;
  title: React.ReactNode;
  text: React.ReactNode;
  cta: string;
  secondary?: { href: string; label: string } | null;
  note?: string;
  scene: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden pb-20 pt-[128px] md:pb-28 md:pt-[160px]" aria-labelledby="segment-title">
      <div className="container-x grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <div className="fade-up">
            <SectionLabel tone="ember">{eyebrow}</SectionLabel>
          </div>
          <h1
            id="segment-title"
            className="fade-up mt-8 max-w-[18ch] text-[clamp(2.3rem,1rem+3.6vw,4.4rem)] font-semibold leading-[1.03] tracking-[-0.045em]"
            style={{ animationDelay: "0.08s" }}
          >
            {title}
          </h1>
          <div className="fade-up mt-8 grid max-w-[38rem] gap-4 text-[1.06rem] leading-relaxed text-muted md:text-lg" style={{ animationDelay: "0.18s" }}>
            {text}
          </div>
          <div className="fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "0.28s" }}>
            <ButtonLink href="#analise" size="lg" arrow>
              {cta}
            </ButtonLink>
            {secondary && (
              <ButtonLink href={secondary.href} variant="secondary" size="lg">
                {secondary.label}
              </ButtonLink>
            )}
          </div>
          {note && (
            <p className="fade-up mt-5 text-sm text-dim" style={{ animationDelay: "0.34s" }}>
              {note}
            </p>
          )}
        </div>
        <div className="fade-up lg:col-span-5" style={{ animationDelay: "0.3s" }}>
          {scene}
        </div>
      </div>
    </section>
  );
}
