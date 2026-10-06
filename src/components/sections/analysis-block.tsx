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

function ScanCard() {
  return (
    <div className="relative mt-10 overflow-hidden rounded-[24px] border border-line bg-ink-900/70" aria-hidden>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-dim">O que avaliamos</span>
        <span className="font-mono text-[0.7rem] text-signal">9 critérios</span>
      </div>
      <div className="relative">
        <span className="absolute inset-x-0 top-0 z-10 h-10 animate-scan bg-gradient-to-b from-transparent via-signal/15 to-transparent" />
        <ul>
          {criteria.map((c, i) => (
            <li key={c} className="flex items-center gap-4 border-b border-line px-5 py-2.5 text-sm text-fg/85 last:border-b-0">
              <span className="font-mono text-[0.68rem] text-dim">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1">{c}</span>
              <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-signal/70" style={{ width: `${[72, 48, 64, 81, 39, 55, 68, 44, 60][i]}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AnalysisBlock({ index = "08", origem = "home", headingLevel = "h2" }: { index?: string; origem?: string; headingLevel?: "h1" | "h2" }) {
  const H = headingLevel;
  return (
    <section id="analise" className="relative overflow-hidden border-t border-line py-24 md:py-32" aria-labelledby="analysis-title">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid mask-radial absolute inset-0 opacity-50" />
        <div className="absolute right-[-10%] top-[10%] h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgb(215_255_58/0.10),transparent_60%)]" />
      </div>
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <SectionLabel index={index} tone="signal">Análise gratuita</SectionLabel>
          <H id="analysis-title" className="mt-6 text-h2 font-medium">
            Descubra o que seu site está <span className="serif-accent text-signal">custando</span> para você.
          </H>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Olhamos seu site como um cliente exigente olharia e apontamos o que impede visitas de virarem contatos. Sem custo e sem
            compromisso.
          </p>
          <ScanCard />
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
