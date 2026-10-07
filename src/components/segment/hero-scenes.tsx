"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

// Cenas do hero de cada landing. Cada uma mostra a dor do segmento como ela aparece na tela de
// quem vive aquilo: o celular do corretor em visita, a recepção da clínica, o pedido de
// orçamento disputado. Ilustrativas, sem dados reais.

/** Avança um contador de 0..max enquanto a cena está visível. */
function useTicker(max: number, every = 1600, startDelay = 600) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) {
      setN(max);
      return;
    }
    if (!inView) return;
    let id: ReturnType<typeof setInterval>;
    const first = setTimeout(() => {
      setN((v) => Math.min(max, v + 1));
      id = setInterval(() => setN((v) => (v >= max ? v : v + 1)), every);
    }, startDelay);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [inView, reduce, max, every, startDelay]);
  return { ref, n };
}

const caption = "mt-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-dim";

/* ───────────────────────── Corretores ───────────────────────── */

const brokerLeads = [
  { app: "Portal de imóveis", from: "Novo lead · Juliana", text: "Interesse no apto de 2 quartos da Vila Mariana.", ago: "agora" },
  { app: "WhatsApp", from: "Juliana", text: "Oi! Ainda está disponível? Consigo ver hoje?", ago: "2 min" },
  { app: "WhatsApp", from: "Carlos", text: "Aceita financiamento? Qual o valor do condomínio?", ago: "9 min" },
  { app: "Instagram", from: "@marcos.r", text: "Tem algo na faixa de 600 mil por ali?", ago: "14 min" },
];

