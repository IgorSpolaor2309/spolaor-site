import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ContactForm } from "@/components/forms/contact-form";
import { SectionLabel } from "@/components/ui/section-label";
import { mailtoLink, site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com a Spolaor Tecnologia sobre seu site, automação, sistema ou consultoria. Orçamento personalizado para cada projeto.",
  alternates: { canonical: "/contato" },
};

export default function ContatoPage() {
  return (
    <section className="relative isolate overflow-hidden pb-24 pt-[150px] md:pb-32 md:pt-[190px]">
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="fade-up">
            <SectionLabel tone="signal">Contato</SectionLabel>
          </div>
          <h1 className="fade-up mt-7 text-[clamp(2.5rem,1.4rem+4.6vw,5rem)] font-medium leading-[0.98] tracking-[-0.045em]" style={{ animationDelay: "0.08s" }}>
            Vamos falar sobre <span className="serif-accent text-signal">seu projeto.</span>
          </h1>
          <p className="fade-up mt-7 max-w-md text-lg leading-relaxed text-muted" style={{ animationDelay: "0.16s" }}>
            Conte o que você precisa ou qual problema quer resolver. Cada projeto recebe um orçamento personalizado, de acordo com a
            necessidade, a complexidade e o prazo.
          </p>
          <div className="fade-up mt-10 grid gap-3" style={{ animationDelay: "0.24s" }}>
            {whatsappLink() && (
              <a href={whatsappLink()!} target="_blank" rel="noopener" className="group flex items-center justify-between rounded-2xl border border-line-strong bg-white/[0.02] p-5 transition-colors hover:border-white/30">
              <span>
                <span className="block text-sm text-dim">Prefere conversar agora?</span>
                <span className="mt-1 block text-lg font-medium">WhatsApp</span>
              </span>
              <span aria-hidden className="text-muted transition-transform group-hover:translate-x-1">→</span>
            </a>
            )}
            {site.email && (
              <a href={mailtoLink("Projeto com a Spolaor Tecnologia")!} className="group flex items-center justify-between rounded-2xl border border-line-strong bg-white/[0.02] p-5 transition-colors hover:border-white/30">
              <span>
                <span className="block text-sm text-dim">E-mail</span>
                <span className="mt-1 block text-lg font-medium">{site.email}</span>
              </span>
              <span aria-hidden className="text-muted transition-transform group-hover:translate-x-1">→</span>
            </a>
            )}
            <Link href="/analise" className="group flex items-center justify-between rounded-2xl border border-signal/30 bg-signal/[0.05] p-5 transition-colors hover:border-signal/60">
              <span>
                <span className="block text-sm text-dim">Ainda não sabe o que precisa?</span>
                <span className="mt-1 block text-lg font-medium text-signal">Comece pela análise gratuita do site</span>
              </span>
              <span aria-hidden className="text-signal transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
        <div className="fade-up lg:col-span-7" style={{ animationDelay: "0.2s" }}>
          <Suspense fallback={<div className="h-[720px] rounded-[16px] border border-line bg-ink-900" />}>
            <ContactForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
