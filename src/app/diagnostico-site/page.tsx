import type { Metadata } from "next";
import Link from "next/link";
import { SegmentHero } from "@/components/segment/segment-hero";
import { ReportScene } from "@/components/offers/scenes";
import { SituationsDay, type Situation } from "@/components/segment/situations-day";
import { BlindFunnel, Notice } from "@/components/segment/artifacts";
import { Statement } from "@/components/segment/sections";
import { Process } from "@/components/sections/process";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq, type QA } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";

export const metadata: Metadata = {
  title: "Diagnóstico gratuito do seu site: o que está afastando clientes",
  description:
    "Enviamos a avaliação do seu site: clareza da oferta, navegação no celular, caminho de compra, agendamento ou contato e aspectos técnicos verificáveis. O diagnóstico é gratuito; a execução das melhorias é contratada à parte.",
  alternates: { canonical: "/diagnostico-site" },
  openGraph: { title: "Descubra o que o seu site precisa melhorar", url: "/diagnostico-site" },
};

const situations: Situation[] = [
  {
    time: "Visita 1",
    where: "um cliente em potencial chega",
    text: "Ele entra pelo celular, olha por alguns segundos e não entende o que você faz nem o que fazer a seguir.",
    outcome: "Sai sem clicar em nada.",
    artifact: <Notice app="Site no celular" from="Primeira tela" text="Bem-vindo! Somos uma empresa com tradição e compromisso…" meta="sem ação clara" />,
  },
  {
    time: "Visita 2",
    where: "outro cliente quer comprar ou marcar",
    text: "Ele procura o botão. Acha o formulário depois de três cliques, com campos demais para o celular.",
    outcome: "Desiste no meio do caminho.",
    artifact: (
      <BlindFunnel
        rows={[
          { label: "Chegam ao site", width: 100 },
          { label: "Entendem a oferta", width: 55 },
          { label: "Acham o contato", width: 30, unknown: true },
          { label: "Enviam o pedido", width: 12, unknown: true },
        ]}
        note="ilustração, não é um site real"
      />
    ),
  },
  {
    time: "Depois",
    where: "você olha o relatório",
    text: "O site tem visitas, mas poucos contatos. Você não sabe se o problema é a oferta, o celular, o formulário ou o que atrai os visitantes.",
    outcome: "Sem saber o problema, qualquer mudança é palpite.",
    artifact: <Notice app="Painel do site" from="Visitas do mês" text="Há visitas, mas quase nenhum contato chegando." meta="onde está o problema?" />,
  },
];

const looks = [
  { title: "Clareza da oferta", text: "Em poucos segundos, dá para entender o que a empresa faz, para quem e o que fazer a seguir?" },
  { title: "Navegação no celular", text: "Textos legíveis, botões fáceis de tocar, menu que funciona e páginas que não quebram na tela pequena." },
  { title: "Caminho até o objetivo", text: "O percurso até comprar, agendar ou entrar em contato: quantos passos, quantos campos, quantas dúvidas pelo caminho." },
  { title: "Confiança", text: "Sinais de que a empresa é real e levada a sério: contatos visíveis, informações claras, ausência de promessas vagas." },
  { title: "Aspectos técnicos verificáveis", text: "Título e descrição da página, HTTPS, tempo de carregamento, imagens pesadas, links quebrados e formulário funcionando." },
];

const included = [
  "Avaliação do site pelos pontos acima, vista como um cliente veria",
  "Os principais problemas encontrados, em linguagem simples",
  "O que corrigir primeiro, em ordem de prioridade",
  "Retorno pelo WhatsApp ou e-mail informado",
];
const separate = [
  "Redesenhar ou corrigir o site",
  "Reescrever textos e reorganizar páginas",
  "Criar formulários, agendamento ou loja",
  "Integrações, automações e acompanhamento contínuo",
];

const steps = [
  ["Você envia o endereço do site", "E conta, se quiser, o que gostaria de melhorar."],
  ["Nós avaliamos", "Olhando o site como um cliente olharia e checando o que é verificável."],
  ["Você recebe o retorno", "Com os pontos que mais pesam e o que fazer primeiro. Sem custo."],
  ["Se quiser, seguimos", "Preparamos uma proposta com escopo, prazo e investimento. A execução é contratada à parte."],
];

