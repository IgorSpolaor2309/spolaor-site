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
    <section className="relative isolate overflow-hidden pb-20 pt-[150px] md:pb-28 md:pt-[200px]">
      <div className="container-x grid gap-12 lg:grid-cols-12 lg:items-end">
        <div className={aside ? "lg:col-span-7" : "lg:col-span-10"}>
          <div className="fade-up">
            <SectionLabel tone={tone}>{eyebrow}</SectionLabel>
          </div>
          <h1 className={`fade-up mt-8 font-semibold leading-[0.98] tracking-[-0.045em] ${aside ? "text-[clamp(2.4rem,1.3rem+3.4vw,4.25rem)]" : "text-[clamp(2.5rem,1.4rem+4.6vw,5.5rem)]"}`} style={{ animationDelay: "0.08s" }}>
            {title}
          </h1>
          <p className="fade-up mt-8 max-w-2xl text-lg leading-relaxed text-muted md:text-xl" style={{ animationDelay: "0.18s" }}>
            {text}
          </p>
          {(primary || secondary) && (
            <div className="fade-up mt-10 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "0.28s" }}>
              {primary && (
                <ButtonLink href={primary.href} size="lg" arrow>
                  {primary.label}
                </ButtonLink>
              )}
              {secondary && (
                <ButtonLink href={secondary.href} variant="secondary" size="lg">
                  {secondary.label}
                </ButtonLink>
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
