import Link from "next/link";
import type { ReactNode } from "react";
import { atribuicao, ETAPA_ROTULO, fmtMoeda, fmtRelativo, fmtWhatsapp, type Etapa, type Oportunidade } from "@/lib/crm/tipos";
import { linkWhatsapp } from "@/lib/crm/normalizar";

// Peças visuais do CRM: base clara do site (gesso, branco, marinho), azul da marca na ação principal e laranja só
// para o que precisa de atenção (atraso, falha). Sem dados de exemplo: lista vazia aparece como vazia.

export const input =
  "w-full rounded-[10px] border border-line-strong bg-white px-3 py-2.5 text-[0.95rem] text-fg placeholder:text-dim hover:border-[#a9a9a2] focus:border-royal focus:outline-none focus:ring-4 focus:ring-royal/15";
export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-[0.92rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50";
export const btnPrimary = `${btn} bg-royal text-white hover:bg-[#1a4fcc]`;
export const btnSecondary = `${btn} border border-line-strong bg-white text-fg hover:border-fg/40`;
export const btnQuiet = "inline-flex min-h-9 items-center rounded-md px-2 text-[0.85rem] font-semibold text-sky underline-offset-4 hover:underline";

export function Painel({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-[14px] border border-line bg-white ${className}`}>
      {children}
    </section>
  );
}

export function Titulo({ children, nota }: { children: ReactNode; nota?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
      <h2 className="font-[family-name:var(--font-display)] text-[1.02rem] font-semibold tracking-[-0.01em]">{children}</h2>
      {nota && <p className="text-[0.8rem] text-dim">{nota}</p>}
    </div>
  );
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] font-semibold text-muted">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-[0.78rem] leading-snug text-dim">{dica}</span>}
    </label>
  );
}

const COR_ETAPA: Record<Etapa, string> = {
  novo: "bg-royal",
  aguardando_resposta: "bg-ink-600",
  em_conversa: "bg-signal",
  proposta_enviada: "bg-navy",
  ganho: "bg-[#1a7f4b]",
  perdido: "bg-[#8a8f98]",
};

export function EtapaMarca({ etapa }: { etapa: Etapa }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8rem] font-semibold text-fg">
      <span aria-hidden className={`h-2 w-2 rounded-[2px] ${COR_ETAPA[etapa]}`} />
      {ETAPA_ROTULO[etapa]}
    </span>
  );
}

export function Aviso({ tom = "info", children }: { tom?: "info" | "alerta" | "ok"; children: ReactNode }) {
  const cls = tom === "alerta" ? "border-[#e9c9a8] bg-[#fdf3e7] text-[#7a3a04]" : tom === "ok" ? "border-[#bfdcc9] bg-[#eef8f1] text-[#14532d]" : "border-line-strong bg-ink-850 text-muted";
  return (
    <p role={tom === "alerta" ? "alert" : "status"} className={`rounded-[10px] border px-3.5 py-2.5 text-[0.9rem] leading-snug ${cls}`}>
      {children}
    </p>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-[0.92rem] text-dim sm:px-5">{children}</p>;
}

/** Linha de uma oportunidade nas listas. O nome leva à ficha; o WhatsApp abre a conversa no aplicativo. */
export function OpLinha({ o, agora, destaque }: { o: Oportunidade; agora: number; destaque?: "retorno" | "falha" }) {
  const atr = atribuicao(o);
  const atrasado = o.proximaAcaoEm ? new Date(o.proximaAcaoEm).getTime() < agora : false;
  return (
    <li className="flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link href={`/leads/o/${o.id}`} className="text-[1rem] font-semibold text-fg underline-offset-4 hover:underline">
            {o.contato.nome}
          </Link>
          {o.contato.empresa && <span className="text-[0.88rem] text-muted">{o.contato.empresa}</span>}
          {o.teste && <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-dim">teste</span>}
        </p>
        <p className="mt-1 text-[0.86rem] leading-snug text-muted">
          {o.servico ?? "Serviço não informado"} · {atr.fonte} · chegou {fmtRelativo(o.recebidoEm, agora)}
        </p>
        {destaque === "retorno" && o.proximaAcaoEm && (
          <p className={`mt-1 text-[0.86rem] font-semibold ${atrasado ? "text-ember" : "text-fg"}`}>
            {atrasado ? "Atrasado" : "Retorno"} {fmtRelativo(o.proximaAcaoEm, agora)}
            {o.proximaAcao ? <span className="font-normal text-muted"> · {o.proximaAcao}</span> : null}
          </p>
        )}
        {destaque === "falha" && <p className="mt-1 text-[0.86rem] font-semibold text-ember">Falha de envio: abra a ficha para tentar de novo.</p>}
        {!destaque && o.mensagem && <p className="mt-1 line-clamp-2 text-[0.86rem] leading-snug text-dim">{o.mensagem}</p>}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <EtapaMarca etapa={o.etapa} />
          {o.valorProposta !== null && <span className="text-[0.8rem] text-muted">Proposta {fmtMoeda(o.valorProposta)}</span>}
          {o.responsavelNome && <span className="text-[0.8rem] text-dim">{o.responsavelNome}</span>}
        </p>
      </div>
      {o.contato.whatsapp && (
        <a
          href={linkWhatsapp(o.contato.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-[10px] border border-line-strong px-3 py-2 text-[0.82rem] font-semibold text-fg hover:border-fg/40"
          aria-label={`Abrir WhatsApp de ${o.contato.nome} (${fmtWhatsapp(o.contato.whatsapp)})`}
        >
          WhatsApp
        </a>
      )}
    </li>
  );
}
