export function SectionLabel({ index, children, tone = "default" }: { index?: string; children: React.ReactNode; tone?: "default" | "ember" | "signal" }) {
  const dot = tone === "ember" ? "bg-ember" : tone === "signal" ? "bg-signal" : "bg-fg/50";
  return (
    <p className="eyebrow inline-flex items-center gap-3">
      {index && <span className="text-dim">{index}</span>}
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
