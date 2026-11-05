import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { ChatExample } from "@/components/ia/chat-example";
import { HireForm } from "@/components/ia/hire-form";
import { ContactForm } from "@/components/forms/contact-form";
import { publicOffer } from "@/lib/ia/config";
import { leadsAvailable } from "@/lib/leads/server/pipeline";

export const metadata: Metadata = {
  title: "Atendimento com IA no WhatsApp: assine e ative em minutos",
  description:
    "Um agente de IA no WhatsApp da sua empresa para responder interessados, tirar dúvidas e passar a negociação para a sua equipe. Você assina, recebe o acesso por e-mail, configura o agente no painel e conecta o seu WhatsApp.",
  alternates: { canonical: "/atendimento-ia" },
  openGraph: { title: "Atendimento com IA no WhatsApp", url: "/atendimento-ia" },
};

// Preço, limite e disponibilidade são lidos no servidor a cada requisição.
export const dynamic = "force-dynamic";

// Oferta de AUTOATENDIMENTO: depois do pagamento confirmado, o acesso é criado automaticamente e o
// comprador configura o agente e conecta o próprio WhatsApp no painel. Caminho curto para comprar.
// Tudo visível desde o carregamento (só a abertura usa a entrada em CSS .fade-up). Sem depoimentos,
// resultados, garantias, contador ou desconto: não há oferta com prazo definida.

const steps = [
  { title: "Assine", text: "Pagamento mensal pelo Mercado Pago. Assim que a primeira cobrança é aprovada, o acesso é liberado automaticamente." },
  { title: "Configure o agente", text: "Pelo convite no seu e-mail, entre no painel e informe serviços, horários e respostas. Dá para testar o agente antes de ligar." },
  { title: "Conecte o seu WhatsApp", text: "No painel, entre com a sua conta da Meta e autorize o número da empresa. A autorização é sempre feita pelo dono do número." },
];

const faq = [
  {
    q: "Preciso de alguém para configurar?",
    a: "Não. Você configura o agente no painel, com as informações da sua empresa, e conecta o seu WhatsApp autorizando na Meta. Se travar em algum passo, fale com a Spolaor.",
  },
  {
    q: "O agente fecha vendas sozinho?",
    a: "Não. Ele responde, tira dúvidas e organiza o pedido. A negociação e o fechamento ficam com a sua equipe, que recebe a conversa quando é a hora.",
  },
  {
    q: "Vocês garantem mais vendas?",
    a: "Não. O agente ajuda a responder mais rápido e a não deixar conversa sem retorno, mas o resultado depende também da oferta, do preço, da divulgação e do atendimento da equipe.",
  },
  {
    q: "Existe limite de respostas?",
    a: "Sim. O plano tem um número de respostas do agente por mês, que zera a cada renovação. Ao atingir o limite, o agente para de responder e as conversas seguem para atendimento humano.",
  },
  {
    q: "As mensagens do WhatsApp estão incluídas?",
    a: "Não. As cobranças da Meta pelas mensagens do WhatsApp são feitas diretamente na conta do WhatsApp conectada, à parte da assinatura.",
  },
  {
    q: "Como funciona o cancelamento?",
    a: "Você cancela a assinatura quando quiser. O acesso continua até o fim do período já pago e não há nova cobrança depois disso.",
  },
  {
    q: "E se um pagamento não for aprovado?",
    a: "O Mercado Pago tenta a cobrança de novo. Enquanto ela não for aprovada, o acesso pode ser suspenso ao fim do período pago e volta quando o pagamento for confirmado.",
  },
];

