import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/ia/checkout-form";
import { Price, PriceNote } from "@/components/ia/price";
import { publicOffer, validationOk } from "@/lib/ia/config";
import { arrependimentoTexto, methodsSentence, renewalTerms } from "@/lib/ia/terms";

export const metadata: Metadata = {
  title: "Checkout · Atendimento com IA no WhatsApp",
  robots: { index: false, follow: false },
  alternates: { canonical: "/atendimento-ia/checkout" },
};

// Disponibilidade e preço vêm do servidor a cada requisição.
export const dynamic = "force-dynamic";

// Checkout próprio: reúne só os dados da assinatura e do acesso e leva ao pagamento seguro do Mercado
// Pago. Nenhum dado de cartão passa por aqui. O servidor define o preço e cria a assinatura recorrente.
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const acesso = typeof sp.acesso === "string" && validationOk(sp.acesso) ? sp.acesso : null;
  const offer = publicOffer({ validation: !!acesso });
  const replyLimit = offer.replyLimit?.toLocaleString("pt-BR");

  if (!offer.enabled || !offer.price || !offer.replyLimit) {
    return (
      <section className="pb-20 pt-[100px] md:pt-[150px]" aria-labelledby="checkout-title">
        <div className="container-x max-w-xl">
          <h1 id="checkout-title" className="text-h3 font-semibold">
            As assinaturas não estão disponíveis agora.
          </h1>
          <p className="mt-4 leading-relaxed text-muted">Deixe seu contato na página do plano e avisamos quando abrirem.</p>
          <Link href="/atendimento-ia#comprar" className="mt-6 inline-block font-semibold text-royal underline underline-offset-4">
            Voltar para o plano
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="pb-16 pt-[84px] md:pb-24 md:pt-[124px]" aria-labelledby="checkout-title">
      <div className="container-x">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line pb-5">
          <div>
            <p className="eyebrow">
              <span className="text-ember">Spolaor Tecnologia</span>
            </p>
            <h1 id="checkout-title" className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] md:text-[2.1rem]">
              Finalize sua assinatura
            </h1>
          </div>
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 text-[#c95a06]">
              <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v7h-9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Pagamento seguro pelo Mercado Pago
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:mt-10 lg:grid-cols-12 lg:gap-10">
          <aside className="lg:order-2 lg:col-span-5" aria-label="Resumo da assinatura">
            <div className="rounded-[16px] border-t-[3px] border-[#f07a12] bg-fg p-6 text-white md:p-7">
              <p className="font-semibold">Atendimento com IA no WhatsApp</p>
              <p className="mt-4">
                <Price price={offer.price} className="text-[2.6rem] text-[#f07a12]" unitClassName="text-[1.05rem] text-white/75" />
              </p>
              <p className="mt-2 text-[0.82rem] text-white/70">
                <PriceNote cycle={offer.cycle} />
              </p>
              <ul className="mt-5 grid gap-2.5 border-t border-white/15 pt-5 text-[0.95rem] leading-snug text-white/90">
                {[`Até ${replyLimit} respostas do agente por ciclo`, "Acesso liberado automaticamente depois do pagamento confirmado", "Sem fidelidade"].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#f07a12]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 hidden text-sm leading-relaxed text-muted lg:block">
              <Conditions methods={offer.methods} cycle={offer.cycle} />
            </div>
          </aside>

          <div className="lg:order-1 lg:col-span-7">
            {offer.validation && (
              <p role="note" className="mb-4 rounded-[12px] border border-[#f07a12] bg-ink-900 px-4 py-3 text-sm text-fg">
                Modo de validação interna: a contratação pública continua desligada. Esta compra é real.
              </p>
            )}
            <CheckoutForm price={offer.price} cycle={offer.cycle} methods={offer.methods} acesso={acesso} />
            <div className="mt-4 text-sm leading-relaxed text-muted lg:hidden">
              <Conditions methods={offer.methods} cycle={offer.cycle} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Conditions({ methods, cycle }: { methods: Parameters<typeof renewalTerms>[0]; cycle: string }) {
  return (
    <>
      <p className="font-semibold text-fg">Condições</p>
      <ul className="mt-2 grid gap-1.5">
        <li>
          {methodsSentence(methods)} {renewalTerms(methods, cycle).join(" ")}
        </li>
        <li>Cancele quando quiser: sem novas cobranças, e o acesso continua até o fim do período já pago.</li>
        <li>{arrependimentoTexto}</li>
        <li>Mensagens cobradas pela Meta no WhatsApp são pagas à parte.</li>
      </ul>
    </>
  );
}
