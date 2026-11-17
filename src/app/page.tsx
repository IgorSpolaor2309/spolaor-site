import type { Viewport } from "next";
import { HeroG as Hero } from "@/components/home/hero-variants";
import { HomeSituations } from "@/components/home/situations";
import { Offers } from "@/components/home/offers";
import { Automation } from "@/components/home/automation";
import { Segments } from "@/components/home/segments";
import { SameProduct } from "@/components/home/same-product";
import { Case } from "@/components/home/case";
import { HowItWorks } from "@/components/home/how-it-works";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

// Cor da barra do navegador no celular: o mesmo azul-claro do topo da home
export const viewport: Viewport = { themeColor: "#d9e6fc" };

// Azul bem leve que começa no topo e se desfaz no gesso ao longo das primeiras rolagens
const sky = "bg-[linear-gradient(180deg,#d9e6fc_0px,#e3ebfb_800px,#edf0f6_1700px,#f5f4f0_2600px)]";
// Lavagem azul curta no começo de algumas seções, para dar ritmo sem trocar o fundo
const wash = "bg-[linear-gradient(180deg,#e6eefb_0px,#f5f4f0_520px)]";

export default function Home() {
  return (
    <>
      <div className={sky}>
        <Hero />
        <Offers />
      </div>
      <HomeSituations />
      <div className={wash}>
        <Automation />
      </div>
      <Segments />
      <SameProduct index="05" />
      <div className={wash}>
        <Case />
      </div>
      <HowItWorks index="07" />
      <div className={wash}>
        <AnalysisBlock index="08" origem="home" submitLabel="Quero descobrir onde perco clientes" />
      </div>
      <Faq />
      <div className={wash}>
        <FinalCta primary={{ href: "#analise", label: "Analisar minha empresa" }} />
      </div>
    </>
  );
}
