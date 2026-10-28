// Prévia do que o visitante recebe: as recomendações em ordem de prioridade.
// Exemplo genérico, sem site, números ou resultado reais, e a legenda diz isso.

const items: { text: string; level: "alta" | "media" }[] = [
  { text: "Dizer na primeira tela o que a empresa faz", level: "alta" },
  { text: "Deixar o botão de contato visível sem rolar", level: "alta" },
  { text: "Pedir só o necessário no formulário", level: "media" },
  { text: "Deixar as imagens da página inicial mais leves", level: "media" },
];

export function PriorityReport() {
  return (
    <figure className="w-full max-w-[30rem] lg:max-w-none">
      <div className="overflow-hidden rounded-[16px] border border-line-strong bg-ink-900 shadow-[0_1px_2px_rgb(20_37_61/0.06),0_40px_80px_-40px_rgb(20_37_61/0.35)]">
        <div className="flex items-center justify-between gap-4 border-b border-line bg-ink-850 px-4 py-3 sm:px-5">
          <span className="text-[0.88rem] font-semibold">Diagnóstico do site</span>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-dim">seusite.com.br</span>
        </div>
        <div className="px-4 pb-2 pt-4 sm:px-5">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-dim">O que fazer primeiro</p>
          <ol className="mt-2">
            {items.map((it, i) => (
              <li key={it.text} className="grid grid-cols-[1.6rem_1fr_auto] items-baseline gap-x-2 border-b border-line py-3 last:border-0">
                <span className="font-mono text-[0.72rem] text-dim">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[0.92rem] leading-snug">{it.text}</span>
                <span
                  className={`flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] ${it.level === "alta" ? "text-ember" : "text-muted"}`}
                >
                  <span aria-hidden className={`h-1.5 w-1.5 ${it.level === "alta" ? "bg-[#f07a12]" : "bg-line-strong"}`} />
                  <span className="sr-only">Prioridade </span>
                  {it.level === "alta" ? "Alta" : "Média"}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="border-t border-line bg-ink-850 px-4 py-3 text-[0.8rem] leading-snug text-muted sm:px-5">
          Cada ponto vem com o motivo e com o que mudar.
        </p>
      </div>
      <figcaption className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-dim">Exemplo ilustrativo · não é a análise de um site real</figcaption>
    </figure>
  );
}
