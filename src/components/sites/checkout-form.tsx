"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { context } from "@/lib/leads/client";
import { trackSiteCheckoutView } from "@/lib/analytics";
import { brl, CONDICOES, type CondicaoId } from "@/lib/sites/oferta";

// Checkout do pacote "Site de uma página": só nome, e-mail e WhatsApp (para a conversa inicial) e a condição de
// pagamento. O valor cobrado é definido pelo servidor pela condição escolhida; nenhum dado de cartão passa por aqui.
// A chave do pedido fica no navegador: clique duplo ou recarregar reaproveitam o mesmo pedido.

type Campo = "nome" | "email" | "whatsapp" | "condicao" | "aceite";
type Errors = Partial<Record<Campo, string>>;
const CHAVE = "spolaor:sites-pacote:pedido";
const VALIDADE = 86_400_000;

function chavePedido(email: string, cond: string) {
  const alvo = `${email.trim().toLowerCase()}|${cond}`;
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as { chave: string; alvo: string; em: number } | null;
    if (salvo && salvo.alvo === alvo && Date.now() - salvo.em < VALIDADE) return salvo.chave;
    const chave = crypto.randomUUID();
    localStorage.setItem(CHAVE, JSON.stringify({ chave, alvo, em: Date.now() }));
    return chave;
  } catch {
    return crypto.randomUUID();
  }
}

function rotulo(c: (typeof CONDICOES)[number]) {
  if (c.meio === "pix") return { titulo: "Pix", linha: `R$ ${brl(c.total)}`, nota: "à vista" };
  if (c.parcelas === 1) return { titulo: "Cartão 1×", linha: `R$ ${brl(c.total)}`, nota: "à vista no cartão" };
  return { titulo: `Cartão ${c.parcelas}×`, linha: `${c.parcelas}× de R$ ${brl(c.parcela)}`, nota: `total R$ ${brl(c.total)}` };
}

