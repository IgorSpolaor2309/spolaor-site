"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Caminhos da área privada (/leads): sem cabeçalho, rodapé, barra de conversão, rolagem suave nem medição do site público. */
export const isPrivatePath = (pathname: string | null) => !!pathname && /^\/leads(\/|$)/.test(pathname);

/** Mostra os filhos só nas páginas públicas do site. */
export function SiteOnly({ children }: { children: ReactNode }) {
  return isPrivatePath(usePathname()) ? null : <>{children}</>;
}
