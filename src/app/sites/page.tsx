import type { Metadata } from "next";
import { PageHero } from "@/components/sections/page-hero";
import { PresenceDemo } from "@/components/home/leak-demos";
import { SameProduct } from "@/components/home/same-product";
import { ConversionAnatomy } from "@/components/sections/conversion-anatomy";
import { FeatureGrid, SectionIntro } from "@/components/sections/feature-grid";
import { SectionLabel } from "@/components/ui/section-label";
import { Reveal } from "@/components/ui/reveal";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq, homeFaq } from "@/components/sections/faq";

export const metadata: Metadata = {
  title: "Sites que convertem",
  description:
    "Sites institucionais, landing pages e redesign pensados para apresentar bem, gerar confiança e transformar visitas em contatos. Solicite uma análise gratuita do seu site.",
  alternates: { canonical: "/sites" },
};

const deliver = [
  { title: "Sites institucionais", text: "A empresa apresentada com o nível de qualidade que ela realmente tem." },
  { title: "Landing pages", text: "Uma página, uma oferta, um objetivo. Ideal para campanhas e anúncios." },
  { title: "Páginas de conversão", text: "Estrutura, texto e chamadas pensados para gerar pedidos de orçamento." },
  { title: "Redesign de sites antigos", text: "Mantemos o que funciona, corrigimos o que afasta clientes." },
  { title: "Responsivo de verdade", text: "Projetado para o celular desde o início, não adaptado no final." },
  { title: "Captação de leads", text: "Formulários, WhatsApp e integração com CRM para nenhum contato se perder." },
];

const insta = [
  ["Quem decide o alcance", "O algoritmo", "Você"],
  ["De quem é o espaço", "Da plataforma", "Da sua empresa"],
  ["Apresentar a oferta completa", "Fragmentado em posts", "Organizado na ordem da decisão"],
  ["Aparecer no Google", "Limitado", "Sim, com SEO"],
  ["Captar e organizar contatos", "Manual, por direct", "Formulário integrado ao CRM"],
  ["Transmitir seriedade a empresas", "Depende", "Endereço próprio e profissional"],
];

const siteFaq = [homeFaq[0], homeFaq[2], homeFaq[3], homeFaq[4], homeFaq[5]];

export default function SitesPage() {
  return (
    <>
      <PageHero
        aside={<div className="rounded-[28px] border border-line bg-ink-900/80 p-4 backdrop-blur md:p-6"><PresenceDemo /></div>}
        eyebrow="Sites"
        title={
          <>
            Seu produto pode não ser o problema. <span className="serif-accent text-ember">Talvez seja a forma como ele é apresentado.</span>
          </>
        }
        text="Antes de conhecer o que você vende, o cliente conhece a forma como sua empresa aparece. Criamos sites que transmitem a qualidade do seu negócio e transformam visita em contato."
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
          <Reveal className="mt-14 overflow-x-auto rounded-[28px] border border-line">
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
            <Reveal id="ecommerce" className="scroll-mt-28 rounded-[28px] border border-line bg-ink-900 p-7 md:p-9">
              <p className="eyebrow">E-commerce</p>
              <h3 className="mt-5 text-2xl font-medium tracking-tight">Sua loja física também pode vender online.</h3>
              <p className="mt-3 text-muted">
                Lojas virtuais para empresas que querem começar a vender pela internet ou organizar uma operação que já existe, com
                catálogo, pagamentos e gestão de pedidos.
              </p>
            </Reveal>
            <Reveal id="identidade" delay={0.08} className="scroll-mt-28 rounded-[28px] border border-line bg-ink-900 p-7 md:p-9">
              <p className="eyebrow">Identidade visual</p>
              <h3 className="mt-5 text-2xl font-medium tracking-tight">Uma marca à altura do que a empresa entrega.</h3>
              <p className="mt-3 text-muted">
                Logotipo, identidade visual, posicionamento visual e materiais digitais básicos para a empresa ser reconhecida e
                levada a sério.
              </p>
            </Reveal>
          </div>

          <Reveal className="mt-5 flex flex-col gap-6 rounded-[28px] border border-line p-7 md:flex-row md:items-center md:justify-between md:p-9">
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

      <AnalysisBlock index="05" origem="sites" />
      <Faq items={siteFaq} index="06" />
    </>
  );
}