function Field({ name, label, hint, error, ...rest }: { name: Campo; label: string; hint?: string; error?: string } & React.ComponentProps<"input">) {
  const id = `site-${name}`;
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

export function SiteCheckoutForm({ disponiveis, inicial }: { disponiveis: CondicaoId[]; inicial: CondicaoId }) {
  const router = useRouter();
  const opcoes = CONDICOES.filter((c) => disponiveis.includes(c.id));
  const [cond, setCond] = useState<CondicaoId>(inicial);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const enviando = useRef(false);
  const escolhida = opcoes.find((c) => c.id === cond) ?? opcoes[0];
  // Id desta abertura da tela: InitiateCheckout sai uma vez por abertura, com o total da condição exibida.
  const [abertura] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    trackSiteCheckoutView(abertura, escolhida.total);
    // só na entrada: trocar a condição não é nova entrada no checkout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abertura]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando.current) return;
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const whatsapp = String(f.get("whatsapp") ?? "").trim();
    const aceite = f.get("aceite") === "on";
    const errs: Errors = {};
    if (nome.length < 2) errs.nome = "Informe o seu nome.";
    if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/.test(email)) errs.email = "Informe um e-mail válido.";
    if (whatsapp.replace(/\D/g, "").length < 10) errs.whatsapp = "Informe o WhatsApp com DDD.";
    if (!aceite) errs.aceite = "É preciso concordar com as condições do pacote para continuar.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`site-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    enviando.current = true;
    setState("sending");
    setMensagem(null);
    try {
      const res = await fetch("/api/sites-pacote/pedido", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome, email, whatsapp, condicao: escolhida.id, aceite, chavePedido: chavePedido(email, escolhida.id), utm: context().utm, website: f.get("website") }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; acompanhar?: string; errors?: Errors; message?: string; error?: string };
      if (data.ok && data.acompanhar) {
        router.push(data.acompanhar);
        return;
      }
      if (data.errors) setErrors(data.errors);
      setMensagem(
        data.message ??
          (data.error === "contratacao_indisponivel"
            ? "A contratação está indisponível no momento. Fale com a Spolaor pelo WhatsApp."
            : data.error === "condicao_indisponivel"
              ? "Esta condição de pagamento não está disponível agora. Escolha outra."
              : data.error === "pedido_divergente"
                ? "Já existe um pedido aberto neste navegador com outros dados. Recarregue a página e tente de novo."
                : "Não foi possível criar o pedido agora. Nada foi cobrado. Tente de novo em instantes."),
      );
      setState("error");
    } catch {
      setMensagem("Sem conexão com o servidor. Nada foi cobrado. Tente de novo.");
      setState("error");
    } finally {
      enviando.current = false;
      setState((s) => (s === "sending" ? "idle" : s));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 rounded-[16px] border border-line-strong bg-ink-900 p-5 sm:p-7" aria-label="Contratar o site de uma página">
      <div className="rounded-[12px] bg-ink-950 px-4 py-3" aria-live="polite">
        <p className="text-sm text-muted">Você vai pagar</p>
        <p className="mt-0.5 text-[1.35rem] font-semibold tabular-nums tracking-[-0.02em]">
          {escolhida.parcelas > 1 ? `${escolhida.parcelas}× de R$ ${brl(escolhida.parcela)}` : `R$ ${brl(escolhida.total)}`}
          <span className="ml-2 text-[0.95rem] font-medium text-muted">{escolhida.meio === "pix" ? "no Pix" : escolhida.parcelas > 1 ? "no cartão" : "no cartão, à vista"}</span>
        </p>
        <p className="text-[0.95rem] font-semibold">Total: R$ {brl(escolhida.total)}</p>
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="mb-2 text-[0.95rem] font-medium">Forma de pagamento</legend>
        {opcoes.map((c) => {
          const r = rotulo(c);
          const ativo = c.id === escolhida.id;
          return (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-[12px] border px-4 py-2.5 transition-colors ${ativo ? "border-royal bg-royal/[0.05]" : "border-line hover:border-line-strong"}`}
            >
              <span className="flex items-center gap-3">
                <input type="radio" name="condicao" value={c.id} checked={ativo} onChange={() => setCond(c.id)} className="h-4 w-4 accent-[#1e5be6]" />
                <span className="whitespace-nowrap font-semibold">{r.titulo}</span>
              </span>
              <span className="whitespace-nowrap text-right leading-tight">
                <span className="block font-semibold tabular-nums">{r.linha}</span>
                <span className="block text-[0.82rem] text-dim">{r.nota}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <Field name="nome" label="Seu nome" autoComplete="name" error={errors.nome} required maxLength={120} />
      <Field name="email" label="E-mail" type="email" inputMode="email" autoComplete="email" error={errors.email} required maxLength={160} />
      <Field
        name="whatsapp"
        label="WhatsApp com DDD"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        hint="É por ele que vamos combinar as informações e os materiais do site."
        error={errors.whatsapp}
        required
        maxLength={30}
      />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div>
        <label className="flex items-start gap-3 text-[0.92rem] leading-relaxed text-muted">
          <input type="checkbox" name="aceite" id="site-aceite" className="mt-1 h-4 w-4 shrink-0 accent-[#1e5be6]" aria-invalid={errors.aceite ? true : undefined} />
          <span>
            Concordo com o pacote: site de uma página, uma rodada de ajustes, prazos contados a partir do recebimento das informações e dos materiais,
            e domínio e hospedagem contratados e pagos à parte por mim.
          </span>
        </label>
        {errors.aceite && <p className="mt-1.5 text-sm text-ember">{errors.aceite}</p>}
      </div>

      {mensagem && (
        <p role="alert" className="rounded-[10px] border border-[#f07a12] px-4 py-3 text-sm text-fg">
          {mensagem}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex min-h-14 items-center justify-center rounded-[10px] bg-royal px-7 text-[1.02rem] font-semibold text-white transition-colors hover:bg-[#1a4fcc] disabled:opacity-60"
      >
        {state === "sending" ? "Criando o pedido…" : escolhida.meio === "pix" ? "Continuar para o Pix" : "Continuar para o pagamento"}
      </button>
      <p className="text-center text-[0.82rem] text-dim">Pagamento processado pelo Mercado Pago. Pagamento único, não é assinatura.</p>
    </form>
  );
}
