import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";

export type QA = { q: string; a: string };

export const homeFaq: QA[] = [
  {
    q: "Quanto custa um projeto?",
    a: "Cada projeto tem orçamento próprio, definido pela necessidade, pela complexidade e pelo prazo. Por isso não publicamos tabela de preços. A análise gratuita é o melhor ponto de partida para chegar a um valor realista.",
  },
  {
    q: "A análise gratuita é mesmo gratuita?",
    a: "Sim. Você informa o site e recebe os principais pontos de melhoria, sem custo e sem obrigação de contratar nada.",
  },
  {
    q: "Já tenho Instagram. Preciso mesmo de um site?",
    a: "O Instagram ajuda a ser lembrado, mas o alcance depende do algoritmo e o perfil não é seu. Um site próprio é onde você controla a mensagem, apresenta a oferta com clareza, reúne provas e transforma interesse em contato.",
  },
  {
    q: "Meu site é recente. Ainda faz sentido pedir a análise?",
    a: "Faz. Um site novo pode ser bonito e ainda assim não converter. A análise mostra se ele está cumprindo o papel de gerar oportunidades.",
  },
  {
    q: "No nome de quem fica o domínio?",
    a: "Sempre no seu. O domínio pertence à sua empresa desde o primeiro dia.",
  },
  {
    q: "Quem cuida da hospedagem depois que o site fica pronto?",
    a: "Você escolhe. Pode receber o projeto e cuidar da própria infraestrutura, ou deixar a Spolaor manter tudo no ar por uma mensalidade. O custo do desenvolvimento é sempre separado da hospedagem.",
  },
  {
    q: "A automação com IA vai substituir minha equipe?",
    a: "Não é esse o objetivo. A automação tira da equipe as tarefas repetitivas para que as pessoas foquem no que exige gente: atender bem, negociar e decidir. É assim que a empresa cresce sem aumentar a estrutura na mesma proporção.",
  },
  {
    q: "Vocês desenvolvem aplicativos para celular?",
    a: "Desenvolvemos sistemas web que funcionam muito bem no navegador do celular. Aplicativos nativos para iOS e Android não fazem parte da nossa oferta neste momento.",
  },
];

export function Faq({ items = homeFaq, index = "09", title = "O que costumam nos perguntar antes de começar." }: { items?: QA[]; index?: string; title?: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
  return (
    <section id="perguntas" className="relative border-t border-line py-24 md:py-32" aria-labelledby="faq-title">
      <div className="container-x grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <SectionLabel index={index}>Perguntas</SectionLabel>
          <h2 id="faq-title" className="mt-8 text-h3 font-semibold md:text-[2.4rem] md:leading-[1.08]">
            {title}
          </h2>
        </Reveal>
        <div className="lg:col-span-7 lg:col-start-6">
          {items.map((item, i) => (
            <Reveal key={item.q} delay={Math.min(i * 0.04, 0.2)}>
              <details className="group border-b border-line py-1 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium transition-colors hover:text-fg/80">
                  {item.q}
                  <span aria-hidden className="relative grid h-8 w-8 shrink-0 place-items-center transition-transform duration-500 group-open:rotate-45">
                    <span className="absolute h-px w-3 bg-fg" />
                    <span className="absolute h-3 w-px bg-fg" />
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 leading-relaxed text-muted">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
