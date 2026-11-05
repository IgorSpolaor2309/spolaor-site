"use client";

import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/atendimento-ia/status?c=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (res.status === 404) return setNotFound(true);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      setPainelUrl(data.painelUrl);
    } catch {
      // sem rede: tenta de novo no próximo ciclo
    }
  }, [id, token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    const stop = setTimeout(() => clearInterval(t), 20 * 60_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [load]);

  // Conversão de compra só com o primeiro pagamento confirmado pelo servidor; uma vez por contratação.
  useEffect(() => {
    if (status?.pagamentoConfirmado) trackPurchase(id, status.valor);
  }, [status?.pagamentoConfirmado, status?.valor, id]);

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
    </div>
  );
}
