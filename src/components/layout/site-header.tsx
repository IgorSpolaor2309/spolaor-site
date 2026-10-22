"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { navMore, navOffers, navSectors, whatsappLink, type NavItem } from "@/lib/site";
import { pageCta } from "@/lib/segments";

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [sectorsOpen, setSectorsOpen] = useState(false);
  // Nas páginas que têm formulário, o CTA rola até ele (e o lead fica com a origem da página).
  const cta = pageCta(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setSectorsOpen(false);
  }, [pathname]);

  // Fecha o menu de setores com Esc ou clique fora.
  useEffect(() => {
    if (!sectorsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSectorsOpen(false);
    const onClick = (e: MouseEvent) => !(e.target as HTMLElement).closest("[data-sectors]") && setSectorsOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [sectorsOpen]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`transition-[background-color,border-color,backdrop-filter] duration-500 ${
          scrolled || open
            ? "border-b border-line bg-ink-950/70 backdrop-blur-xl backdrop-saturate-150"
            : "border-b border-transparent"
        }`}
      >
        <div className="container-x flex h-[72px] items-center justify-between gap-6">
          <Link href="/" aria-label="Spolaor Tecnologia, página inicial" className="relative z-10 shrink-0">
            <Logo />
          </Link>

          <nav aria-label="Principal" className="hidden xl:block">
            <ul className="flex items-center gap-0.5">
              {navOffers.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
              <li className="relative" data-sectors>
                <button
                  type="button"
                  aria-expanded={sectorsOpen}
                  aria-controls="menu-setores"
                  onClick={() => setSectorsOpen((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.92rem] transition-colors ${
                    navSectors.some((i) => pathname.startsWith(i.href)) ? "text-fg" : "text-muted hover:text-fg"
                  }`}
                >
                  Para o seu setor
                  <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${sectorsOpen ? "rotate-180" : ""}`}>
                    <path d="m2.5 4.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {sectorsOpen && (
                  <ul id="menu-setores" className="absolute left-0 top-[calc(100%+8px)] w-[19rem] rounded-[12px] border border-line-strong bg-ink-900 p-2 shadow-[0_12px_40px_-16px_rgb(20_37_61/0.3)]">
                    {navSectors.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className="block rounded-[8px] px-3 py-2.5 text-[0.92rem] text-fg/85 hover:bg-fg/[0.04] hover:text-fg">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              <NavLink item={navMore[1]} pathname={pathname} />
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block">
              <ButtonLink href={cta.href} arrow>
                {cta.label}
              </ButtonLink>
            </span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="menu-mobile"
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              className="relative z-10 grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-fg/[0.03] xl:hidden"
            >
              <span className="relative block h-3 w-5">
                <span className={`absolute left-0 h-[1.5px] w-5 bg-fg transition-all duration-300 ${open ? "top-[5px] rotate-45" : "top-0"}`} />
                <span className={`absolute left-0 h-[1.5px] w-5 bg-fg transition-all duration-300 ${open ? "top-[5px] -rotate-45" : "top-[10px]"}`} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 top-[72px] z-40 flex flex-col bg-ink-950/95 backdrop-blur-xl xl:hidden"
          >
            <nav aria-label="Menu" className="container-x flex-1 overflow-y-auto pt-6">
              <ul className="divide-y divide-line border-y border-line">
                {mobileItems.map((item, i) =>
                  "group" in item ? (
                    <li key={item.group} className="pb-2 pt-5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">
                      {item.group}
                    </li>
                  ) : (
                    <motion.li
                      key={item.href}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.025 * i, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Link href={item.href} onClick={() => setOpen(false)} className="flex items-center justify-between py-3.5 text-[1.5rem] font-medium tracking-[-0.03em]">
                        {item.label}
                      </Link>
                    </motion.li>
                  ),
                )}
              </ul>
            </nav>
            <div className="container-x grid gap-3 pb-8 pt-6">
              <ButtonLink href={cta.href} size="lg" arrow onClick={() => setOpen(false)}>
                {cta.label}
              </ButtonLink>
              {whatsappLink() ? (
                <ButtonLink href={whatsappLink()!} variant="secondary" size="lg" target="_blank" rel="noopener">
                  Falar no WhatsApp
                </ButtonLink>
              ) : (
                <ButtonLink href="/contato" variant="secondary" size="lg">
                  Falar sobre meu projeto
                </ButtonLink>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

const mobileItems: ({ group: string } | NavItem)[] = [
  { href: "/", label: "Início" },
  { group: "O que fazemos" },
  ...navOffers,
  { group: "Para o seu setor" },
  ...navSectors,
  { group: "Empresa" },
  ...navMore,
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname.startsWith(item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`relative rounded-full px-3 py-2 text-[0.92rem] transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
      >
        {active && (
          <motion.span
            layoutId="nav-pill"
            className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-ember"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}
        <span className="relative">{item.short ?? item.label}</span>
      </Link>
    </li>
  );
}
