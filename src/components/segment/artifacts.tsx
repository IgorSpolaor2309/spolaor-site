// Pequenos "objetos de cena" que acompanham cada situação: a notificação que ninguém abriu, a
// planilha copiada à mão, o lembrete que se perdeu. São ilustrativos e não trazem números reais.

type Tone = "ember" | "signal" | "muted";
const toneText: Record<Tone, string> = { ember: "text-ember", signal: "text-signal", muted: "text-dim" };

/** Notificação de celular: canal, quem chamou, a mensagem e o que aconteceu com ela. */
export function Notice({ app, from, text, meta, tone = "ember" }: { app: string; from: string; text: string; meta: string; tone?: Tone }) {
  return (
    <div className="max-w-sm rounded-[14px] border border-line bg-ink-900 px-4 py-3 shadow-[0_1px_2px_rgb(20_37_61/0.05)]" aria-hidden>
      <p className="flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">
        <span>{app}</span>
        <span className={toneText[tone]}>{meta}</span>
      </p>
      <p className="mt-1.5 text-[0.88rem] font-semibold">{from}</p>
      <p className="mt-0.5 text-[0.85rem] leading-snug text-muted">{text}</p>
    </div>
  );
}

/** Trecho de conversa. "me" = a empresa; "them" = o cliente. */
export function Chat({ lines, footer }: { lines: { from: "me" | "them"; text: string; meta?: string }[]; footer?: string }) {
  return (
    <div className="flex max-w-sm flex-col gap-2" aria-hidden>
      {lines.map((l, i) => (
        <p
          key={i}
          className={`max-w-[88%] rounded-[12px] px-3.5 py-2 text-[0.84rem] leading-snug ${
            l.from === "them" ? "self-start rounded-bl-[4px] border border-line bg-ink-900" : "self-end rounded-br-[4px] bg-[#dce7ff]"
          }`}
        >
          {l.text}
          {l.meta && <span className="mt-0.5 block text-right font-mono text-[0.6rem] text-dim">{l.meta}</span>}
        </p>
      ))}
      {footer && <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ember">{footer}</p>}
    </div>
  );
}

/** Planilha preenchida à mão: linhas com células faltando ou desencontradas. */
export function Ledger({ head, rows, note }: { head: string[]; rows: (string | null)[][]; note?: string }) {
  return (
    <div className="max-w-md" aria-hidden>
      <div className="overflow-hidden rounded-[10px] border border-line bg-ink-900 font-mono text-[0.68rem]">
        <div className="grid border-b border-line bg-ink-850 text-dim" style={{ gridTemplateColumns: `repeat(${head.length}, minmax(0,1fr))` }}>
          {head.map((h) => (
            <span key={h} className="truncate border-r border-line px-2.5 py-1.5 last:border-r-0">
              {h}
            </span>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid border-b border-line last:border-b-0" style={{ gridTemplateColumns: `repeat(${head.length}, minmax(0,1fr))` }}>
            {r.map((c, j) => (
              <span key={j} className={`truncate border-r border-line px-2.5 py-1.5 last:border-r-0 ${c === null ? "bg-ember/[0.07] text-ember" : "text-fg/80"}`}>
                {c ?? "?"}
              </span>
            ))}
          </div>
        ))}
      </div>
      {note && <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">{note}</p>}
    </div>
  );
}

/** Lembrete solto: as tarefas que dependem de alguém lembrar. */
export function Reminders({ items, note }: { items: { text: string; done?: boolean; lost?: boolean }[]; note?: string }) {
  return (
    <div className="max-w-sm rounded-[12px] border border-line bg-ink-900 px-4 py-3" aria-hidden>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.text} className="flex items-start gap-2.5 text-[0.85rem] leading-snug">
            <span
              className={`mt-[3px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] border ${
                it.done ? "border-signal bg-signal" : it.lost ? "border-ember/60" : "border-fg/25"
              }`}
            />
            <span className={it.done ? "text-dim line-through" : it.lost ? "text-ember" : "text-fg/85"}>{it.text}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 border-t border-line pt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">{note}</p>}
    </div>
  );
}

/** Origens de contato sem um lugar único: cada canal com sua pilha e ninguém sabe o total. */
export function Channels({ items, note }: { items: { name: string; count: number; owner?: string }[]; note?: string }) {
  return (
    <div className="max-w-md" aria-hidden>
      <div className="grid grid-cols-3 gap-2">
        {items.map((c) => (
          <div key={c.name} className="rounded-[10px] border border-line bg-ink-900 px-3 py-2.5">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-dim">{c.name}</p>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: c.count }).map((_, i) => (
                <span key={i} className={`h-4 w-2 rounded-[2px] ${i % 3 === 2 ? "bg-ember/70" : "bg-fg/20"}`} />
              ))}
            </div>
            <p className="mt-2 text-[0.72rem] text-muted">{c.owner ?? "quem cuida?"}</p>
          </div>
        ))}
      </div>
      {note && <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">{note}</p>}
    </div>
  );
}

/** Funil sem a última etapa: o site recebe visitas e ninguém sabe o que vira contato. */
export function BlindFunnel({ rows, note }: { rows: { label: string; width: number; unknown?: boolean }[]; note?: string }) {
  return (
    <div className="max-w-sm rounded-[12px] border border-line bg-ink-900 px-4 py-3.5" aria-hidden>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-[0.78rem] text-muted">
            <span>{r.label}</span>
            {r.unknown ? (
              <span className="h-2 rounded-full border border-dashed border-ember/60" style={{ width: `${r.width}%` }} />
            ) : (
              <span className="h-2 rounded-full bg-fg/25" style={{ width: `${r.width}%` }} />
            )}
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 border-t border-line pt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ember">{note}</p>}
    </div>
  );
}

/** Agenda com horários vagos que eram de alguém. */
export function Schedule({ slots, note }: { slots: { time: string; who?: string; state: "ok" | "empty" | "late" }[]; note?: string }) {
  return (
    <div className="max-w-sm overflow-hidden rounded-[12px] border border-line bg-ink-900" aria-hidden>
      {slots.map((s) => (
        <div key={s.time} className="flex items-center gap-3 border-b border-line px-4 py-2 text-[0.82rem] last:border-b-0">
          <span className="w-11 font-mono text-[0.7rem] text-dim">{s.time}</span>
          {s.state === "ok" ? (
            <span className="flex-1 text-fg/85">{s.who}</span>
          ) : (
            <span className="flex-1 rounded-[6px] border border-dashed border-ember/50 px-2 py-0.5 text-ember">{s.who ?? "vago"}</span>
          )}
        </div>
      ))}
      {note && <p className="border-t border-line px-4 py-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">{note}</p>}
    </div>
  );
}
