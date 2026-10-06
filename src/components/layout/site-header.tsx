"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { nav, whatsappLink } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

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

          <nav aria-label="Principal" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {nav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative rounded-full px-3.5 py-2 text-[0.92rem] transition-colors ${
                        active ? "text-fg" : "text-muted hover:text-fg"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-x-3.5 -bottom-0.5 h-[2px] rounded-full bg-ember"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <span className="relative">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block">
              <ButtonLink href="/analise" arrow>
                Solicitar análise
              </ButtonLink>
            </span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="menu-mobile"
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              className="relative z-10 grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-fg/[0.03] lg:hidden"
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
            className="fixed inset-0 top-[72px] z-40 flex flex-col bg-ink-950/95 backdrop-blur-xl lg:hidden"
          >
            <nav aria-label="Menu" className="container-x flex-1 overflow-y-auto pt-6">
              <ul className="divide-y divide-line border-y border-line">
                {[{ href: "/", label: "Início" }, ...nav].map((item, i) => (
                  <motion.li
                    key={item.href}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link href={item.href} className="flex items-center justify-between py-4 text-[1.75rem] font-medium tracking-[-0.03em]">
                      {item.label}
                      <span className="font-mono text-xs text-dim">0{i + 1}</span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <div className="container-x grid gap-3 pb-8 pt-6">
              <ButtonLink href="/analise" size="lg" arrow>
                Solicitar análise do meu site
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
