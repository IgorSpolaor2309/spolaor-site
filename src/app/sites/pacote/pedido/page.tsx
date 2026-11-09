import type { Metadata } from "next";
import { PedidoPagamento } from "@/components/sites/pedido-pagamento";
import { sitesConfig } from "@/lib/sites/config";
import { whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Seu pedido · Site de uma página",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Pagamento e acompanhamento do pedido (link com id e token, como o acompanhamento da IA).
export default function SitePedidoPage() {
  return (
    <section className="pb-16 pt-[80px] md:pb-24 md:pt-[124px]" aria-labelledby="pedido-title">
      <div className="container-x max-w-2xl">
        <p className="eyebrow">
          <span className="text-ember">Spolaor Tecnologia</span>
        </p>
        <h1 id="pedido-title" className="mt-2 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] md:text-[2.1rem]">
          Seu pedido: site de uma página
        </h1>
        <p className="mt-2 text-sm text-dim">Guarde este link: ele mostra o andamento do pagamento.</p>
        <div className="mt-5">
          <PedidoPagamento publicKey={sitesConfig.publicKey()} whatsappLink={whatsappLink("Olá! Tenho um pedido do site de uma página.")} />
        </div>
      </div>
    </section>
  );
}