export function BrokerPhone() {
  const { ref, n } = useTicker(brokerLeads.length, 1500);
  const shown = brokerLeads.slice(0, n).reverse();
  return (
    <div ref={ref} aria-hidden className="mx-auto w-full max-w-[22rem]">
      <div className="rounded-[2.4rem] border border-line-strong bg-ink-900 p-3 shadow-[0_1px_2px_rgb(20_37_61/0.06),0_40px_80px_-40px_rgb(20_37_61/0.35)]">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-ink-800 px-4 pb-6 pt-5">
          <div className="mx-auto h-5 w-24 rounded-full bg-fg/90" />
          <p className="mt-5 text-center font-[family-name:var(--font-display)] text-[3.2rem] font-light leading-none tracking-[-0.04em]">14:20</p>
          <p className="mt-2 text-center text-[0.78rem] text-muted">Você está em visita · Rua Afonso Celso</p>
          <div className="mt-6 grid min-h-[19rem] content-start gap-2">
            <AnimatePresence initial={false}>
              {shown.map((l) => (
                <motion.div
                  key={l.from + l.app}
                  layout
                  initial={{ opacity: 0, y: -14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-[16px] border border-line bg-ink-900/95 px-3.5 py-2.5"
                >
                  <p className="flex justify-between font-mono text-[0.58rem] uppercase tracking-[0.12em] text-dim">
                    <span>{l.app}</span>
                    <span>{l.ago}</span>
                  </p>
                  <p className="mt-1 text-[0.82rem] font-semibold">{l.from}</p>
                  <p className="text-[0.8rem] leading-snug text-muted">{l.text}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <p className="mt-5 flex items-baseline justify-center gap-3">
        <span className="font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-none tracking-[-0.04em] text-ember tabular-nums">{n}</span>
        <span className="text-sm text-muted">{n === 1 ? "interessado esperando resposta" : "interessados esperando resposta"}</span>
      </p>
      <p className={`${caption} text-center`}>Cena ilustrativa</p>
    </div>
  );
}

/* ───────────────────────── Clínicas ───────────────────────── */

const waiting = [
  { name: "Paciente novo", text: "Vocês atendem convênio?" },
  { name: "Renata", text: "Qual o valor da avaliação?" },
  { name: "Paulo", text: "Preciso remarcar minha consulta de amanhã." },
  { name: "Paciente novo", text: "Tem horário no sábado?" },
  { name: "Beatriz", text: "Qual o endereço mesmo?" },
];

const agenda: { time: string; who: string; state: "ok" | "empty" }[] = [
  { time: "08:00", who: "Confirmado", state: "ok" },
  { time: "09:00", who: "Confirmado", state: "ok" },
  { time: "10:00", who: "Cancelou ontem à noite", state: "empty" },
  { time: "11:00", who: "Não confirmou", state: "empty" },
  { time: "14:00", who: "Confirmado", state: "ok" },
];

export function ReceptionDesk() {
  const { ref, n } = useTicker(waiting.length, 1400);
  return (
    <div ref={ref} aria-hidden className="w-full">
      <div className="overflow-hidden rounded-[16px] border border-line-strong bg-ink-900 shadow-[0_1px_2px_rgb(20_37_61/0.06),0_40px_80px_-40px_rgb(20_37_61/0.35)]">
        <div className="flex items-center justify-between border-b border-line bg-ink-850 px-4 py-2.5">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-dim">Recepção · terça</p>
          <p className="flex items-center gap-2 text-[0.75rem] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ember" /> atendendo no balcão
          </p>
        </div>
        <div className="grid sm:grid-cols-2">
          <div className="border-b border-line p-4 sm:border-b-0 sm:border-r">
            <p className="flex items-baseline justify-between">
              <span className="text-[0.8rem] font-semibold">WhatsApp</span>
              <span className="font-mono text-[0.7rem] text-ember tabular-nums">{n} sem resposta</span>
            </p>
            <ul className="mt-3 grid min-h-[15.5rem] content-start gap-2">
              <AnimatePresence initial={false}>
                {waiting.slice(0, n).map((w) => (
                  <motion.li
                    key={w.text}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="rounded-[10px] border border-line bg-ink-850 px-3 py-2"
                  >
                    <p className="text-[0.74rem] font-semibold">{w.name}</p>
                    <p className="text-[0.76rem] leading-snug text-muted">{w.text}</p>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
          <div className="p-4">
            <p className="text-[0.8rem] font-semibold">Agenda de hoje</p>
            <ul className="mt-3 space-y-1.5">
              {agenda.map((a) => (
                <li key={a.time} className="flex items-center gap-3 text-[0.78rem]">
                  <span className="w-10 font-mono text-[0.68rem] text-dim">{a.time}</span>
                  <span
                    className={`flex-1 rounded-[6px] px-2 py-1 ${
                      a.state === "ok" ? "bg-signal/[0.08] text-fg/85" : "border border-dashed border-ember/50 text-ember"
                    }`}
                  >
                    {a.who}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <p className={caption}>Cena ilustrativa</p>
    </div>
  );
}

/* ───────────────────────── Orçamentos ───────────────────────── */

const race = [
  { name: "Empresa B", at: 1, reply: "respondeu em 6 min" },
  { name: "Empresa C", at: 2, reply: "respondeu em 25 min" },
  { name: "Empresa D", at: 3, reply: "respondeu em 1h" },
];

export function QuoteRace() {
  const { ref, n } = useTicker(5, 1300, 800);
  return (
    <div ref={ref} aria-hidden className="w-full">
      <div className="overflow-hidden rounded-[16px] border border-line-strong bg-ink-900 shadow-[0_1px_2px_rgb(20_37_61/0.06),0_40px_80px_-40px_rgb(20_37_61/0.35)]">
        <div className="border-b border-line bg-ink-850 px-5 py-4">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">Pedido de orçamento · enviado para 4 empresas</p>
          <p className="mt-1.5 text-[0.95rem] font-semibold leading-snug">Instalação de ar-condicionado em 2 ambientes</p>
          <p className="text-[0.8rem] text-muted">“Preciso para esta semana. Quanto fica?”</p>
        </div>
        <ul className="divide-y divide-line">
          {race.map((r) => {
            const on = n >= r.at;
            return (
              <li key={r.name} className="flex items-center gap-3 px-5 py-3 text-[0.85rem]">
                <span className={`h-2 w-2 rounded-full transition-colors duration-500 ${on ? "bg-fg/60" : "bg-fg/15"}`} />
                <span className="flex-1">{r.name}</span>
                <span className={`font-mono text-[0.7rem] transition-opacity duration-500 ${on ? "text-muted opacity-100" : "opacity-0"}`}>{r.reply}</span>
              </li>
            );
          })}
          <li className="flex items-center gap-3 bg-ember/[0.05] px-5 py-3 text-[0.85rem]">
            <span className="h-2 w-2 rounded-full bg-ember" />
            <span className="flex-1 font-semibold">Sua empresa</span>
            <span className="font-mono text-[0.7rem] text-ember">{n >= 4 ? "ainda sem resposta" : "…"}</span>
          </li>
        </ul>
        <div className={`border-t border-line px-5 py-3 transition-opacity duration-700 ${n >= 5 ? "opacity-100" : "opacity-0"}`}>
          <p className="text-[0.82rem] text-muted">
            <span className="font-semibold text-fg">Cliente:</span> “Obrigado, já fechei com outra empresa.”
          </p>
        </div>
      </div>
      <p className={caption}>Cena ilustrativa</p>
    </div>
  );
}
