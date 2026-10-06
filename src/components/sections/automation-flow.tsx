"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

type Step = { title: string; detail: string; log: string; icon: keyof typeof icons };

export const flows: Record<string, { label: string; steps: Step[] }> = {
  comercial: {
    label: "Comercial",
    steps: [
      { title: "Lead entra", detail: "Formulário, anúncio ou WhatsApp", log: "Novo lead: Marina Costa · origem: site", icon: "inbox" },
      { title: "CRM registra", detail: "Dados organizados, sem digitação", log: "Contato criado no CRM · etapa: novo", icon: "database" },
      { title: "WhatsApp dispara", detail: "Primeira resposta em segundos", log: "Mensagem de boas-vindas enviada", icon: "chat" },
      { title: "Responsável avisado", detail: "Quem atende recebe o contexto", log: "Notificação para Rafael (vendas)", icon: "bell" },
      { title: "Follow-up acontece", detail: "Sem depender de memória", log: "Lembrete agendado: retorno em 2 dias", icon: "clock" },
      { title: "Oportunidade acompanhada", detail: "Nada fica esquecido", log: "Oportunidade em acompanhamento", icon: "target" },
    ],
  },
  operacao: {
    label: "Operação",
    steps: [
      { title: "Cliente envia", detail: "Documento, pedido ou dúvida", log: "Arquivo recebido pelo portal", icon: "inbox" },
      { title: "Sistema identifica", detail: "Quem enviou e do que se trata", log: "Classificado: nota fiscal · cliente #2041", icon: "scan" },
      { title: "Organiza", detail: "Salva no lugar certo, com padrão", log: "Arquivado em Clientes/2041/Fiscal", icon: "folder" },
      { title: "Atualiza status", detail: "Cliente e equipe veem o mesmo", log: "Status: documentação completa", icon: "check" },
      { title: "Equipe recebe", detail: "Tarefa criada para o responsável", log: "Tarefa atribuída a Ana (fiscal)", icon: "users" },
      { title: "Cliente informado", detail: "Confirmação automática", log: "Confirmação enviada por WhatsApp", icon: "chat" },
    ],
  },
};

const icons = {
  inbox: "M3 13h4l2 3h6l2-3h4M5 5h14l2 8v6H3v-6l2-8Z",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  chat: "M4 5h16v11H9l-5 4V5Z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4h4",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  target: "M12 3v3m0 12v3M3 12h3m12 0h3M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  scan: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16",
  folder: "M3 6h6l2 2h10v11H3V6Z",
  check: "M4 12l5 5L20 6",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
};

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={icons[name]} />
    </svg>
  );
}

export function AutomationFlow({ initial = "comercial" }: { initial?: keyof typeof flows }) {
  const [flowKey, setFlowKey] = useState<string>(initial);
  const [step, setStep] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-25% 0px -25% 0px" });
  const reduce = useReducedMotion();
  const flow = flows[flowKey];

  useEffect(() => {
    if (reduce) {
      setStep(flow.steps.length - 1);
      return;
    }
    if (!inView) return;
    setStep(-1);
    let i = -1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      if (i < flow.steps.length) {
        setStep(i);
        timer = setTimeout(tick, 950);
      } else {
        timer = setTimeout(() => {
          i = -1;
          setStep(-1);
          timer = setTimeout(tick, 600);
        }, 3200);
      }
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [inView, flowKey, reduce, flow.steps.length]);

  const logs = flow.steps.slice(0, step + 1);

  return (
    <div ref={ref} className="relative overflow-hidden rounded-[28px] border border-line bg-ink-900">
      <div aria-hidden className="bg-grid absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Fluxo automático · executando</span>
        </div>
        <div role="tablist" aria-label="Exemplos de fluxo" className="inline-flex rounded-full border border-line bg-ink-950 p-1">
          {Object.entries(flows).map(([key, f]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={flowKey === key}
              onClick={() => setFlowKey(key)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${flowKey === key ? "bg-white/10 text-fg" : "text-muted hover:text-fg"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative grid gap-0 p-5 md:p-8 lg:grid-cols-12 lg:gap-8">
        <ol className="relative grid gap-3 lg:col-span-8 lg:grid-cols-3 lg:gap-4" aria-label={`Etapas do fluxo ${flow.label}`}>
          {flow.steps.map((s, i) => {
            const done = i < step;
            const current = i === step;
            const lit = i <= step;
            return (
              <li
                key={s.title}
                className={`relative flex items-start gap-4 rounded-2xl border p-4 transition-all duration-500 lg:flex-col lg:gap-5 lg:p-5 ${
                  current
                    ? "border-signal/60 bg-signal/[0.06] shadow-[0_0_50px_-12px_rgb(215_255_58/0.45)]"
                    : lit
                      ? "border-line-strong bg-white/[0.03]"
                      : "border-line bg-transparent"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors duration-500 ${
                    lit ? "border-signal/50 bg-signal text-ink-950" : "border-line-strong text-muted"
                  }`}
                >
                  <Icon name={s.icon} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[0.68rem] text-dim">0{i + 1}</span>
                    {done && <span className="font-mono text-[0.68rem] text-signal">ok</span>}
                  </span>
                  <span className={`mt-1 block font-medium transition-colors ${lit ? "text-fg" : "text-fg/60"}`}>{s.title}</span>
                  <span className="mt-1 block text-sm text-muted">{s.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 rounded-2xl border border-line bg-ink-950/80 lg:col-span-4 lg:mt-0" aria-live="polite">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-dim">Registro de eventos</span>
            <span className="font-mono text-[0.7rem] text-dim">{logs.length}/{flow.steps.length}</span>
          </div>
          <ul className="h-[248px] space-y-2 overflow-hidden p-4 font-mono text-[0.74rem] leading-relaxed">
            <AnimatePresence initial={false}>
              {logs.map((s, i) => (
                <motion.li
                  key={`${flowKey}-${s.title}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex gap-3"
                >
                  <span className="shrink-0 text-dim">+{(i * 0.9 + 0.2).toFixed(1)}s</span>
                  <span className={i === step ? "text-signal" : "text-fg/75"}>{s.log}</span>
                </motion.li>
              ))}
            </AnimatePresence>
            {step < 0 && <li className="text-dim">aguardando evento…</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
