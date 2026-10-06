import type { Metadata } from "next";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq, homeFaq } from "@/components/sections/faq";

export const metadata: Metadata = {
  title: "Análise gratuita do seu site",
  description:
    "Descubra o que seu site está custando para você. Avaliamos primeira impressão, clareza da oferta, mobile, CTAs, credibilidade e oportunidades de conversão e automação. Sem custo.",
  alternates: { canonical: "/analise" },
};

export default function AnalisePage() {
  return (
    <div className="pt-[72px]">
      <AnalysisBlock index="" origem="pagina-analise" headingLevel="h1" />
      <Faq items={[homeFaq[1], homeFaq[0], homeFaq[3], homeFaq[2]]} index="" title="Antes de enviar." />
    </div>
  );
}
