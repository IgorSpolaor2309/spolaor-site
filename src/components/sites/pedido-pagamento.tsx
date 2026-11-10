"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackSitePurchase } from "@/lib/analytics";
import { brl } from "@/lib/sites/oferta";

// Página do pedido do pacote de sites: pagamento (Pix com QR Code ou formulário seguro de cartão do Mercado Pago)
// e acompanhamento. O estado vem sempre do servidor, que confere no Mercado Pago; nada aqui confirma pagamento.
// Purchase só sai quando o servidor devolve "pago" (pagamento aprovado e conferido).

type Estado = {
  id: string;
  status: "criado" | "pagamento_pendente" | "pago" | "recusado" | "expirado" | "estornado" | "divergente";
  condicao: string;
  rotulo: string;
  meio: "pix" | "cartao";
  parcelas: number;
  parcela: number;
  total: number;
  nome: string;
  whatsapp: string;
  pix: { copiaCola: string; qrBase64: string | null; expiraEm: string | null } | null;
  motivoRecusa: string | null;
  interna: boolean;
};

type MpBricks = { create: (tipo: string, container: string, settings: unknown) => Promise<{ unmount: () => void }> };
declare global {
  interface Window {
    MercadoPago?: new (key: string, opts: { locale: string }) => { bricks: () => MpBricks };
  }
}

function carregarSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("sdk"));
    document.head.appendChild(s);
  });
}

function Valor({ e }: { e: Estado }) {
  return (
    <div className="rounded-[12px] bg-ink-950 px-4 py-3">
      <p className="text-sm text-muted">Site de uma página · {e.meio === "pix" ? "Pix" : e.parcelas > 1 ? `cartão em ${e.parcelas}×` : "cartão à vista"}</p>
      <p className="mt-0.5 text-[1.35rem] font-semibold tabular-nums tracking-[-0.02em]">
        {e.parcelas > 1 ? `${e.parcelas}× de R$ ${brl(e.parcela)}` : `R$ ${brl(e.total)}`}
      </p>
      <p className="text-[0.95rem] font-semibold">Total: R$ {brl(e.total)}</p>
    </div>
  );
}