const faq: QA[] = [
  {
    q: "O diagnóstico tem custo?",
    a: "Não. A avaliação do seu site e o retorno com os principais pontos e prioridades são gratuitos, sem obrigação de contratar nada.",
  },
  {
    q: "E se eu quiser que vocês façam as melhorias?",
    a: "Aí preparamos uma proposta separada, com escopo, prazo e investimento para o seu caso. A execução das melhorias é contratada à parte, e o diagnóstico não é uma promessa de contratação nem de resultado.",
  },
  {
    q: "O que vocês analisam, exatamente?",
    a: "Clareza da oferta, navegação no celular, o caminho até comprar, agendar ou entrar em contato, sinais de confiança e aspectos técnicos que dá para verificar de fora, como título, descrição, HTTPS, tempo de carregamento e links quebrados.",
  },
  {
    q: "Vocês prometem mais vendas ou mais contatos?",
    a: "Não. O diagnóstico aponta o que está dificultando a decisão do visitante. Quanto isso muda o resultado depende de muita coisa fora do site, como o que você divulga, o preço e a concorrência.",
  },
  {
    q: "Meu site é recente. Vale a pena?",
    a: "Vale. Um site novo pode ser bonito e ainda assim não deixar claro o que a empresa faz ou o caminho até o contato. O diagnóstico mostra se ele está cumprindo o papel.",
  },
  {
    q: "Em quanto tempo recebo o retorno?",
    a: "Combinamos o prazo quando recebemos o pedido, porque depende do tamanho do site. Se for urgente, avise no campo de mensagem.",
  },
  {
    q: "Funciona para loja virtual ou página de agendamento?",
    a: "Sim. Avaliamos o caminho de compra ou de agendamento da mesma forma. Se o que falta for a loja ou o agendamento em si, temos páginas específicas para isso.",
  },
];

