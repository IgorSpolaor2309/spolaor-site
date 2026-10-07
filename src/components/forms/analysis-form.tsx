"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, ButtonLink } from "@/components/ui/button";
import { maskPhone, validateLead, type LeadOrigem, type LeadPayload } from "@/lib/leads/schema";
import { submitLead } from "@/lib/leads/client";
import { PROBLEMAS, SEGMENTOS, SEGMENTO_DA_ORIGEM } from "@/lib/segments";
import { SubmitError } from "./submit-error";
import { whatsappLink } from "@/lib/site";

type Errors = Partial<Record<keyof LeadPayload, string>>;

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="mt-1.5 text-sm text-ember-soft">
      {msg}
    </p>
  ) : null;
}

function Choice({ name, value, checked, onChange, children }: { name: string; value: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label
      className={`cursor-pointer rounded-xl border px-3.5 py-3 text-sm leading-snug transition-all duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal ${
        checked ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted hover:border-fg/30 hover:text-fg"
      }`}
    >
      <input type="radio" name={name} value={value} className="sr-only" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

/**
 * Formulário do diagnóstico gratuito, usado na home, nas landings de segmento, em /analise e
 * em /sites. Passo 1: o problema (e o segmento, quando a página não sabe). Passo 2: contato.
 * A origem vem da página que renderiza o formulário e segue junto com o lead para /api/lead.
 */
export function AnalysisForm({
  origem = "home",
  problemas,
  submitLabel = "Quero meu diagnóstico",
}: {
  origem?: LeadOrigem;
  problemas?: string[];
  submitLabel?: string;
}) {
  const fixedSegment = SEGMENTO_DA_ORIGEM[origem];
  const options = problemas ?? (origem === "corretores" || origem === "clinicas" || origem === "orcamentos" ? PROBLEMAS[origem] : PROBLEMAS.geral);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [data, setData] = useState<LeadPayload>({
    tipo: "analise",
    origem,
    segmento: fixedSegment ?? "",
    problema: "",
    nome: "",
    empresa: "",
    whatsapp: "",
    email: "",
    site: "",
    mensagem: "",
  });

  const set = <K extends keyof LeadPayload>(k: K, v: LeadPayload[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const next = () => {
    const errs: Errors = {};
    if (!data.segmento) errs.segmento = "Escolha o segmento da empresa.";
    if (!data.problema) errs.problema = "Escolha o que mais pesa hoje.";
    if (Object.keys(errs).length) {
      setErrors(errs);
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
      if (errs.segmento || errs.problema) setStep(1);
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

  const id = (k: string) => `${origem}-${k}`;

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-line-strong bg-ink-900">
      {step < 3 && (
        <div className="flex items-center gap-3 border-b border-line px-6 py-4 md:px-8">
          <span className="font-mono text-xs text-dim">Passo {step} de 2</span>
          <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-fg/10">
            <span className="absolute inset-y-0 left-0 rounded-full bg-signal transition-all duration-700 ease-out-expo" style={{ width: step === 1 ? "50%" : "100%" }} />
          </span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="p-6 md:p-8" aria-label="Solicitar diagnóstico gratuito">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.fieldset key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }} className="grid gap-6">
              <legend className="sr-only">Sobre a sua empresa</legend>

              {!fixedSegment && (
                <div>
                  <p id={id("segmento-label")} className="mb-2.5 text-sm font-medium">
                    Qual é o seu negócio?
                  </p>
                  <div role="radiogroup" aria-labelledby={id("segmento-label")} aria-describedby={errors.segmento ? id("segmento-err") : undefined} className="grid grid-cols-2 gap-2">
                    {SEGMENTOS.map((s) => (
                      <Choice key={s} name={id("segmento")} value={s} checked={data.segmento === s} onChange={() => set("segmento", s)}>
                        {s}
                      </Choice>
                    ))}
                  </div>
                  <FieldError id={id("segmento-err")} msg={errors.segmento} />
                </div>
              )}

              <div>
                <p id={id("problema-label")} className="mb-2.5 text-sm font-medium">
                  O que mais pesa hoje?
                </p>
                <div role="radiogroup" aria-labelledby={id("problema-label")} aria-describedby={errors.problema ? id("problema-err") : undefined} className="grid gap-2 sm:grid-cols-2">
                  {options.map((p) => (
                    <Choice key={p} name={id("problema")} value={p} checked={data.problema === p} onChange={() => set("problema", p)}>
                      {p}
                    </Choice>
                  ))}
                </div>
                <FieldError id={id("problema-err")} msg={errors.problema} />
                <textarea
                  rows={2}
                  aria-label="Conte mais, se quiser"
                  placeholder="Conte mais, se quiser (opcional)"
                  className="field mt-3 resize-none"
                  value={data.mensagem}
                  onChange={(e) => set("mensagem", e.target.value)}
                />
              </div>

              <div>
                <label htmlFor={id("site")} className="mb-2 block text-sm font-medium">
                  Site <span className="font-normal text-dim">(se tiver)</span>
                </label>
                <input
                  id={id("site")}
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="suaempresa.com.br"
                  className="field"
                  value={data.site}
                  onChange={(e) => set("site", e.target.value)}
                />
              </div>

              <Button type="submit" size="lg" arrow className="w-full">
                Continuar
              </Button>
            </motion.fieldset>
          )}

          {step === 2 && (
            <motion.fieldset key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }} className="grid gap-5">
              <legend className="mb-1 text-lg font-medium">Com quem falamos sobre o diagnóstico?</legend>
              <div className="grid gap-5 sm:grid-cols-2">
                {(
                  [
                    ["nome", "Seu nome", "text", "name", "Como podemos te chamar"],
                    ["empresa", "Empresa", "text", "organization", "Nome da empresa ou o seu"],
                    ["whatsapp", "WhatsApp", "tel", "tel", "(00) 00000-0000"],
                    ["email", "E-mail (opcional)", "email", "email", "voce@empresa.com.br"],
                  ] as const
                ).map(([k, label, type, ac, ph]) => (
                  <div key={k}>
                    <label htmlFor={id(k)} className="mb-2 block text-sm font-medium">
                      {label}
                    </label>
                    <input
                      id={id(k)}
                      type={type}
                      autoComplete={ac}
                      placeholder={ph}
                      className="field"
                      value={data[k]}
                      onChange={(e) => set(k, k === "whatsapp" ? maskPhone(e.target.value) : e.target.value)}
                      aria-invalid={!!errors[k]}
                      aria-describedby={errors[k] ? id(`${k}-err`) : undefined}
                    />
                    <FieldError id={id(`${k}-err`)} msg={errors[k]} />
                  </div>
                ))}
              </div>
              {status === "error" && <SubmitError message="Olá! Quero o diagnóstico gratuito da Spolaor." />}
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button type="submit" size="lg" arrow className="flex-1" disabled={status === "sending"}>
                  {status === "sending" ? "Enviando…" : submitLabel}
                </Button>
              </div>
              <p className="text-xs text-dim">Usamos seus dados só para falar sobre o diagnóstico. Nada de spam.</p>
            </motion.fieldset>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="py-6 text-center" role="status">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-signal text-white">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="mt-6 text-2xl font-medium tracking-tight">Pedido recebido, {data.nome.split(" ")[0]}.</p>
              <p className="mx-auto mt-3 max-w-sm text-muted">Vamos olhar o que você contou e chamar você no WhatsApp informado.</p>
              {whatsappLink() && (
                <div className="mt-8">
                  <ButtonLink href={whatsappLink(`Olá! Acabei de pedir o diagnóstico para ${data.empresa}.`)!} variant="secondary" target="_blank" rel="noopener">
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
