"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

// Cenas ilustrativas das páginas de oferta. Mostram a ideia do serviço com dados genéricos
// (sem nomes, preços, avaliações ou resultados reais) e dizem isso na legenda.

const caption = "mt-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-dim";
const frame = "overflow-hidden rounded-[16px] border border-line-strong bg-ink-900 shadow-[0_1px_2px_rgb(20_37_61/0.06),0_40px_80px_-40px_rgb(20_37_61/0.35)]";

/** Avança 0..max sozinho enquanto a cena está visível, até o visitante mexer. */
function useAutoStep(max: number, every = 2600) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!inView || touched || reduce) return;
    const id = setInterval(() => setStep((v) => (v >= max ? 0 : v + 1)), every);
    return () => clearInterval(id);
  }, [inView, touched, reduce, max, every]);
  return {
    ref,
    step,
    pick: (n: number) => {
      setTouched(true);
      setStep(n);
    },
  };
}

/* ───────────────────────── Loja virtual ───────────────────────── */

const storeSteps = ["Catálogo", "Produto", "Pedido"];

export function StorefrontScene() {
  const { ref, step, pick } = useAutoStep(2);
  return (
    <div ref={ref} className="w-full">
      <div className={frame}>
        <div className="flex items-center justify-between border-b border-line bg-ink-850 px-4 py-2.5">
          <span className="flex items-center gap-2 text-[0.8rem] font-semibold">
            <span className="h-3.5 w-3.5 rounded-[4px] bg-royal" aria-hidden /> Sua loja
          </span>
          <div role="tablist" aria-label="Etapas da compra (cena ilustrativa)" className="inline-flex rounded-[8px] border border-line bg-ink-800 p-0.5">
            {storeSteps.map((s, i) => (
              <button
                key={s}
                role="tab"
                type="button"
                aria-selected={step === i}
                onClick={() => pick(i)}
                className={`rounded-[6px] px-2.5 py-1 text-[0.74rem] transition-colors ${step === i ? "bg-ink-900 text-fg shadow-sm" : "text-muted hover:text-fg"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-[19rem] p-4 sm:h-[20rem]" aria-live="polite">
          {step === 0 && (
            <div className="grid h-full grid-cols-2 gap-3">
              {["Produto A", "Produto B", "Produto C", "Produto D"].map((p, i) => (
                <div key={p} className="flex flex-col rounded-[10px] border border-line bg-ink-850 p-2.5">
                  <span className={`h-full min-h-[3.2rem] rounded-[6px] ${i % 2 ? "bg-fg/[0.07]" : "bg-royal/[0.12]"}`} />
                  <span className="mt-2 text-[0.78rem] font-semibold">{p}</span>
                  <span className="font-mono text-[0.68rem] text-dim">R$ ••,••</span>
                </div>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="grid h-full grid-cols-5 gap-4">
              <span className="col-span-2 rounded-[10px] bg-royal/[0.12]" />
              <div className="col-span-3 flex flex-col">
                <p className="text-[0.95rem] font-semibold">Produto A</p>
                <p className="mt-1 text-[0.76rem] leading-snug text-muted">Descrição, medidas e o que acompanha, no mesmo lugar, sem perguntar no direct.</p>
                <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">Tamanho</p>
                <div className="mt-1.5 flex gap-1.5">
                  {["P", "M", "G"].map((t, i) => (
                    <span key={t} className={`grid h-7 w-7 place-items-center rounded-[6px] border text-[0.72rem] ${i === 1 ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted"}`}>
                      {t}
                    </span>
                  ))}
                </div>
                <span className="mt-auto rounded-[8px] bg-royal px-3 py-2 text-center text-[0.78rem] font-semibold text-white">Adicionar ao carrinho</span>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="flex h-full flex-col">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">Pedido · resumo</p>
              <ul className="mt-2 divide-y divide-line rounded-[10px] border border-line bg-ink-850 text-[0.78rem]">
                <li className="flex justify-between px-3 py-2"><span>1 × Produto A (M)</span><span className="font-mono text-dim">R$ ••,••</span></li>
                <li className="flex justify-between px-3 py-2"><span>Entrega</span><span className="font-mono text-dim">a calcular por CEP</span></li>
              </ul>
              <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">Pagamento (conforme o projeto)</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {["Pix", "Cartão", "Boleto"].map((t, i) => (
                  <span key={t} className={`rounded-[6px] border px-2.5 py-1 text-[0.74rem] ${i === 0 ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted"}`}>
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-auto flex items-center gap-2 rounded-[8px] bg-signal/[0.08] px-3 py-2 text-[0.78rem]">
                <span className="h-2 w-2 rounded-full bg-signal" aria-hidden /> Pedido registrado no painel, com status e dados do cliente
              </p>
            </div>
          )}
        </div>
      </div>
      <p className={caption}>Cena ilustrativa · sem produtos, preços ou vendas reais</p>
    </div>
  );
}

