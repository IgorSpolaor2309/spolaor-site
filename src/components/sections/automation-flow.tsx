"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

// Demonstração de produto: um contato real atravessando a automação, visto pelas três telas
// que a empresa usaria (conversa, registro no sistema e histórico). Dados fictícios.

type Msg = { at: number; from: "them" | "auto"; text: string; time: string };
type Field = { at: number; label: string; value: string };
type Flow = {
  label: string;
  contact: { name: string; meta: string; initials: string };
  chat: Msg[];
  record: { kind: string; title: string; fields: Field[]; stages: string[]; stageAt: number[] };
  log: string[];
};

export const flows: Record<string, Flow> = {
  comercial: {
    label: "Comercial",
    contact: { name: "Marina Costa", meta: "Clínica Vita · veio pelo site", initials: "MC" },
    chat: [
      { at: 0, from: "them", text: "Oi! Preenchi o formulário do site, queria um orçamento para 3 unidades.", time: "09:41" },
      { at: 2, from: "auto", text: "Olá, Marina! Recebemos seu pedido. O Rafael, do comercial, vai te chamar ainda hoje. Para adiantar: qual cidade?", time: "09:41" },
      { at: 3, from: "them", text: "Campinas.", time: "09:43" },
      { at: 5, from: "auto", text: "Marina, a proposta foi enviada para o seu e-mail. Posso agendar uma conversa de 15 min amanhã?", time: "dia 14 · 10:00" },
    ],
    record: {
      kind: "Lead",
      title: "Marina Costa",
      fields: [
        { at: 1, label: "Origem", value: "Formulário do site" },
        { at: 1, label: "Interesse", value: "Orçamento · 3 unidades" },
        { at: 3, label: "Cidade", value: "Campinas" },
        { at: 3, label: "Responsável", value: "Rafael (comercial)" },
        { at: 4, label: "Próximo contato", value: "em 2 dias, automático" },
      ],
      stages: ["Novo", "Em atendimento", "Proposta"],
      stageAt: [1, 3, 5],
    },
    log: [
      "Mensagem recebida · WhatsApp",
      "Lead criado no CRM · origem: site",
      "Resposta automática enviada · 3s",
      "Rafael notificado com o histórico",
      "Follow-up agendado para dia 14",
      "Etapa alterada para Proposta",
    ],
  },
  operacao: {
    label: "Operação",
    contact: { name: "Grupo Orion", meta: "cliente #2041 · portal", initials: "GO" },
    chat: [
      { at: 0, from: "them", text: "Segue a nota fiscal de setembro.", time: "14:02" },
      { at: 3, from: "auto", text: "Recebido! Nota fiscal de setembro arquivada. Sua documentação do mês está completa.", time: "14:02" },
      { at: 5, from: "auto", text: "A Ana, do fiscal, já está com o seu processo. Previsão de retorno: até sexta.", time: "14:03" },
    ],
    record: {
      kind: "Documento",
      title: "NF set/2026 · Grupo Orion",
      fields: [
        { at: 1, label: "Tipo", value: "Nota fiscal" },
        { at: 2, label: "Pasta", value: "Clientes/2041/Fiscal" },
        { at: 3, label: "Status do mês", value: "Documentação completa" },
        { at: 4, label: "Responsável", value: "Ana (fiscal)" },
      ],
      stages: ["Recebido", "Arquivado", "Em análise"],
      stageAt: [0, 2, 4],
    },
    log: [
      "Arquivo recebido pelo portal",
      "Classificado: nota fiscal · cliente #2041",
      "Salvo em Clientes/2041/Fiscal",
      "Status atualizado para o cliente",
      "Tarefa criada para Ana (fiscal)",
      "Confirmação enviada por WhatsApp",
    ],
  },
};

