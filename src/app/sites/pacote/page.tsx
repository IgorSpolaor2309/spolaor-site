import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { publicSiteOffer } from "@/lib/sites/config";
import { brl, CONDICOES, condicao, PACOTE } from "@/lib/sites/oferta";

export const metadata: Metadata = {
  title: "Site de uma página: 12× de R$ 47,90",
  description:
    "Criação de site de uma página para a sua empresa: adaptado ao celular, com a sua identidade visual, seus serviços e botão de WhatsApp. 12× de R$ 47,90 (total R$ 574,80) ou R$ 449,90 no Pix ou cartão à vista.",
  alternates: { canonical: "/sites/pacote" },
};

// Disponibilidade das condições de pagamento vem do servidor a cada requisição.
export const dynamic = "force-dynamic";

const destaque = condicao(PACOTE.destaque)!;
const avista = condicao(PACOTE.avista)!;

const incluido = [
  { t: "Uma página com as seções do seu negócio", d: "Apresentação, serviços, como você atende, contato e o que mais fizer sentido. Acrescentar ou tirar um bloco simples faz parte da personalização." },
  { t: "Adaptado ao celular", d: "Projetado para a tela pequena desde o começo, e igualmente bem no computador." },
  { t: "Com a sua identidade visual", d: "Seu logo, suas cores e suas fotos (ou imagens adequadas ao seu ramo)." },
  { t: "Textos organizados por nós", d: "Você conta como a empresa funciona; nós organizamos e revisamos os textos a partir dessas informações." },
  { t: "Botão de WhatsApp", d: "O visitante chama a sua empresa com um toque, no computador e no celular." },
  { t: "Publicação", d: "Conectamos o site ao domínio e à hospedagem que você contratar e colocamos no ar." },
];

const etapas = [
  { t: "Conversa pelo WhatsApp", d: "Depois do pagamento, falamos com você pelo WhatsApp informado para entender a empresa e reunir informações e materiais (logo, fotos, serviços, contatos)." },
  { t: "Textos e primeira versão", d: "Organizamos e revisamos os textos. A primeira versão fica pronta em até 5 dias úteis depois de recebermos todas as informações e materiais necessários. Reunião online só quando for necessária." },
  { t: "Uma rodada de ajustes", d: "Você revisa e envia, de uma vez, a lista de ajustes. Entregamos os ajustes em até 5 dias úteis depois de receber a lista consolidada." },
  { t: "Site no ar", d: "Orientamos pelo WhatsApp a escolha do domínio e da hospedagem, que você contrata e paga direto ao provedor. Nós conectamos e publicamos." },
];

const faq = [
  {
    q: "É uma assinatura?",
    a: "Não. É o pagamento pela criação do site, uma vez só: R$ 449,90 no Pix ou cartão à vista, ou parcelado no cartão. Não há mensalidade da Spolaor.",
  },
  {
    q: "Quanto tempo leva?",
    a: "A primeira versão fica pronta em até 5 dias úteis depois de recebermos todas as informações e materiais necessários. Por isso o prazo depende de quando os materiais chegam. Depois, você tem uma rodada de ajustes, entregue em até 5 dias úteis após recebermos a lista consolidada.",
  },
  {
    q: "Quantas alterações estão incluídas?",
    a: "Uma rodada de ajustes depois da primeira versão. Junte tudo o que quer mudar numa lista só, que nós aplicamos de uma vez.",
  },
  {
    q: "Quantas seções o site pode ter?",
    a: "As seções seguem o que o seu negócio precisa: apresentação, serviços, como você atende, contato e outras do mesmo tipo. Acrescentar ou tirar um bloco simples faz parte da personalização. O pacote é de uma página: várias páginas, loja virtual, login, sistema de agendamento ou integrações têm orçamento separado.",
  },
  {
    q: "Domínio e hospedagem estão incluídos?",
    a: "Não. Você contrata e paga o domínio e a hospedagem direto ao provedor que escolher. Nós orientamos a escolha pelo WhatsApp e fazemos a conexão e a publicação.",
  },
  {
    q: "Preciso ter os textos prontos?",
    a: "Não. Você nos passa as informações pelo WhatsApp (o que faz, para quem, como atende, contatos) e nós organizamos e revisamos os textos.",
  },
  {
    q: "E se eu precisar de algo maior?",
    a: "Sites com várias páginas, lojas virtuais, agendamento e integrações são feitos sob orçamento. Peça pela página de sites.",
  },
];