/* ───────────────────────── Agendamento ───────────────────────── */

const services = ["Avaliação", "Sessão", "Retorno"];
const days = [
  ["seg", "12"],
  ["ter", "13"],
  ["qua", "14"],
  ["qui", "15"],
  ["sex", "16"],
];
const slots = ["09:00", "10:30", "11:00", "14:00", "15:30", "17:00"];
const taken = new Set(["10:30", "15:30"]);

export function BookingScene() {
  const { ref, step, pick } = useAutoStep(3, 2200);
  const [service, setService] = useState(0);
  const [day, setDay] = useState(1);
  const [slot, setSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [hands, setHands] = useState(false);

  // Demonstração automática: escolhe o horário e confirma, até o visitante clicar em algo.
  useEffect(() => {
    if (hands) return;
    if (step === 1) setSlot("11:00");
    if (step === 2) setConfirmed(true);
    if (step === 0) {
      setSlot(null);
      setConfirmed(false);
    }
  }, [step, hands]);

  const touch = () => {
    setHands(true);
    pick(-1);
  };

  return (
    <div ref={ref} className="w-full">
      <div className={frame}>
        <div className="border-b border-line bg-ink-850 px-4 py-2.5 text-[0.8rem] font-semibold">Agendar horário</div>
        <div className="grid gap-4 p-4">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">1 · Serviço</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {services.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={service === i}
                  onClick={() => {
                    touch();
                    setService(i);
                    setConfirmed(false);
                  }}
                  className={`rounded-[8px] border px-3 py-1.5 text-[0.78rem] transition-colors ${service === i ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted hover:text-fg"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">2 · Dia e horário</p>
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {days.map(([d, n], i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={day === i}
                  onClick={() => {
                    touch();
                    setDay(i);
                    setSlot(null);
                    setConfirmed(false);
                  }}
                  className={`rounded-[8px] border py-1.5 text-center text-[0.72rem] leading-tight transition-colors ${day === i ? "border-fg bg-fg text-white" : "border-line-strong text-muted hover:text-fg"}`}
                >
                  <span className="block font-mono text-[0.6rem] uppercase">{d}</span>
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {slots.map((t) => {
                const off = taken.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={off}
                    aria-pressed={slot === t}
                    onClick={() => {
                      touch();
                      setSlot(t);
                      setConfirmed(false);
                    }}
                    className={`rounded-[8px] border py-1.5 font-mono text-[0.74rem] transition-colors ${
                      off ? "border-line text-dim/60 line-through" : slot === t ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted hover:text-fg"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            disabled={!slot}
            onClick={() => {
              touch();
              setConfirmed(true);
            }}
            className="rounded-[10px] bg-royal px-4 py-2.5 text-[0.85rem] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            Confirmar horário
          </button>
          <div className="min-h-[4.2rem] rounded-[10px] border border-dashed border-line-strong px-3 py-2.5 text-[0.78rem] leading-snug" aria-live="polite">
            {confirmed && slot ? (
              <>
                <p className="font-semibold">Confirmado: {services[service].toLowerCase()}, {days[day][0]} {days[day][1]}, {slot}.</p>
                <p className="mt-1 text-muted">Lembrete enviado na véspera. Precisa remarcar? O cliente escolhe outro horário pelo mesmo link.</p>
              </>
            ) : (
              <p className="text-muted">Escolha serviço, dia e horário. A confirmação e o lembrete saem sozinhos.</p>
            )}
          </div>
        </div>
      </div>
      <p className={caption}>Cena ilustrativa · agenda de exemplo, sem dados reais</p>
    </div>
  );
}
