"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, ButtonLink } from "@/components/ui/button";
import { maskPhone, validateLead, type LeadPayload } from "@/lib/leads/schema";
import { submitLead } from "@/lib/leads/client";
import { SubmitError } from "./submit-error";
import { whatsappLink } from "@/lib/site";

const improvements = [
  "Passar mais confiança",
  "Gerar mais contatos",
  "Visual desatualizado",
  "Funcionar melhor no celular",
  "Explicar melhor a oferta",
  "Automatizar o atendimento",
];

const urgencies = ["Quero resolver logo", "Nos próximos 30 dias", "Nos próximos meses", "Só quero entender"];

type Errors = Partial<Record<keyof LeadPayload, string>>;

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="mt-1.5 text-sm text-ember-soft">
      {msg}
    </p>
  ) : null;
}

export function AnalysisForm({ origem = "home" }: { origem?: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [data, setData] = useState<LeadPayload>({
    tipo: "analise",
    nome: "",
    empresa: "",
    whatsapp: "",
    email: "",
    site: "",
    semSite: false,
    melhorias: [],
    mensagem: "",
    urgencia: "",
    origem,
  });

  const set = <K extends keyof LeadPayload>(k: K, v: LeadPayload[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const toggleImprovement = (v: string) =>
    set("melhorias", data.melhorias?.includes(v) ? data.melhorias.filter((m) => m !== v) : [...(data.melhorias ?? []), v]);

  const next = () => {
    if (!data.semSite && !data.site?.trim()) {
      setErrors({ site: "Informe o endereço do site (ou marque que ainda não tem)." });
      return;
    }
    setStep(2);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 1) return next();
    const errs = validateLead(data);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setStatus("sending");
    try {
      const honeypot = (e.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value;
      const result = await submitLead(data, honeypot);
      if (!result.ok) {
        if (result.errors) setErrors(result.errors);
        throw new Error();
      }
      setStep(3);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-line-strong bg-ink-900/90 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.9)] backdrop-blur">
      {step < 3 && (
        <div className="flex items-center gap-3 border-b border-line px-6 py-4 md:px-8">
          <span className="font-mono text-xs text-dim">Passo {step} de 2</span>
          <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="absolute inset-y-0 left-0 rounded-full bg-signal transition-all duration-700 ease-out-expo" style={{ width: step === 1 ? "50%" : "100%" }} />
          </span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="p-6 md:p-8" aria-label="Solicitar análise gratuita do site">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.fieldset key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }} className="grid gap-6">
              <legend className="sr-only">Sobre o seu site</legend>
              <div>
                <label htmlFor="site" className="mb-2 block text-sm font-medium">
                  Endereço do site
                </label>
                <input
                  id="site"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="suaempresa.com.br"
                  className="field"
                  value={data.site}
                  disabled={data.semSite}
                  onChange={(e) => set("site", e.target.value)}
                  aria-invalid={!!errors.site}
                  aria-describedby={errors.site ? "site-err" : undefined}
                />
                <FieldError id="site-err" msg={errors.site} />
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#d7ff3a]"
                    checked={data.semSite}
                    onChange={(e) => {
                      set("semSite", e.target.checked);
                      setErrors({});
                    }}
                  />
                  Ainda não tenho site (só Instagram ou nada)
                </label>
              </div>

              <div>
                <p id="melhorias-label" className="mb-2.5 text-sm font-medium">
                  O que você gostaria de melhorar? <span className="font-normal text-dim">(opcional)</span>
                </p>
                <div role="group" aria-labelledby="melhorias-label" className="flex flex-wrap gap-2">
                  {improvements.map((m) => {
                    const on = data.melhorias?.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleImprovement(m)}
                        className={`rounded-full border px-3.5 py-2 text-sm transition-all duration-300 ${
                          on ? "border-signal bg-signal/10 text-signal" : "border-line-strong text-muted hover:border-white/30 hover:text-fg"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  rows={2}
                  aria-label="Conte mais, se quiser"
                  placeholder="Conte mais, se quiser"
                  className="field mt-3 resize-none"
                  value={data.mensagem}
                  onChange={(e) => set("mensagem", e.target.value)}
                />
              </div>

              <div>
                <p id="urgencia-label" className="mb-2.5 text-sm font-medium">
                  Qual a urgência?
                </p>
                <div role="radiogroup" aria-labelledby="urgencia-label" className="grid grid-cols-2 gap-2">
                  {urgencies.map((u) => (
                    <label
                      key={u}
                      className={`cursor-pointer rounded-xl border px-3.5 py-3 text-sm transition-all duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal ${
                        data.urgencia === u ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted hover:border-white/30"
                      }`}
                    >
                      <input type="radio" name="urgencia" value={u} className="sr-only" checked={data.urgencia === u} onChange={() => set("urgencia", u)} />
                      {u}
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit" size="lg" arrow className="w-full">
                Continuar
              </Button>
            </motion.fieldset>
          )}

          {step === 2 && (
            <motion.fieldset key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }} className="grid gap-5">
              <legend className="mb-1 text-lg font-medium">Para onde enviamos a análise?</legend>
              <div className="grid gap-5 sm:grid-cols-2">
                {(
                  [
                    ["nome", "Seu nome", "text", "name", "Como podemos te chamar"],
                    ["empresa", "Empresa", "text", "organization", "Nome da empresa"],
                    ["whatsapp", "WhatsApp", "tel", "tel", "(00) 00000-0000"],
                    ["email", "E-mail", "email", "email", "voce@empresa.com.br"],
                  ] as const
                ).map(([k, label, type, ac, ph]) => (
                  <div key={k}>
                    <label htmlFor={k} className="mb-2 block text-sm font-medium">
                      {label}
                    </label>
                    <input
                      id={k}
                      type={type}
                      autoComplete={ac}
                      placeholder={ph}
                      className="field"
                      value={data[k]}
                      onChange={(e) => set(k, k === "whatsapp" ? maskPhone(e.target.value) : e.target.value)}
                      aria-invalid={!!errors[k]}
                      aria-describedby={errors[k] ? `${k}-err` : undefined}
                    />
                    <FieldError id={`${k}-err`} msg={errors[k]} />
                  </div>
                ))}
              </div>
              {status === "error" && <SubmitError message="Olá! Quero uma análise gratuita do meu site." />}
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button type="submit" size="lg" arrow className="flex-1" disabled={status === "sending"}>
                  {status === "sending" ? "Enviando…" : "Quero minha análise gratuita"}
                </Button>
              </div>
              <p className="text-xs text-dim">Usamos seus dados só para enviar a análise e falar sobre ela. Nada de spam.</p>
            </motion.fieldset>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="py-6 text-center" role="status">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-signal text-ink-950">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="mt-6 text-2xl font-medium tracking-tight">Pedido recebido, {data.nome.split(" ")[0]}.</p>
              <p className="mx-auto mt-3 max-w-sm text-muted">
                Vamos analisar {data.semSite ? "a presença digital da sua empresa" : "seu site"} e retornar pelo WhatsApp ou e-mail informado.
              </p>
              {whatsappLink() && (
                <div className="mt-8">
                  <ButtonLink href={whatsappLink(`Olá! Acabei de pedir a análise gratuita para ${data.empresa}.`)!} variant="secondary" target="_blank" rel="noopener">
                    Adiantar a conversa no WhatsApp
                  </ButtonLink>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
