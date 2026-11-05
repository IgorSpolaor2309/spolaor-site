"use client";

import { useState } from "react";
import { context } from "@/lib/leads/client";

// Contratação: dados do responsável e aceite das condições. O servidor cria a assinatura com o
// preço definido por ele e devolve o link do checkout do Mercado Pago. Nenhum dado de cartão
// passa pelo site. O retorno do checkout leva à página de acompanhamento, que mostra só o que
// o servidor confirmou.

type Errors = Partial<Record<"empresa" | "responsavel" | "email" | "telefone" | "aceite", string>>;

function Field({ name, label, hint, error, ...rest }: { name: keyof Errors; label: string; hint?: string; error?: string } & React.ComponentProps<"input">) {
  const id = `ia-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[0.95rem] font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-sm text-ember">
          {error}
        </p>
      )}
    </div>
  );
}

export function HireForm({ price, replyLimit }: { price: number; replyLimit: number }) {
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const brl = price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      empresa: String(f.get("empresa") ?? ""),
      responsavel: String(f.get("responsavel") ?? ""),
      email: String(f.get("email") ?? ""),
      telefone: String(f.get("telefone") ?? ""),
      segmento: String(f.get("segmento") ?? ""),
      aceite: f.get("aceite") === "on",
      website: String(f.get("website") ?? ""),
      utm: context().utm,
    };
    setState("sending");
    setErrors({});
    try {
      const res = await fetch("/api/atendimento-ia/contratar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data.errors) {
        setErrors(data.errors);
        setState("idle");
        return;
      }
      if (!res.ok || !data.checkoutUrl) throw new Error(String(res.status));
      try {
        localStorage.setItem("spolaor:atendimento-ia", data.acompanhar);
      } catch {
        // sem localStorage: o link de retorno do Mercado Pago continua funcionando
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Contratar atendimento com IA no WhatsApp" className="grid gap-5 rounded-[16px] border border-line-strong bg-ink-900 p-5 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-4">
        <p className="text-[1.6rem] font-semibold tracking-[-0.03em]">
          {brl}
          <span className="text-base font-normal text-muted"> por mês</span>
        </p>
        <p className="text-sm text-muted">Até {replyLimit.toLocaleString("pt-BR")} respostas do agente por mês</p>
      </div>
      <Field name="empresa" label="Nome da empresa" autoComplete="organization" required error={errors.empresa} />
      <Field name="responsavel" label="Seu nome" autoComplete="name" required error={errors.responsavel} />
      <Field name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" required hint="O convite de acesso à plataforma chega neste e-mail." error={errors.email} />
      <Field
        name="telefone"
        label="Seu telefone com DDD"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        hint="Para falarmos com você, se precisar. O WhatsApp do atendimento você conecta depois, no painel."
        error={errors.telefone}
      />
      <div>
        <label htmlFor="ia-segmento" className="mb-2 block text-[0.95rem] font-medium">
          Ramo da empresa <span className="font-normal text-dim">(opcional)</span>
        </label>
        <input id="ia-segmento" name="segmento" className="field" placeholder="Ex.: estética, imobiliária, assistência técnica" />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div>
        <label className="flex gap-3 text-[0.92rem] leading-snug">
          <input type="checkbox" name="aceite" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-royal)]" aria-invalid={errors.aceite ? true : undefined} />
          <span>
            Entendi que a assinatura é mensal e renovada automaticamente no Mercado Pago, que posso cancelar quando quiser e manter o acesso até o
            fim do período já pago, e que as mensagens cobradas pela Meta no WhatsApp são pagas à parte.
          </span>
        </label>
        {errors.aceite && <p className="mt-1.5 text-sm text-ember">{errors.aceite}</p>}
      </div>
      {state === "error" && (
        <p role="alert" className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember-soft">
          Não foi possível abrir o pagamento agora. Nada foi cobrado. Tente de novo em alguns minutos ou fale com a Spolaor.
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex min-h-14 items-center justify-center rounded-[10px] bg-royal px-7 text-[1.02rem] font-semibold text-white disabled:opacity-60"
      >
        {state === "sending" ? "Abrindo o pagamento…" : "Continuar para o pagamento"}
      </button>
      <p className="text-center text-sm text-dim">Pagamento processado pelo Mercado Pago. O site não recebe os dados do seu cartão.</p>
    </form>
  );
}
