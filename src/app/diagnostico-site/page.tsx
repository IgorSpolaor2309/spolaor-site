import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { PriorityReport } from "@/components/diagnostico/priority-report";
import { PhoneCompare } from "@/components/diagnostico/phone-compare";
import { SiteDiagnosisForm } from "@/components/diagnostico/site-diagnosis-form";
import { Solutions } from "@/components/diagnostico/solutions";
import { Faq, type QA } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import { leadsAvailable } from "@/lib/leads/server/pipeline";

export const metadata: Metadata = {
  title: "Diagnóstico gratuito de site: descubra o que melhorar",
  description:
    "Analisamos como seu site funciona, o que pode dificultar o contato dos visitantes e quais melhorias merecem prioridade. O diagnóstico é gratuito; as melhorias são contratadas à parte.",
  alternates: { canonical: "/diagnostico-site" },
  openGraph: { title: "Seu site pode estar perdendo clientes. Descubra o que melhorar.", url: "/diagnostico-site" },
};

// Página de campanha (anúncios e orgânico): a oferta e o botão na primeira tela do celular, uma
// demonstração do que o diagnóstico encontra, os três passos, o formulário curto e, depois dele,
// o restante do que a Spolaor faz. Todo botão principal leva aos campos do formulário (#solicitar).

const steps = [
  {
    title: "Você envia o endereço do seu site.",
    text: "E um contato para o retorno. Não pedimos senha nem acesso ao painel.",
  },
  {
    title: "Analisamos os pontos que dificultam a experiência.",
    text: "Clareza da oferta, uso no celular, caminho até o contato e aspectos técnicos que dá para verificar de fora.",
  },
  {
    title: "Você recebe as principais recomendações e prioridades.",
    text: "Em linguagem simples, pelo WhatsApp ou e-mail, com o que corrigir primeiro.",
  },
];

const receives = [
  "Os principais problemas encontrados, em linguagem simples",
  "O que corrigir primeiro, em ordem de prioridade",
  "Uma recomendação prática para cada ponto",
];

const faq: QA[] = [
  {
    q: "O diagnóstico tem custo?",
    a: "Não. A análise do seu site e o retorno com os principais pontos e prioridades são gratuitos, sem obrigação de contratar nada.",
  },
  {
    q: "E se eu quiser que vocês façam as melhorias?",
    a: "Preparamos uma proposta separada, com escopo, prazo e investimento para o seu caso. A execução das melhorias é contratada à parte.",
  },
  {
    q: "O que vocês analisam, exatamente?",
    a: "Clareza da oferta, uso no celular, o caminho até comprar, agendar ou entrar em contato, sinais de confiança e aspectos técnicos verificáveis, como título, descrição, HTTPS, tempo de carregamento e links quebrados. Vale também para lojas virtuais e páginas de agendamento.",
  },
  {
    q: "Preciso dar acesso ao site ou ao painel?",
    a: "Não. Avaliamos o que qualquer visitante vê. Se quiser que a gente considere números de visitas ou de contatos, é só nos contar.",
  },
  {
    q: "Vocês prometem mais vendas ou mais contatos?",
    a: "Não. O diagnóstico aponta o que dificulta a decisão do visitante. O resultado depende também de fatores fora do site, como divulgação, preço e concorrência.",
  },
  {
    q: "Em quanto tempo recebo o retorno?",
    a: "Combinamos o prazo quando recebemos o pedido, porque depende do tamanho do site. Se for urgente, avise quando falarmos pelo WhatsApp.",
  },
];

