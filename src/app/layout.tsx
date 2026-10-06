import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { Manrope, Sora } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MobileCtaBar } from "@/components/layout/mobile-cta-bar";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { isIndexable, site, siteBaseUrl } from "@/lib/site";
import "./globals.css";

// Sora nos títulos (geométrica, ecoa o "SPOLAOR" da logo); Manrope no texto corrido.
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteBaseUrl),
  title: {
    default: "Spolaor Tecnologia · Sites que convertem, automação e sistemas sob medida",
    template: "%s · Spolaor Tecnologia",
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "criação de sites",
    "site institucional",
    "landing page",
    "automação de processos",
    "sistemas web sob medida",
    "CRM personalizado",
    "integração de sistemas",
    "consultoria em tecnologia",
  ],
  openGraph: {
    type: "website",
    locale: site.locale,
    siteName: site.name,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
  robots: isIndexable ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f5f4f0",
  colorScheme: "light",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: site.name,
  ...(site.url ? { url: site.url } : {}),
  ...(site.email ? { email: site.email } : {}),
  description: site.description,
  areaServed: "BR",
  knowsAbout: ["Desenvolvimento de sites", "Automação de processos", "Sistemas web", "Integrações e APIs"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${sora.variable} ${manrope.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-dvh overflow-x-clip">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-signal focus:px-4 focus:py-2 focus:text-ink-950"
        >
          Pular para o conteúdo
        </a>
        <SmoothScroll />
        <SiteHeader />
        <main id="conteudo">{children}</main>
        <SiteFooter />
        <MobileCtaBar />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </body>
    </html>
  );
}
