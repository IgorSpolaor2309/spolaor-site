import type { Metadata } from "next";
import Link from "next/link";
import { PedidoForm } from "@/components/forms/pedido-form";
import { leadsAvailable } from "@/lib/leads/server/pipeline";
import { SectionLabel } from "@/components/ui/section-label";
import { mailtoLink, site, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Conte o que sua empresa precisa: site ou landing page, loja virtual, agendamento online ou automação. Se ainda não souber qual solução serve, ajudamos a identificar.",
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
            Site, loja virtual, agendamento online ou a automação de um processo que hoje depende de alguém lembrar. Escolha o
            que precisa e escreva do seu jeito; se ainda não souber, ajudamos a identificar.
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
        {/* Alvo dos botões que trazem a pessoa para falar de um projeto (/contato#formulario). */}
        <div id="formulario" className="lg:col-span-7">
          <div className="fade-up" style={{ animationDelay: "0.2s" }}>
            {/* Pedido geral: a pessoa escolhe o serviço (ou "ainda não sei") e responde à pergunta daquele serviço.
                Links com ?servico=site ou ?interesse=Automação já chegam com a opção marcada. */}
            <PedidoForm origem="contato" tipo="projeto" available={leadsAvailable()} />
          </div>
        </div>
      </div>
    </section>
  );
}
