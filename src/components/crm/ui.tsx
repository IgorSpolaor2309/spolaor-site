import Link from "next/link";
import type { ReactNode } from "react";
import { atribuicao, CATEGORIA_ROTULO, CATEGORIAS, ETAPA_ROTULO, fmtMoeda, fmtRelativo, fmtWhatsapp, type Categoria, type Etapa, type Oportunidade } from "@/lib/crm/tipos";
import { linkWhatsapp } from "@/lib/crm/normalizar";
import { estadoAtendimento, previaPedido, servicoSolicitado, type Estado } from "@/lib/crm/pedido";

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
    <section id={id} className={`min-w-0 rounded-[14px] border border-line bg-white ${className}`}>
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

const COR_ESTADO: Record<Estado["tipo"], string> = {
  falha: "border-[#e9c9a8] bg-[#fdf3e7] text-[#7a3a04]",
  novo: "border-[#cfdcf7] bg-[#f1f5fe] text-[#1a3f9c]",
  aguardando: "border-line-strong bg-ink-850 text-fg",
};

/** Situação do atendimento na fila: "Novo pedido", "Aguardando atendimento" ou "Falha de envio". */
export function EstadoMarca({ estado }: { estado: Estado }) {
  return (
    <span data-estado={estado.tipo} className={`inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[0.74rem] font-semibold ${COR_ESTADO[estado.tipo]}`}>
      {estado.rotulo}
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

/** Um dado do pedido. Ausente aparece apagado ("Não informado"); a nota diz de onde veio o valor. */
export function Dado({ rotulo, valor, ausente, nota, link, forte }: { rotulo: string; valor: string; ausente?: boolean; nota?: string; link?: string; forte?: boolean }) {
  return (
    <div className="min-w-0" data-dado={rotulo} data-ausente={ausente ? "1" : undefined}>
      <dt className="text-[0.78rem] font-semibold text-dim">{rotulo}</dt>
      <dd className={`mt-0.5 break-words ${ausente ? "text-dim" : forte ? "text-[1.02rem] font-semibold" : ""}`}>
        {link && !ausente ? (
          <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="text-sky underline-offset-4 hover:underline">
            {valor}
          </a>
        ) : (
          valor
        )}
      </dd>
      {nota && <dd className="mt-0.5 text-[0.8rem] leading-snug text-dim">{nota}</dd>}
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-[0.92rem] text-dim sm:px-5">{children}</p>;
}

/** Linha de uma oportunidade nas listas. O nome leva à ficha; o WhatsApp abre a conversa no aplicativo. */
export function OpLinha({ o, agora, destaque }: { o: Oportunidade; agora: number; destaque?: "retorno" | "falha" }) {
  const atr = atribuicao(o);
  const servico = servicoSolicitado(o);
  const previa = previaPedido(o);
  const estado = o.etapa === "ganho" || o.etapa === "perdido" ? (o.falha ? estadoAtendimento(o) : null) : estadoAtendimento(o);
  const atrasado = o.proximaAcaoEm ? new Date(o.proximaAcaoEm).getTime() < agora : false;
  return (
    <li className="flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5">
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link href={`/leads/o/${o.id}`} className="text-[1rem] font-semibold text-fg underline-offset-4 hover:underline">
            {o.contato.nome}
          </Link>
          {o.contato.empresa && <span className="text-[0.88rem] text-muted">{o.contato.empresa}</span>}
          {o.teste && <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-dim">{o.validacao ? "validação" : "teste"}</span>}
        </p>
        <p className="mt-1 text-[0.86rem] leading-snug text-muted">
          {servico.informado ? servico.texto : CATEGORIA_ROTULO[o.categoria]} · {atr.fonte} · chegou {fmtRelativo(o.recebidoEm, agora)}
        </p>
        {estado && !destaque && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <EstadoMarca estado={estado} />
            {estado.tipo === "falha" && <span className="text-[0.84rem] font-semibold text-ember">{estado.detalhe}</span>}
          </p>
        )}
        {destaque === "retorno" && o.proximaAcaoEm && (
          <p className={`mt-1 text-[0.86rem] font-semibold ${atrasado ? "text-ember" : "text-fg"}`}>
            {atrasado ? "Atrasado" : "Retorno"} {fmtRelativo(o.proximaAcaoEm, agora)}
            {o.proximaAcao ? <span className="font-normal text-muted"> · {o.proximaAcao}</span> : null}
          </p>
        )}
        {destaque === "falha" && <p className="mt-1 text-[0.86rem] font-semibold text-ember">Falha de envio: abra a ficha para tentar de novo.</p>}
        {!destaque && (
          <p className={`mt-1 line-clamp-2 text-[0.86rem] leading-snug ${previa.ausente ? "text-dim" : "text-muted"}`} data-lista-previa>
            <span className="text-dim">Pedido: </span>
            {previa.texto}
          </p>
        )}
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

/** Filtro por serviço (categoria), em links: funciona sem JavaScript e mantém os outros parâmetros da página. */
export function FiltroServico({ base, atual, outros = {} }: { base: string; atual?: Categoria; outros?: Record<string, string> }) {
  const href = (c?: Categoria) => {
    const u = new URLSearchParams(outros);
    if (c) u.set("servico", c);
    const q = u.toString();
    return `${base}${q ? `?${q}` : ""}`;
  };
  const cls = (on: boolean) => `whitespace-nowrap rounded-lg px-3 py-2 text-[0.84rem] font-semibold ${on ? "bg-fg text-white" : "border border-line-strong text-muted hover:text-fg"}`;
  return (
    <nav aria-label="Filtrar por serviço" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <Link href={href()} className={cls(!atual)} aria-current={!atual ? "true" : undefined}>
        Todos os serviços
      </Link>
      {CATEGORIAS.map((c) => (
        <Link key={c} href={href(c)} className={cls(atual === c)} aria-current={atual === c ? "true" : undefined}>
          {CATEGORIA_ROTULO[c]}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Item de "Depende de mim": quem é, qual serviço, por que está aqui, a última mensagem, há quanto tempo espera e
 * quem é o responsável.
 */
export function ItemFilaLinha({ o, motivo, desde, alerta, agora }: { o: Oportunidade; motivo: string; desde: string; alerta: boolean; agora: number }) {
  const um = o.ultimaMensagem;
  const estado = estadoAtendimento(o);
  const servico = servicoSolicitado(o);
  const previa = previaPedido(o);
  return (
    <li className="flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5" data-oportunidade={o.id}>
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link href={`/leads/o/${o.id}`} className="text-[1rem] font-semibold text-fg underline-offset-4 hover:underline">
            {o.contato.nome}
          </Link>
          {o.contato.empresa && <span className="text-[0.88rem] text-muted">{o.contato.empresa}</span>}
          {o.validacao && <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-dim">validação</span>}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {estado && <EstadoMarca estado={estado} />}
          <span className="text-[0.88rem] font-semibold leading-snug text-fg" data-fila-servico>
            {servico.informado ? servico.texto : CATEGORIA_ROTULO[o.categoria]}
          </span>
        </p>
        {estado?.tipo === "falha" ? (
          <p className="mt-1 text-[0.86rem] font-semibold leading-snug text-ember" data-falha-motivo>
            {estado.detalhe}
          </p>
        ) : estado?.tipo === "novo" ? null : (
          // "Novo pedido" já diz o motivo; nos demais casos o motivo explica por que está na fila.
          <p className={`mt-1 text-[0.84rem] leading-snug ${alerta ? "font-semibold text-ember" : "text-dim"}`}>{motivo}</p>
        )}
        <p className={`mt-1 line-clamp-2 text-[0.88rem] leading-snug ${previa.ausente ? "text-dim" : "text-muted"}`} data-fila-previa>
          <span className="text-dim">Pedido: </span>
          {previa.texto}
        </p>
        {um && (
          <p className="mt-1 line-clamp-2 text-[0.88rem] leading-snug text-muted">
            <span className="text-dim">{um.direcao === "entrada" ? "Disse: " : um.automatica ? "Automática: " : "Você: "}</span>
            {um.corpo}
          </p>
        )}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-dim">
          <EtapaMarca etapa={o.etapa} />
          <span>esperando {fmtRelativo(desde, agora)}</span>
          <span>{o.responsavelNome ?? "sem responsável"}</span>
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
