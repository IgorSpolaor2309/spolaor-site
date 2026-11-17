import { Hero } from "@/components/home/hero";
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

// Lavagem azul curta no começo de algumas seções, para dar ritmo sem trocar o fundo
const wash = "bg-[linear-gradient(180deg,#e6eefb_0px,#f5f4f0_520px)]";

export default function Home() {
  return (
    <>
      <Hero />
      <Offers />
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
