import type { Metadata } from "next";
import { PageHero } from "@/components/sections/page-hero";
import { CaseShowcase } from "@/components/sections/case-showcase";
import { FeatureGrid, SectionIntro } from "@/components/sections/feature-grid";
import { SectionLabel } from "@/components/ui/section-label";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { Faq, type QA } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

export const metadata: Metadata = {
  title: "Sistemas sob medida",
  description:
    "Sistemas web, CRM, portais, áreas de clientes, dashboards, painéis administrativos, integrações e APIs desenvolvidos para o jeito que sua empresa trabalha.",
  alternates: { canonical: "/sistemas" },
};

const build = [
  { title: "Sistemas web", text: "Acessados pelo navegador, no computador ou no celular, sem instalar nada." },
  { title: "CRM", text: "Funil de vendas, histórico de contatos e follow-up do jeito que seu time vende." },
  { title: "Portais e áreas de clientes", text: "Seu cliente acompanha pedidos, documentos, pagamentos e status sem precisar perguntar." },
  { title: "Dashboards", text: "Os números que importam em um lugar só, atualizados automaticamente." },
  { title: "Painéis administrativos", text: "Controle de cadastros, permissões, operações e aprovações." },
  { title: "Integrações e APIs", text: "Seu sistema conversando com pagamentos, WhatsApp, ERPs e outras ferramentas." },
];

const signals = [
  "As informações da empresa estão espalhadas em planilhas que só uma pessoa entende",
  "Ferramentas prontas obrigam a equipe a se adaptar a um processo que não é o seu",
  "Os sistemas que vocês usam não conversam entre si",
  "Seus clientes precisam mandar mensagem para saber o status de qualquer coisa",
  "Você não consegue ver os números da operação sem montar um relatório",
];

const faq: QA[] = [
  {
    q: "Vocês desenvolvem aplicativos para celular?",
    a: "Desenvolvemos sistemas web que funcionam muito bem no navegador do celular. Aplicativos nativos para iOS e Android não fazem parte da nossa oferta neste momento.",
  },
  {
    q: "O sistema fica sendo da minha empresa?",
    a: "Sim. As condições de propriedade, hospedagem e manutenção ficam claras na proposta, e o custo do desenvolvimento é sempre separado da hospedagem.",
  },
  {
    q: "Dá para começar pequeno?",
    a: "Dá, e geralmente é o melhor caminho. Começamos pelo módulo que resolve o maior problema e evoluímos a partir dele.",
  },
];

export default function SistemasPage() {
  return (
    <>
      <PageHero
        eyebrow="Sistemas"
        tone="signal"
        title={
          <>
            Sistemas feitos para o jeito que sua empresa trabalha. <span className="serif-accent text-muted">Não o contrário.</span>
          </>
        }
        text="Quando planilhas e ferramentas prontas começam a limitar o crescimento, um sistema sob medida organiza a operação, dá visibilidade e abre espaço para automação."
        primary={{ href: "/contato?interesse=Sistema", label: "Falar sobre meu sistema" }}
        secondary={{ href: "/projetos", label: "Ver projeto em destaque" }}
      />

      <section className="border-t border-line py-24 md:py-32">
        <div className="container-x">
          <CaseShowcase />
          <p className="mt-6 text-center text-sm text-dim">Interface demonstrativa de uma plataforma de gestão e atendimento desenvolvida pela Spolaor.</p>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="build-title">
        <div className="container-x">
          <SectionIntro
            id="build-title"
            label={<SectionLabel index="01" tone="signal">O que desenvolvemos</SectionLabel>}
            title={<>Do CRM ao portal do cliente, <span className="serif-accent text-muted">integrado de ponta a ponta.</span></>}
          />
          <div className="mt-14">
            <FeatureGrid items={build} />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="signals-title">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionLabel index="02" tone="ember">Sinais</SectionLabel>
            <h2 id="signals-title" className="mt-6 text-h2 font-medium">
              Quando um sistema sob medida <span className="serif-accent text-ember">faz sentido?</span>
            </h2>
            <div className="mt-10">
              <ButtonLink href="/consultoria" variant="secondary" arrow>
                Não sei se preciso de um sistema
              </ButtonLink>
            </div>
          </Reveal>
          <ul className="lg:col-span-6 lg:col-start-7">
            {signals.map((s, i) => (
              <Reveal as="li" key={s} delay={i * 0.05} className="flex gap-5 border-t border-line py-6 text-lg last:border-b">
                <span className="mt-1 font-mono text-xs text-ember">0{i + 1}</span>
                {s}
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <Faq items={faq} index="03" />
      <FinalCta
        title={
          <>
            Sua operação cresceu. <span className="serif-accent text-signal">As ferramentas acompanharam?</span>
          </>
        }
        text="Conte como sua empresa trabalha hoje e o que precisa mudar. Indicamos o caminho mais simples para chegar lá."
      />
    </>
  );
}
