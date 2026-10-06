import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { PresenceDemo, ManualTasksDemo } from "./leak-demos";

const leaks = [
  {
    tag: "Vazamento 01",
    name: "Perda de clientes",
    title: "Antes de conhecer seu produto, o cliente conhece a forma como você se apresenta.",
    symptoms: [
      "Visitantes entram e saem sem pedir orçamento",
      "A oferta não fica clara nos primeiros segundos",
      "No celular, o site parece improvisado",
      "Faltam provas, depoimentos e sinais de confiança",
      "O Instagram é o único endereço da empresa",
    ],
    demo: <PresenceDemo />,
  },
  {
    tag: "Vazamento 02",
    name: "Desperdício operacional",
    title: "Antes de contratar mais uma pessoa, descubra o que sua empresa ainda faz à mão.",
    symptoms: [
      "Dados copiados de um sistema para outro",
      "As mesmas respostas digitadas no WhatsApp o dia todo",
      "Cobranças e prazos lembrados de cabeça",
      "Relatórios montados em planilha toda semana",
      "Leads esquecidos porque ninguém fez o follow-up",
    ],
    demo: <ManualTasksDemo />,
  },
];

export function Leaks() {
  return (
    <section className="relative py-24 md:py-32" aria-labelledby="leaks-title">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel index="01" tone="ember">O diagnóstico</SectionLabel>
            <h2 id="leaks-title" className="mt-6 text-h2 font-medium">
              Dinheiro raramente some de uma vez. <span className="serif-accent text-ember">Ele vaza.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5">
            <p className="text-lg leading-relaxed text-muted">
              Na maioria das empresas, o prejuízo se esconde em dois lugares que ninguém mede: os clientes que
              desistiram antes de falar com você e as horas que sua equipe gasta com trabalho repetitivo.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-5 lg:grid-cols-2">
          {leaks.map((l, i) => (
            <Reveal key={l.tag} delay={i * 0.12} as="article" className="group relative flex flex-col overflow-hidden rounded-[28px] border border-line bg-ink-900">
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-ember/10 blur-3xl transition-opacity duration-700 group-hover:opacity-100 md:opacity-60" />
              <div className="relative p-7 md:p-10">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-ember">{l.tag}</span>
                  <span className="rounded-full border border-ember/30 bg-ember/10 px-3 py-1 text-xs text-ember-soft">{l.name}</span>
                </div>
                <h3 className="mt-8 text-h3 font-medium">{l.title}</h3>
                <ul className="mt-8 grid gap-3">
                  {l.symptoms.map((s) => (
                    <li key={s} className="flex gap-3 text-[0.98rem] text-muted">
                      <svg viewBox="0 0 16 16" className="mt-1 h-4 w-4 shrink-0 text-ember" aria-hidden>
                        <path d="M8 3v6M8 12v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mt-auto border-t border-line bg-ink-950/50 p-4 md:p-6">{l.demo}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
