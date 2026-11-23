"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, ButtonLink } from "@/components/ui/button";
import { mascararTelefone } from "@/lib/leads/phone-input";
import { AVISO_RETORNO, PEDIDO_CHAVES, PEDIDOS, isPedido, validateLead, type LeadOrigem, type LeadPayload, type LeadTipo, type PedidoChave } from "@/lib/leads/schema";
import { formStartProps, submitLead } from "@/lib/leads/client";
import { FormUnavailable, SubmitError } from "./submit-error";
import { whatsappLink } from "@/lib/site";

type Errors = Partial<Record<keyof LeadPayload, string>>;

function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="mt-1.5 text-sm text-ember-soft">
      {msg}
    </p>
  ) : null;
}

/** Link com ?servico=site (ou o antigo ?interesse=Automação) já marca a opção; a pessoa vê e pode trocar. */
function pedidoDaUrl(): PedidoChave | undefined {
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("servico");
    if (isPedido(s)) return s;
    const i = (q.get("interesse") ?? "").toLowerCase();
    if (i.startsWith("automa")) return "automacao";
    if (i.startsWith("site") || i.startsWith("landing")) return "site";
    if (i.startsWith("loja")) return "loja";
    if (i.startsWith("agend")) return "agendamento";
  } catch {
    // sem acesso à URL: nada pré-marcado
  }
  return undefined;
}

/**
 * Pedido em poucas perguntas, para quem chega pela home, por /analise ou por /contato (inclusive dos anúncios gerais de
 * serviços). Passo 1: o que precisa (site, loja virtual, agendamento, automação ou ajuda para identificar), uma pergunta
 * curta adaptada à escolha (obrigatória), nome do negócio e site ou Instagram (opcionais, com "ainda não tenho").
 * Passo 2: contato. A pergunta mostrada é gravada pelo servidor junto com a resposta.
 */
