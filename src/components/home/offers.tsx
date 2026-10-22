import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { ButtonLink } from "@/components/ui/button";

// As duas ofertas principais, lado a lado e com a mesma estrutura: para quem é, o que resolve,
// o que entregamos e o próximo passo. Sites levam ao pedido de orçamento direto; automação, ao
// diagnóstico do processo, com saída para quem já sabe o que quer contratar.
const offers = [
  {
    id: "oferta-sites",
    name: "Sites e landing pages",
    tone: "text-sky",
    forWhom: "Para empresas que precisam apresentar bem os seus serviços e facilitar contatos e pedidos de orçamento.",
    solves: [
      "Visitante que não entende o que você faz e sai sem chamar",
      "Site antigo, lento ou difícil de usar no celular",
      "Pedido de orçamento que chega incompleto ou se perde no e-mail",
    ],
    delivers: [
      "Site institucional ou landing page com texto e estrutura pensados para o cliente decidir",
      "Botão de WhatsApp e formulário de orçamento que pedem só o necessário",
      "Versão para celular projetada desde o início",
      "Domínio sempre no nome da sua empresa",
    ],
    primary: { href: "/sites#orcamento", label: "Pedir orçamento de site" },
    secondary: { href: "/sites", label: "Ver como fazemos sites" },
  },
  {
    id: "oferta-automacao",
    name: "Automação de processos",
    tone: "text-ember",
    forWhom:
      "Para empresas que querem reduzir tarefas manuais, organizar informações e acompanhar atendimentos e oportunidades comerciais.",
    solves: [
      "Orçamentos enviados que ficam sem retorno",
      "As mesmas perguntas feitas e anotadas à mão em todo atendimento",
      "Os mesmos dados preenchidos na planilha, no sistema e no WhatsApp",
    ],
    delivers: [
      "Lista dos orçamentos em aberto, com lembrete para o segundo contato",
      "Informações básicas coletadas já no primeiro atendimento",
      "Dados preenchidos uma vez e levados para onde precisam estar",
      "Cada atendimento com responsável, etapa e próximo passo",
    ],
    primary: { href: "/automacao#analise", label: "Pedir diagnóstico do processo" },
    secondary: { href: "/contato?interesse=Automação", label: "Já sei o que quero automatizar" },
  },
];

function List({ title, items, marker }: { title: string; items: string[]; marker: string }) {
  return (
    <div>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">{title}</p>
      <ul className="mt-3 grid gap-2.5">
        {items.map((it) => (
          <li key={it} className="flex gap-3 leading-snug text-fg/90">
            <span aria-hidden className={`mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full ${marker}`} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Offers() {
  return (
    <section id="servicos" className="relative border-t border-line py-24 md:py-36" aria-labelledby="offers-title">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <SectionLabel index="02" tone="signal">
              O que fazemos
            </SectionLabel>
            <h2 id="offers-title" className="mt-8 text-h2 font-semibold">
              Duas frentes de trabalho. Você contrata uma ou as duas.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <p className="text-[1.05rem] leading-relaxed text-muted">
              Um site que facilita o primeiro contato e um processo que não deixa esse contato esquecido. Cada projeto começa pelo
              problema que você quer resolver, não pela ferramenta.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-x-12 gap-y-16 lg:grid-cols-2">
          {offers.map((o, i) => (
            <Reveal key={o.id} delay={i * 0.06}>
              <article id={o.id} aria-labelledby={`${o.id}-title`} className="flex h-full scroll-mt-28 flex-col border-t-2 border-fg pt-8">
                <span className={`font-mono text-sm ${o.tone}`}>0{i + 1}</span>
                <h3 id={`${o.id}-title`} className="mt-4 text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.035em] md:text-[2.3rem]">
                  {o.name}
                </h3>
                <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-muted">{o.forWhom}</p>
                <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <List title="O que resolve" items={o.solves} marker="bg-[#f07a12]" />
                  <List title="O que entregamos" items={o.delivers} marker="bg-royal" />
                </div>
                <div className="mt-auto flex flex-col gap-4 pt-10 sm:flex-row sm:items-center">
                  <ButtonLink href={o.primary.href} size="lg" arrow>
                    {o.primary.label}
                  </ButtonLink>
                  <Link
                    href={o.secondary.href}
                    className="text-[0.95rem] font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
                  >
                    {o.secondary.label}
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-16 max-w-3xl leading-relaxed text-muted">
            Quando a operação pede mais, desenvolvemos{" "}
            <Link href="/sistemas" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              sistemas sob medida
            </Link>{" "}
            ou começamos por uma{" "}
            <Link href="/consultoria" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              consultoria
            </Link>
            . Também fazemos{" "}
            <Link href="/sites#ecommerce" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              lojas virtuais
            </Link>{" "}
            e{" "}
            <Link href="/sites#identidade" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              identidade visual
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
