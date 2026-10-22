import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ContactForm } from "@/components/forms/contact-form";
import { leadsAvailable } from "@/lib/leads/server/pipeline";
import { SectionLabel } from "@/components/ui/section-label";
import { mailtoLink, site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Conte o que sua empresa precisa: um site ou landing page, ou automação de processos. Peça o orçamento direto ou comece pelo diagnóstico do processo.",
  alternates: { canonical: "/contato" },
};

// Os dois caminhos diretos, um por oferta, além do formulário geral da página.
const paths = [
  {
    href: "/sites#orcamento",
    kicker: "Sites e landing pages",
    title: "Pedir orçamento de site",
    text: "Já sabe que precisa de um site ou landing page? Vá direto ao pedido de orçamento.",
  },
  {
    href: "/automacao#analise",
    kicker: "Automação de processos",
    title: "Diagnóstico do processo",
    text: "Sente o problema mas não sabe o que automatizar? Conte como o trabalho acontece hoje.",
  },
];

export default function ContatoPage() {
  const wa = whatsappLink();
  return (
    <section className="relative isolate overflow-hidden pb-24 pt-[150px] md:pb-32 md:pt-[190px]">
      <div className="container-x grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="fade-up">
            <SectionLabel tone="signal">Contato</SectionLabel>
          </div>
          <h1 className="fade-up mt-7 text-[clamp(2.5rem,1.4rem+4.6vw,5rem)] font-medium leading-[0.98] tracking-[-0.045em]" style={{ animationDelay: "0.08s" }}>
            Conte o que sua empresa <span className="serif-accent text-signal">precisa.</span>
          </h1>
          <p className="fade-up mt-7 max-w-md text-lg leading-relaxed text-muted" style={{ animationDelay: "0.16s" }}>
            Um site que apresente bem seus serviços, a automação de um processo que hoje depende de alguém lembrar, ou os dois.
            Escreva do seu jeito; cada projeto recebe um orçamento próprio.
          </p>
          <div className="fade-up mt-10 grid gap-3" style={{ animationDelay: "0.24s" }}>
            {paths.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-line-strong bg-fg/[0.02] p-5 transition-colors hover:border-fg/30"
              >
                <span>
                  <span className="block font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">{p.kicker}</span>
                  <span className="mt-1.5 block text-lg font-medium">{p.title}</span>
                  <span className="mt-1 block text-sm leading-snug text-muted">{p.text}</span>
                </span>
                <span aria-hidden className="text-muted transition-transform group-hover:translate-x-1">→</span>
              </Link>
            ))}
            {wa && (
              <a href={wa} target="_blank" rel="noopener" className="group flex items-center justify-between rounded-2xl border border-line-strong bg-fg/[0.02] p-5 transition-colors hover:border-fg/30">
                <span>
                  <span className="block text-sm text-dim">Prefere conversar agora?</span>
                  <span className="mt-1 block text-lg font-medium">WhatsApp</span>
                </span>
                <span aria-hidden className="text-muted transition-transform group-hover:translate-x-1">→</span>
              </a>
            )}
            {site.email && (
              <a href={mailtoLink("Projeto com a Spolaor Tecnologia")!} className="group flex items-center justify-between rounded-2xl border border-line-strong bg-fg/[0.02] p-5 transition-colors hover:border-fg/30">
                <span>
                  <span className="block text-sm text-dim">E-mail</span>
                  <span className="mt-1 block text-lg font-medium">{site.email}</span>
                </span>
                <span aria-hidden className="text-muted transition-transform group-hover:translate-x-1">→</span>
              </a>
            )}
          </div>
        </div>
        <div className="fade-up lg:col-span-7" style={{ animationDelay: "0.2s" }}>
          <Suspense fallback={<div className="h-[720px] rounded-[16px] border border-line bg-ink-900" />}>
            <ContactForm
              interestsLabel="Seu interesse"
              messageLabel="O que sua empresa precisa"
              formLabel="Conte o que sua empresa precisa"
              available={leadsAvailable()}
            />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
