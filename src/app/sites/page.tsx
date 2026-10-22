import type { Metadata } from "next";
import { PageHero } from "@/components/sections/page-hero";
import { PresenceDemo } from "@/components/home/leak-demos";
import { SameProduct } from "@/components/home/same-product";
import { ConversionAnatomy } from "@/components/sections/conversion-anatomy";
import { FeatureGrid, SectionIntro } from "@/components/sections/feature-grid";
import { SectionLabel } from "@/components/ui/section-label";
import { Reveal } from "@/components/ui/reveal";
import { Suspense } from "react";
import Link from "next/link";
import { ContactForm } from "@/components/forms/contact-form";
import { leadsAvailable } from "@/lib/leads/server/pipeline";
import { Faq, homeFaq } from "@/components/sections/faq";

export const metadata: Metadata = {
  title: "Sites e landing pages",
  description:
    "Sites institucionais, landing pages e redesign para empresas que precisam apresentar bem seus serviços e facilitar contatos e pedidos de orçamento. Peça um orçamento direto.",
  alternates: { canonical: "/sites" },
};

const deliver = [
  { title: "Sites institucionais", text: "A empresa apresentada com o nível de qualidade que ela realmente tem." },
  { title: "Landing pages", text: "Uma página, uma oferta, um objetivo. Ideal para campanhas e anúncios." },
  { title: "Páginas de conversão", text: "Estrutura, texto e chamadas pensados para gerar pedidos de orçamento." },
  { title: "Redesign de sites antigos", text: "Mantemos o que funciona, corrigimos o que afasta clientes." },
  { title: "Responsivo de verdade", text: "Projetado para o celular desde o início, não adaptado no final." },
  { title: "Pedido de orçamento fácil", text: "Formulário e botão de WhatsApp que pedem só o necessário e entregam o contato completo para a equipe." },
];

const insta = [
  ["Quem decide o alcance", "O algoritmo", "Você"],
  ["De quem é o espaço", "Da plataforma", "Da sua empresa"],
  ["Apresentar a oferta completa", "Fragmentado em posts", "Organizado na ordem da decisão"],
  ["Aparecer no Google", "Limitado", "Sim, com SEO"],
  ["Receber pedidos de orçamento", "Solto no direct", "Formulário com as informações que você precisa"],
  ["Transmitir seriedade a empresas", "Depende", "Endereço próprio e profissional"],
];

const siteTypes = ["Site institucional", "Landing page", "Refazer o site atual", "Loja virtual", "Ainda não sei"];

const siteFaq = [
  homeFaq[0],
  {
    q: "O que vocês precisam saber para fazer o orçamento?",
    a: "O que a empresa faz, para quem, se já existe site, quantas páginas você imagina e o prazo. Se faltar alguma informação, perguntamos pelo WhatsApp antes de enviar o orçamento.",
  },
  homeFaq[6],
  {
    q: "Meu site é recente. Ainda faz sentido mexer nele?",
    a: "Depende do que ele entrega hoje. Um site novo pode ser bonito e ainda assim não gerar contatos. Se não tiver certeza, comece pelo diagnóstico: olhamos o site e o caminho do contato antes de propor qualquer mudança.",
  },
  homeFaq[7],
  homeFaq[8],
];

