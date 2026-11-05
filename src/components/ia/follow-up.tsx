"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StatusPublico } from "@/lib/ia/public-status";
import { trackPurchase } from "@/lib/analytics";

// Acompanhamento depois do checkout (autoatendimento). Mostra só o que o servidor confirmou e
// atualiza sozinho. Com o acesso liberado, o comprador segue no painel: configura o agente e
// conecta o próprio WhatsApp.

const dot: Record<string, string> = {
  feito: "bg-royal",
  em_andamento: "bg-[#f07a12]",
  no_painel: "bg-[#f07a12]",
  pendente: "bg-line-strong",
  problema: "bg-ember",
};
const label: Record<string, string> = { feito: "Concluído", em_andamento: "Em andamento", no_painel: "Faça no painel", pendente: "Pendente", problema: "Requer atenção" };

export function FollowUp({ id, token }: { id: string; token: string }) {
  const [status, setStatus] = useState<StatusPublico | null>(null);
  const [painelUrl, setPainelUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelState, setCancelState] = useState<"idle" | "sending" | "error">("idle");
  const [polling, setPolling] = useState(true);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const openedAt = useRef(Date.now());
  const lastStatus = useRef<StatusPublico | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/atendimento-ia/status?c=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (res.status === 404) return setNotFound(true);
      if (!res.ok) return;
      const data = await res.json();
      lastStatus.current = data.status;
      setStatus(data.status);
      setPainelUrl(data.painelUrl);
    } catch {
      // sem rede: tenta de novo no próximo ciclo
    }
  }, [id, token]);

  async function cancel() {
    setCancelState("sending");
    try {
      const res = await fetch("/api/atendimento-ia/cancelar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ c: id, t: token, confirmar: true }) });
      if (!res.ok) throw new Error(String(res.status));
      setConfirming(false);
      setCancelState("idle");
      await load();
    } catch {
      setCancelState("error");
    }
  }
  // Atualização automática: a cada 5 s enquanto o pagamento é confirmado ou o acesso é criado (o servidor
  // só consulta o Mercado Pago a cada 30 s); a cada 20 s depois disso. Pausa após 30 min (botão retoma)
  // e confere de novo ao voltar para a aba.
  useEffect(() => {
    if (!polling) return;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const tick = async () => {
      await load();
      if (Date.now() - started > 30 * 60_000) return setPolling(false);
      const s = lastStatus.current;
      timer = setTimeout(tick, !s || s.confirmando || s.liberando ? 5000 : 20000);
    };
    tick();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, polling]);

  useEffect(() => {
    if (!status?.confirmando && !status?.liberando) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status?.confirmando, status?.liberando]);

  async function checkNow() {
    setChecking(true);
    await load();
    setChecking(false);
    if (!polling) {
      openedAt.current = Date.now();
      setPolling(true);
    }
  }

  // Conversão de compra só com o primeiro pagamento confirmado pelo servidor; uma vez por contratação.
  useEffect(() => {
    if (status?.pagamentoConfirmado && !status.interna) trackPurchase(id, status.valor);
  }, [status?.pagamentoConfirmado, status?.interna, status?.valor, id]);

  if (notFound)
    return (
      <p className="rounded-[14px] border border-line-strong bg-ink-900 p-5 leading-relaxed">
        Não encontramos esta contratação. Confira se abriu o link completo do retorno do pagamento ou fale com a Spolaor.
      </p>
    );
  if (!status)
    return (
      <p className="text-muted" role="status">
        Carregando o andamento…
      </p>
    );

  return (
    <div className="grid gap-8">
      <div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">{status.empresa}</p>
        <p className="mt-2 text-[1.35rem] font-semibold leading-snug tracking-[-0.02em]" role="status" aria-live="polite">
          {status.resumo}
        </p>
      </div>

      {(status.confirmando || status.liberando) && (
        <div className="grid gap-3 rounded-[14px] border border-line-strong bg-ink-900 p-5" aria-live="polite">
          <p className="flex items-center gap-3 font-semibold">
            <span aria-hidden className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f07a12] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#f07a12]" />
            </span>
            {status.confirmando ? "Conferindo o pagamento com o Mercado Pago" : "Criando o seu acesso na plataforma"}
          </p>
          <p className="text-sm leading-relaxed text-muted">
            {status.confirmando
              ? `Pagamentos com cartão costumam ser confirmados em até 1 minuto. Esta página confere sozinha${
                  status.conferidoEm ? ` — última conferência há ${Math.max(0, Math.round((now - new Date(status.conferidoEm).getTime()) / 1000))} s` : ""
                }.`
              : "Isso leva poucos segundos. Esta página atualiza sozinha."}
          </p>
          {status.confirmando && now - openedAt.current > 3 * 60_000 && (
            <p className="text-sm leading-relaxed">
              Está levando mais que o normal. Se você concluiu o pagamento, não precisa fazer nada: o acesso é liberado automaticamente
              e o convite chega no e-mail da contratação, mesmo com esta página fechada. Se não concluiu, volte ao checkout do Mercado Pago.
            </p>
          )}
          {!polling && <p className="text-sm text-muted">A atualização automática foi pausada.</p>}
          <div>
            <button type="button" onClick={checkNow} disabled={checking} className="min-h-11 rounded-[10px] border border-line-strong px-4 text-[0.95rem] font-medium disabled:opacity-60">
              {checking ? "Verificando…" : "Verificar agora"}
            </button>
          </div>
        </div>
      )}

      <ol className="border-t border-line-strong">
        {status.passos.map((p) => (
          <li key={p.id} className="grid grid-cols-[1rem_1fr] gap-x-3 border-b border-line py-4">
            <span aria-hidden className={`mt-2 h-2.5 w-2.5 rounded-full ${dot[p.status]}`} />
            <div>
              <p className="flex flex-wrap items-baseline justify-between gap-x-4 font-semibold">
                {p.titulo}
                <span className="font-mono text-[0.62rem] font-normal uppercase tracking-[0.12em] text-dim">{label[p.status]}</span>
              </p>
              <p className="mt-1 leading-relaxed text-muted">{p.detalhe}</p>
            </div>
          </li>
        ))}
      </ol>

      {status.acessoLiberado && painelUrl && (
        <div className="grid gap-3">
          <a href={painelUrl} target="_blank" rel="noopener" className="inline-flex min-h-14 items-center justify-center rounded-[10px] bg-royal px-7 font-semibold text-white">
            Abrir o painel
          </a>
          <p className="text-center text-sm text-dim">Entre com o e-mail da contratação e a senha criada pelo convite.</p>
        </div>
      )}

      {status.podeCancelar && (
        <div className="border-t border-line pt-6">
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="text-[0.95rem] font-medium text-fg underline decoration-line-strong underline-offset-4">
              Cancelar assinatura
            </button>
          ) : (
            <div className="grid gap-3 rounded-[14px] border border-line-strong bg-ink-900 p-5">
              <p className="leading-relaxed">
                Ao cancelar, não haverá novas cobranças.
                {status.acessoAte
                  ? ` O acesso continua até ${new Date(status.acessoAte).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}, fim do período já pago.`
                  : ""}
              </p>
              {cancelState === "error" && <p role="alert" className="text-sm text-ember">Não foi possível cancelar agora. Tente de novo ou cancele pelo Mercado Pago.</p>}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" disabled={cancelState === "sending"} onClick={cancel} className="min-h-12 rounded-[10px] border border-ember px-5 font-semibold text-ember disabled:opacity-60">
                  {cancelState === "sending" ? "Cancelando…" : "Confirmar cancelamento"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-12 rounded-[10px] px-5 font-medium text-muted">
                  Manter assinatura
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
