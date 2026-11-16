"use client";

import { useState } from "react";
import { contatoFeitoAction, enviarEmailAction, enviarWhatsappAction } from "@/app/leads/actions";
import { linkEmail, linkInstagram, linkWhatsapp } from "@/lib/crm/normalizar";
import { Enviar } from "./enviar";
import { btnPrimary, btnSecondary, Campo, input } from "./ui";

export type ModeloPronto = { id: string; titulo: string; canal: "whatsapp" | "instagram" | "email"; assunto?: string; corpo: string };
type Canal = "whatsapp" | "email" | "instagram" | "telefone";
const ROTULO: Record<Canal, string> = { whatsapp: "WhatsApp", email: "E-mail", instagram: "Instagram", telefone: "Ligação" };

/** WhatsApp pelo CRM (API oficial). null = integração não configurada: só abertura do aplicativo e registro à mão. */
export type WaCrm = {
  /** dentro das 24 h desde a última mensagem da pessoa: texto livre é aceito */
  janelaAberta: boolean;
  janelaAte: string | null;
  /** modelo aprovado, já preenchido, para iniciar conversa fora da janela */
  modelo: { texto: string } | null;
  modeloMotivo: string | null;
};

/**
 * Falar com o interessado.
 * - WhatsApp com a integração configurada: a mensagem sai pelo número comercial, pelo CRM. Dentro da janela de 24 h
 *   vai o texto escrito; fora dela, só o modelo aprovado. Responder pelo aplicativo do celular também vale: a mensagem
 *   aparece na conversa sozinha.
 * - WhatsApp sem integração, Instagram e ligação: o CRM prepara o texto e abre o aplicativo; o registro é à mão.
 * - E-mail: pode sair pelo próprio CRM (provedor de e-mail), com estado de envio.
 */
