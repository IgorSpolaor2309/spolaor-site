import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";

// Seção do formulário das páginas de oferta: texto e passos à esquerda, formulário à direita.
// O id "formulario" é o alvo dos CTAs da página (header, barra mobile e botões).
export function RequestSection({
  index,
  label,
  title,
  text,
  steps,
  note,
  children,
}: {
  index?: string;
  label: string;
  title: React.ReactNode;
  text: string;
  steps: string[];
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id="formulario" className="scroll-mt-20 border-t border-line py-24 md:py-32" aria-labelledby="request-title">
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <SectionLabel index={index} tone="signal">
            {label}
          </SectionLabel>
          <h2 id="request-title" className="mt-8 text-h2 font-semibold">
            {title}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted">{text}</p>
          <ol className="mt-10 grid border-t border-line-strong text-[0.95rem]">
            {steps.map((t, i) => (
              <li key={t} className="flex gap-3 border-b border-line py-3">
                <span className="font-mono text-[0.72rem] leading-6 text-dim">{String(i + 1).padStart(2, "0")}</span>
                {t}
              </li>
            ))}
          </ol>
          {note && <p className="mt-6 text-sm text-dim">{note}</p>}
        </Reveal>
        <Reveal delay={0.12} className="lg:col-span-6 lg:col-start-7">
          {children}
        </Reveal>
      </div>
    </section>
  );
}
