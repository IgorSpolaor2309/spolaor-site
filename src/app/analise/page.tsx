import type { Metadata } from "next";
import { AnalysisBlock } from "@/components/sections/analysis-block";
import { Faq, homeFaq } from "@/components/sections/faq";

export const metadata: Metadata = {
  title: "Diagnóstico gratuito: onde sua empresa perde clientes",
  description:
    "Conte como os contatos chegam na sua empresa e o que acontece com eles. Mostramos onde estão os pontos de perda (demora na resposta, contatos sem registro, follow-up esquecido, site que não converte) e o que resolver primeiro. Sem custo.",
  alternates: { canonical: "/analise" },
};

export default function AnalisePage() {
  return (
    <div className="pt-[72px]">
      <AnalysisBlock origem="pagina-analise" headingLevel="h1" />
      <Faq items={[homeFaq[1], homeFaq[0], homeFaq[2], homeFaq[3]]} index="" title="Antes de enviar." />
    </div>
  );
}
