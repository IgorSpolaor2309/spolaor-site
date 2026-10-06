import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { Process } from "@/components/sections/process";

const guarantees = [
  {
    title: "O domínio é sempre seu",
    text: "Registrado no seu nome desde o primeiro dia. Você nunca fica refém de ninguém.",
  },
  {
    title: "Projeto e hospedagem são coisas separadas",
    text: "O desenvolvimento é orçado à parte. Hospedagem e manutenção só se você quiser.",
  },
  {
    title: "Você escolhe quem mantém",
    text: "Receba o projeto e cuide da infraestrutura, ou deixe a Spolaor manter tudo no ar por uma mensalidade.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative border-t border-line py-24 md:py-32" aria-labelledby="how-title">
      <div className="container-x grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <Reveal>
              <SectionLabel index="07">Como funciona</SectionLabel>
              <h2 id="how-title" className="mt-6 text-h2 font-medium">
                Um caminho claro, <span className="serif-accent text-muted">do primeiro contato ao site no ar.</span>
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                Cada projeto tem orçamento próprio, definido pela necessidade, complexidade e prazo. Sem pacotes genéricos.
              </p>
            </Reveal>
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <Process />
        </div>
      </div>

      <div className="container-x mt-24">
        <Reveal>
          <p className="eyebrow">Sem amarras</p>
        </Reveal>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {guarantees.map((g, i) => (
            <Reveal key={g.title} delay={i * 0.08} className="rounded-[24px] border border-line bg-ink-900 p-7">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-signal" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
                <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="mt-6 text-xl font-medium tracking-tight">{g.title}</h3>
              <p className="mt-2 text-muted">{g.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
