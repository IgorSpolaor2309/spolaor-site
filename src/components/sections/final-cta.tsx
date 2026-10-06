import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";

export function FinalCta({
  title = (
    <>
      Seu concorrente pode ter um produto pior. <span className="serif-accent text-ember">E ainda assim parecer melhor.</span>
    </>
  ),
  text = "Descubra em poucos minutos o que seu site comunica para quem ainda não conhece sua empresa.",
}: {
  title?: React.ReactNode;
  text?: string;
}) {
  return (
    <section className="noise relative isolate overflow-hidden border-t border-line py-32 md:py-48">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid mask-radial absolute inset-0 opacity-60" />
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgb(47_128_255/0.12),transparent_60%)]" />
      </div>
      <div className="container-x text-center">
        <Reveal>
          <h2 className="mx-auto max-w-5xl text-h2 font-medium">{title}</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">{text}</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/analise" size="lg" arrow>
              Solicitar análise do meu site
            </ButtonLink>
            <ButtonLink href="/contato" variant="secondary" size="lg">
              Falar sobre meu projeto
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
