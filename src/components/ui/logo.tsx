export function LogoMark({ className = "" }: { className?: string }) {
  // Duas barras deslocadas: apresentação (topo) e operação (base) formando um "S".
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="9" y="4" width="20" height="10" rx="5" fill="currentColor" />
      <rect x="3" y="18" width="20" height="10" rx="5" fill="currentColor" opacity="0.38" />
      <circle cx="26" cy="23" r="3" fill="#d7ff3a" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-7 w-7 text-fg" />
      <span className="text-[1.05rem] font-semibold tracking-[-0.03em]">
        Spolaor<span className="ml-1 font-normal text-muted">Tecnologia</span>
      </span>
    </span>
  );
}
