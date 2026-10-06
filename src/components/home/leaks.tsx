import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { PresenceDemo, ManualTasksDemo } from "./leak-demos";

const leaks = [
  {
    n: "01",
    name: "Clientes que não chegam",
    title: "O cliente conhece a forma como você se apresenta antes de conhecer o seu produto.",
    symptoms: [
      "Visitantes entram e saem sem pedir orçamento",
      "A oferta não fica clara nos primeiros segundos",
      "No celular, o site parece improvisado",
      "Faltam depoimentos, números e sinais de que outros confiaram",
      "O Instagram é o único endereço da empresa",
    ],
    demo: <PresenceDemo />,
  },
  {
    n: "02",
    name: "Horas que não voltam",
    title: "Sua equipe gasta o dia fazendo à mão o que um sistema faria em segundos.",
    symptoms: [
      "Dados copiados de um sistema para outro",
      "As mesmas respostas digitadas no WhatsApp o dia todo",
      "Cobranças e prazos lembrados de cabeça",
      "Relatório montado em planilha toda sexta-feira",
      "Orçamentos esquecidos porque ninguém fez o follow-up",
    ],
    demo: <ManualTasksDemo />,
  },
];

export function Leaks() {
  return (
    <section className="relative pb-24 pt-20 md:pb-36 md:pt-28" aria-labelledby="leaks-title">
      <div className="container-x">
        <Reveal>
          <SectionLabel index="01" tone="ember">Diagnóstico</SectionLabel>
        </Reveal>
        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-8">
            <h2 id="leaks-title" className="text-h2 font-semibold">
              A maior parte do prejuízo não aparece no relatório.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <p className="text-[1.05rem] leading-relaxed text-muted">
              Ele está nos clientes que desistiram antes de falar com você e nas horas que a equipe gasta repetindo tarefas. Dois
              vazamentos que quase nenhuma empresa mede.
            </p>
          </Reveal>
        </div>

        <div className="mt-20 grid gap-16 lg:grid-cols-2 lg:gap-0">
          {leaks.map((l, i) => (
            <Reveal
              key={l.n}
              delay={i * 0.1}
              as="article"
              className={`flex flex-col ${i === 1 ? "lg:border-l lg:border-line lg:pl-14" : "lg:pr-14"}`}
            >
              <p className="flex items-baseline gap-4">
                <span className="font-mono text-sm text-ember">{l.n}</span>
                <span className="text-sm font-semibold uppercase tracking-[0.12em] text-fg/80">{l.name}</span>
              </p>
              <h3 className="mt-6 max-w-[26ch] font-[family-name:var(--font-display)] text-[1.6rem] font-light leading-[1.2] tracking-[-0.025em] text-fg md:text-[1.9rem]">
                {l.title}
              </h3>
              <ul className="mt-8 border-t border-line">
                {l.symptoms.map((s) => (
                  <li key={s} className="flex gap-4 border-b border-line py-3 text-[0.97rem] text-muted">
                    <span aria-hidden className="text-ember/70">—</span>
                    {s}
                  </li>
                ))}
              </ul>
              <div className="mt-10">{l.demo}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
