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
      <AnalysisBlock
        origem="pagina-analise"
        headingLevel="h1"
        formulario="pedido"
        title={
          <>
            Diga o que quer melhorar. <span className="text-ember">Ajudamos a escolher a solução.</span>
          </>
        }
        text="Escolha o que você precisa (site, loja virtual, agendamento online ou automação) ou marque “Ainda não sei”. Conte em poucas palavras o que está atrapalhando: olhamos o seu caso e respondemos pelo WhatsApp com o que resolver primeiro. Sem custo e sem compromisso."
        itemsTitle="O que olhamos quando você pede ajuda para escolher"
        submitLabel="Enviar pedido"
      />
      <Faq items={[homeFaq[1], homeFaq[3], homeFaq[0], homeFaq[2]]} index="" title="Antes de enviar." />
    </div>
  );
}
