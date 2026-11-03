"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { whatsappLink } from "@/lib/site";
import { pageCta } from "@/lib/segments";

// Barra fixa de conversão no celular. Só aparece depois que o botão principal da abertura
// ([data-hero-cta]) saiu da tela e some enquanto o formulário da página está visível.
export function MobileCtaBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const cta = pageCta(pathname);

  useEffect(() => {
    const onScroll = () => {
      const vh = window.innerHeight;
      const form = cta.target ? document.getElementById(cta.target) : null;
      const formVisible = form ? form.getBoundingClientRect().top < vh && form.getBoundingClientRect().bottom > 0 : false;
      const heroCta = document.querySelector("[data-hero-cta]");
      // Sem botão marcado na abertura, vale a regra antiga (depois de rolar 60% da tela).
      const heroGone = heroCta ? heroCta.getBoundingClientRect().bottom < 64 : window.scrollY > vh * 0.6;
      setVisible(heroGone && !formVisible);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname, cta.target]);

  if (pathname === "/analise") return null;
  const wa = whatsappLink();

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-950/92 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur transition-transform duration-500 ease-out-expo sm:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center gap-2">
        <Link
          href={cta.href}
          className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-royal text-[0.95rem] font-semibold text-white"
        >
          {cta.label}
        </Link>
        {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener"
          aria-label="Falar no WhatsApp"
          className="grid h-11 w-11 place-items-center rounded-[10px] border border-line-strong bg-ink-900"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
          </svg>
        </a>
        )}
      </div>
    </div>
  );
}