export default function AtendimentoIaPage() {
  const offer = publicOffer();
  const brl = offer.price ? offer.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
  const ctaLabel = offer.enabled ? "Assinar agora" : "Quero ser avisado";
  return (
    <>
      <section className="relative isolate overflow-hidden pb-10 pt-[84px] md:pb-20 md:pt-[140px]" aria-labelledby="ia-title">
        <div className="container-x grid gap-7 md:gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="lg:col-span-7">
            <div className="fade-up">
              <SectionLabel tone="signal">Atendimento com IA no WhatsApp</SectionLabel>
            </div>
            <h1
              id="ia-title"
              className="fade-up mt-4 max-w-[17ch] text-[clamp(2.15rem,1rem+3.8vw,4.2rem)] font-semibold leading-[1.04] tracking-[-0.045em] md:mt-7"
              style={{ animationDelay: "0.06s" }}
            >
              Seu WhatsApp <span className="text-sky">respondendo na hora</span>, até fora do expediente.
            </h1>
            <p className="fade-up mt-4 max-w-[34rem] text-[1.06rem] leading-relaxed text-muted md:mt-6 md:text-lg" style={{ animationDelay: "0.12s" }}>
              Um agente de IA responde interessados, tira dúvidas e passa a negociação para a sua equipe. Você assina, configura no painel e
              conecta o seu número.
            </p>
            <div className="fade-up mt-6 flex flex-col gap-3 sm:flex-row sm:items-center md:mt-9" style={{ animationDelay: "0.18s" }}>
              <ButtonLink href="#contratar" size="lg" arrow data-hero-cta className="shadow-[0_10px_30px_-10px_rgb(30_91_230/0.6)]">
                {ctaLabel}
              </ButtonLink>
              {brl && offer.enabled && (
                <p className="text-center text-[0.95rem] text-muted sm:text-left">
                  <strong className="font-semibold text-fg">{brl}</strong> por mês · cancele quando quiser
                </p>
              )}
            </div>
          </div>
          <div className="fade-up lg:col-span-5" style={{ animationDelay: "0.24s" }}>
            <ChatExample className="mx-auto w-full max-w-[22rem] lg:max-w-none" />
          </div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-16 border-t border-line py-12 md:py-24" aria-labelledby="como-title">
        <div className="container-x">
          <SectionLabel index="01">Ativação</SectionLabel>
          <h2 id="como-title" className="mt-5 max-w-3xl text-h3 font-semibold md:mt-6 md:text-[2.5rem] md:leading-[1.08]">
            Três passos, e o atendimento é seu.
          </h2>
          <ol className="mt-6 grid gap-3 md:mt-12 md:grid-cols-3 md:gap-6">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-[16px] border border-line bg-ink-900 p-5 md:p-7">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-royal font-mono text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-4 text-[1.25rem] font-semibold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="contratar" className="scroll-mt-16 bg-fg py-12 text-white md:py-24" aria-labelledby="contratar-title">
        <div className="container-x grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-white/60">02 · Plano</p>
            <h2 id="contratar-title" className="mt-5 text-h3 font-semibold text-white md:mt-6 md:text-[2.5rem] md:leading-[1.08]">
              {offer.enabled ? "Um plano, sem fidelidade." : "As assinaturas abrem em breve."}
            </h2>
            {brl && offer.enabled && (
              <p className="mt-5 text-[2.6rem] font-semibold leading-none tracking-[-0.04em]">
                {brl}
                <span className="ml-1 text-base font-normal tracking-normal text-white/70">/mês</span>
              </p>
            )}
            <ul className="mt-6 grid gap-2.5 leading-snug text-white/90">
              {[
                offer.replyLimit ? `Até ${offer.replyLimit.toLocaleString("pt-BR")} respostas do agente por mês` : "Limite mensal de respostas do agente definido no plano",
                "Acesso liberado automaticamente depois do pagamento confirmado",
                "Configuração do agente e conexão do WhatsApp feitas por você, no painel",
                "Renovação mensal automática no Mercado Pago; cancele quando quiser",
                "Mensagens cobradas pela Meta no WhatsApp pagas à parte",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#f07a12]" />
                  {t}
                </li>
              ))}
            </ul>
            {!offer.enabled && <p className="mt-6 leading-relaxed text-white/75">Deixe seu contato e avisamos quando as assinaturas abrirem.</p>}
          </div>
          <div className="text-fg lg:col-span-6 lg:col-start-7">
            {offer.enabled && offer.price && offer.replyLimit ? (
              <HireForm price={offer.price} replyLimit={offer.replyLimit} />
            ) : (
              <Suspense fallback={<div className="h-[640px] rounded-[16px] bg-ink-900" />}>
                <ContactForm
                  origem="atendimento-ia"
                  interests={["Quero assinar quando abrir", "Tenho dúvidas sobre como funciona", "Já uso WhatsApp Business"]}
                  interestsLabel="O que você procura?"
                  messageLabel="Como é o atendimento pelo WhatsApp hoje"
                  submitLabel="Quero ser avisado"
                  formLabel="Interesse no atendimento com IA"
                  available={leadsAvailable()}
                />
              </Suspense>
            )}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-24" aria-labelledby="faq-ia-title">
        <div className="container-x grid gap-6 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <SectionLabel index="03">Dúvidas</SectionLabel>
            <h2 id="faq-ia-title" className="mt-5 text-h3 font-semibold md:mt-6 md:text-[2.5rem] md:leading-[1.08]">
              Antes de assinar.
            </h2>
          </div>
          <div className="border-t border-line-strong lg:col-span-7 lg:col-start-6">
            {faq.map((f) => (
              <details key={f.q} className="group border-b border-line py-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[1.05rem] font-semibold leading-snug [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="mt-0.5 font-mono text-lg leading-none text-sky transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
