import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";

// As três capacidades, sempre com o resultado antes da tecnologia. Índice editorial, não cards.
const capabilities = [
  {
    href: "/sites",
    result: "Mais visitas virando conversa.",
    text: "Sites e landing pages que deixam claro, em poucos segundos, o que você faz, para quem e qual é o próximo passo. E que entregam cada contato organizado para a equipe.",
    how: "sites · landing pages · redesign · captação de contatos",
  },
  {
    href: "/sistemas",
    result: "Nenhum contato sem dono.",
    text: "Cada contato registrado num só lugar, com origem, responsável e próximo passo. Você sabe quem está esperando retorno e o que cada canal traz de verdade.",
    how: "CRM · organização de leads · funil de vendas",
  },
  {
    href: "/automacao",
    result: "Menos gente fazendo trabalho de máquina.",
    text: "Primeira resposta, follow-up, lembretes, cópia de dados e avisos para a equipe acontecendo sozinhos, na hora certa. As pessoas ficam com o que exige gente.",
    how: "automações · WhatsApp · integrações · API",
  },
];

export function Capabilities() {
  return (
    <section id="servicos" className="relative border-t border-line py-24 md:py-36" aria-labelledby="cap-title">
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Reveal className="lg:sticky lg:top-32">
            <SectionLabel index="02" tone="signal">
              O que fazemos
            </SectionLabel>
            <h2 id="cap-title" className="mt-8 text-[clamp(1.9rem,1.2rem+2vw,2.9rem)] font-semibold leading-[1.08] tracking-[-0.04em]">
              A Spolaor existe para eliminar esses gargalos.
            </h2>
            <p className="mt-6 max-w-sm leading-relaxed text-muted">
              Primeiro descobrimos onde o contato se perde. Depois usamos a tecnologia que resolve aquele ponto, e só ela.
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-8">
          <ol className="border-t border-line-strong">
            {capabilities.map((c, i) => (
              <Reveal as="li" key={c.href} delay={i * 0.05}>
                <Link href={c.href} className="group grid gap-x-8 gap-y-3 border-b border-line py-9 md:grid-cols-[3rem_1fr_auto] md:py-11">
                  <span className="font-mono text-sm text-dim transition-colors group-hover:text-signal">0{i + 1}</span>
                  <span>
                    <span className="block text-[1.6rem] font-semibold leading-[1.15] tracking-[-0.03em] transition-colors group-hover:text-sky md:text-[2.05rem]">
                      {c.result}
                    </span>
                    <span className="mt-3 block max-w-xl leading-relaxed text-muted">{c.text}</span>
                    <span className="mt-4 block font-mono text-[0.7rem] text-dim">com {c.how}</span>
                  </span>
                  <span aria-hidden className="hidden self-center text-2xl text-dim transition-all duration-300 group-hover:translate-x-1 group-hover:text-fg md:block">
                    →
                  </span>
                </Link>
              </Reveal>
            ))}
          </ol>
          <Reveal>
            <p className="mt-8 max-w-2xl leading-relaxed text-muted">
              Quando a operação pede mais, desenvolvemos{" "}
              <Link href="/sistemas" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                sistemas sob medida
              </Link>{" "}
              ou começamos por uma{" "}
              <Link href="/consultoria" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                consultoria
              </Link>
              . Também fazemos{" "}
              <Link href="/sites#ecommerce" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                lojas virtuais
              </Link>{" "}
              e{" "}
              <Link href="/sites#identidade" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                identidade visual
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