export function AutomationFlow({ initial = "comercial" }: { initial?: keyof typeof flows }) {
  const [flowKey, setFlowKey] = useState<string>(initial);
  const [step, setStep] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px -20% 0px" });
  const reduce = useReducedMotion();
  const flow = flows[flowKey];
  const total = flow.log.length;

  useEffect(() => {
    if (reduce) {
      setStep(total - 1);
      return;
    }
    if (!inView) return;
    setStep(-1);
    let i = -1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      if (i < total) {
        setStep(i);
        timer = setTimeout(tick, 1300);
      } else {
        timer = setTimeout(() => {
          i = -1;
          setStep(-1);
          timer = setTimeout(tick, 700);
        }, 4200);
      }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [inView, flowKey, reduce, total]);

  const stage = flow.record.stageAt.filter((a) => a <= step).length - 1;

  return (
    <div ref={ref} className="overflow-hidden rounded-[14px] border border-line bg-ink-900 shadow-[0_1px_2px_rgb(20_37_61/0.06),0_24px_60px_-30px_rgb(20_37_61/0.3)]">
      {/* barra da janela */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink-850 px-4 py-2.5 md:px-5">
        <p className="flex items-center gap-3 font-mono text-[0.7rem] text-dim">
          <span className={`h-1.5 w-1.5 rounded-full ${step >= 0 ? "bg-signal" : "bg-fg/25"}`} aria-hidden />
          automação · {flow.label.toLowerCase()} · {Math.max(0, step + 1)}/{total} etapas
        </p>
        <div role="tablist" aria-label="Exemplos de fluxo" className="inline-flex rounded-[8px] border border-line bg-ink-800 p-0.5">
          {Object.entries(flows).map(([key, f]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={flowKey === key}
              onClick={() => setFlowKey(key)}
              className={`rounded-[6px] px-3 py-1 text-[0.8rem] transition-colors ${flowKey === key ? "bg-ink-900 text-fg shadow-sm" : "text-muted hover:text-fg"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-12">
        {/* 1. conversa */}
        <div className="border-b border-line lg:col-span-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-[0.7rem] font-semibold">{flow.contact.initials}</span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">{flow.contact.name}</span>
              <span className="block text-[0.72rem] text-dim">{flow.contact.meta}</span>
            </span>
            <span className="ml-auto font-mono text-[0.65rem] text-dim">WhatsApp</span>
          </div>
          <ul className="flex h-[300px] flex-col justify-end gap-2.5 overflow-hidden p-4 md:p-5" aria-label="Conversa">
            <AnimatePresence initial={false}>
              {flow.chat
                .filter((m) => m.at <= step)
                .map((m) => (
                  <motion.li
                    key={`${flowKey}-${m.text}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className={`max-w-[85%] rounded-[12px] px-3.5 py-2.5 text-[0.84rem] leading-snug ${
                      m.from === "them" ? "self-start rounded-bl-[4px] bg-ink-700 text-fg/90" : "self-end rounded-br-[4px] bg-[#dce7ff] text-fg"
                    }`}
                  >
                    {m.text}
                    <span className="mt-1 flex justify-end gap-2 font-mono text-[0.6rem] text-fg/65">
                      {m.from === "auto" && <span className="text-signal">automático</span>}
                      {m.time}
                    </span>
                  </motion.li>
                ))}
            </AnimatePresence>
            {step < 0 && <li className="self-center font-mono text-[0.7rem] text-dim">aguardando mensagem…</li>}
          </ul>
        </div>

        {/* 2. registro no sistema */}
        <div className="border-b border-line p-4 md:p-5 lg:col-span-4 lg:border-b-0 lg:border-r">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-dim">{flow.record.kind} · CRM</p>
          <p className={`mt-2 text-lg font-semibold tracking-[-0.02em] transition-opacity duration-500 ${step >= flow.record.fields[0].at ? "opacity-100" : "opacity-25"}`}>
            {flow.record.title}
          </p>
          <ol className="mt-4 grid grid-cols-3 gap-1" aria-label="Etapa">
            {flow.record.stages.map((s, i) => (
              <li key={s}>
                <span className={`block h-[3px] rounded-full transition-colors duration-500 ${i <= stage ? "bg-signal" : "bg-fg/10"}`} />
                <span className={`mt-1.5 block text-[0.68rem] transition-colors duration-500 ${i === stage ? "text-fg" : "text-dim"}`}>{s}</span>
              </li>
            ))}
          </ol>
          <dl className="mt-5 divide-y divide-line border-y border-line">
            {flow.record.fields.map((f) => {
              const on = f.at <= step;
              return (
                <div key={f.label} className="flex items-baseline justify-between gap-3 py-2.5 text-[0.82rem]">
                  <dt className="text-dim">{f.label}</dt>
                  <dd className={`text-right transition-all duration-500 ${on ? "text-fg" : "text-transparent"}`}>
                    {on ? f.value : "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        {/* 3. histórico */}
        <div className="p-4 md:p-5 lg:col-span-3" aria-live="polite">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-dim">Histórico</p>
          <ol className="relative mt-4 space-y-3.5 border-l border-line pl-4">
            {flow.log.map((l, i) => {
              const on = i <= step;
              return (
                <li key={l} className={`relative text-[0.78rem] leading-snug transition-opacity duration-500 ${on ? "opacity-100" : "opacity-0"}`}>
                  <span aria-hidden className={`absolute -left-[19.5px] top-1.5 h-[7px] w-[7px] rounded-full ${i === step ? "bg-signal" : "bg-ink-600"}`} />
                  <span className="block font-mono text-[0.62rem] text-dim">+{(i * 0.9 + 0.3).toFixed(1)}s</span>
                  <span className={i === step ? "text-fg" : "text-muted"}>{l}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
