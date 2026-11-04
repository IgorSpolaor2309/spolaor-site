import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";

export function PageHero({
  eyebrow,
  title,
  text,
  primary = { href: "/analise", label: "Analisar minha empresa" },
  secondary = { href: "/contato", label: "Falar sobre meu projeto" },
  tone = "ember",
  aside,
}: {
  eyebrow: string;
  title: React.ReactNode;
  text: string;
  primary?: { href: string; label: string } | null;
  secondary?: { href: string; label: string } | null;
  tone?: "ember" | "signal";
  aside?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden pb-12 pt-[84px] md:pb-28 md:pt-[200px]">
      <div className="container-x grid gap-6 md:gap-12 lg:grid-cols-12 lg:items-center">
        <div className={aside ? "lg:col-span-7" : "lg:col-span-10"}>
          <div className="fade-up">
            <SectionLabel tone={tone}>{eyebrow}</SectionLabel>
          </div>
          <h1 className={`fade-up mt-4 font-semibold leading-[1.03] tracking-[-0.045em] md:mt-8 ${aside ? "text-[clamp(2.15rem,1.2rem+3.4vw,4.25rem)]" : "text-[clamp(2.3rem,1.3rem+4.6vw,5.5rem)]"}`} style={{ animationDelay: "0.08s" }}>
            {title}
          </h1>
          <p className="fade-up mt-4 max-w-2xl text-[1.06rem] leading-relaxed text-muted md:mt-8 md:text-xl" style={{ animationDelay: "0.18s" }}>
            {text}
          </p>
          {(primary || secondary) && (
            <div className="fade-up mt-6 flex flex-col gap-3.5 sm:flex-row md:mt-10" style={{ animationDelay: "0.28s" }}>
              {primary && (
                <ButtonLink href={primary.href} size="lg" arrow data-hero-cta>
                  {primary.label}
                </ButtonLink>
              )}
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
          )}
        </div>
        {aside && (
          <div className="fade-up lg:col-span-5" style={{ animationDelay: "0.35s" }}>
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
