import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { AnalysisForm } from "@/components/forms/analysis-form";

export const criteria = [
  "Primeira impressão",
  "Clareza da oferta",
  "Organização",
  "Visual",
  "Experiência no celular",
  "Chamadas para ação",
  "Credibilidade",
  "Oportunidades de conversão",
  "Oportunidades de automação",
];

function Criteria() {
  return (
    <div className="mt-10 border-t border-line-strong pt-5" aria-label="O que avaliamos">
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">O que olhamos no seu site · 9 pontos</p>
      <ol className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {criteria.map((c, i) => (
          <li key={c} className="flex gap-3 border-b border-line py-2.5 text-[0.92rem] text-fg/85">
            <span className="font-mono text-[0.7rem] leading-6 text-dim">{String(i + 1).padStart(2, "0")}</span>
            {c}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AnalysisBlock({ index = "08", origem = "home", headingLevel = "h2" }: { index?: string; origem?: string; headingLevel?: "h1" | "h2" }) {
  const H = headingLevel;
  return (
    <section id="analise" className="relative overflow-hidden border-t border-line py-24 md:py-32" aria-labelledby="analysis-title">
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <SectionLabel index={index} tone="signal">Análise do site</SectionLabel>
          <H id="analysis-title" className="mt-8 text-h2 font-semibold">
            Descubra o que seu site está <span className="text-ember">custando</span> para você.
          </H>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Olhamos o seu site como um cliente exigente olharia e apontamos o que impede visitas de virarem contatos. Sem custo e
            sem compromisso.
          </p>
          <Criteria />
          <p className="mt-6 text-sm text-dim">
            Se fizer sentido, preparamos depois uma análise completa, com apresentação, reunião e proposta.
          </p>
        </Reveal>
        <Reveal delay={0.12} className="lg:col-span-6 lg:col-start-7 lg:pt-10">
          <AnalysisForm origem={origem} />
        </Reveal>
      </div>
    </section>
  );
}
