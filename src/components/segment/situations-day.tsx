"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";

// "Um dia comum": as situações em que a empresa perde clientes, contadas na ordem em que
// acontecem num dia de trabalho. No desktop, o relógio à esquerda acompanha a leitura; cada
// situação traz o objeto que a denuncia (a notificação, a planilha, o lembrete).

export type Situation = {
  time: string;
  /** Onde a pessoa estava quando aconteceu (ex.: "na visita", "no balcão") */
  where: string;
  text: React.ReactNode;
  /** O desfecho, curto, em laranja */
  outcome: string;
  artifact?: React.ReactNode;
};

function minutes(t: string) {
  if (!/^d{1,2}:d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function SituationsDay({
  id = "situacoes",
  index,
  label,
  title,
  intro,
  dayLabel = "Um dia comum",
  scale = ["7h", "21h"],
  items,
  closing,
}: {
  id?: string;
  index?: string;
  label: string;
  title: React.ReactNode;
  intro?: string;
  dayLabel?: string;
  /** Rótulos das pontas da régua do tempo */
  scale?: [string, string];
  items: Situation[];
  closing?: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // Faixa do expediente: 7h às 21h
  const start = 7 * 60;
  const span = 14 * 60;
  // Horários (hh:mm) ficam no ponto do expediente; outros rótulos (dias) se espalham por igual.
  const pos = (t: string, i: number) => {
    const m = minutes(t);
    if (m === null) return items.length > 1 ? (i / (items.length - 1)) * 100 : 0;
    return Math.min(100, Math.max(0, ((m - start) / span) * 100));
  };

  return (
    <section id={id} className="relative border-t border-line py-24 md:py-32" aria-labelledby={`${id}-title`}>
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-8">
            <SectionLabel index={index} tone="ember">
              {label}
            </SectionLabel>
            <h2 id={`${id}-title`} className="mt-8 text-h2 font-semibold">
              {title}
            </h2>
          </Reveal>
          {intro && (
            <Reveal delay={0.08} className="lg:col-span-4 lg:self-end">
              <p className="text-[1.05rem] leading-relaxed text-muted">{intro}</p>
            </Reveal>
          )}
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-12 lg:gap-16">
          {/* Relógio do dia: fixo no desktop */}
          <div className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-[22vh]" aria-hidden>
              <p className="eyebrow">{dayLabel}</p>
              <p
                className={`mt-4 font-[family-name:var(--font-display)] font-light leading-none tracking-[-0.05em] tabular-nums ${
                  minutes(items[active].time) === null ? "text-[3.6rem]" : "text-[5.5rem]"
                }`}
              >
                {items[active].time}
              </p>
              <p className="mt-3 text-muted">{items[active].where}</p>
              <div className="relative mt-10 h-8">
                <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
                {items.map((s, i) => (
                  <span
                    key={s.time + i}
                    className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-500 ${
                      i < active ? "border-ember bg-ember" : i === active ? "border-ember bg-ink-950" : "border-line-strong bg-ink-950"
                    }`}
                    style={{ left: `${pos(s.time, i)}%` }}
                  />
                ))}
                <span className="absolute -bottom-4 left-0 font-mono text-[0.62rem] text-dim">{scale[0]}</span>
                <span className="absolute -bottom-4 right-0 font-mono text-[0.62rem] text-dim">{scale[1]}</span>
              </div>
              <p className="mt-12 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">
                {String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                <span className="ml-3 text-ember">{active + 1 === 1 ? "1 oportunidade em risco" : `${active + 1} oportunidades em risco`}</span>
              </p>
            </div>
          </div>

          <ol className="lg:col-span-8">
            {items.map((s, i) => (
              <li
                key={s.time + i}
                data-index={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={`grid gap-6 border-t border-line py-12 transition-opacity duration-500 first:border-t-0 first:pt-0 md:grid-cols-[1fr_auto] md:gap-10 lg:min-h-[40vh] lg:content-center ${
                  active === i ? "lg:opacity-100" : "lg:opacity-40"
                }`}
              >
                <div>
                  <p className="flex items-baseline gap-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-dim lg:hidden">
                    <span className="text-fg">{s.time}</span> {s.where}
                  </p>
                  <p className="mt-3 max-w-[30ch] font-[family-name:var(--font-display)] text-[1.5rem] font-light leading-[1.22] tracking-[-0.025em] md:text-[1.85rem] lg:mt-0">
                    {s.text}
                  </p>
                  <p className="mt-5 flex items-center gap-3 text-[0.95rem] font-medium text-ember">
                    <span aria-hidden className="h-px w-6 bg-ember" />
                    {s.outcome}
                  </p>
                </div>
                {s.artifact && <div className="md:w-[19rem] md:self-center">{s.artifact}</div>}
              </li>
            ))}
          </ol>
        </div>

        {closing && (
          <Reveal className="mt-16 border-t border-line-strong pt-10">
            <p className="max-w-3xl text-h3 font-medium">{closing}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