export function PedidoForm({
  origem,
  tipo = "analise",
  submitLabel = "Enviar pedido",
  available = true,
  titulo = "O que você precisa?",
}: {
  origem: LeadOrigem;
  tipo?: LeadTipo;
  submitLabel?: string;
  /** false enquanto não há destino de leads: avisa e bloqueia o envio */
  available?: boolean;
  titulo?: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "unavailable">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [data, setData] = useState<LeadPayload>({
    tipo,
    formulario: "pedido",
    origem,
    pedido: undefined,
    nome: "",
    empresa: "",
    semEmpresa: false,
    whatsapp: "",
    email: "",
    site: "",
    semSite: false,
    mensagem: "",
    aviso: AVISO_RETORNO.versao,
  });

  useEffect(() => {
    const p = pedidoDaUrl();
    if (p) setData((d) => (d.pedido ? d : { ...d, pedido: p }));
  }, []);

  const set = <K extends keyof LeadPayload>(k: K, v: LeadPayload[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const id = (k: string) => `${origem}-pedido-${k}`;
  const escolhido = data.pedido ? PEDIDOS[data.pedido] : null;

  const next = () => {
    const errs: Errors = {};
    if (!data.pedido) errs.pedido = "Escolha o que você precisa.";
    else if ((data.mensagem ?? "").trim().length < 3) errs.mensagem = "Conte em poucas palavras o que você quer resolver.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      document.getElementById(errs.pedido ? id("pedido-label") : id("mensagem"))?.focus();
      return;
    }
    setStep(2);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 1) return next();
    if (!available) return;
    const errs = validateLead(data);
    if (Object.keys(errs).length) {
      setErrors(errs);
      if (errs.pedido || errs.mensagem) setStep(1);
      // Erro num campo que este formulário não mostra: avisa em vez de ficar parado sem explicação.
      else if (!errs.nome && !errs.whatsapp && !errs.email) setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      const honeypot = (e.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value;
      const result = await submitLead(data, honeypot);
      if (!result.ok) {
        if (result.errors) {
          setErrors(result.errors);
          if (result.errors.pedido || result.errors.mensagem) setStep(1);
        }
        setStatus(result.unavailable ? "unavailable" : "error");
        return;
      }
      setStep(3);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

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

      <form {...formStartProps(origem)} onSubmit={submit} noValidate className="p-6 md:p-8" aria-label="Fazer um pedido à Spolaor" data-formulario="pedido">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        {!available && step < 3 && (
          <div className="mb-6">
            <FormUnavailable />
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.fieldset key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }} className="grid gap-6">
              <legend className="sr-only">Seu pedido</legend>

              <div>
                <p id={id("pedido-label")} tabIndex={-1} className="mb-2.5 text-sm font-medium outline-none">
                  {titulo}
                </p>
                <div role="radiogroup" aria-labelledby={id("pedido-label")} aria-describedby={errors.pedido ? id("pedido-err") : undefined} className="grid gap-2 sm:grid-cols-2">
                  {PEDIDO_CHAVES.map((k) => {
                    const on = data.pedido === k;
                    return (
                      <label
                        key={k}
                        className={`cursor-pointer rounded-xl border px-3.5 py-3 text-sm leading-snug transition-all duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal ${
                          k === "nao-sei" ? "sm:col-span-2" : ""
                        } ${on ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted hover:border-fg/30 hover:text-fg"}`}
                      >
                        <input type="radio" name={id("pedido")} value={k} className="sr-only" checked={on} onChange={() => set("pedido", k)} />
                        {PEDIDOS[k].rotulo}
                      </label>
                    );
                  })}
                </div>
                <FieldError id={id("pedido-err")} msg={errors.pedido} />
              </div>

              {escolhido && (
                <div>
                  <label htmlFor={id("mensagem")} className="mb-2 block text-sm font-medium">
                    {escolhido.pergunta}
                  </label>
                  <textarea
                    id={id("mensagem")}
                    rows={3}
                    required
                    maxLength={4000}
                    placeholder={escolhido.exemplo}
                    className="field resize-none"
                    value={data.mensagem}
                    onChange={(e) => set("mensagem", e.target.value)}
                    aria-invalid={!!errors.mensagem}
                    aria-describedby={errors.mensagem ? id("mensagem-err") : undefined}
                  />
                  <FieldError id={id("mensagem-err")} msg={errors.mensagem} />
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor={id("empresa")} className="mb-2 block text-sm font-medium">
                    Nome do negócio <span className="font-normal text-dim">(opcional)</span>
                  </label>
                  <input
                    id={id("empresa")}
                    type="text"
                    autoComplete="organization"
                    placeholder={data.semEmpresa ? "Ainda estou começando" : "Ex.: Doces da Ana"}
                    className="field disabled:opacity-60"
                    value={data.empresa}
                    disabled={data.semEmpresa}
                    onChange={(e) => set("empresa", e.target.value)}
                  />
                  <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm leading-snug text-muted">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-signal" checked={!!data.semEmpresa} onChange={(e) => setData((d) => ({ ...d, semEmpresa: e.target.checked, empresa: e.target.checked ? "" : d.empresa }))} />
                    Ainda estou começando
                  </label>
                </div>
                <div>
                  <label htmlFor={id("site")} className="mb-2 block text-sm font-medium">
                    Site ou Instagram atual <span className="font-normal text-dim">(se tiver)</span>
                  </label>
                  <input
                    id={id("site")}
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    placeholder={data.semSite ? "Ainda não tenho" : "site.com.br ou @perfil"}
                    className="field disabled:opacity-60"
                    value={data.site}
                    disabled={data.semSite}
                    onChange={(e) => set("site", e.target.value)}
                  />
                  <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm leading-snug text-muted">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-signal" checked={!!data.semSite} onChange={(e) => setData((d) => ({ ...d, semSite: e.target.checked, site: e.target.checked ? "" : d.site }))} />
                    Ainda não tenho site nem Instagram
                  </label>
                </div>
              </div>

              <Button type="submit" size="lg" arrow className="w-full">
                Continuar
              </Button>
            </motion.fieldset>
          )}

          {step === 2 && (
            <motion.fieldset key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }} className="grid gap-5">
              <legend className="mb-4 text-lg font-medium">Com quem falamos sobre o pedido?</legend>
              {escolhido && (
                <p className="-mt-1 flex flex-wrap items-baseline gap-x-2 rounded-xl border border-line bg-fg/[0.03] px-3.5 py-2.5 text-sm leading-snug" data-resumo-pedido>
                  <span className="text-dim">Seu pedido:</span>
                  <span className="font-medium">{escolhido.rotulo}</span>
                  <button type="button" onClick={() => setStep(1)} className="ml-auto font-medium text-signal underline-offset-4 hover:underline">
                    Alterar
                  </button>
                </p>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                {(
                  [
                    ["nome", "Seu nome", "text", "name", "Como podemos te chamar"],
                    ["whatsapp", "WhatsApp", "tel", "tel", "(00) 00000-0000"],
                    ["email", "E-mail (opcional)", "email", "email", "voce@email.com.br"],
                  ] as const
                ).map(([k, label, type, ac, ph]) => (
                  <div key={k} className={k === "email" ? "sm:col-span-2" : undefined}>
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
                      onChange={(e) => set(k, k === "whatsapp" ? mascararTelefone(e, data.whatsapp) : e.target.value)}
                      aria-invalid={!!errors[k]}
                      aria-describedby={errors[k] ? id(`${k}-err`) : undefined}
                    />
                    <FieldError id={id(`${k}-err`)} msg={errors[k]} />
                  </div>
                ))}
              </div>
              {(status === "error" || status === "unavailable") && (
                <SubmitError message={`Olá! Quero falar com a Spolaor sobre: ${escolhido?.rotulo ?? "um pedido"}.`} unavailable={status === "unavailable"} />
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button type="submit" size="lg" arrow className="flex-1" disabled={status === "sending" || !available}>
                  {status === "sending" ? "Enviando…" : submitLabel}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-dim" data-aviso-retorno={AVISO_RETORNO.versao}>
                {AVISO_RETORNO.texto} Usamos seus dados só para responder a este pedido. Nada de spam.
              </p>
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
              <p className="mx-auto mt-3 max-w-sm text-muted">
                {escolhido && data.pedido !== "nao-sei" ? (
                  <>
                    Seu pedido de <strong className="font-medium text-fg">{escolhido.rotulo.toLowerCase()}</strong> chegou.{" "}
                  </>
                ) : (
                  "Seu pedido chegou. "
                )}
                Vamos ler o que você contou e chamar você no WhatsApp informado.
              </p>
              {whatsappLink() && (
                <div className="mt-8">
                  <ButtonLink href={whatsappLink(`Olá! Acabei de enviar um pedido pelo site: ${escolhido?.rotulo ?? ""}.`)!} variant="secondary" target="_blank" rel="noopener">
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
