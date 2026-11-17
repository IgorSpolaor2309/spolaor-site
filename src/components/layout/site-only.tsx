"use client";

import type { ReactNode } from "react";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";

/** Caminhos da área privada (/leads): sem cabeçalho, rodapé, barra de conversão, rolagem suave nem medição do site público. */
export const isPrivatePath = (pathname: string | null) => !!pathname && /^\/leads(\/|$)/.test(pathname);

/**
 * Mostra os filhos só nas páginas públicas do site. O blog (rotas em app/blog, servidas em blog.<domínio>)
 * tem cabeçalho e rodapé próprios. Ele é identificado pelo segmento da rota, que não muda com a
 * reescrita do subdomínio (o endereço no navegador é /<slug>, a rota é /blog/<slug>).
 */
export function SiteOnly({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const pathname = usePathname();
  if (segment === "blog" || isPrivatePath(pathname)) return null;
  return <>{children}</>;
}
