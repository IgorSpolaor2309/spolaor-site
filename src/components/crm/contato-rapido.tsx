"use client";

import { useState } from "react";
import { contatoFeitoAction, enviarEmailAction } from "@/app/leads/actions";
import { linkEmail, linkInstagram, linkWhatsapp } from "@/lib/crm/normalizar";
import { Enviar } from "./enviar";
import { btnPrimary, btnSecondary, Campo, input } from "./ui";

export type ModeloPronto = { id: string; titulo: string; canal: "whatsapp" | "instagram" | "email"; assunto?: string; corpo: string };
type Canal = "whatsapp" | "email" | "instagram" | "telefone";
const ROTULO: Record<Canal, string> = { whatsapp: "WhatsApp", email: "E-mail", instagram: "Instagram", telefone: "Ligação" };

/**
 * Falar com o interessado. WhatsApp, Instagram e ligação: o CRM prepara o texto e abre o aplicativo; quem envia é
 * você, e o registro é feito à mão. E-mail: pode sair pelo próprio CRM (provedor de e-mail), com estado de envio.
 */
export function ContatoRapido({
  id,
  contato,
  modelos,
  emailPeloCrm,
  chave,
}: {
  id: string;
  contato: { whatsapp: string | null; email: string | null; instagram: string | null };
  modelos: ModeloPronto[];
  /** null = pronto; texto = o que falta configurar */
  emailPeloCrm: string | null;
  chave: string;
}) {
  const canais = (["whatsapp", "email", "instagram", "telefone"] as Canal[]).filter((c) => (c === "whatsapp" || c === "telefone" ? contato.whatsapp : c === "email" ? contato.email : contato.instagram));
  const [canal, setCanal] = useState<Canal | null>(canais[0] ?? null);
  const doCanal = (c: Canal | null) => modelos.filter((m) => m.canal === c);
  const primeiro = doCanal(canais[0] ?? null)[0];
  const [corpo, setCorpo] = useState(primeiro?.corpo ?? "");
  const [assunto, setAssunto] = useState(primeiro?.assunto ?? "");
  const [copiado, setCopiado] = useState(false);

  if (!canal) return <p className="px-4 py-5 text-[0.92rem] text-dim sm:px-5">Este contato não tem WhatsApp, e-mail nem Instagram cadastrado. Complete os dados do contato para falar com ele por aqui.</p>;

  const trocarCanal = (c: Canal) => {
    setCanal(c);
    const m = doCanal(c)[0];
    setCorpo(m?.corpo ?? "");
    setAssunto(m?.assunto ?? "");
    setCopiado(false);
  };
  const usarModelo = (mid: string) => {
    const m = modelos.find((x) => x.id === mid);
    if (!m) return;
    setCorpo(m.corpo);
    setAssunto(m.assunto ?? "");
  };
  const abrir =
    canal === "whatsapp"
      ? { href: linkWhatsapp(contato.whatsapp!, corpo), rotulo: "Abrir no WhatsApp" }
      : canal === "instagram"
        ? { href: linkInstagram(contato.instagram!), rotulo: "Abrir o Direct" }
        : canal === "telefone"
          ? { href: `tel:+${contato.whatsapp}`, rotulo: "Ligar" }
          : { href: linkEmail(contato.email!, assunto, corpo), rotulo: "Abrir no meu e-mail" };

  return (
    <div className="grid gap-3.5 px-4 py-4 sm:px-5">
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
