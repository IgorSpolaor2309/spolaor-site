import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { mailtoLink, site, whatsappLink } from "@/lib/site";
import { siteHref } from "@/lib/blog/config";
import { catalogo } from "@/lib/blog/conteudo";

// Cabeçalho e rodapé do blog. Os do site principal (SiteOnly) ficam de fora nas rotas do blog porque
// usam caminhos relativos, que no subdomínio apontariam para o blog. Aqui todo link para o site é absoluto.

export default function BlogLayout({ children }: { children: ReactNode }) {
  const { servicos, contato } = catalogo();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-ink-950/90 backdrop-blur">
        <div className="container-x flex h-[60px] items-center justify-between gap-4 sm:h-[72px]">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <a href={siteHref("/")} aria-label={`${site.name}: site principal`} className="shrink-0">
              <Logo compact />
            </a>
            <span aria-hidden className="h-6 w-px bg-line-strong" />
            <Link href="/" className="font-[family-name:var(--font-display)] text-[0.95rem] font-semibold tracking-[-0.01em] text-fg">
              Blog
            </Link>
          </div>
          <nav aria-label="Navegação do blog" className="flex items-center gap-1 text-[0.93rem] sm:gap-2">
            <a href={siteHref("/#servicos")} className="hidden rounded-lg px-3 py-2 text-muted transition-colors hover:text-fg sm:inline-block">
              Serviços
            </a>
            <a
              href={siteHref(`${contato.caminho}#formulario`)}
              className="inline-flex min-h-10 items-center whitespace-nowrap rounded-[10px] bg-royal px-4 py-2 font-semibold text-white transition-colors hover:bg-[#1a4fcc]"
            >
              <span className="sm:hidden">Contato</span>
              <span className="hidden sm:inline">{contato.chamada}</span>
            </a>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-line bg-ink-950 pb-12 pt-16">
        <div className="container-x">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <a href={siteHref("/")} aria-label={`${site.name}: site principal`}>
                <Logo />
              </a>
              <p className="mt-5 max-w-md text-muted">
                Blog da {site.name}: sites, lojas virtuais, agendamento, automação, atendimento e sistemas explicados para quem
                decide o que contratar.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <a href={siteHref(contato.caminho)} className="rounded-full border border-line-strong px-4 py-2 text-muted transition-colors hover:text-fg">
                  Contato
                </a>
                {site.email && (
                  <a href={mailtoLink()!} className="rounded-full border border-line-strong px-4 py-2 text-muted transition-colors hover:text-fg">
                    {site.email}
                  </a>
                )}
                {whatsappLink() && (
                  <a href={whatsappLink()!} target="_blank" rel="noopener" className="rounded-full border border-line-strong px-4 py-2 text-muted transition-colors hover:text-fg">
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
            <div className="md:col-span-7">
              <h2 className="eyebrow">Serviços da {site.shortName}</h2>
              <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {servicos.map((s) => (
                  <li key={s.id}>
                    <a href={siteHref(s.caminho)} className="text-fg/80 transition-colors hover:text-fg">
                      {s.nome}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-14 flex flex-col justify-between gap-3 border-t border-line pt-6 text-sm text-dim sm:flex-row">
            <p>
              © {new Date().getFullYear()} {site.name}.
            </p>
            <p>
              <Link href="/feed.xml" className="hover:text-fg">
                RSS
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
