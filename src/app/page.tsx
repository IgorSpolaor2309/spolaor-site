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
        {/* Quem chega pelo anúncio geral (sites, lojas, agendamento e automação) faz aqui o pedido do que precisa.
            O diagnóstico continua como opção ("ainda não sei"), não como o único pedido possível. */}
        <AnalysisBlock
          index="08"
          origem="home"
          formulario="pedido"
          label="Pedido sem compromisso"
          title={
            <>
              Conte o que sua empresa precisa. <span className="text-ember">Respondemos pelo WhatsApp.</span>
            </>
          }
          text="Site, loja virtual, agendamento online ou automação: escolha o que procura e diga em poucas palavras o que quer resolver. Se ainda não souber qual solução serve, marque “Ainda não sei” e ajudamos a identificar."
          itemsTitle="Depois do envio"
          items={[
            "Lemos o seu pedido, com as suas palavras",
            "Chamamos você no WhatsApp informado para entender os detalhes",
            "Se pediu ajuda para escolher, olhamos como os clientes chegam até você e o que acontece com eles",
            "Se fizer sentido seguir, enviamos proposta com escopo, prazo e investimento",
          ]}
          note="Pedir não custa nada e não obriga a contratar."
          submitLabel="Enviar pedido"
        />
      </div>
      <Faq />
      <div className={wash}>
        <FinalCta
          text="Conte o que sua empresa precisa: site, loja virtual, agendamento online ou automação. Se ainda não souber, ajudamos a identificar."
          primary={{ href: "#analise", label: "Fazer meu pedido" }}
        />
      </div>
    </>
  );
}
