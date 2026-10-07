import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { SLines } from "@/components/brand/s-lines";

type Cta = { href: string; label: string };

export function FinalCta({
  title = (
    <>
      Seu concorrente não precisa ser melhor. <span className="text-ember">Só precisa responder primeiro.</span>
    </>
  ),
  text = "Descubra onde sua empresa perde contatos hoje, e o que dá para resolver primeiro.",
  primary = { href: "/analise", label: "Analisar minha empresa" },
  secondary = { href: "/contato", label: "Falar sobre um projeto" },
}: {
  title?: React.ReactNode;
  text?: string;
  primary?: Cta;
  secondary?: Cta | null;
}) {
  return (
    <section className="relative isolate overflow-hidden border-t border-line py-28 md:py-40">
      <SLines className="pointer-events-none absolute -right-16 top-1/2 -z-10 hidden h-[115%] -translate-y-1/2 opacity-80 md:block" />
      <div className="container-x">
        <Reveal className="max-w-3xl">
          <h2 className="text-h2 font-semibold">{title}</h2>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">{text}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={primary.href} size="lg" arrow>
              {primary.label}
            </ButtonLink>
            {secondary && (
              <ButtonLink href={secondary.href} variant="secondary" size="lg">
                {secondary.label}
              </ButtonLink>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
