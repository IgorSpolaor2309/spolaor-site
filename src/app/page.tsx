import { Hero } from "@/components/home/hero";
import { HomeSituations } from "@/components/home/situations";
import { Capabilities } from "@/components/home/capabilities";
import { Automation } from "@/components/home/automation";
import { Segments } from "@/components/home/segments";
import { SameProduct } from "@/components/home/same-product";
import { Case } from "@/components/home/case";
import { HowItWorks } from "@/components/home/how-it-works";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

export default function Home() {
  return (
    <>
      <Hero />
      <HomeSituations />
      <Capabilities />
      <Automation />
      <Segments />
      <SameProduct index="05" />
      <Case />
      <HowItWorks index="07" />
      <AnalysisBlock index="08" origem="home" submitLabel="Quero descobrir onde perco clientes" />
      <Faq />
      <FinalCta primary={{ href: "#analise", label: "Analisar minha empresa" }} />
    </>
  );
}