export default function DiagnosticoSitePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden pb-16 pt-[96px] md:pb-24 md:pt-[148px]" aria-labelledby="diag-title">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="lg:col-span-7">
            <div className="fade-up">
              <SectionLabel tone="ember">Diagnóstico de site</SectionLabel>
            </div>
            <h1
              id="diag-title"
              className="fade-up mt-5 max-w-[17ch] text-[clamp(2.1rem,1.15rem+3.9vw,4rem)] font-semibold leading-[1.04] tracking-[-0.045em] md:mt-8 lg:max-w-none lg:text-[clamp(2.75rem,1rem+2.9vw,3.5rem)]"
              style={{ animationDelay: "0.06s" }}
            >
              Seu site pode estar <span className="text-ember">perdendo clientes.</span> <span className="lg:block">Descubra o que melhorar.</span>
            </h1>
            <p className="fade-up mt-5 max-w-[34rem] text-[1.06rem] leading-relaxed text-muted md:mt-7 md:text-lg" style={{ animationDelay: "0.14s" }}>
              Analisamos como seu site funciona, o que pode dificultar o contato dos visitantes e quais melhorias merecem prioridade.{" "}
              <strong className="font-semibold text-fg">O diagnóstico é gratuito.</strong>
            </p>
            <div className="fade-up mt-7 md:mt-10" style={{ animationDelay: "0.22s" }}>
              <ButtonLink href="#solicitar" size="lg" arrow className="w-full sm:w-auto">
                Solicitar diagnóstico gratuito
              </ButtonLink>
              <p className="mt-3.5 text-sm text-dim">Sem custo e sem compromisso. Melhorias contratadas à parte.</p>
            </div>
          </div>
          <div className="fade-up lg:col-span-5" style={{ animationDelay: "0.3s" }}>
            <PriorityReport />
          </div>
        </div>
      </section>

      <section id="na-pratica" className="relative border-t border-line py-20 md:py-28" aria-labelledby="demo-title">
        <div className="container-x">
          <PhoneCompare>
            <Reveal className="max-w-2xl">
              <SectionLabel index="01" tone="ember">
                Na prática
              </SectionLabel>
              <h2 id="demo-title" className="mt-6 text-h3 font-semibold md:text-[2.5rem] md:leading-[1.08]">
                Pequenos detalhes decidem se o visitante chama ou vai embora.
              </h2>
              <p className="mt-5 leading-relaxed text-muted md:text-lg">
                Compare duas versões da mesma página no celular. São pontos como estes que o diagnóstico encontra no seu site.
              </p>
            </Reveal>
          </PhoneCompare>
        </div>
      </section>

      <section id="como-funciona" className="relative border-t border-line py-20 md:py-28" aria-labelledby="steps-title">
        <div className="container-x">
          <Reveal className="max-w-3xl">
            <SectionLabel index="02">Como funciona</SectionLabel>
            <h2 id="steps-title" className="mt-6 text-h3 font-semibold md:text-[2.5rem] md:leading-[1.08]">
              Três passos, do endereço do site às prioridades.
            </h2>
          </Reveal>
          <ol className="mt-8 border-b border-line md:mt-14 md:grid md:grid-cols-3 md:gap-10 md:border-0">
            {steps.map((s, i) => (
              <Reveal
                as="li"
                key={s.title}
                delay={i * 0.06}
                className="grid grid-cols-[2.25rem_1fr] border-t border-line py-6 md:block md:border-t-2 md:border-fg md:pb-0 md:pt-5"
              >
                <span className="pt-1 font-mono text-sm text-sky md:pt-0">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-[1.2rem] font-semibold leading-[1.18] tracking-[-0.03em] md:mt-3 md:text-[1.5rem] md:leading-[1.15]">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted md:mt-3">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="formulario" className="relative border-t border-line py-16 md:py-28" aria-labelledby="form-title">
        <div className="container-x grid gap-8 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-10">
          <div className="lg:col-span-5">
            <SectionLabel index="03" tone="signal">
              Solicitar diagnóstico
            </SectionLabel>
            <h2 id="form-title" className="mt-6 text-h3 font-semibold md:text-[2.5rem] md:leading-[1.08]">
              Solicite seu diagnóstico gratuito.
            </h2>
            <p className="mt-4 leading-relaxed text-muted md:text-lg">Precisamos só do endereço do site e de um contato para enviar o retorno.</p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1">
            <SiteDiagnosisForm available={leadsAvailable()} />
          </div>
          <div className="lg:col-span-5">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">O que você recebe</p>
            <ul className="mt-3 border-t border-line-strong">
              {receives.map((t) => (
                <li key={t} className="flex gap-3 border-b border-line py-3.5 leading-snug">
                  <span aria-hidden className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-dim">
              Se quiser ajuda para executar, preparamos uma proposta separada. Redesenho, correções, textos, formulários e integrações são
              contratados à parte.
            </p>
          </div>
        </div>
      </section>

      <Solutions index="04" />

      <Faq items={faq} index="05" title="Dúvidas sobre o diagnóstico." />

      <FinalCta
        title={
          <>
            Antes de mudar o site, <span className="text-ember">descubra o que melhorar primeiro.</span>
          </>
        }
        text="Envie o endereço e receba as principais recomendações, sem custo e sem compromisso."
        primary={{ href: "#solicitar", label: "Solicitar diagnóstico gratuito" }}
        secondary={null}
      />
    </>
  );
}
