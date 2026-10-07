import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";

// Ponte da home para as landings: cada segmento aparece pela situação que ele reconhece.
const rows = [
  {
    href: "/corretores",
    label: "Corretores de imóveis",
    quote: "Enquanto você mostra um imóvel, quem responde o próximo interessado?",
  },
  {
    href: "/clinicas",
    label: "Clínicas e consultórios",
    quote: "O paciente chamou enquanto a recepção atendia outra pessoa. Quando recebeu resposta, já tinha marcado em outro lugar.",
  },
  {
    href: "/orcamentos",
    label: "Empresas que vendem por orçamento",
    quote: "Você está perdendo vendas pelo preço, ou porque ninguém fez o segundo contato?",
  },
];

export function Segments({ index = "04" }: { index?: string }) {
  return (
    <section id="segmentos" className="relative border-t border-line py-24 md:py-32" aria-labelledby="segments-title">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <SectionLabel index={index}>Por segmento</SectionLabel>
            <h2 id="segments-title" className="mt-8 text-h2 font-semibold">
              Cada negócio perde clientes de um jeito.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <p className="text-[1.05rem] leading-relaxed text-muted">
              Em alguns segmentos já conhecemos a rotina de perto. Veja como o problema aparece no seu dia a dia e o que dá para
              fazer.
            </p>
          </Reveal>
        </div>

        <ul className="mt-16 border-t border-line-strong">
          {rows.map((r, i) => (
            <Reveal as="li" key={r.href} delay={i * 0.06}>
              <Link href={r.href} className="group grid gap-4 border-b border-line py-9 md:grid-cols-[16rem_1fr_auto] md:items-baseline md:gap-10 md:py-12">
                <span className="text-sm font-semibold uppercase tracking-[0.1em] text-fg/80 transition-colors group-hover:text-sky">{r.label}</span>
                <span className="max-w-[40ch] font-[family-name:var(--font-display)] text-[1.45rem] font-light leading-[1.25] tracking-[-0.025em] md:text-[1.8rem]">
                  “{r.quote}”
                </span>
                <span className="flex items-center gap-2 text-[0.92rem] font-medium text-sky">
                  Ver a página
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
        <Reveal>
          <p className="mt-8 text-muted">
            Seu segmento não está aqui? O{" "}
            <Link href="#analise" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              diagnóstico
            </Link>{" "}
            vale para qualquer empresa que recebe contatos e depende deles para vender.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
