import type { Metadata } from "next";
import { FollowUp } from "@/components/ia/follow-up";

export const metadata: Metadata = {
  title: "Acompanhar contratação · Atendimento com IA",
  robots: { index: false, follow: false },
};

// Destino do retorno do checkout (back_url). O link traz o id e um token secreto; a página não
// confirma pagamento por conta própria: tudo vem de /api/atendimento-ia/status.
export default async function AcompanharPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const id = typeof sp.c === "string" ? sp.c : "";
  const token = typeof sp.t === "string" ? sp.t : "";
  return (
    <section className="pb-20 pt-[84px] md:pt-[140px]" aria-labelledby="acompanhar-title">
      <div className="container-x max-w-3xl">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-dim">Atendimento com IA no WhatsApp</p>
        <h1 id="acompanhar-title" className="mt-4 text-h3 font-semibold md:text-[2.4rem] md:leading-[1.08]">
          Acompanhe a sua contratação.
        </h1>
        <p className="mt-3 leading-relaxed text-muted">Guarde este link: é por ele que você acompanha o pagamento e a liberação do acesso.</p>
        <div className="mt-8">
          {id && token ? <FollowUp id={id} token={token} /> : <p className="text-muted">Link incompleto. Abra o link enviado depois do pagamento.</p>}
        </div>
      </div>
    </section>
  );
}
