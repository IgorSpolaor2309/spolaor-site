import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { AnalysisForm } from "@/components/forms/analysis-form";
import type { LeadOrigem } from "@/lib/leads/schema";

// O que o diagnóstico gratuito olha, na ordem em que um contato percorre a empresa.
export const criteria = [
  "Por onde os contatos chegam: site, WhatsApp, formulário, Instagram",
  "Quanto tempo leva a primeira resposta",
  "Onde cada contato fica registrado, e se fica",
  "O que acontece depois do primeiro contato",
  "O que o site comunica nos primeiros segundos",
  "Tarefas manuais que poderiam rodar sozinhas",
];

function Criteria({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="mt-10 border-t border-line-strong pt-5" aria-label="O que avaliamos">
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">{title}</p>
      <ol className="mt-4 grid grid-cols-1">
        {items.map((c, i) => (
          <li key={c} className="flex gap-3 border-b border-line py-2.5 text-[0.92rem] text-fg/85">
            <span className="font-mono text-[0.7rem] leading-6 text-dim">{String(i + 1).padStart(2, "0")}</span>
            {c}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AnalysisBlock({
  index = "",
  label = "Diagnóstico gratuito",
  origem = "home",
  headingLevel = "h2",
  title = (
    <>
      Descubra onde sua empresa está <span className="text-ember">perdendo clientes.</span>
    </>
  ),
  text = "Você conta como os contatos chegam e o que acontece com eles. Nós mostramos onde estão os vazamentos e o que resolver primeiro. Sem custo e sem compromisso.",
  items = criteria,
  itemsTitle = "O que olhamos",
  problemas,
  submitLabel,
}: {
  index?: string;
  label?: string;
  origem?: LeadOrigem;
  headingLevel?: "h1" | "h2";
  title?: React.ReactNode;
  text?: string;
  items?: string[];
  itemsTitle?: string;
  problemas?: string[];
  submitLabel?: string;
}) {
  const H = headingLevel;
  return (
    <section id="analise" className="relative overflow-hidden border-t border-line py-24 md:py-32" aria-labelledby="analysis-title">
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <SectionLabel index={index || undefined} tone="signal">
            {label}
          </SectionLabel>
          <H id="analysis-title" className="mt-8 text-h2 font-semibold">
            {title}
          </H>
          <p className="mt-6 text-lg leading-relaxed text-muted">{text}</p>
          <Criteria items={items} title={itemsTitle} />
          <p className="mt-6 text-sm text-dim">
            Se fizer sentido seguir, preparamos depois uma proposta com escopo, prazo e investimento para o seu caso.
          </p>
        </Reveal>
        <Reveal delay={0.12} className="lg:col-span-6 lg:col-start-7 lg:pt-10">
          <AnalysisForm origem={origem} problemas={problemas} submitLabel={submitLabel} />
        </Reveal>
      </div>
    </section>
  );
}