export function ContatoRapido({
  id,
  contato,
  modelos,
  emailPeloCrm,
  chave,
  wa,
}: {
  id: string;
  contato: { whatsapp: string | null; email: string | null; instagram: string | null };
  modelos: ModeloPronto[];
  /** null = pronto; texto = o que falta configurar */
  emailPeloCrm: string | null;
  chave: string;
  wa: WaCrm | null;
}) {
  const canais = (["whatsapp", "email", "instagram", "telefone"] as Canal[]).filter((c) => (c === "whatsapp" || c === "telefone" ? contato.whatsapp : c === "email" ? contato.email : contato.instagram));
  const [canal, setCanal] = useState<Canal | null>(canais[0] ?? null);
  const doCanal = (c: Canal | null) => modelos.filter((m) => m.canal === c);
  const primeiro = doCanal(canais[0] ?? null)[0];
  // Com a integração e a janela aberta, o campo começa vazio: é uma resposta, não uma abordagem pronta.
  const inicial = (c: Canal | null) => (c === "whatsapp" && wa?.janelaAberta ? "" : (doCanal(c)[0]?.corpo ?? ""));
  const [corpo, setCorpo] = useState(inicial(canais[0] ?? null));
  const [assunto, setAssunto] = useState(primeiro?.assunto ?? "");
  const [copiado, setCopiado] = useState(false);

  if (!canal) return <p className="px-4 py-5 text-[0.92rem] text-dim sm:px-5">Este contato não tem WhatsApp, e-mail nem Instagram cadastrado. Complete os dados do contato para falar com ele por aqui.</p>;

  const trocarCanal = (c: Canal) => {
    setCanal(c);
    setCorpo(inicial(c));
    setAssunto(doCanal(c)[0]?.assunto ?? "");
    setCopiado(false);
  };
  const usarModelo = (mid: string) => {
    const m = modelos.find((x) => x.id === mid);
    if (!m) return;
    setCorpo(m.corpo);
    setAssunto(m.assunto ?? "");
  };
  const waCrm = canal === "whatsapp" ? wa : null;
  const abrir =
    canal === "whatsapp"
      ? { href: linkWhatsapp(contato.whatsapp!, waCrm ? undefined : corpo), rotulo: waCrm ? "Abrir a conversa no WhatsApp" : "Abrir no WhatsApp" }
      : canal === "instagram"
        ? { href: linkInstagram(contato.instagram!), rotulo: "Abrir o Direct" }
        : canal === "telefone"
          ? { href: `tel:+${contato.whatsapp}`, rotulo: "Ligar" }
          : { href: linkEmail(contato.email!, assunto, corpo), rotulo: "Abrir no meu e-mail" };

  const abas = (
    <div role="tablist" aria-label="Canal" className="flex flex-wrap gap-1.5">
      {canais.map((c) => (
        <button
          key={c}
          type="button"
          role="tab"
          aria-selected={canal === c}
          onClick={() => trocarCanal(c)}
          className={`min-h-10 rounded-lg px-3.5 text-[0.88rem] font-semibold ${canal === c ? "bg-fg text-white" : "border border-line-strong text-muted hover:text-fg"}`}
        >
          {ROTULO[c]}
        </button>
      ))}
    </div>
  );

  // ── WhatsApp pelo CRM ──
  if (waCrm) {
    return (
      <div className="grid gap-3.5 px-4 py-4 sm:px-5" data-wa-crm={waCrm.janelaAberta ? "janela-aberta" : "janela-fechada"}>
        {abas}
        {waCrm.janelaAberta ? (
          <form action={enviarWhatsappAction} className="grid gap-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="chave" value={chave} />
            <input type="hidden" name="modo" value="texto" />
            <Campo rotulo="Mensagem">
              <textarea name="corpo" required className={`${input} min-h-[110px] leading-relaxed`} value={corpo} onChange={(e) => setCorpo(e.target.value)} maxLength={4000} />
            </Campo>
            <div className="flex flex-wrap items-center gap-2.5">
              <Enviar className={btnPrimary}>Enviar pelo WhatsApp</Enviar>
              <a href={abrir.href} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
                {abrir.rotulo}
              </a>
            </div>
            <p className="text-[0.8rem] leading-snug text-dim">
              Sai pelo número comercial. Janela de atendimento aberta até {waCrm.janelaAte} (24 horas desde a última mensagem da pessoa). Se preferir responder pelo
              aplicativo do celular, a mensagem aparece aqui sozinha.
            </p>
          </form>
        ) : (
          <div className="grid gap-3">
            <p className="text-[0.88rem] leading-snug text-muted">
              Fora da janela de 24 horas o WhatsApp só aceita, pela API, um modelo aprovado. Texto livre volta a valer quando a pessoa responder.
            </p>
            {waCrm.modelo ? (
              <form action={enviarWhatsappAction} className="grid gap-3">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="chave" value={chave} />
                <input type="hidden" name="modo" value="modelo" />
                <div>
                  <p className="mb-1.5 text-[0.8rem] font-semibold text-muted">Modelo aprovado (o texto não pode ser alterado aqui)</p>
                  <p className="whitespace-pre-wrap rounded-[10px] border border-line bg-ink-850 px-3 py-2.5 text-[0.92rem] leading-relaxed" data-modelo-wa>
                    {waCrm.modelo.texto}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Enviar className={btnPrimary}>Enviar o modelo pelo WhatsApp</Enviar>
                  <a href={abrir.href} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
                    {abrir.rotulo}
                  </a>
                </div>
              </form>
            ) : (
              <>
                <p className="text-[0.88rem] font-semibold leading-snug text-ember" data-modelo-indisponivel>
                  Sem modelo disponível: {waCrm.modeloMotivo}
                </p>
                <div>
                  <a href={abrir.href} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                    {abrir.rotulo}
                  </a>
                </div>
              </>
            )}
            <p className="text-[0.8rem] leading-snug text-dim">Pelo aplicativo do celular comercial você escreve o que quiser; a mensagem aparece aqui sozinha.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3.5 px-4 py-4 sm:px-5">
      {abas}
      {doCanal(canal).length > 1 && (
        <Campo rotulo="Modelo">
          <select className={input} onChange={(e) => usarModelo(e.target.value)} defaultValue={doCanal(canal)[0].id} key={canal}>
            {doCanal(canal).map((m) => (
              <option key={m.id} value={m.id}>
                {m.titulo}
              </option>
            ))}
          </select>
        </Campo>
      )}
      {canal === "email" && (
        <Campo rotulo="Assunto">
          <input className={input} value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={200} />
        </Campo>
      )}
      <Campo rotulo={canal === "telefone" ? "Anotação da ligação (opcional)" : "Mensagem (revise antes de enviar)"}>
        <textarea className={`${input} min-h-[120px] leading-relaxed`} value={corpo} onChange={(e) => setCorpo(e.target.value)} maxLength={4000} />
      </Campo>

      <div className="flex flex-wrap items-center gap-2.5">
        <a href={abrir.href} target={canal === "telefone" || canal === "email" ? undefined : "_blank"} rel="noopener noreferrer" className={canal === "email" && !emailPeloCrm ? btnSecondary : btnPrimary}>
          {abrir.rotulo}
        </a>
        {canal === "instagram" && (
          <button
            type="button"
            className={btnSecondary}
            onClick={() => navigator.clipboard?.writeText(corpo).then(() => setCopiado(true), () => setCopiado(false))}
          >
            {copiado ? "Texto copiado" : "Copiar texto"}
          </button>
        )}
        <form action={contatoFeitoAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="canal" value={canal} />
          <input type="hidden" name="corpo" value={corpo} />
          <Enviar className={btnSecondary}>{canal === "telefone" ? "Registrar ligação feita" : "Registrar como enviada"}</Enviar>
        </form>
      </div>
      <p className="text-[0.8rem] leading-snug text-dim">
        {canal === "email"
          ? "“Abrir no meu e-mail” usa o seu programa de e-mail; depois registre como enviada."
          : "O CRM não envia por este canal: você envia pelo aplicativo e registra aqui. O registro não confirma entrega nem leitura."}
      </p>

      {canal === "email" && (
        <div className="border-t border-line pt-3.5">
          {emailPeloCrm ? (
            <p className="text-[0.84rem] leading-snug text-dim">Envio pelo próprio CRM indisponível: {emailPeloCrm}</p>
          ) : (
            <form action={enviarEmailAction} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="assunto" value={assunto} />
              <input type="hidden" name="corpo" value={corpo} />
              <input type="hidden" name="chave" value={chave} />
              <Enviar className={btnPrimary}>Enviar pelo CRM</Enviar>
              <span className="text-[0.8rem] leading-snug text-dim">Sai pelo provedor de e-mail, para {contato.email}. A resposta chega na sua caixa de e-mail, não aqui.</span>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
