import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { ButtonLink } from "@/components/ui/button";

const steps = [
  ["Entendemos como a empresa funciona hoje", "Vendas, atendimento, operação e as ferramentas que já existem."],
  ["Encontramos onde se perde cliente ou tempo", "Com base no que acontece de verdade, não em suposição."],
  ["Dizemos o que fazer primeiro", "E também o que não vale a pena fazer agora."],
];

// Momento de respiro da página: uma frase grande, leve, e pouca informação em volta.
export function Consulting() {
  return (
    <section className="relative border-t border-line py-28 md:py-44" aria-labelledby="consult-title">
      <div className="container-x">
        <Reveal>
          <SectionLabel index="06">Consultoria</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2
            id="consult-title"
            className="mt-10 max-w-[24ch] font-[family-name:var(--font-display)] text-[clamp(2rem,1.1rem+3.4vw,4.2rem)] font-light leading-[1.08] tracking-[-0.035em]"
          >
            Você entende o seu negócio. <span className="text-sky">Nós entendemos como a tecnologia pode trabalhar nele.</span>
          </h2>
        </Reveal>

        <div className="mt-20 grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="leading-relaxed text-muted">
              Para empresas que sentem o problema, mas ainda não sabem o nome da solução. Antes de vender qualquer projeto,
              ajudamos você a decidir o que realmente vale o investimento.
            </p>
            <div className="mt-8">
              <ButtonLink href="/consultoria" variant="secondary" arrow>
                Conhecer a consultoria
              </ButtonLink>
            </div>
          </Reveal>
          <ol className="grid gap-8 sm:grid-cols-3 lg:col-span-7 lg:col-start-6">
            {steps.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 0.06} className="border-t border-line-strong pt-5">
                <span className="font-mono text-xs text-sky">0{i + 1}</span>
                <p className="mt-3 font-semibold leading-snug">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
