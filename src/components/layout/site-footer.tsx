import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { mailtoLink, site, whatsappLink } from "@/lib/site";

const groups = [
  {
    title: "Soluções",
    links: [
      { href: "/corretores", label: "Para corretores de imóveis" },
      { href: "/clinicas", label: "Para clínicas e consultórios" },
      { href: "/orcamentos", label: "Para quem vende por orçamento" },
      { href: "/analise", label: "Diagnóstico gratuito" },
    ],
  },
  {
    title: "Serviços",
    links: [
      { href: "/sites", label: "Sites e landing pages" },
      { href: "/automacao", label: "Automações e integrações" },
      { href: "/sistemas", label: "CRM e sistemas sob medida" },
      { href: "/consultoria", label: "Consultoria" },
      { href: "/sites#ecommerce", label: "E-commerce" },
      { href: "/sites#identidade", label: "Identidade visual" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/projetos", label: "Projetos" },
      { href: "/#metodo", label: "Como trabalhamos" },
      { href: "/#perguntas", label: "Perguntas frequentes" },
      { href: "/contato", label: "Contato" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-line bg-ink-950 pb-28 pt-20 sm:pb-12">
      <div className="container-x">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-12 lg:col-span-3">
            <Logo />
            <p className="mt-5 max-w-sm text-muted">
              Encontramos onde sua empresa perde clientes e tempo, e resolvemos com site, CRM, automação e integrações.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
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
          {groups.map((g) => (
            <div key={g.title} className="md:col-span-4 lg:col-span-3">
              <h2 className="eyebrow">{g.title}</h2>
              <ul className="mt-5 space-y-3">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-fg/80 transition-colors hover:text-fg">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-20 flex flex-col justify-between gap-3 border-t border-line pt-6 text-sm text-dim sm:flex-row">
          <p>© {new Date().getFullYear()} {site.name}. Todos os direitos reservados.</p>
          <p>O domínio do seu site é sempre seu.</p>
        </div>
      </div>
    </footer>
  );
}
