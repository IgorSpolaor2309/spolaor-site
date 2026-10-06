import type { Metadata } from "next";
import { PageHero } from "@/components/sections/page-hero";
import { SectionIntro } from "@/components/sections/feature-grid";
import { SectionLabel } from "@/components/ui/section-label";
import { Reveal } from "@/components/ui/reveal";
import { FinalCta } from "@/components/sections/final-cta";

export const metadata: Metadata = {
  title: "Consultoria em tecnologia",
  description:
    "Para empresas que sabem que têm problemas operacionais ou digitais, mas não sabem qual tecnologia precisam. Diagnóstico, mapa de oportunidades e plano priorizado.",
  alternates: { canonical: "/consultoria" },
};

const forWho = [
  "Você sabe que algo não funciona, mas não sabe exatamente o quê",
  "Recebeu propostas de tecnologia e não sabe avaliar qual faz sentido",
  "Quer usar IA, mas não sabe onde ela realmente ajudaria",
  "A empresa usa ferramentas demais e tem resultado de menos",
  "Vai contratar mais gente e quer saber se existe outro caminho",
];

const how = [
  ["Diagnóstico", "Conversamos com quem faz a operação acontecer e entendemos vendas, atendimento, processos e ferramentas."],
  ["Mapa de oportunidades", "Identificamos onde a empresa perde clientes, tempo ou dinheiro, e o tamanho de cada problema."],
  ["Plano priorizado", "Recomendamos o que fazer primeiro, o que pode esperar e o que não vale o investimento."],
  ["Execução, se você quiser", "Implementamos com a Spolaor ou você leva o plano para quem preferir."],
];

export default function ConsultoriaPage() {
  return (
    <>
      <PageHero
        eyebrow="Consultoria"
        title={
          <>
            Você entende seu negócio. <span className="serif-accent text-muted">Nós entendemos como a tecnologia pode trabalhar nele.</span>
          </>
        }
        text="Para empresas que sentem o problema, mas ainda não sabem o nome da solução. Antes de qualquer projeto, ajudamos você a decidir onde investir."
        primary={{ href: "/contato?interesse=Consultoria", label: "Agendar uma conversa" }}
        secondary={{ href: "/analise", label: "Começar pela análise gratuita" }}
      />

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="who-title">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionLabel index="01" tone="ember">Para quem é</SectionLabel>
            <h2 id="who-title" className="mt-6 text-h2 font-medium">
              Se você se reconhece aqui, <span className="serif-accent text-ember">vale conversar.</span>
            </h2>
          </Reveal>
          <ul className="lg:col-span-6 lg:col-start-7">
            {forWho.map((s, i) => (
              <Reveal as="li" key={s} delay={i * 0.05} className="flex gap-5 border-t border-line py-6 text-lg last:border-b">
                <span className="mt-1 font-mono text-xs text-ember">0{i + 1}</span>
                {s}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="how-c-title">
        <div className="container-x">
          <SectionIntro
            id="how-c-title"
            label={<SectionLabel index="02" tone="signal">Como funciona</SectionLabel>}
            title={<>Primeiro o diagnóstico. <span className="serif-accent text-muted">Depois a tecnologia.</span></>}
            text="A recomendação vem do que acontece na sua empresa, não do que temos para vender."
          />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[16px] border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
            {how.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 0.06} className="bg-ink-950 p-7">
                <span className="font-mono text-xs text-signal">0{i + 1}</span>
                <p className="mt-6 text-xl font-medium tracking-tight">{t}</p>
                <p className="mt-2 leading-relaxed text-muted">{d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <FinalCta
        title={
          <>
            Não sabe por onde começar? <span className="serif-accent text-signal">Esse é o ponto de partida certo.</span>
          </>
        }
        text="Uma conversa sobre como sua empresa funciona hoje já mostra onde estão as maiores oportunidades."
      />
    </>
  );
}