export default function PacoteSitePage() {
  const oferta = publicSiteOffer();
  const checkoutHref = `/sites/pacote/checkout?c=${destaque.id}`;
  return (
    <>
      <section className="relative isolate overflow-hidden pb-8 pt-[78px] md:pb-16 md:pt-[132px]" aria-labelledby="pacote-title">
        <div className="container-x grid gap-6 md:gap-10 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="lg:col-span-6">
            <SectionLabel>
              <span className="text-ember">Pacote de site</span>
            </SectionLabel>
            <h1 id="pacote-title" className="mt-3 max-w-[18ch] text-[clamp(1.95rem,1rem+3.4vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.04em] md:mt-6">
              O site da sua empresa, em uma página, <span className="text-sky">pronto para o celular.</span>
            </h1>
            <p className="mt-3 max-w-[34rem] text-[1rem] leading-relaxed text-muted md:mt-5 md:text-lg">
              Com a sua identidade visual, os seus serviços e botão de WhatsApp. Nós organizamos os textos e publicamos.
            </p>
            <div className="mt-4 md:mt-7" aria-label="Preço">
              <p className="flex flex-wrap items-baseline gap-x-2 font-display font-semibold tracking-[-0.03em]">
                <span className="text-[1.35rem] text-[#c95a06] md:text-[1.6rem]">{destaque.parcelas}×</span>
                <span className="text-[1.05rem] text-fg md:text-[1.2rem]">de R$</span>
                <span className="text-[2.5rem] leading-none text-royal md:text-[3.1rem]">{brl(destaque.parcela)}</span>
              </p>
              <p className="mt-1.5 text-[0.98rem] font-medium text-fg">Total parcelado: R$ {brl(destaque.total)}</p>
              <p className="mt-0.5 text-[0.98rem] font-semibold text-fg">ou R$ {brl(avista.total)} no Pix ou cartão à vista</p>
              <p className="mt-1.5 text-[0.84rem] text-dim">Pagamento único pela criação do site. Não é assinatura.</p>
            </div>
            <div className="mt-4 md:mt-6">
              {oferta.aberta ? (
                <ButtonLink href={checkoutHref} size="lg" arrow data-hero-cta className="w-full shadow-[0_10px_30px_-10px_rgb(30_91_230/0.6)] sm:w-auto">
                  Contratar meu site
                </ButtonLink>
              ) : (
                <div data-hero-cta>
                  <ButtonLink href="/contato" size="lg" arrow className="w-full sm:w-auto">
                    Falar com a Spolaor
                  </ButtonLink>
                  <p className="mt-2 text-sm text-dim">A contratação pelo site abre em breve.</p>
                </div>
              )}
              <p className="mt-2.5 text-[0.84rem] text-dim">Domínio e hospedagem são contratados à parte, com a nossa orientação.</p>
            </div>
          </div>
          <figure className="lg:col-span-6">
            <Image
              src="/ilustracoes/site-uma-pagina-A.webp"
              alt="Exemplo demonstrativo: o mesmo site de uma página de uma empresa fictícia de ar-condicionado aberto no notebook e no celular, com botão de WhatsApp."
              width={1360}
              height={990}
              priority
              sizes="(min-width: 1024px) 46vw, 92vw"
              className="h-auto w-full"
            />
            <figcaption className="mt-1 flex items-center gap-2 text-[0.8rem] text-dim">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#f07a12]" />
              Exemplo demonstrativo · empresa fictícia
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="border-t border-line py-12 md:py-24" aria-labelledby="incluido-title">
        <div className="container-x">
          <SectionLabel index="01">O pacote</SectionLabel>
          <h2 id="incluido-title" className="mt-5 max-w-3xl text-h3 font-semibold md:mt-6 md:text-[2.5rem] md:leading-[1.08]">
            O que está incluído.
          </h2>
          <ul className="mt-6 grid gap-x-10 border-t border-line-strong md:mt-10 md:grid-cols-2">
            {incluido.map((i) => (
              <li key={i.t} className="flex gap-4 border-b border-line py-5">
                <span aria-hidden className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f07a12]">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white">
                    <path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[1.08rem] font-semibold">{i.t}</span>
                  <span className="mt-1 block leading-relaxed text-muted">{i.d}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8 grid gap-6 rounded-[16px] border border-line bg-ink-900 p-6 md:grid-cols-2 md:p-8">
            <div>
              <p className="font-semibold">Não está incluído</p>
              <ul className="mt-3 grid gap-2 leading-relaxed text-muted">
                <li>Domínio e hospedagem: você contrata e paga direto ao provedor. Nós orientamos, conectamos e publicamos.</li>
                <li>Funcionalidades como loja virtual, login, sistema de agendamento ou integrações.</li>
                <li>Várias páginas.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">Precisa de mais?</p>
              <p className="mt-3 leading-relaxed text-muted">
                Projetos maiores são feitos sob orçamento, com escopo e prazo próprios.{" "}
                <Link href="/sites#orcamento" className="font-semibold text-sky underline underline-offset-4">
                  Pedir orçamento de site
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-12 md:py-24" aria-labelledby="exemplo-title">
        <div className="container-x grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="lg:col-span-5">
            <SectionLabel index="02">Exemplo demonstrativo</SectionLabel>
            <h2 id="exemplo-title" className="mt-5 text-h3 font-semibold md:mt-6 md:text-[2.5rem] md:leading-[1.08]">
              Com a sua marca, suas cores e seus serviços.
            </h2>
            <p className="mt-4 leading-relaxed text-muted">
              O mesmo modelo de página, personalizado para duas empresas fictícias de ar-condicionado. No seu site entram o seu nome, as suas cores,
              as suas fotos e os seus serviços. Os exemplos não são clientes reais.
            </p>
          </div>
          <figure className="lg:col-span-7">
            <Image
              src="/ilustracoes/site-uma-pagina-B.webp"
              alt="Exemplo demonstrativo: o mesmo modelo de site com outra marca fictícia, outras cores e outra foto."
              width={1360}
              height={990}
              sizes="(min-width: 1024px) 54vw, 92vw"
              className="h-auto w-full"
            />
            <figcaption className="mt-1 flex items-center gap-2 text-[0.8rem] text-dim">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#f07a12]" />
              Exemplo demonstrativo · empresa fictícia
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="border-t border-line py-12 md:py-24" aria-labelledby="etapas-title">
        <div className="container-x">
          <SectionLabel index="03" tone="ember">
            Como funciona
          </SectionLabel>
          <h2 id="etapas-title" className="mt-5 max-w-3xl text-h3 font-semibold md:mt-6 md:text-[2.5rem] md:leading-[1.08]">
            Duas etapas: a criação e uma rodada de ajustes.
          </h2>
          <ol className="mt-6 grid gap-3 md:mt-10 md:grid-cols-2 md:gap-5 lg:grid-cols-4">
            {etapas.map((e, i) => (
              <li key={e.t} className="rounded-[16px] border border-line bg-ink-900 p-5 md:p-6">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f07a12] font-mono text-sm font-semibold text-fg">{i + 1}</span>
                <h3 className="mt-4 text-[1.15rem] font-semibold tracking-[-0.02em]">{e.t}</h3>
                <p className="mt-2 leading-relaxed text-muted">{e.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="condicoes" className="scroll-mt-16 border-t-[3px] border-[#f07a12] bg-fg py-12 text-white md:py-24" aria-labelledby="condicoes-title">
        <div className="container-x grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-white/60">
              <span className="text-[#f07a12]">04</span> · Pagamento
            </p>
            <h2 id="condicoes-title" className="mt-5 text-h3 font-semibold text-white md:mt-6 md:text-[2.5rem] md:leading-[1.08]">
              Pagamento único pela criação do site.
            </h2>
            <p className="mt-4 leading-relaxed text-white/80">
              Não é assinatura. Você escolhe a condição no checkout e paga exatamente o total mostrado para ela, pelo Mercado Pago.
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <table className="w-full text-left text-[0.98rem]">
              <caption className="sr-only">Condições de pagamento do site de uma página</caption>
              <thead>
                <tr className="border-b border-white/20 text-sm text-white/65">
                  <th scope="col" className="py-3 pr-3 font-medium">Condição</th>
                  <th scope="col" className="py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {CONDICOES.filter((c) => !oferta.aberta || oferta.condicoes.includes(c.id)).map((c) => (
                  <tr key={c.id} className="border-b border-white/10">
                    <th scope="row" className="py-3 pr-3 font-medium">
                      {c.meio === "pix" ? "Pix" : c.parcelas === 1 ? "Cartão à vista" : `Cartão em ${c.parcelas}× de R$ ${brl(c.parcela)}`}
                    </th>
                    <td className="py-3 text-right font-semibold tabular-nums">R$ {brl(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {oferta.aberta && (
              <ButtonLink href={checkoutHref} size="lg" arrow className="mt-6 w-full sm:w-auto">
                Contratar meu site
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-24" aria-labelledby="faq-pacote-title">
        <div className="container-x grid gap-6 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <SectionLabel index="05" tone="ember">
              Dúvidas
            </SectionLabel>
            <h2 id="faq-pacote-title" className="mt-5 text-h3 font-semibold md:mt-6 md:text-[2.5rem] md:leading-[1.08]">
              Antes de contratar.
            </h2>
          </div>
          <div className="border-t border-line-strong lg:col-span-7 lg:col-start-6">
            {faq.map((f) => (
              <details key={f.q} className="group border-b border-line py-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[1.05rem] font-semibold leading-snug [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="mt-0.5 font-mono text-lg leading-none text-ember transition-transform group-open:rotate-45">
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
