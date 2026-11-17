import type { Metadata, Viewport } from "next";

// Área privada: nunca indexada (além do noindex, o robots.txt e o cabeçalho X-Robots-Tag bloqueiam /leads).
export const viewport: Viewport = { themeColor: "#f5f4f0" };

export const metadata: Metadata = {
  title: { default: "Leads", template: "%s · Leads Spolaor" },
  description: "Área interna da Spolaor Tecnologia.",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

// Sempre renderizada a cada requisição: nada de /leads pode ser gerado no build nem servido de cache.
export const dynamic = "force-dynamic";

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
