// Conversa ilustrativa (dados fictícios) para mostrar a ideia: o agente responde com as
// informações configuradas pela empresa, faz perguntas e passa a conversa para a equipe.
// Estática e visível desde o carregamento; não é captura de um atendimento real.

type Line = { from: "cliente" | "agente" | "aviso"; text: string; time?: string; /** some no celular, para a conversa caber logo abaixo do botão */ desktop?: boolean };

const lines: Line[] = [
  { from: "cliente", text: "Oi! Vocês fazem limpeza de sofá? Quanto fica?", time: "21:14" },
  { from: "agente", text: "Oi! Fazemos sim. O valor depende do tamanho: sofá de 2 lugares a partir de R$ ••• e de 3 lugares a partir de R$ •••. Qual é o seu?", time: "21:14" },
  { from: "cliente", text: "3 lugares. Atendem no Centro?", time: "21:15", desktop: true },
  { from: "agente", text: "Atendemos. Para qual dia você gostaria? Vou passar para a equipe confirmar o horário.", time: "21:15", desktop: true },
  { from: "aviso", text: "Conversa encaminhada para a equipe · resumo: sofá 3 lugares, Centro" },
];

export function ChatExample({ className = "" }: { className?: string }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-[18px] border border-line-strong bg-ink-900 shadow-[0_1px_2px_rgb(20_37_61/0.06),0_40px_80px_-40px_rgb(20_37_61/0.35)]">
        <div className="flex items-center gap-3 border-b border-line bg-ink-850 px-4 py-3">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-royal/10 font-mono text-[0.7rem] font-semibold text-royal">
            SE
          </span>
          <span className="leading-tight">
            <span className="block text-[0.9rem] font-semibold">Sua empresa</span>
            <span className="block text-[0.72rem] text-dim">atendimento com IA</span>
          </span>
        </div>
        <ol className="grid gap-2.5 bg-ink-950/60 p-4" aria-label="Exemplo de conversa">
          {lines.map((l, i) =>
            l.from === "aviso" ? (
              <li key={i} className="mx-auto max-w-[95%] rounded-full border border-line bg-ink-900 px-3 py-1.5 text-center text-[0.72rem] leading-snug text-muted">
                {l.text}
              </li>
            ) : (
              <li
                key={i}
                className={`${l.desktop ? "hidden sm:block " : ""}max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-[0.88rem] leading-snug ${
                  l.from === "cliente" ? "justify-self-start rounded-tl-[4px] bg-ink-900 shadow-sm" : "justify-self-end rounded-tr-[4px] bg-royal text-white"
                }`}
              >
                <span className="sr-only">{l.from === "cliente" ? "Cliente: " : "Agente: "}</span>
                {l.text}
                {l.time && <span className={`mt-1 block text-right font-mono text-[0.6rem] ${l.from === "cliente" ? "text-dim" : "text-white/70"}`}>{l.time}</span>}
              </li>
            ),
          )}
        </ol>
      </div>
      <figcaption className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-dim">Exemplo ilustrativo · conversa fictícia</figcaption>
    </figure>
  );
}
