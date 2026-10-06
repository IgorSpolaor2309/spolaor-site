import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";

// Índice editorial em vez de grade de cards: cada linha diz o que é, para quem e leva à página.
const services = [
  {
    href: "/sites",
    title: "Sites e páginas que convertem",
    text: "Institucional, landing page e redesign. Pensados para o cliente que decide em poucos segundos se vai pedir orçamento.",
    tags: "institucional · landing page · redesign · captação",
  },
  {
    href: "/automacao",
    title: "Automação de processos",
    text: "WhatsApp, CRM, follow-up, cobranças e relatórios rodando sem depender de alguém lembrar.",
    tags: "WhatsApp · integrações · IA · fluxos internos",
  },
  {
    href: "/sistemas",
    title: "Sistemas sob medida",
    text: "CRM, portal do cliente e painéis feitos para o jeito que a sua empresa já trabalha, e não o contrário.",
    tags: "CRM · portal do cliente · dashboards",
  },
  {
    href: "/consultoria",
    title: "Consultoria em tecnologia",
    text: "Para quando você sabe que algo não funciona, mas ainda não sabe qual tecnologia resolve.",
    tags: "diagnóstico · prioridades · plano",
  },
];

export function Services() {
  return (
    <section className="relative border-t border-line py-24 md:py-36" aria-labelledby="services-title">
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Reveal className="lg:sticky lg:top-32">
            <SectionLabel index="04">O que fazemos</SectionLabel>
            <h2 id="services-title" className="mt-8 text-[clamp(1.9rem,1.2rem+2vw,2.9rem)] font-semibold leading-[1.08] tracking-[-0.04em]">
              Fazemos poucas coisas. Todas ligadas a vender mais ou trabalhar menos.
            </h2>
          </Reveal>
        </div>

        <div className="lg:col-span-8">
          <ol className="border-t border-line-strong">
            {services.map((s, i) => (
              <Reveal as="li" key={s.href} delay={i * 0.05}>
                <Link
                  href={s.href}
                  className="group grid gap-x-8 gap-y-3 border-b border-line py-8 transition-colors md:grid-cols-[3rem_1fr_auto] md:py-10"
                >
                  <span className="font-mono text-sm text-dim transition-colors group-hover:text-ember">0{i + 1}</span>
                  <span>
                    <span className="block text-[1.5rem] font-semibold tracking-[-0.03em] transition-colors group-hover:text-sky md:text-[1.85rem]">
                      {s.title}
                    </span>
                    <span className="mt-3 block max-w-xl leading-relaxed text-muted">{s.text}</span>
                    <span className="mt-4 block font-mono text-[0.7rem] text-dim">{s.tags}</span>
                  </span>
                  <span aria-hidden className="hidden self-center text-2xl text-dim transition-all duration-300 group-hover:translate-x-1 group-hover:text-fg md:block">
                    →
                  </span>
                </Link>
              </Reveal>
            ))}
          </ol>
          <Reveal>
            <p className="mt-8 text-muted">
              Também fazemos{" "}
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