export default function SitesPage() {
  return (
    <>
      <PageHero
        aside={<div className="rounded-[16px] border border-line bg-ink-900/80 p-4 backdrop-blur md:p-6"><PresenceDemo /></div>}
        eyebrow="Sites"
        title={
          <>
            Seu produto pode não ser o problema. <span className="serif-accent text-ember">Talvez seja a forma como ele é apresentado.</span>
          </>
        }
        text="Para empresas que precisam apresentar bem seus serviços e facilitar contatos e pedidos de orçamento. Criamos sites e landing pages que deixam claro o que você faz e tornam fácil o próximo passo do cliente."
        primary={{ href: "#orcamento", label: "Pedir orçamento de site" }}
        secondary={{ href: "/analise", label: "Prefiro começar pelo diagnóstico" }}
      />

      <SameProduct index="01" label="A escolha" showLink={false} />

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="anatomy-title">
        <div className="container-x">
          <SectionIntro
            id="anatomy-title"
            label={<SectionLabel index="02" tone="signal">Anatomia</SectionLabel>}
            title={<>O que uma página que converte <span className="serif-accent text-muted">tem e a sua talvez não.</span></>}
            text="Bonito é o mínimo. O que faz alguém pedir orçamento é clareza, confiança e um próximo passo óbvio."
          />
          <div className="mt-16">
            <ConversionAnatomy />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="insta-title">
        <div className="container-x">
          <SectionIntro
            id="insta-title"
            label={<SectionLabel index="03">Instagram x site</SectionLabel>}
            title={<>Instagram é vitrine. <span className="serif-accent text-signal">Site é endereço.</span></>}
            text="O Instagram é importante para ser lembrado. Mas ele não substitui um lugar que é seu, onde o cliente encontra tudo o que precisa para decidir."
          />
          <Reveal className="mt-14 overflow-x-auto rounded-[16px] border border-line">
            <table className="w-full min-w-[640px] text-left">
              <caption className="sr-only">Comparação entre Instagram e site próprio</caption>
              <thead>
                <tr className="border-b border-line text-sm">
                  <th scope="col" className="p-5 font-normal text-dim md:p-6"> </th>
                  <th scope="col" className="p-5 font-medium text-muted md:p-6">Só Instagram</th>
                  <th scope="col" className="bg-signal/[0.05] p-5 font-medium text-signal md:p-6">Site próprio</th>
                </tr>
              </thead>
              <tbody>
                {insta.map(([k, a, b]) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <th scope="row" className="p-5 font-medium md:p-6">{k}</th>
                    <td className="p-5 text-muted md:p-6">{a}</td>
                    <td className="bg-signal/[0.05] p-5 md:p-6">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line py-24 md:py-32" aria-labelledby="deliver-title">
        <div className="container-x">
          <SectionIntro
            id="deliver-title"
            label={<SectionLabel index="04">O que entregamos</SectionLabel>}
            title={<>Apresentação, confiança e conversão <span className="serif-accent text-muted">no mesmo projeto.</span></>}
          />
          <div className="mt-14">
            <FeatureGrid items={deliver} />
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Reveal id="ecommerce" className="scroll-mt-28 rounded-[16px] border border-line bg-ink-900 p-7 md:p-9">
              <p className="eyebrow">E-commerce</p>
              <h3 className="mt-5 text-2xl font-medium tracking-tight">Sua loja física também pode vender online.</h3>
              <p className="mt-3 text-muted">
                Lojas virtuais para empresas que querem começar a vender pela internet ou organizar uma operação que já existe, com
                catálogo, pagamentos e gestão de pedidos.
              </p>
              <Link href="/lojas-virtuais" className="mt-5 inline-block text-[0.95rem] font-medium text-sky">
                Ver lojas virtuais →
              </Link>
            </Reveal>
            <Reveal id="identidade" delay={0.08} className="scroll-mt-28 rounded-[16px] border border-line bg-ink-900 p-7 md:p-9">
              <p className="eyebrow">Identidade visual</p>
              <h3 className="mt-5 text-2xl font-medium tracking-tight">Uma marca à altura do que a empresa entrega.</h3>
              <p className="mt-3 text-muted">
                Logotipo, identidade visual, posicionamento visual e materiais digitais básicos para a empresa ser reconhecida e
                levada a sério.
              </p>
            </Reveal>
          </div>

          <Reveal className="mt-5 flex flex-col gap-6 rounded-[16px] border border-line p-7 md:flex-row md:items-center md:justify-between md:p-9">
            <div className="max-w-2xl">
              <p className="eyebrow">Depois do lançamento</p>
              <p className="mt-4 text-lg">
                O domínio é sempre seu. Você pode receber o projeto e cuidar da infraestrutura, ou deixar a Spolaor manter o site no
                ar por uma mensalidade, com planos de manutenção e evolução separados do desenvolvimento.
              </p>
            </div>
            <p className="max-w-xs text-sm text-muted">
              Também acompanhamos o desempenho do site para melhorar chamadas, textos, formulários e ofertas com o tempo.
            </p>
          </Reveal>
        </div>
      </section>

      <section id="orcamento" className="scroll-mt-20 border-t border-line py-24 md:py-32" aria-labelledby="quote-title">
        <div className="container-x grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionLabel index="05" tone="signal">
              Orçamento
            </SectionLabel>
            <h2 id="quote-title" className="mt-8 text-h2 font-semibold">
              Já sabe que precisa de um site? <span className="text-sky">Peça o orçamento.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              Conte o que a empresa faz e o que você precisa. Respondemos com perguntas, se faltar algo, e depois com escopo, prazo
              e investimento para o seu caso.
            </p>
            <ol className="mt-10 grid border-t border-line-strong text-[0.95rem]">
              {["Você conta o que precisa", "Tiramos dúvidas pelo WhatsApp, se for preciso", "Você recebe o orçamento com escopo e prazo"].map((t, i) => (
                <li key={t} className="flex gap-3 border-b border-line py-3">
                  <span className="font-mono text-[0.72rem] leading-6 text-dim">{String(i + 1).padStart(2, "0")}</span>
                  {t}
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-dim">
              Ainda não sabe se o problema é o site?{" "}
              <Link href="/analise" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                Comece pelo diagnóstico sem custo
              </Link>
              .
            </p>
          </Reveal>
          <Reveal delay={0.12} className="lg:col-span-6 lg:col-start-7">
            <Suspense fallback={<div className="h-[720px] rounded-[16px] border border-line bg-ink-900" />}>
              <ContactForm
                origem="sites"
                interests={siteTypes}
                interestsLabel="O que você precisa?"
                messageLabel="O que a empresa faz e o que o site precisa ter"
                submitLabel="Pedir orçamento"
                formLabel="Pedir orçamento de site"
                available={leadsAvailable()}
              />
            </Suspense>
          </Reveal>
        </div>
      </section>
      <Faq items={siteFaq} index="06" />
    </>
  );
}
