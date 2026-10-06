"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

function useAutoToggle(interval = 3800) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  const reduce = useReducedMotion();
  const [on, setOn] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!inView || touched || reduce) return;
    const first = setTimeout(() => setOn(true), 900);
    const id = setInterval(() => setOn((v) => !v), interval);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [inView, touched, reduce, interval]);

  const set = (v: boolean) => {
    setTouched(true);
    setOn(v);
  };
  return { ref, on, set };
}

function Toggle({ on, set, labels }: { on: boolean; set: (v: boolean) => void; labels: [string, string] }) {
  return (
    <div role="group" aria-label="Comparar cenários" className="relative inline-grid grid-cols-2 rounded-[9px] border border-line bg-ink-900 p-1 text-[0.8rem]">
      <span
        aria-hidden
        className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[6px] transition-all duration-500 ease-out-expo ${
          on ? "translate-x-full bg-signal" : "translate-x-0 bg-ember/90"
        }`}
      />
      {labels.map((l, i) => {
        const active = on === (i === 1);
        return (
          <button
            key={l}
            type="button"
            aria-pressed={active}
            onClick={() => set(i === 1)}
            className={`relative z-10 rounded-[6px] px-3.5 py-1.5 font-medium transition-colors duration-300 ${active ? "text-ink-950" : "text-muted hover:text-fg"}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Meter({ value, on, label }: { value: number; on: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[0.75rem] text-dim">{label}</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-fg/10 sm:w-32">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out-expo ${on ? "bg-signal" : "bg-ember"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`w-9 font-mono text-[0.75rem] ${on ? "text-signal" : "text-ember"}`}>{value}%</span>
    </div>
  );
}

export function PresenceDemo() {
  const { ref, on, set } = useAutoToggle();
  return (
    <div ref={ref}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Toggle on={on} set={set} labels={["Como está", "Como poderia ser"]} />
        <Meter value={on ? 87 : 31} on={on} label="Confiança" />
      </div>
      <div className="relative overflow-hidden rounded-[12px] border border-line bg-ink-850">
        <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-fg/15" />
          <span className="h-2 w-2 rounded-full bg-fg/15" />
          <span className="h-2 w-2 rounded-full bg-fg/15" />
          <span className="ml-3 h-4 flex-1 rounded bg-fg/[0.05] px-2 font-mono text-[0.6rem] leading-4 text-dim">suaempresa.com.br</span>
        </div>
        <div className="relative h-[230px] sm:h-[250px]" aria-hidden>
          {/* Hoje */}
          <div className={`absolute inset-0 p-4 transition-all duration-700 ease-out-expo ${on ? "scale-[0.97] opacity-0 blur-sm" : "opacity-100"}`}>
            <div className="flex items-center justify-between">
              <span className="font-serif text-sm tracking-widest text-fg/50">EMPRESA LTDA</span>
              <span className="flex gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <span key={i} className="h-1.5 w-5 rounded bg-fg/15" />
                ))}
              </span>
            </div>
            <div className="mt-3 grid h-[84px] place-items-center rounded bg-gradient-to-r from-fg/[0.06] to-fg/[0.1]">
              <span className="font-serif text-[0.8rem] italic text-fg/40">Bem-vindo ao nosso site!</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {[100, 96, 99, 92, 97, 60].map((w, i) => (
                <span key={i} className="block h-1.5 rounded bg-fg/10" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[0.6rem] text-fg/30 underline">clique aqui para saber mais</span>
              <span className="rounded bg-fg/10 px-2 py-1 text-[0.55rem] text-fg/40">Fale conosco</span>
            </div>
          </div>
          {/* Com a Spolaor */}
          <div className={`absolute inset-0 p-4 transition-all duration-700 ease-out-expo ${on ? "opacity-100" : "scale-[1.03] opacity-0 blur-sm"}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold">
                <span className="h-3 w-3 rounded-[4px] bg-signal" /> Empresa
              </span>
              <span className="flex items-center gap-3">
                <span className="h-1.5 w-7 rounded bg-fg/20" />
                <span className="h-1.5 w-7 rounded bg-fg/20" />
                <span className="rounded-full bg-signal px-2.5 py-1 text-[0.55rem] font-semibold text-ink-950">Pedir orçamento</span>
              </span>
            </div>
            <div className="mt-5 grid grid-cols-5 gap-4">
              <div className="col-span-3">
                <p className="text-[0.95rem] font-semibold leading-tight tracking-tight sm:text-[1.05rem]">
                  O resultado que seu cliente procura, explicado em uma frase.
                </p>
                <span className="mt-2 block h-1.5 w-[90%] rounded bg-fg/15" />
                <span className="mt-1.5 block h-1.5 w-[70%] rounded bg-fg/15" />
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full bg-signal px-3 py-1.5 text-[0.6rem] font-semibold text-ink-950">Quero uma proposta</span>
                  <span className="text-[0.6rem] text-muted">★★★★★ 4,9 · 300+ avaliações</span>
                </div>
              </div>
              <div className="col-span-2 rounded-xl bg-gradient-to-br from-ice/30 via-white/5 to-signal/20" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["Garantia", "Entrega em 48h", "Atendimento direto"].map((t) => (
                <span key={t} className="rounded-lg border border-line bg-fg/[0.03] px-2 py-1.5 text-center text-[0.55rem] text-muted">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[0.72rem] text-dim">Simulação. O mesmo negócio, apresentado de duas formas.</p>
    </div>
  );
}

const tasks = [
  { name: "Responder dúvidas repetidas no WhatsApp", manual: 22, auto: 4 },
  { name: "Copiar leads para a planilha", manual: 9, auto: 0 },
  { name: "Lembrar e cobrar clientes", manual: 7, auto: 1 },
  { name: "Montar o relatório semanal", manual: 6, auto: 0 },
  { name: "Fazer follow-up de orçamentos", manual: 8, auto: 1 },
];

function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(prev.current, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (node.textContent = Math.round(v).toString()),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return <span ref={ref}>{value}</span>;
}

export function ManualTasksDemo() {
  const { ref, on, set } = useAutoToggle(4200);
  const total = tasks.reduce((s, t) => s + (on ? t.auto : t.manual), 0);
  return (
    <div ref={ref}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Toggle on={on} set={set} labels={["Feito à mão", "Automatizado"]} />
        <p className="flex items-baseline gap-1.5">
          <span className={`font-mono text-2xl font-medium tabular-nums transition-colors duration-500 ${on ? "text-signal" : "text-ember"}`}>
            <Counter value={total} />h
          </span>
          <span className="text-[0.75rem] text-dim">por mês</span>
        </p>
      </div>
      <ul className="overflow-hidden rounded-[12px] border border-line bg-ink-850">
        {tasks.map((t, i) => {
          const hours = on ? t.auto : t.manual;
          return (
            <li key={t.name} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all duration-500 ${
                  on ? "border-signal bg-signal text-ink-950" : "border-fg/20"
                }`}
                style={{ transitionDelay: on ? `${i * 90}ms` : "0ms" }}
                aria-hidden
              >
                <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}>
                  <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className={`flex-1 text-[0.86rem] transition-colors duration-500 ${on ? "text-muted" : "text-fg/90"}`}>{t.name}</span>
              <span className="hidden h-1 w-16 overflow-hidden rounded-full bg-fg/10 sm:block" aria-hidden>
                <span
                  className={`block h-full rounded-full transition-all duration-1000 ease-out-expo ${on ? "bg-signal" : "bg-ember"}`}
                  style={{ width: `${(hours / 22) * 100}%`, transitionDelay: on ? `${i * 90}ms` : "0ms" }}
                />
              </span>
              <span className={`w-9 text-right font-mono text-[0.8rem] tabular-nums ${on ? "text-signal" : "text-ember"}`}>{hours}h</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[0.72rem] text-dim">Exemplo ilustrativo de horas mensais em tarefas comuns.</p>
    </div>
  );
}
