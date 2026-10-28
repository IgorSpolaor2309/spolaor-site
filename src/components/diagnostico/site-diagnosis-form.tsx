"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { maskPhone, validateLead, type LeadPayload } from "@/lib/leads/schema";
import { submitLead } from "@/lib/leads/client";
import { FormUnavailable, SubmitError } from "@/components/forms/submit-error";
import { whatsappLink } from "@/lib/site";

type Errors = Partial<Record<keyof LeadPayload, string>>;
type Status = "idle" | "sending" | "error" | "unavailable" | "sent";

// Opcional: ajuda a análise, mas não trava o envio (quem não sabe, simplesmente não marca).
// Rótulo curto na tela; o valor por extenso é o que chega no lead ("Principal problema").
const incomodos = [
  ["Poucos contatos", "Tem visitas, mas poucos contatos"],
  ["Difícil no celular", "Difícil de usar no celular"],
  ["Confuso", "Não deixa claro o que a empresa faz"],
  ["Desatualizado", "Parece desatualizado"],
] as const;

// Ordem dos campos na tela, para levar o foco ao primeiro erro.
const ORDER = ["site", "nome", "whatsapp", "email"] as const;
const fid = (k: string) => `diag-${k}`;

function Field({
  name,
  label,
  error,
  ...input
}: { name: (typeof ORDER)[number]; label: React.ReactNode; error?: string } & Omit<React.ComponentProps<"input">, "name" | "id">) {
  return (
    <div>
      <label htmlFor={fid(name)} className="mb-2 block text-[0.95rem] font-medium">
        {label}
      </label>
      <input
        id={fid(name)}
        name={name}
        className="field"
        aria-invalid={!!error}
        aria-describedby={error ? fid(`${name}-err`) : undefined}
        {...input}
      />
      {error && (
        <p id={fid(`${name}-err`)} className="mt-1.5 text-sm text-ember-soft">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Formulário da landing /diagnostico-site: um passo só, com o endereço do site e um contato.
 * Envia pelo mesmo caminho dos demais (submitLead → /api/lead), com origem "diagnostico-site".
 */
export function SiteDiagnosisForm({ available = true }: { /** false enquanto não há destino de leads */ available?: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [data, setData] = useState<LeadPayload>({
    tipo: "analise",
    origem: "diagnostico-site",
    problema: "",
    nome: "",
    empresa: "",
    whatsapp: "",
    email: "",
    site: "",
  });
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (status === "sent") doneRef.current?.focus();
  }, [status]);

  const set = <K extends keyof LeadPayload>(k: K, v: LeadPayload[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const showErrors = (errs: Errors) => {
    setErrors(errs);
    const first = ORDER.find((k) => errs[k]);
    if (first) formRef.current?.querySelector<HTMLInputElement>(`#${fid(first)}`)?.focus();
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!available || status === "sending") return;
    const errs = validateLead(data);
    if (Object.keys(errs).length) return showErrors(errs);
    setStatus("sending");
    try {
      const honeypot = (e.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value;
      const result = await submitLead(data, honeypot);
      if (!result.ok) {
        if (result.errors) showErrors(result.errors);
        setStatus(result.unavailable ? "unavailable" : "error");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  const legend = "font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim";

  return (
    <div id="solicitar" className="scroll-mt-2 overflow-hidden rounded-[16px] border border-line-strong bg-ink-900 shadow-[0_1px_2px_rgb(20_37_61/0.05)]">
      {status === "sent" ? (
        <div role="status" className="px-6 py-12 text-center sm:px-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-signal text-white">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p ref={doneRef} tabIndex={-1} className="mt-6 text-2xl font-semibold tracking-tight outline-none">
            Pedido recebido, {data.nome.trim().split(" ")[0]}.
          </p>
          <p className="mx-auto mt-3 max-w-sm leading-relaxed text-muted">
            Vamos analisar <span className="break-all font-medium text-fg">{data.site?.trim()}</span> e retornar pelo WhatsApp informado
            com os pontos que mais pesam e o que fazer primeiro.
          </p>
          {whatsappLink() && (
            <div className="mt-8">
              <ButtonLink href={whatsappLink(`Olá! Acabei de pedir o diagnóstico do site ${data.site?.trim()}.`)!} variant="secondary" target="_blank" rel="noopener">
                Adiantar a conversa no WhatsApp
              </ButtonLink>
            </div>
          )}
        </div>
      ) : (
        <form ref={formRef} onSubmit={submit} noValidate aria-label="Solicitar diagnóstico gratuito" className="grid gap-7 p-5 sm:p-8">
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          {!available && <FormUnavailable />}

          <fieldset className="min-w-0">
            <legend className={legend}>1 · O site</legend>
            <div className="mt-4 grid gap-5">
              <Field
                name="site"
                label="Endereço do site"
                type="text"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="suaempresa.com.br"
                value={data.site}
                onChange={(e) => set("site", e.target.value)}
                error={errors.site}
              />
              <fieldset className="min-w-0">
                <legend className="text-[0.95rem] font-medium">
                  O que mais incomoda nele? <span className="font-normal text-dim">(opcional)</span>
                </legend>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {incomodos.map(([label, value]) => {
                    const checked = data.problema === value;
                    return (
                      <label
                        key={value}
                        className={`flex min-h-10 cursor-pointer items-center rounded-[10px] border px-3 py-1.5 text-[0.9rem] leading-snug transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-royal ${
                          checked ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted hover:border-fg/30 hover:text-fg"
                        }`}
                      >
                        <input type="radio" name="incomodo" value={value} className="sr-only" checked={checked} onChange={() => set("problema", value)} />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </fieldset>

          <fieldset className="min-w-0 border-t border-line pt-6">
            <legend className={`${legend} float-left w-full`}>2 · Para onde enviamos o retorno</legend>
            <div className="clear-left grid gap-5 pt-4">
              <Field
                name="nome"
                label="Seu nome"
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                placeholder="Como podemos te chamar"
                value={data.nome}
                onChange={(e) => set("nome", e.target.value)}
                error={errors.nome}
              />
              <Field
                name="whatsapp"
                label="WhatsApp com DDD"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                enterKeyHint="next"
                placeholder="(00) 00000-0000"
                value={data.whatsapp}
                onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
                error={errors.whatsapp}
              />
              <Field
                name="email"
                label={
                  <>
                    E-mail <span className="font-normal text-dim">(opcional)</span>
                  </>
                }
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="send"
                placeholder="voce@empresa.com.br"
                value={data.email}
                onChange={(e) => set("email", e.target.value)}
                error={errors.email}
              />
            </div>
          </fieldset>

          {(status === "error" || status === "unavailable") && (
            <SubmitError message="Olá! Quero o diagnóstico gratuito do meu site." unavailable={status === "unavailable"} />
          )}

          <div className="grid gap-3">
            <Button type="submit" size="lg" arrow className="w-full" disabled={status === "sending" || !available} aria-busy={status === "sending"}>
              {status === "sending" ? "Enviando…" : "Solicitar diagnóstico gratuito"}
            </Button>
            <p className="text-center text-xs leading-relaxed text-dim">Sem custo e sem compromisso. Usamos seus dados só para falar sobre o diagnóstico.</p>
          </div>
        </form>
      )}
    </div>
  );
}
