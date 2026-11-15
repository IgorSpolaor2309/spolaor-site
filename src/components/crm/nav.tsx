"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itens = [
  { href: "/leads", rotulo: "Atendimento", curto: "Hoje" },
  { href: "/leads/lista", rotulo: "Lista", curto: "Lista" },
  { href: "/leads/funil", rotulo: "Funil", curto: "Funil" },
  { href: "/leads/indicadores", rotulo: "Indicadores", curto: "Números" },
  { href: "/leads/integracoes", rotulo: "Integrações", curto: "Canais" },
  { href: "/leads/configuracoes", rotulo: "Configurações", curto: "Ajustes" },
];

const ativo = (pathname: string, href: string) => (href === "/leads" ? pathname === "/leads" || pathname.startsWith("/leads/o/") || pathname === "/leads/novo" : pathname.startsWith(href));

/** Navegação do CRM: no computador, na barra do topo; no celular, fixa embaixo (ao alcance do polegar). */
export function CrmNav({ variante }: { variante: "topo" | "rodape" }) {
  const pathname = usePathname() ?? "";
  if (variante === "topo") {
    return (
      <nav aria-label="Seções do CRM" className="hidden items-center gap-1 lg:flex">
        {itens.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={ativo(pathname, i.href) ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-[0.9rem] font-semibold transition-colors ${ativo(pathname, i.href) ? "bg-fg/[0.06] text-fg" : "text-muted hover:text-fg"}`}
          >
            {i.rotulo}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav
      aria-label="Seções do CRM"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line-strong bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {itens.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={ativo(pathname, i.href) ? "page" : undefined}
          className={`flex min-h-[54px] items-center justify-center px-0.5 text-center text-[0.72rem] font-semibold leading-tight ${
            ativo(pathname, i.href) ? "text-royal shadow-[inset_0_2px_0_var(--color-royal)]" : "text-muted"
          }`}
        >
          {i.curto}
        </Link>
      ))}
    </nav>
  );
}
