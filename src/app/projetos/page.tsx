import type { Metadata } from "next";
import { PageHero } from "@/components/sections/page-hero";
import { CaseShowcase } from "@/components/sections/case-showcase";
import { SectionIntro } from "@/components/sections/feature-grid";
import { SectionLabel } from "@/components/ui/section-label";
import { Reveal } from "@/components/ui/reveal";
import { FinalCta } from "@/components/sections/final-cta";

export const metadata: Metadata = {
  title: "Projetos",
  description:
    "Plataforma de gestão e atendimento com CRM, portal do cliente, financeiro, pagamentos, contratos, automações, WhatsApp e inteligência artificial, desenvolvida pela Spolaor Tecnologia.",
  alternates: { canonical: "/projetos" },
};

const modules = [
  ["CRM", "Funil comercial, histórico de cada cliente e acompanhamento de oportunidades."],
  ["Portal do cliente", "Área própria onde o cliente consulta documentos, solicitações e pagamentos."],
  ["Financeiro", "Receitas, cobranças, inadimplência e visão consolidada do caixa."],
  ["Pagamentos", "Cobranças online com confirmação automática e baixa no sistema."],
  ["Contratos", "Geração, envio e controle de contratos com assinatura digital."],
  ["Automações", "Lembretes, notificações, mudanças de status e tarefas criadas sozinhas."],
  ["WhatsApp", "Atendimento e notificações integrados ao histórico de cada cliente."],
  ["Inteligência artificial", "Respostas a dúvidas frequentes, classificação e organização de informações."],
  ["Fluxos internos", "Etapas de trabalho com responsáveis, prazos e acompanhamento."],
  ["Dashboards", "Indicadores da operação em tempo real, sem montar relatório."],
];

const story = [
  {
    t: "O desafio",
    d: "Uma operação de serviços com muitos clientes recorrentes, informações espalhadas em ferramentas diferentes, cobranças acompanhadas manualmente e atendimento concentrado em mensagens soltas.",
  },
  {
    t: "A solução",
    d: "Uma plataforma única, construída do zero, que reúne relacionamento, financeiro, contratos e atendimento, com automações e IA conectando tudo.",
  },
  {
    t: "O que isso mostra",
    d: "A Spolaor projeta e desenvolve sistemas empresariais complexos, integrados a pagamentos, WhatsApp e IA, e não apenas páginas na internet.",
  },
];

export default function ProjetosPage() {
  return (
    <>
      <PageHero
        eyebrow="Projeto em destaque"
        tone="signal"
        title={
          <>
            Plataforma de gestão e atendimento. <span className="serif-accent text-muted">Dez módulos, um só sistema.</span>
          </>
        }
        text="Um sistema empresarial completo, desenvolvido do zero pela Spolaor, que tirou uma operação inteira de planilhas e mensagens soltas."
        primary={{ href: "/contato?interesse=Sistema", label: "Quero algo assim" }}
        secondary={null}
      />

      <section className="border-t border-line py-24 md:py-32">
        <div className="container-x">
          <CaseShowcase />
          <p className="mt-6 text-center text-sm text-dim">Interface demonstrativa com dados fictícios.</p>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32">
        <div className="container-x grid gap-5 md:grid-cols-3">
          {story.map((s, i) => (
            <Reveal key={s.t} delay={i * 0.08} className="rounded-[28px] border border-line bg-ink-900 p-7 md:p-9">
              <p className="eyebrow">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-5 text-2xl font-medium tracking-tight">{s.t}</h2>
              <p className="mt-3 leading-relaxed text-muted">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="mod-title">
        <div className="container-x">
          <SectionIntro id="mod-title" label={<SectionLabel tone="signal">Módulos</SectionLabel>} title="Tudo o que a plataforma faz." />
          <dl className="mt-14 grid gap-px overflow-hidden rounded-[28px] border border-line bg-line sm:grid-cols-2">
            {modules.map(([t, d], i) => (
              <Reveal key={t} delay={(i % 2) * 0.06} className="flex gap-5 bg-ink-950 p-6 md:p-8">
                <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <dt className="text-lg font-medium">{t}</dt>
                  <dd className="mt-1.5 text-muted">{d}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      <FinalCta
        title={
          <>
            Seu projeto pode ser o próximo. <span className="serif-accent text-signal">Comece pelo diagnóstico.</span>
          </>
        }
        text="Analisamos seu site ou sua operação e mostramos onde a tecnologia traz retorno primeiro."
      />
    </>
  );
}
