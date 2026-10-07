import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { Process } from "@/components/sections/process";

// Método de trabalho: o diagnóstico vem antes de qualquer tecnologia.
const steps = [
  ["Entendemos como a empresa funciona", "Como os contatos chegam, quem atende, o que acontece depois e quais ferramentas já existem."],
  ["Encontramos onde se perde dinheiro, contato ou tempo", "Com base no que acontece de verdade na sua rotina, não em suposição."],
  ["Propomos a solução", "O que fazer primeiro, com escopo, prazo e investimento definidos. E o que não vale a pena agora."],
  ["Construímos e integramos", "Aproveitando as ferramentas que você já usa sempre que fizer sentido."],
  ["Acompanhamos o funcionamento", "Depois que entra no ar, olhamos o que está acontecendo e ajustamos o que for preciso."],
];

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
    text: "Receba o projeto e cuide da infraestrutura, ou deixe a Spolaor manter tudo funcionando por uma mensalidade.",
  },
];

export function HowItWorks({ index = "06", guaranteesVisible = true }: { index?: string; guaranteesVisible?: boolean }) {
  return (
    <section id="metodo" className="relative border-t border-line py-24 md:py-32" aria-labelledby="how-title">
      <div className="container-x grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <Reveal>
              <SectionLabel index={index}>Como trabalhamos</SectionLabel>
              <h2 id="how-title" className="mt-8 text-[clamp(1.9rem,1.2rem+2vw,2.9rem)] font-semibold leading-[1.08] tracking-[-0.04em]">
                Primeiro o diagnóstico. <span className="text-muted">Depois a tecnologia.</span>
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                Cada projeto tem orçamento próprio, definido pela necessidade, pela complexidade e pelo prazo. Sem pacote pronto.
              </p>
            </Reveal>
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <Process steps={steps} />
        </div>
      </div>

      {guaranteesVisible && (
        <div className="container-x mt-28 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="font-[family-name:var(--font-display)] text-[1.7rem] font-light leading-[1.2] tracking-[-0.025em]">
              O que é seu continua sendo seu.
            </p>
          </Reveal>
          <dl className="border-t border-line-strong lg:col-span-7 lg:col-start-6">
            {guarantees.map((g, i) => (
              <Reveal key={g.title} delay={i * 0.05} className="grid gap-2 border-b border-line py-6 md:grid-cols-[1fr_1.3fr] md:gap-8">
                <dt className="font-semibold">{g.title}</dt>
                <dd className="text-muted">{g.text}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
