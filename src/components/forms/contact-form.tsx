"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { maskPhone, validateLead, type LeadPayload } from "@/lib/leads/schema";
import { submitLead } from "@/lib/leads/client";
import { SubmitError } from "./submit-error";

const interests = ["Site", "Automação", "Sistema", "E-commerce", "Identidade visual", "Consultoria", "Ainda não sei"];
const urgencies = ["Quero resolver logo", "Nos próximos 30 dias", "Nos próximos meses", "Só quero entender"];

type Errors = Partial<Record<keyof LeadPayload, string>>;

export function ContactForm() {
  const params = useSearchParams();
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [data, setData] = useState<LeadPayload>({
    tipo: "projeto",
    nome: "",
    empresa: "",
    whatsapp: "",
    email: "",
    site: "",
    servicos: [],
    mensagem: "",
    urgencia: "",
    origem: "contato",
  });

  useEffect(() => {
    const i = params.get("interesse");
    if (i && interests.includes(i)) setData((d) => ({ ...d, servicos: [i] }));
  }, [params]);

  const set = <K extends keyof LeadPayload>(k: K, v: LeadPayload[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validateLead(data);
    if (Object.keys(errs).length) {
      setErrors(errs);
      document.getElementById(Object.keys(errs)[0])?.focus();
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
      setSent(true);
    } catch {
      setStatus("error");
    }
  };

  if (sent)
    return (
      <div role="status" className="rounded-[16px] border border-line-strong bg-ink-900 p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-signal text-ink-950">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="mt-6 text-2xl font-medium tracking-tight">Mensagem recebida, {data.nome.split(" ")[0]}.</p>
        <p className="mx-auto mt-3 max-w-sm text-muted">Vamos ler com atenção e retornar pelo WhatsApp ou e-mail informado.</p>
      </div>
    );

  const fields = [
    ["nome", "Seu nome", "text", "name"],
    ["empresa", "Empresa", "text", "organization"],
    ["whatsapp", "WhatsApp", "tel", "tel"],
    ["email", "E-mail", "email", "email"],
  ] as const;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 rounded-[16px] border border-line-strong bg-ink-900/90 p-6 md:p-9" aria-label="Falar sobre um projeto">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div>
        <p id="interesse-label" className="mb-2.5 text-sm font-medium">
          Sobre o que você quer conversar?
        </p>
        <div role="group" aria-labelledby="interesse-label" className="flex flex-wrap gap-2">
          {interests.map((m) => {
            const on = data.servicos?.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => set("servicos", on ? data.servicos!.filter((x) => x !== m) : [...(data.servicos ?? []), m])}
                className={`rounded-[8px] border px-3.5 py-2 text-sm transition-all duration-300 ${on ? "border-signal bg-signal/10 text-signal" : "border-line-strong text-muted hover:border-fg/30 hover:text-fg"}`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map(([k, label, type, ac]) => (
          <div key={k}>
            <label htmlFor={k} className="mb-2 block text-sm font-medium">
              {label}
            </label>
            <input
              id={k}
              type={type}
              autoComplete={ac}
              className="field"
              value={data[k]}
              placeholder={k === "whatsapp" ? "(00) 00000-0000" : undefined}
              onChange={(e) => set(k, k === "whatsapp" ? maskPhone(e.target.value) : e.target.value)}
              aria-invalid={!!errors[k]}
              aria-describedby={errors[k] ? `${k}-err` : undefined}
            />
            {errors[k] && (
              <p id={`${k}-err`} className="mt-1.5 text-sm text-ember-soft">
                {errors[k]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div>
        <label htmlFor="site-c" className="mb-2 block text-sm font-medium">
          Site atual <span className="font-normal text-dim">(se tiver)</span>
        </label>
        <input id="site-c" type="text" inputMode="url" className="field" placeholder="suaempresa.com.br" value={data.site} onChange={(e) => set("site", e.target.value)} />
      </div>

      <div>
        <label htmlFor="mensagem" className="mb-2 block text-sm font-medium">
          Conte um pouco sobre o projeto ou o problema
        </label>
        <textarea id="mensagem" rows={4} className="field resize-none" value={data.mensagem} onChange={(e) => set("mensagem", e.target.value)} />
      </div>

      <div>
        <p id="urg-c" className="mb-2.5 text-sm font-medium">
          Qual o prazo?
        </p>
        <div role="radiogroup" aria-labelledby="urg-c" className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {urgencies.map((u) => (
            <label key={u} className={`cursor-pointer rounded-xl border px-3.5 py-3 text-sm transition-all duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal ${data.urgencia === u ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted hover:border-fg/30"}`}>
              <input type="radio" name="urgencia-c" className="sr-only" checked={data.urgencia === u} onChange={() => set("urgencia", u)} />
              {u}
            </label>
          ))}
        </div>
      </div>

      {status === "error" && <SubmitError />}
      <Button type="submit" size="lg" arrow disabled={status === "sending"}>
        {status === "sending" ? "Enviando…" : "Enviar mensagem"}
      </Button>
    </form>
  );
}
