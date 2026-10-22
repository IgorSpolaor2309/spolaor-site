"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

// Demonstração do hero: uma entrega, em três momentos. Um pedido de orçamento chega, fica
// registrado com dono e próximo passo, e recebe acompanhamento até alguém retomar o contato.
// Exemplo ilustrativo com dados fictícios: não mostra números nem resultados de clientes.
// Azul = organizado/em andamento; laranja = o ponto em que o contato se perderia.

const steps = [
  { short: "Chega", label: "Chega o pedido" },
  { short: "Organiza", label: "Fica organizado" },
  { short: "Acompanha", label: "Recebe acompanhamento" },
];

const record = [
  ["Cliente", "Carla M."],
  ["Pedido", "Reforma de banheiro"],
  ["Para quando", "Mês que vem"],
  ["Veio por", "Formulário do site"],
  ["Responsável", "Rafael · comercial"],
  ["Etapa", "Orçamento em preparo"],
];

const timeline: { time: string; text: string; tone?: "alert" | "next" }[] = [
  { time: "seg 09:12", text: "Pedido recebido e confirmado para a cliente" },
  { time: "seg 10:05", text: "Rafael assumiu o atendimento" },
  { time: "ter 16:40", text: "Orçamento enviado" },
  { time: "sex 09:00", text: "Sem resposta há 3 dias: lembrete para Rafael retomar o contato", tone: "alert" },
  { time: "hoje", text: "Próximo passo: ligar para a Carla", tone: "next" },
];