export function PedidoPagamento({ publicKey, whatsappLink }: { publicKey: string; whatsappLink: string | null }) {
  const [cred, setCred] = useState<{ p: string; t: string } | null>(null);
  const [e, setE] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const brick = useRef<{ unmount: () => void } | null>(null);

  useEffect(() => {
    const u = new URL(window.location.href);
    const p = u.searchParams.get("p");
    const t = u.searchParams.get("t");
    if (p && t) setCred({ p, t });
    else setErro("Link do pedido incompleto. Abra o link completo ou fale com a Spolaor.");
  }, []);

  const atualizar = useCallback(async () => {
    if (!cred) return;
    const res = await fetch(`/api/sites-pacote/status?p=${encodeURIComponent(cred.p)}&t=${encodeURIComponent(cred.t)}`, { cache: "no-store" }).catch(() => null);
    if (!res) return;
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; pedido?: Estado };
    if (data.ok && data.pedido) setE(data.pedido);
    else if (res.status === 404) setErro("Pedido não encontrado. Confira o link ou fale com a Spolaor.");
  }, [cred]);

  useEffect(() => {
    atualizar();
  }, [atualizar]);

  // enquanto o pagamento estiver pendente, confere a cada 5 s (o servidor consulta o Mercado Pago no máximo a cada ~12 s)
  useEffect(() => {
    if (e?.status !== "pagamento_pendente") return;
    const id = setInterval(atualizar, 5000);
    return () => clearInterval(id);
  }, [e?.status, atualizar]);

  // Purchase só com o pagamento confirmado pelo servidor; uma vez por pedido (marcador persistente)
  useEffect(() => {
    if (e?.status === "pago" && !e.interna) trackSitePurchase(e.id, e.total);
  }, [e?.status, e?.id, e?.total, e?.interna]);

  // formulário de cartão do Mercado Pago: só quando o pedido é de cartão e ainda não há pagamento em andamento
  const precisaCartao = !!e && e.meio === "cartao" && (e.status === "criado" || e.status === "recusado");
  useEffect(() => {
    if (!precisaCartao || !e || !cred || !publicKey) return;
    let cancelado = false;
    (async () => {
      try {
        await carregarSdk();
        if (cancelado || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        brick.current?.unmount();
        brick.current = await mp.bricks().create("cardPayment", "site-cartao", {
          initialization: { amount: e.total },
          customization: {
            paymentMethods: { minInstallments: e.parcelas, maxInstallments: e.parcelas },
            visual: { style: { theme: "default" } },
          },
          callbacks: {
            onReady: () => {},
            onError: () => setAviso("O formulário do cartão teve um problema. Recarregue a página ou use o Pix."),
            onSubmit: (formData: unknown, additionalData?: { paymentTypeId?: string }) =>
              new Promise<void>((resolve, reject) => {
                setAviso(null);
                fetch("/api/sites-pacote/cartao", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  // só o tipo do cartão (crédito/débito) vai junto; o resto do additionalData (BIN, final) não é enviado
                  body: JSON.stringify({ id: cred.p, t: cred.t, formData, additionalData: { paymentTypeId: additionalData?.paymentTypeId } }),
                })
                  .then((r) => r.json())
                  .then((data: { ok?: boolean; pedido?: Estado; message?: string; error?: string }) => {
                    if (data.ok && data.pedido) {
                      setE(data.pedido);
                      resolve();
                    } else {
                      setAviso(data.message ?? "Não foi possível concluir o pagamento. Nada foi cobrado. Tente de novo.");
                      atualizar();
                      reject();
                    }
                  })
                  .catch(() => {
                    setAviso("Sem conexão com o servidor. Confira o status antes de tentar de novo.");
                    reject();
                  });
              }),
          },
        });
      } catch {
        if (!cancelado) setAviso("Não foi possível carregar o formulário de cartão. Recarregue a página ou fale com a Spolaor.");
      }
    })();
    return () => {
      cancelado = true;
      brick.current?.unmount();
      brick.current = null;
    };
    // recria o formulário só quando muda o pedido ou volta a precisar dele
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaCartao, e?.id, cred, publicKey]);

  async function novoPix() {
    if (!cred) return;
    setAviso(null);
    const res = await fetch("/api/sites-pacote/pix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: cred.p, t: cred.t }) }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { ok?: boolean; pedido?: Estado; message?: string } | undefined;
    if (data?.ok && data.pedido) setE(data.pedido);
    else setAviso(data?.message ?? "Não foi possível gerar o Pix agora. Tente de novo em instantes.");
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  if (erro) return <p className="rounded-[12px] border border-[#f07a12] px-4 py-3">{erro}</p>;
  if (!e) return <div className="h-[420px] animate-pulse rounded-[16px] border border-line bg-ink-900" aria-label="Carregando o pedido" />;

  const contato = whatsappLink ? (
    <a href={whatsappLink} target="_blank" rel="noopener" className="font-semibold text-sky underline underline-offset-4">
      fale com a Spolaor pelo WhatsApp
    </a>
  ) : (
    <Link href="/contato" className="font-semibold text-sky underline underline-offset-4">
      fale com a Spolaor
    </Link>
  );

  if (e.status === "pago") {
    return (
      <div className="grid gap-4 rounded-[16px] border border-line-strong bg-ink-900 p-5 sm:p-7" role="status">
        <p className="flex items-center gap-3 text-[1.35rem] font-semibold tracking-[-0.02em]">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-[#1e9e57] text-white">✓</span>
          Pagamento confirmado
        </p>
        <Valor e={e} />
        <div className="grid gap-2 leading-relaxed text-muted">
          <p className="font-semibold text-fg">Próximo passo: a conversa pelo WhatsApp.</p>
          <p>
            Vamos chamar você no WhatsApp <span className="font-semibold text-fg">{e.whatsapp}</span> para entender a empresa e reunir as informações e os
            materiais do site (logo, fotos, serviços, contatos).
          </p>
          <p>
            A primeira versão fica pronta em até 5 dias úteis depois de recebermos tudo o que é necessário, então o prazo começa quando os materiais
            chegam. Depois, você tem uma rodada de ajustes.
          </p>
          <p>Domínio e hospedagem são contratados e pagos à parte; orientamos a escolha na conversa.</p>
        </div>
      </div>
    );
  }

  if (e.status === "estornado" || e.status === "divergente") {
    return (
      <div className="grid gap-3 rounded-[16px] border border-[#f07a12] bg-ink-900 p-5 sm:p-7" role="status">
        <p className="text-[1.2rem] font-semibold">{e.status === "estornado" ? "Pagamento devolvido" : "Pagamento em conferência"}</p>
        <Valor e={e} />
        <p className="leading-relaxed text-muted">
          {e.status === "estornado"
            ? "O Mercado Pago informou a devolução ou a contestação deste pagamento."
            : "O pagamento chegou com dados diferentes da condição escolhida e está sendo conferido pela Spolaor. Não tente pagar de novo."}{" "}
          Para qualquer dúvida, {contato}.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 rounded-[16px] border border-line-strong bg-ink-900 p-5 sm:p-7">
      <Valor e={e} />

      {e.meio === "pix" && e.status === "pagamento_pendente" && e.pix && (
        <div className="grid gap-4">
          <p className="text-[1.15rem] font-semibold">Pague com Pix</p>
          <ol className="grid gap-1 text-[0.95rem] leading-relaxed text-muted">
            <li>1. Abra o app do seu banco e escolha pagar com Pix (QR Code ou copia e cola).</li>
            <li>2. Confira o valor: R$ {brl(e.total)}.</li>
            <li>3. A confirmação aparece aqui sozinha, em alguns instantes.</li>
          </ol>
          {e.pix.qrBase64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${e.pix.qrBase64}`} alt="QR Code do Pix" width={220} height={220} className="mx-auto h-[220px] w-[220px] rounded-[8px] border border-line bg-white p-2" />
          )}
          <div>
            <label htmlFor="pix-copia" className="mb-1.5 block text-sm font-medium">
              Pix copia e cola
            </label>
            <div className="flex gap-2">
              <input id="pix-copia" readOnly value={e.pix.copiaCola} className="field min-w-0 flex-1 font-mono text-[0.8rem]" onFocus={(ev) => ev.currentTarget.select()} />
              <button type="button" onClick={() => copiar(e.pix!.copiaCola)} className="shrink-0 rounded-[10px] bg-royal px-4 text-sm font-semibold text-white">
                {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
          {e.pix.expiraEm && (
            <p className="text-sm text-dim">
              Válido até {new Date(e.pix.expiraEm).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}.
            </p>
          )}
          <p className="flex items-center gap-2 text-sm font-medium text-fg" aria-live="polite">
            <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[#f07a12]" />
            Aguardando o pagamento
          </p>
        </div>
      )}

      {e.meio === "pix" && (e.status === "expirado" || e.status === "criado" || e.status === "recusado") && (
        <div className="grid gap-3">
          <p className="font-semibold">{e.status === "expirado" ? "O Pix venceu sem pagamento." : "O Pix ainda não foi gerado."}</p>
          <button type="button" onClick={novoPix} className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-royal px-6 font-semibold text-white">
            Gerar Pix de R$ {brl(e.total)}
          </button>
        </div>
      )}

      {e.meio === "cartao" && e.status === "pagamento_pendente" && (
        <p className="flex items-center gap-2 font-medium" role="status" aria-live="polite">
          <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[#f07a12]" />
          Pagamento em análise pelo Mercado Pago. A confirmação aparece aqui; você pode fechar a página e voltar pelo mesmo link.
        </p>
      )}

      {precisaCartao && (
        <div className="grid gap-3">
          <p className="text-[1.15rem] font-semibold">Dados do cartão</p>
          {e.status === "recusado" && e.motivoRecusa && (
            <p role="alert" className="rounded-[10px] border border-[#f07a12] px-4 py-3 text-sm">
              {e.motivoRecusa}
            </p>
          )}
          <p className="text-sm text-muted">
            Formulário seguro do Mercado Pago: os dados do cartão não passam pelo nosso site. Parcelas fixas da condição escolhida:{" "}
            <span className="font-semibold text-fg">{e.parcelas > 1 ? `${e.parcelas}× de R$ ${brl(e.parcela)}` : `1× de R$ ${brl(e.total)}`}</span>.
          </p>
          {!publicKey ? <p className="text-sm text-ember">Pagamento com cartão indisponível no momento.</p> : <div id="site-cartao" className="min-h-[360px]" />}
        </div>
      )}

      {aviso && (
        <p role="alert" className="rounded-[10px] border border-[#f07a12] px-4 py-3 text-sm">
          {aviso}
        </p>
      )}

      <p className="text-sm leading-relaxed text-dim">
        Quer mudar a forma de pagamento?{" "}
        <Link href="/sites/pacote/checkout" className="font-semibold text-sky underline underline-offset-4">
          Voltar ao checkout
        </Link>{" "}
        (cria outro pedido; nada é cobrado em dobro). Dúvidas? {contato}.
      </p>
    </div>
  );
}