export default function DiagnosticoSitePage() {
  return (
    <>
      <SegmentHero
        eyebrow="Diagnóstico de site"
        title={
          <>
            Seu site recebe visitas. <span className="text-ember">Quantas viram contato, compra ou agendamento?</span>
          </>
        }
        text={
          <>
            <p className="text-fg">
              Enviamos a avaliação do seu site, vista como um cliente veria: clareza da oferta, navegação no celular, o caminho
              até comprar, agendar ou falar com você, e o que dá para verificar de forma técnica.
            </p>
            <p>O diagnóstico é gratuito. Executar as melhorias é um serviço contratado à parte, se você quiser.</p>
          </>
        }
        cta="Pedir diagnóstico do meu site"
        ctaHref="#formulario"
        secondary={{ href: "#o-que-olhamos", label: "Ver o que analisamos" }}
        note="Sem custo e sem compromisso. Você recebe os pontos que mais pesam e o que fazer primeiro."
        scene={<ReportScene />}
      />

      <SituationsDay
        index="01"
        label="Onde o site perde clientes"
        title="Um site pode estar no ar e ainda assim afastar quem chega."
        intro="Não é preciso ser feio para perder cliente. Basta não deixar claro o que a empresa faz ou o que o visitante deve fazer."
        dayLabel="O caminho do visitante"
        scale={["chega", "decide"]}
        items={situations}
        closing={
          <>
            Antes de refazer o site, vale saber o que está de fato atrapalhando. <span className="text-muted">É para isso que serve o diagnóstico.</span>
          </>
        }
      />

      <section id="o-que-olhamos" className="relative scroll-mt-24 border-t border-line py-24 md:py-32" aria-labelledby="looks-title">
        <div className="container-x grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionLabel index="02" tone="signal">
              O que analisamos
            </SectionLabel>
            <h2 id="looks-title" className="mt-8 text-h2 font-semibold">
              Cinco pontos, vistos pelos olhos de quem chega.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Só avaliamos o que dá para verificar de fora. Não temos acesso ao painel nem aos números do seu site, a não ser que
              você nos informe.
            </p>
          </Reveal>
          <ol className="border-t border-line-strong lg:col-span-7">
            {looks.map((l, i) => (
              <Reveal as="li" key={l.title} delay={i * 0.05} className="grid gap-1 border-b border-line py-5 md:grid-cols-[3rem_14rem_1fr] md:gap-6">
                <span className="font-mono text-sm text-dim">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-semibold">{l.title}</span>
                <span className="text-[0.95rem] leading-relaxed text-muted">{l.text}</span>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative border-t border-line py-24 md:py-32" aria-labelledby="scope-title">
        <div className="container-x">
          <Reveal className="max-w-4xl">
            <SectionLabel index="03">O que você recebe</SectionLabel>
            <h2 id="scope-title" className="mt-8 text-h2 font-semibold">
              O diagnóstico é gratuito. <span className="text-muted">As melhorias, não.</span>
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-14 lg:grid-cols-2 lg:gap-0">
            <Reveal className="lg:pr-14">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-signal">Incluído no diagnóstico gratuito</p>
              <ul className="mt-6 border-t border-line-strong">
                {included.map((t) => (
                  <li key={t} className="border-b border-line py-4 text-[0.98rem] leading-relaxed">
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08} className="lg:border-l lg:border-line lg:pl-14">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-fg">Contratado à parte, se você quiser</p>
              <ul className="mt-6 border-t border-line-strong">
                {separate.map((t) => (
                  <li key={t} className="border-b border-line py-4 text-[0.98rem] leading-relaxed text-muted">
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-relaxed text-dim">
                Cada projeto tem orçamento próprio. Não prometemos aumento de vendas ou de faturamento: apontamos o que dificulta a
                decisão do visitante e propomos como resolver.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <Statement kicker="Como funciona">
        Você envia o endereço. <span className="text-sky">Nós olhamos como um cliente olharia e dizemos o que corrigir primeiro.</span>
      </Statement>

      <section className="relative border-t border-line py-24 md:py-32" aria-labelledby="steps-title">
        <div className="container-x grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionLabel index="04">Passo a passo</SectionLabel>
            <h2 id="steps-title" className="mt-8 text-[clamp(1.9rem,1.2rem+2vw,2.9rem)] font-semibold leading-[1.08] tracking-[-0.04em]">
              Do pedido ao retorno, sem burocracia.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              Quando fizer sentido seguir, a proposta vem separada, com escopo, prazo e investimento. Antes disso, você não paga
              nada.
            </p>
          </Reveal>
          <div className="lg:col-span-6 lg:col-start-7">
            <Process steps={steps} />
          </div>
        </div>
      </section>

      <AnalysisBlock
        sectionId="formulario"
        index="05"
        origem="diagnostico-site"
        siteRequired
        label="Diagnóstico gratuito"
        title={
          <>
            Descubra o que o seu site <span className="text-ember">precisa melhorar.</span>
          </>
        }
        text="Informe o endereço do site e conte o que mais incomoda. Retornamos com os pontos que mais pesam e o que fazer primeiro. Sem custo e sem compromisso."
        items={looks.map((l) => l.title)}
        itemsTitle="O que olhamos"
        problemas={[
          "As pessoas visitam, mas poucas entram em contato",
          "Não está claro o que a empresa faz",
          "No celular é difícil de usar",
          "É difícil comprar, agendar ou pedir orçamento",
          "O site parece antigo ou pouco profissional",
          "Não sei qual é o problema",
        ]}
        submitLabel="Pedir diagnóstico do meu site"
        note={
          <>
            Se o que você precisa é de um site novo, de uma loja ou de agendamento, veja{" "}
            <Link href="/sites" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              sites
            </Link>
            ,{" "}
            <Link href="/lojas-virtuais" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              lojas virtuais
            </Link>{" "}
            ou{" "}
            <Link href="/agendamento-online" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              agendamento online
            </Link>
            .
          </>
        }
      />

      <Faq items={faq} index="06" title="O que costumam perguntar sobre o diagnóstico." />

      <FinalCta
        title={
          <>
            Antes de investir em mudanças, <span className="text-ember">descubra onde está o problema.</span>
          </>
        }
        text="Envie o endereço do seu site e receba o diagnóstico, sem custo e sem compromisso."
        primary={{ href: "#formulario", label: "Pedir diagnóstico do meu site" }}
        secondary={{ href: "/sites", label: "Ver sites e landing pages" }}
      />
    </>
  );
}
