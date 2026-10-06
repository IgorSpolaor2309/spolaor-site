import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { ButtonLink } from "@/components/ui/button";

const steps = [
  ["Entendemos como sua empresa funciona hoje", "Vendas, atendimento, operação e ferramentas que já existem."],
  ["Encontramos onde há perda de clientes ou de tempo", "Com base no que acontece de verdade, não em suposições."],
  ["Indicamos o que fazer primeiro", "E também o que não vale a pena fazer agora."],
];

export function Consulting() {
  return (
    <section className="relative border-t border-line py-24 md:py-32" aria-labelledby="consult-title">
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <SectionLabel index="06">Consultoria</SectionLabel>
          <h2 id="consult-title" className="mt-6 text-h2 font-medium">
            Você entende seu negócio.{" "}
            <span className="serif-accent text-muted">Nós entendemos como a tecnologia pode trabalhar nele.</span>
          </h2>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
            Para empresas que sentem o problema, mas não sabem o nome da solução. Antes de vender qualquer projeto, ajudamos você a
            decidir o que realmente vale o investimento.
          </p>
          <div className="mt-10">
            <ButtonLink href="/consultoria" variant="secondary" arrow>
              Conhecer a consultoria
            </ButtonLink>
          </div>
        </Reveal>
        <ol className="lg:col-span-5 lg:pt-16">
          {steps.map(([t, d], i) => (
            <Reveal as="li" key={t} delay={i * 0.08} className="flex gap-5 border-t border-line py-7 last:border-b">
              <span className="font-mono text-sm text-dim">0{i + 1}</span>
              <div>
                <p className="text-lg font-medium">{t}</p>
                <p className="mt-1.5 text-muted">{d}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
