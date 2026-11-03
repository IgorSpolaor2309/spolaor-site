import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { ButtonLink } from "@/components/ui/button";
import { ServiceIllustration, type IllustrationName } from "@/components/ui/service-illustration";

// As soluções lado a lado, com a mesma estrutura para comparar: para quem é, o que inclui e o
// próximo passo. É o destino do botão da abertura (#servicos). A ilustração de sites já está na
// abertura, então a linha de sites não repete imagem. Cada caminho mantém o destino da sua página.
type Solution = {
  id: string;
  name: string;
  forWhom: string;
  includes: string;
  image?: IllustrationName;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
};

const solutions: Solution[] = [
  {
    id: "oferta-sites",
    name: "Sites e landing pages",
    forWhom: "Para apresentar bem os seus serviços e receber contatos e pedidos de orçamento.",
    includes: "Texto e estrutura pensados para o cliente decidir, versão para celular desde o início, formulário e botão de WhatsApp que pedem só o necessário. O domínio fica no nome da sua empresa.",
    primary: { href: "/sites#orcamento", label: "Pedir orçamento de site" },
    secondary: { href: "/sites", label: "Ver como fazemos sites" },
  },
  {
    id: "oferta-lojas",
    name: "Lojas virtuais",
    forWhom: "Para quem vende pelo Instagram, pelo WhatsApp ou em loja física.",
    includes: "Catálogo, compra, pagamento e pedidos num endereço seu, conforme o escopo de cada projeto.",
    image: "loja-virtual",
    primary: { href: "/lojas-virtuais", label: "Ver lojas virtuais" },
  },
  {
    id: "oferta-agendamento",
    name: "Agendamento online",
    forWhom: "Para quem atende com hora marcada e ainda combina tudo por mensagem.",
    includes: "O cliente escolhe o serviço e o horário livre, recebe a confirmação e os lembretes. Para prestadores de serviço e clínicas.",
    image: "agendamento-online",
    primary: { href: "/agendamento-online", label: "Ver agendamento online" },
  },
  {
    id: "oferta-automacao",
    name: "Automação de processos",
    forWhom: "Para equipes que repetem tarefas à mão e perdem o fio dos atendimentos.",
    includes: "Cada atendimento com responsável e próximo passo, dados preenchidos uma vez só e lembrete para retomar orçamentos enviados.",
    image: "crm-automacao",
    primary: { href: "/automacao#analise", label: "Pedir diagnóstico do processo" },
    secondary: { href: "/contato?interesse=Automação", label: "Já sei o que quero automatizar" },
  },
];

const link = "text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg";

export function Offers() {
  return (
    <section id="servicos" className="relative scroll-mt-16 border-t border-line pb-14 pt-10 md:py-28" aria-labelledby="offers-title">
      <div className="container-x">
        <Reveal className="max-w-3xl">
          <SectionLabel index="01" tone="signal">
            O que fazemos
          </SectionLabel>
          <h2 id="offers-title" className="mt-5 text-h3 font-semibold md:mt-7 md:text-[2.6rem] md:leading-[1.08]">
            Quatro soluções. Você começa pela que mais faz falta hoje.
          </h2>
        </Reveal>

        <div className="mt-8 border-t-2 border-fg md:mt-12">
          {solutions.map((s, i) => (
            <Reveal key={s.id} delay={i * 0.04}>
              <article
                id={s.id}
                aria-labelledby={`${s.id}-title`}
                className="grid scroll-mt-24 grid-cols-[1fr_5.75rem] gap-x-4 gap-y-3 border-b border-line py-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem] md:gap-x-10 md:py-9"
              >
                <div className={s.image ? "" : "col-span-2 md:col-span-1"}>
                  <span className="font-mono text-[0.72rem] text-sky">0{i + 1}</span>
                  <h3 id={`${s.id}-title`} className="mt-1.5 text-[1.45rem] font-semibold leading-[1.15] tracking-[-0.03em] md:text-[1.75rem]">
                    {s.name}
                  </h3>
                  <p className="mt-2 leading-snug text-muted">{s.forWhom}</p>
                </div>
                {s.image && (
                  <ServiceIllustration
                    name={s.image}
                    decorative
                    sizes="(min-width: 768px) 160px, 92px"
                    className="col-start-2 row-start-1 self-start md:col-start-3 md:row-span-2"
                  />
                )}
                <p className="col-span-2 leading-relaxed text-fg/90 md:col-span-1 md:col-start-2 md:row-span-2 md:row-start-1 md:pt-7">
                  <span className="mb-1 block font-mono text-[0.66rem] uppercase tracking-[0.14em] text-dim">O que inclui</span>
                  {s.includes}
                </p>
                <div className="col-span-2 flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:gap-5 md:col-span-1 md:col-start-1 md:row-start-2">
                  <ButtonLink href={s.primary.href} arrow className="w-full sm:w-auto">
                    {s.primary.label}
                  </ButtonLink>
                  {s.secondary && (
                    <Link href={s.secondary.href} className={`text-center text-[0.95rem] font-medium sm:text-left ${link}`}>
                      {s.secondary.label}
                    </Link>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-8 grid gap-4 leading-relaxed text-muted md:mt-10 md:grid-cols-2 md:gap-10">
            <p>
              <span className="font-semibold text-fg">Já tem site?</span> Pedimos só o endereço e devolvemos o que melhorar primeiro, no{" "}
              <Link href="/diagnostico-site" className={link}>
                diagnóstico gratuito de site
              </Link>
              . As melhorias são contratadas à parte.
            </p>
            <p>
              Quando a operação pede mais, desenvolvemos{" "}
              <Link href="/sistemas" className={link}>
                sistemas sob medida
              </Link>{" "}
              ou começamos por uma{" "}
              <Link href="/consultoria" className={link}>
                consultoria
              </Link>
              . Também fazemos{" "}
              <Link href="/sites#identidade" className={link}>
                identidade visual
              </Link>
              .
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
