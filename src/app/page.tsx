import { Hero } from "@/components/home/hero";
import { Leaks } from "@/components/home/leaks";
import { SameProduct } from "@/components/home/same-product";
import { Automation } from "@/components/home/automation";
import { Services } from "@/components/home/services";
import { Case } from "@/components/home/case";
import { Consulting } from "@/components/home/consulting";
import { HowItWorks } from "@/components/home/how-it-works";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

export default function Home() {
  return (
    <>
      <Hero />
      <Leaks />
      <SameProduct />
      <Automation />
      <Services />
      <Case />
      <Consulting />
      <HowItWorks />
      <AnalysisBlock />
      <Faq />
      <FinalCta />
    </>
  );
}
