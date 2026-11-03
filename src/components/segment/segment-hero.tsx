import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";

// Hero das landings de segmento: a dor na língua do segmento à esquerda e, à direita, a cena
// em que ela acontece. O CTA leva ao formulário da própria página, para manter a origem do lead.
export function SegmentHero({
  eyebrow,
  title,
  text,
  cta,
  ctaHref = "#analise",
  secondary = { href: "#como-funciona", label: "Ver como funciona" },
  note,
  scene,
}: {
  eyebrow: string;
  title: React.ReactNode;
  text: React.ReactNode;
  cta: string;
  /** Destino do botão principal; por padrão, o formulário da própria página */
  ctaHref?: string;
  secondary?: { href: string; label: string } | null;
  note?: string;
  scene: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden pb-12 pt-[84px] md:pb-28 md:pt-[160px]" aria-labelledby="segment-title">
      <div className="container-x grid items-center gap-6 md:gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <div className="fade-up">
            <SectionLabel tone="ember">{eyebrow}</SectionLabel>
          </div>
          <h1
            id="segment-title"
            className="fade-up mt-4 max-w-[18ch] text-[clamp(2.1rem,1rem+3.6vw,4.4rem)] font-semibold leading-[1.05] tracking-[-0.045em] md:mt-8"
            style={{ animationDelay: "0.08s" }}
          >
            {title}
          </h1>
          <div className="fade-up mt-4 grid max-w-[38rem] gap-4 text-[1.06rem] md:mt-8 leading-relaxed text-muted md:text-lg" style={{ animationDelay: "0.18s" }}>
            {text}
          </div>
          <div className="fade-up mt-6 flex flex-col gap-3.5 sm:flex-row sm:items-center md:mt-10" style={{ animationDelay: "0.28s" }}>
            <ButtonLink href={ctaHref} size="lg" arrow data-hero-cta>
              {cta}
            </ButtonLink>
            {secondary && (
              <>
                <span className="hidden sm:inline-flex">
                  <ButtonLink href={secondary.href} variant="secondary" size="lg">
                    {secondary.label}
                  </ButtonLink>
                </span>
                {/* No celular, o caminho secundário vira link de texto para não competir com o botão. */}
                <Link href={secondary.href} className="text-center text-[0.95rem] font-medium text-fg underline decoration-line-strong underline-offset-4 sm:hidden">
                  {secondary.label}
                </Link>
              </>
            )}
          </div>
          {note && (
            <p className="fade-up mt-3.5 text-sm leading-snug text-dim md:mt-5" style={{ animationDelay: "0.34s" }}>
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
