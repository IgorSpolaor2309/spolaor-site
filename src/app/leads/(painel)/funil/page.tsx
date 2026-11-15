import type { Metadata } from "next";
import Link from "next/link";
import { avancarAction } from "@/app/leads/actions";
import { Enviar } from "@/components/crm/enviar";
import { exigirUsuario } from "@/lib/crm/auth";
import { funil } from "@/lib/crm/consultas";
import { ETAPAS, ETAPA_ROTULO, fmtMoeda, fmtRelativo, type Etapa, type Oportunidade } from "@/lib/crm/tipos";

export const metadata: Metadata = { title: "Funil" };

const PROXIMA: Partial<Record<Etapa, string>> = { novo: "Aguardando resposta", aguardando_resposta: "Em conversa", em_conversa: "Proposta enviada" };

function Cartao({ o, agora }: { o: Oportunidade; agora: number }) {
  const valor = o.etapa === "ganho" ? o.valorFechado : o.valorProposta;
  return (
    <li className="rounded-[10px] border border-line bg-white p-3">
      <Link href={`/leads/o/${o.id}`} className="block text-[0.95rem] font-semibold leading-snug text-fg underline-offset-4 hover:underline">
        {o.contato.nome}
      </Link>
      {o.contato.empresa && <p className="text-[0.82rem] text-muted">{o.contato.empresa}</p>}
      <p className="mt-1 text-[0.82rem] leading-snug text-dim">{o.servico ?? "Serviço não informado"}</p>
      <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-[0.8rem]">
        <span className="text-dim">chegou {fmtRelativo(o.recebidoEm, agora)}</span>
        {valor !== null && <span className="font-semibold text-fg">{fmtMoeda(valor)}</span>}
      </p>
      {o.etapa === "perdido" && o.motivoPerda && <p className="mt-1 text-[0.8rem] text-dim">Motivo: {o.motivoPerda}</p>}
      {PROXIMA[o.etapa] && (
        <form action={avancarAction} className="mt-2">
          <input type="hidden" name="id" value={o.id} />
          <Enviar className="min-h-9 text-left text-[0.8rem] font-semibold text-sky underline-offset-4 hover:underline disabled:opacity-50">Mover para “{PROXIMA[o.etapa]}”</Enviar>
        </form>
      )}
    </li>
  );
}

export default async function FunilPage() {
  await exigirUsuario();
  const ops = await funil();
  const agora = Date.now();
  const colunas = ETAPAS.map((etapa) => {
    const itens = ops.filter((o) => o.etapa === etapa);
    const comValor = itens.map((o) => (etapa === "ganho" ? o.valorFechado : o.valorProposta)).filter((v): v is number => v !== null);
    return { etapa, itens, soma: comValor.length ? comValor.reduce((a, b) => a + b, 0) : null, semValor: itens.length - comValor.length };
  });
  return (
    <>
      <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">Funil</h1>
      <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
        Todas as oportunidades abertas e as encerradas nos últimos 60 dias. Valores de proposta não são vendas: só a coluna “Ganho” soma o que foi fechado. Proposta,
        ganho e perda são marcados na ficha.
      </p>
      {/* Celular: uma etapa por vez, recolhível. Computador: colunas lado a lado. */}
      <div className="mt-6 grid gap-3 lg:grid-cols-6 lg:items-start">
        {colunas.map((c) => (
          <details key={c.etapa} open={c.itens.length > 0 && c.etapa !== "perdido"} className="group rounded-[14px] border border-line bg-ink-850 lg:open:pb-1">
            <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 px-3 py-3 [&::-webkit-details-marker]:hidden">
              <span className="font-[family-name:var(--font-display)] text-[0.92rem] font-semibold">
                {ETAPA_ROTULO[c.etapa]} <span className="font-normal text-dim">({c.itens.length})</span>
              </span>
              <span aria-hidden className="text-dim transition-transform group-open:rotate-90">
                ›
              </span>
            </summary>
            <p className="px-3 pb-2 text-[0.78rem] leading-snug text-dim">
              {c.soma !== null
                ? `${c.etapa === "ganho" ? "Fechado" : "Em propostas"}: ${fmtMoeda(c.soma)}${c.semValor ? ` · ${c.semValor} sem valor` : ""}`
                : c.itens.length
                  ? "Sem valores informados"
                  : "Vazio"}
            </p>
            {c.itens.length > 0 && (
              <ul className="grid gap-2 px-2 pb-2">
                {c.itens.map((o) => (
                  <Cartao key={o.id} o={o} agora={agora} />
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