function Dot({ tone }: { tone: "alert" | "ok" | "idle" }) {
  const c = tone === "alert" ? "bg-[#f07a12]" : tone === "ok" ? "bg-royal" : "bg-ink-600";
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${c}`} />;
}

function Arrival() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[0.78rem] text-dim">
        <span className="font-medium text-fg">Novo pedido de orçamento</span>
        <span className="font-mono">site · 09:12</span>
      </div>
      <ul className="mt-4 grid gap-1.5 text-[0.82rem] text-dim">
        <li className="flex gap-2">
          <span className="w-[4.5rem] shrink-0 font-mono text-[0.72rem]">WhatsApp</span>
          <span className="truncate">“Vocês fazem visita no sábado?”</span>
        </li>
        <li className="flex gap-2">
          <span className="w-[4.5rem] shrink-0 font-mono text-[0.72rem]">e-mail</span>
          <span className="truncate">“Segue a planta para o orçamento”</span>
        </li>
      </ul>
      <div className="mt-3 rounded-[12px] border border-line bg-ink-850 p-4">
        <p className="text-[0.95rem] leading-relaxed text-fg">
          “Olá, preciso de um orçamento para reformar um banheiro. Pode ser para o mês que vem.”
        </p>
        <p className="mt-3 text-[0.8rem] text-dim">Carla M. · deixou nome e WhatsApp</p>
      </div>
      <p className="mt-4 flex items-center gap-2 text-[0.85rem] text-ember">
        <Dot tone="alert" />
        Sem um processo, este pedido depende de alguém lembrar de responder.
      </p>
    </div>
  );
}

function Organized() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[0.78rem] text-dim">
        <span className="font-medium text-fg">Pedido registrado</span>
        <span className="font-mono">nº 0148</span>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 border-t border-line text-[0.88rem]">
        {record.map(([k, v]) => (
          <div key={k} className="col-span-2 grid grid-cols-subgrid border-b border-line py-2">
            <dt className="text-dim">{k}</dt>
            <dd className={k === "Responsável" || k === "Etapa" ? "font-medium text-sky" : "text-fg"}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 flex items-center gap-2 text-[0.85rem] text-muted">
        <Dot tone="ok" />O que a cliente informou é registrado uma vez, sem redigitar.
      </p>
    </div>
  );
}

function FollowUp() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[0.78rem] text-dim">
        <span className="font-medium text-fg">Histórico do atendimento</span>
        <span className="font-mono">Carla M.</span>
      </div>
      <ol className="relative mt-4 grid gap-3 border-l border-line-strong pl-4 text-[0.88rem]">
        {timeline.map((e) => (
          <li key={e.time} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[21px] top-[0.45em] h-2 w-2 rounded-full ring-4 ring-ink-900 ${
                e.tone === "alert" ? "bg-[#f07a12]" : e.tone === "next" ? "bg-royal" : "bg-ink-600"
              }`}
            />
            <span className="mr-2 font-mono text-[0.72rem] text-dim">{e.time}</span>
            <span className={e.tone === "alert" ? "text-ember" : e.tone === "next" ? "font-medium text-sky" : "text-fg"}>{e.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const panels = [Arrival, Organized, FollowUp];

export function HeroDemo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  // Avança sozinho só enquanto visível, sem preferência por movimento reduzido e até a pessoa
  // escolher uma etapa ou pausar. Passar o mouse ou focar dentro do quadro também pausa.
  const [playing, setPlaying] = useState(true);
  const [hold, setHold] = useState(false);
  const auto = playing && !hold && inView && !reduce;

  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % steps.length), active === 2 ? 5200 : 3800);
    return () => clearTimeout(id);
  }, [auto, active]);

  return (
    <figure
      ref={ref}
      className={className}
      aria-label="Exemplo ilustrativo: um pedido de orçamento chegando, ficando organizado e recebendo acompanhamento"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHold(false)}
    >
      <div className="overflow-hidden rounded-[16px] border border-line-strong bg-ink-900 shadow-[0_30px_60px_-36px_rgb(20_37_61/0.35)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-dim">
            Exemplo ilustrativo<span className="hidden sm:inline lg:hidden xl:inline"> · dados fictícios</span>
          </span>
          {!reduce && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="rounded-[6px] px-2 py-1 text-[0.75rem] font-medium text-muted transition-colors hover:text-fg"
            >
              {playing ? "Pausar" : "Reproduzir"}
            </button>
          )}
        </div>

        <div className="px-5 pt-4">
          <ol className="grid grid-cols-3 gap-2">
            {steps.map((s, i) => (
              <li key={s.label}>
                <button
                  type="button"
                  aria-current={active === i ? "step" : undefined}
                  onClick={() => {
                    setActive(i);
                    setPlaying(false);
                  }}
                  className="group block w-full text-left"
                >
                  {/* Trilho com as cores das fitas do símbolo: preenche até a etapa atual */}
                  <span aria-hidden className="block h-[3px] overflow-hidden rounded-full bg-ink-700">
                    <span
                      className={`block h-full rounded-full bg-linear-to-r from-navy via-royal to-[#0ea5d8] transition-transform duration-700 ease-out-expo motion-reduce:transition-none ${
                        i <= active ? "translate-x-0" : "-translate-x-full"
                      }`}
                    />
                  </span>
                  <span className={`mt-2 flex items-baseline gap-1.5 text-[0.8rem] transition-colors ${active === i ? "text-fg" : "text-dim group-hover:text-fg"}`}>
                    <span className="font-mono text-[0.68rem]">{i + 1}</span>
                    <span className="font-medium sm:hidden lg:inline xl:hidden">{s.short}</span>
                    <span className="hidden font-medium sm:inline lg:hidden xl:inline">{s.label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* As três telas ocupam a mesma célula: a altura não muda ao trocar de etapa. */}
        <div className="grid p-5 pt-6">
          {panels.map((Panel, i) => (
            <div
              key={i}
              aria-hidden={active !== i}
              inert={active !== i}
              className={`col-start-1 row-start-1 transition-[opacity,transform] duration-500 ease-out-expo motion-reduce:transition-none ${
                active === i ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0 motion-reduce:translate-y-0"
              }`}
            >
              <Panel />
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 text-[0.8rem] leading-snug text-dim">
        Um exemplo do que entregamos: o pedido chega, fica registrado com dono e próximo passo, e ninguém precisa lembrar de
        voltar nele. Não representa resultados de clientes.
      </figcaption>
    </figure>
  );
}
