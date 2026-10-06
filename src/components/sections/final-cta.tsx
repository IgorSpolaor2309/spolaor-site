import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { SLines } from "@/components/brand/s-lines";

export function FinalCta({
  title = (
    <>
      Seu concorrente não precisa ser melhor. <span className="text-ember">Só precisa parecer melhor.</span>
    </>
  ),
  text = "Descubra o que o seu site comunica para quem ainda não conhece a sua empresa, e o que dá para resolver primeiro.",
}: {
  title?: React.ReactNode;
  text?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden border-t border-line py-28 md:py-40">
      <SLines className="pointer-events-none absolute -right-16 top-1/2 -z-10 hidden h-[115%] -translate-y-1/2 opacity-80 md:block" />
      <div className="container-x">
        <Reveal className="max-w-3xl">
          <h2 className="text-h2 font-semibold">{title}</h2>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">{text}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/analise" size="lg" arrow>
              Solicitar análise do meu site
            </ButtonLink>
            <ButtonLink href="/contato" variant="secondary" size="lg">
              Falar sobre um projeto
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
