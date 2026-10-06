"use client";

import { useId, useState } from "react";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm text-muted">
          {label}
        </label>
        <span className="font-mono text-lg text-fg">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-fg/10 accent-[#1e5be6] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-signal [&::-webkit-slider-thumb]:shadow-[0_0_0_6px_rgb(10_114_173/0.15)]"
        style={{ background: `linear-gradient(to right, #1e5be6 ${pct}%, rgb(20 37 61 / 0.1) ${pct}%)` }}
      />
    </div>
  );
}

// Estimativa simples do custo anual de tarefas repetitivas.
export function ManualCost() {
  const [people, setPeople] = useState(3);
  const [hours, setHours] = useState(8);
  const [cost, setCost] = useState(35);
  const monthlyHours = people * hours * 4.3;
  const yearly = monthlyHours * cost * 12;

  return (
    <div className="grid overflow-hidden rounded-[16px] border border-line bg-ink-900 lg:grid-cols-2">
      <div className="grid gap-8 p-7 md:p-10">
        <Slider label="Pessoas que fazem tarefas repetitivas" value={people} min={1} max={30} step={1} onChange={setPeople} format={(v) => `${v}`} />
        <Slider label="Horas por semana, por pessoa, nessas tarefas" value={hours} min={1} max={30} step={1} onChange={setHours} format={(v) => `${v}h`} />
        <Slider label="Custo médio da hora (salário + encargos)" value={cost} min={15} max={150} step={5} onChange={setCost} format={(v) => brl(v)} />
      </div>
      <div className="relative flex flex-col justify-between gap-8 border-t border-line bg-gradient-to-br from-ember/[0.08] to-transparent p-7 md:p-10 lg:border-l lg:border-t-0" aria-live="polite">
        <div>
          <p className="eyebrow">Sua empresa gasta, por ano</p>
          <p className="mt-4 font-mono text-[clamp(2.4rem,1.6rem+3vw,4rem)] font-medium leading-none tracking-tight text-ember">{brl(yearly)}</p>
          <p className="mt-3 text-muted">
            em cerca de <span className="text-fg">{Math.round(monthlyHours)} horas por mês</span> de trabalho repetitivo.
          </p>
        </div>
        <p className="text-sm text-dim">
          Estimativa simples, para dar dimensão ao problema. Nem toda tarefa pode ou deve ser automatizada; o diagnóstico mostra quais
          valem a pena.
        </p>
      </div>
    </div>
  );
}
