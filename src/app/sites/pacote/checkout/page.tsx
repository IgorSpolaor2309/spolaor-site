import type { Metadata } from "next";
import Link from "next/link";
import { SiteCheckoutForm } from "@/components/sites/checkout-form";
import { publicSiteOffer } from "@/lib/sites/config";
import { brl, condicao, PACOTE, type CondicaoId } from "@/lib/sites/oferta";
import { whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Checkout · Site de uma página",
  robots: { index: false, follow: false },
  alternates: { canonical: "/sites/pacote/checkout" },
};

// Disponibilidade das condições vem do servidor a cada requisição.
export const dynamic = "force-dynamic";

export default async function SiteCheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const oferta = publicSiteOffer();
  const wa = whatsappLink("Olá! Quero contratar o site de uma página da Spolaor.");

  if (!oferta.aberta) {
    return (
      <section className="pb-20 pt-[100px] md:pt-[150px]" aria-labelledby="checkout-title">
        <div className="container-x max-w-xl">
          <h1 id="checkout-title" className="text-h3 font-semibold">
            A contratação pelo site não está disponível agora.
          </h1>
          <p className="mt-4 leading-relaxed text-muted">Nada foi cobrado. Fale com a Spolaor e combinamos o seu site pelo WhatsApp.</p>
          <div className="mt-6 flex flex-wrap gap-4">
            {wa && (
              <a href={wa} target="_blank" rel="noopener" className="font-semibold text-royal underline underline-offset-4">
                Falar pelo WhatsApp
              </a>
            )}
            <Link href="/sites/pacote" className="font-semibold text-royal underline underline-offset-4">
              Voltar para o pacote
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const pedida = typeof sp.c === "string" ? (sp.c as CondicaoId) : PACOTE.destaque;
  const inicial = oferta.condicoes.includes(pedida) ? pedida : oferta.condicoes.includes(PACOTE.destaque) ? PACOTE.destaque : oferta.condicoes[0];
  const destaque = condicao(PACOTE.destaque)!;

  return (
    <section className="pb-16 pt-[80px] md:pb-24 md:pt-[124px]" aria-labelledby="checkout-title">
      <div className="container-x">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
          <div>
            <p className="eyebrow">
              <span className="text-ember">Spolaor Tecnologia</span>
            </p>
            <h1 id="checkout-title" className="mt-2 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] md:text-[2.1rem]">
              Contratar o site de uma página
            </h1>
          </div>
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 text-[#c95a06]">
              <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v7h-9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Pagamento pelo Mercado Pago
          </p>
        </div>

        <div className="mt-5 grid gap-6 lg:mt-10 lg:grid-cols-12 lg:gap-10">
          <div className="lg:order-1 lg:col-span-7">
            <SiteCheckoutForm disponiveis={oferta.condicoes} inicial={inicial} />
          </div>
          <aside className="lg:order-2 lg:col-span-5" aria-label="Resumo do pacote">
            <div className="rounded-[16px] border-t-[3px] border-[#f07a12] bg-fg p-5 text-white md:p-7">
              <p className="font-semibold">{PACOTE.nome}</p>
              <p className="mt-1 text-[0.9rem] text-white/75">
                {oferta.condicoes.includes(destaque.id)
                  ? `A partir de ${destaque.parcelas}× de R$ ${brl(destaque.parcela)} (total R$ ${brl(destaque.total)}) ou R$ ${brl(condicao(PACOTE.avista)!.total)} à vista`
                  : "Pagamento único pela criação do site"}
              </p>
              <ul className="mt-4 grid gap-2 border-t border-white/15 pt-4 text-[0.93rem] leading-snug text-white/90">
                {[
                  "Site de uma página, adaptado ao celular",
                  "Sua identidade visual, seus serviços e botão de WhatsApp",
                  "Textos organizados e revisados por nós",
                  "Primeira versão em até 5 dias úteis após recebermos as informações e os materiais",
                  "Uma rodada de ajustes, entregue em até 5 dias úteis após a lista consolidada",
                  "Domínio e hospedagem contratados e pagos à parte por você; nós conectamos e publicamos",
                  "Pagamento único, não é assinatura",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#f07a12]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Depois do pagamento, falamos com você pelo WhatsApp para reunir as informações e os materiais. Loja virtual, login, agendamento e
              integrações não fazem parte do pacote.{" "}
              <Link href="/sites/pacote" className="font-semibold text-sky underline underline-offset-4">
                Ver detalhes do pacote
              </Link>
            </p>
          </aside>

        </div>
      </div>
    </section>
  );
}
