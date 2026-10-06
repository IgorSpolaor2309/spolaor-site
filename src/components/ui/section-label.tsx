// Rótulo editorial de seção: número em mono, fio curto e nome. Sem pílula, sem bolinha.
// tone mantém a cor do número (laranja = problema, ciano = solução).
export function SectionLabel({ index, children, tone = "default" }: { index?: string; children: React.ReactNode; tone?: "default" | "ember" | "signal" }) {
  const num = tone === "ember" ? "text-ember" : tone === "signal" ? "text-signal" : "text-sky";
  return (
    <p className="eyebrow inline-flex items-center gap-3">
      {index && <span className={num}>{index}</span>}
      <span className="h-px w-8 bg-line-strong" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
