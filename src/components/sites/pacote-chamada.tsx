import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { brl, condicao, PACOTE } from "@/lib/sites/oferta";

// Chamada do pacote "Site de uma página" na página /sites: o preço fechado fica visível sem contradizer os
// projetos sob orçamento (o restante da página continua oferecendo o orçamento direto).
export function PacoteChamada() {
  const d = condicao(PACOTE.destaque)!;
  const a = condicao(PACOTE.avista)!;
  return (
    <section className="border-t border-line py-10 md:py-16" aria-labelledby="pacote-chamada-title">
      <div className="container-x">
        <div className="grid items-center gap-6 rounded-[16px] border border-line-strong bg-ink-900 p-5 sm:p-8 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7">
            <p className="eyebrow">
              <span className="text-ember">Pacote com preço fechado</span>
            </p>
            <h2 id="pacote-chamada-title" className="mt-3 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] md:text-[2.1rem]">
              Precisa só de uma página bem feita?
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              Site de uma página, adaptado ao celular, com a sua identidade visual, seus serviços e botão de WhatsApp. Primeira versão em até 5 dias
              úteis após recebermos os materiais e uma rodada de ajustes.
            </p>
            <p className="mt-4 font-display text-[1.5rem] font-semibold tracking-[-0.03em]">
              <span className="text-[#c95a06]">{d.parcelas}×</span> de R$ <span className="text-royal">{brl(d.parcela)}</span>
            </p>
            <p className="text-[0.95rem] text-fg">
              Total R$ {brl(d.total)} · ou R$ {brl(a.total)} no Pix ou cartão à vista. Domínio e hospedagem à parte.
            </p>
            <ButtonLink href="/sites/pacote" size="md" arrow className="mt-5">
              Ver o pacote
            </ButtonLink>
          </div>
          <div className="md:col-span-5">
            <Image src="/ilustracoes/site-uma-pagina-A.webp" alt="Exemplo demonstrativo de site de uma página no notebook e no celular (empresa fictícia)." width={1360} height={990} sizes="(min-width: 768px) 36vw, 90vw" className="h-auto w-full" />
            <p className="mt-1 text-[0.78rem] text-dim">Exemplo demonstrativo · empresa fictícia</p>
          </div>
        </div>
      </div>
    </section>
  );
}
