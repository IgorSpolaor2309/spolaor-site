"use client";

import { useEffect, useRef, useState } from "react";
import { context } from "@/lib/leads/client";
import { trackCheckoutRegistered, trackCheckoutView, trackPaymentRedirect } from "@/lib/analytics";
import { arrependimentoTexto, renewalTerms, type Meio } from "@/lib/ia/terms";

// Dados mínimos da assinatura e do acesso: o nome completo vira o nome do cliente no ZappMillion, o e-mail
// recebe o convite e o WhatsApp é o contato da Spolaor com o comprador. O servidor cria a assinatura com o
// preço definido por ele e devolve o link do Mercado Pago; nenhum dado de cartão passa pelo site. A chave do
// pedido fica salva no navegador: clique duplo ou recarregar a página reutilizam a mesma assinatura.

type Campo = "nome" | "email" | "telefone" | "aceite";
type Errors = Partial<Record<Campo, string>>;
const CHAVE = "spolaor:atendimento-ia:pedido";
const VALIDADE = 86_400_000;

function chavePedido(email: string) {
  const alvo = email.trim().toLowerCase();
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as { chave: string; email: string; em: number } | null;
    if (salvo && salvo.email === alvo && Date.now() - salvo.em < VALIDADE) return salvo.chave;
    const chave = crypto.randomUUID();
    localStorage.setItem(CHAVE, JSON.stringify({ chave, email: alvo, em: Date.now() }));
    return chave;
  } catch {
    return crypto.randomUUID();
  }
}

function Field({ name, label, hint, error, ...rest }: { name: Campo; label: string; hint?: string; error?: string } & React.ComponentProps<"input">) {
  const id = `ia-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[0.95rem] font-medium">
        {label}
      </label>
      <input id={id} name={name} className="field" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
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

export function CheckoutForm({ price, cycle, methods, acesso = null }: { price: number; cycle: string; methods: Meio[]; acesso?: string | null }) {
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "error" | "ja_contratada">("idle");
  const enviando = useRef(false);
  const brl = price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // Id desta abertura da tela: o estado sobrevive à reexecução de efeitos do React, então o evento sai uma vez.
  const [abertura] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  // Entrada no checkout disponível (a página só monta o formulário com a contratação aberta). Validação
  // interna não é medida.
  useEffect(() => {
    if (!acesso) trackCheckoutView(abertura, price);
  }, [abertura, acesso, price]);

  async function enviar(body: Record<string, unknown>, tentativa = 0): Promise<void> {
    const res = await fetch("/api/atendimento-ia/contratar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 422 && data.errors) {
      setErrors({ ...data.errors, nome: data.errors.responsavel });
      setState("idle");
      enviando.current = false;
      return;
    }
    // Outra aba ou clique ainda está criando esta assinatura: espera e pega o mesmo link.
    if (data.error === "em_andamento" && tentativa < 5) {
      await new Promise((r) => setTimeout(r, 1500));
      return enviar(body, tentativa + 1);
    }
    if (data.error === "ja_contratada") {
      setState("ja_contratada");
      enviando.current = false;
      return;
    }
    if (!res.ok || !data.ok || !data.checkoutUrl || !data.id) throw new Error(String(res.status));
    try {
      if (data.acompanhar) localStorage.setItem("spolaor:atendimento-ia", data.acompanhar);
    } catch {
      // sem localStorage: o link de retorno do Mercado Pago continua funcionando
    }
    // Cadastro aceito e encaminhamento: medidos só com o id e o link devolvidos pela API, nunca na
    // validação interna. Um intervalo curto dá tempo de o Pixel enviar; a navegação acontece de qualquer jeito.
    if (!acesso) {
      const registrou = trackCheckoutRegistered(String(data.id));
      const encaminhou = trackPaymentRedirect(String(data.id));
      if (registrou || encaminhou) await new Promise((r) => setTimeout(r, 300));
    }
    window.location.assign(data.checkoutUrl);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando.current) return;
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "");
    enviando.current = true;
    setState("sending");
    setErrors({});
    try {
      await enviar({
        responsavel: String(f.get("nome") ?? ""),
        email,
        telefone: String(f.get("telefone") ?? ""),
        aceite: f.get("aceite") === "on",
        website: String(f.get("website") ?? ""),
        chavePedido: chavePedido(email),
        ...(acesso ? { acesso } : {}),
        utm: context().utm,
      });
    } catch {
      setState("error");
      enviando.current = false;
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Dados da assinatura" className="grid gap-5 rounded-[16px] border border-line-strong bg-ink-900 p-5 sm:p-8">
      <Field name="nome" label="Nome completo" autoComplete="name" required error={errors.nome} />
      <Field name="email" label="E-mail" type="email" autoComplete="email" inputMode="email" required hint="O convite de acesso à plataforma chega neste e-mail." error={errors.email} />
      <Field
        name="telefone"
        label="WhatsApp com DDD"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        hint="Para falarmos com você, se precisar. O número do atendimento você conecta depois, no painel."
        error={errors.telefone}
      />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div>
        <label className="flex gap-3 text-[0.9rem] leading-snug text-muted">
          <input type="checkbox" name="aceite" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-royal)]" aria-invalid={errors.aceite ? true : undefined} />
          <span>
            Entendi que a assinatura custa {brl} {cycle}. {renewalTerms(methods, cycle).join(" ")} {arrependimentoTexto} Posso cancelar quando quiser, sem novas cobranças e mantendo o
            acesso até o fim do período já pago. As mensagens cobradas pela Meta no WhatsApp são pagas à parte.
          </span>
        </label>
        {errors.aceite && <p className="mt-1.5 text-sm text-ember">{errors.aceite}</p>}
      </div>
      {state === "error" && (
        <p role="alert" className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember-soft">
          Não foi possível abrir o pagamento agora. Nada foi cobrado. Confira o e-mail ou tente de novo em alguns minutos. Se persistir, fale com a Spolaor.
        </p>
      )}
      {state === "ja_contratada" && (
        <p role="alert" className="rounded-xl border border-line-strong px-4 py-3 text-sm text-fg">
          Já existe uma assinatura em andamento para este pedido. Acompanhe pelo link de retorno do pagamento ou fale com a Spolaor.
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className="inline-flex min-h-14 items-center justify-center rounded-[10px] bg-royal px-7 text-[1.02rem] font-semibold text-white disabled:opacity-60">
        {state === "sending" ? "Abrindo o pagamento…" : "Continuar para pagamento"}
      </button>
      <p className="text-center text-sm text-dim">Você conclui o pagamento no ambiente seguro do Mercado Pago. O site não recebe dados do cartão.</p>
    </form>
  );
}
