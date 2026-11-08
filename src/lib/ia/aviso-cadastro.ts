import { cycleLabel } from "./config";
import { sendInternalEmail } from "./notify";
import { store, type Contratacao } from "./store";

// Aviso interno de novo cadastro no checkout (pagamento pendente), para contato manual da Spolaor.
// Estado em ia_contratacoes.aviso_cadastro_*: "pendente" é gravado na MESMA escrita que salva a assinatura e o
// link do Mercado Pago (startContratacao), então só existe aviso depois de: formulário válido, contratação
// gravada, link válido e vínculo salvo. O envio roda logo após a resposta (after) e a rotina do QStash repete
// os pendentes, no máximo MAX_TENTATIVAS vezes, sempre relendo a situação atual. Logs sem dados pessoais.

export const ASSUNTO = "Atendimento IA · Novo cadastro — pagamento pendente";
const MAX_TENTATIVAS = 5;
const isCancelled = (s?: string | null) => !!s && /^cancel+ed$/.test(s);

/** Estado inicial do aviso para uma contratação que acabou de receber o link de pagamento. */
export function estadoInicialAviso(utm: Record<string, string> | null | undefined) {
  return utm?.validacao === "interna" ? ("ignorado" as const) : ("pendente" as const);
}

const BRASILIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function montarAviso(c: Contratacao) {
  const utm = c.utm ?? {};
  const digitos = c.telefone.replace(/\D/g, "");
  const wa = digitos.length >= 12 ? digitos : digitos.length >= 10 ? `55${digitos}` : null;
  const valor = Number(c.precoMensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const origem = [
    utm.utm_campaign && `Campanha: ${utm.utm_campaign}`,
    utm.utm_content && `Anúncio (utm_content): ${utm.utm_content}`,
    utm.utm_term && `ID do anúncio (utm_term): ${utm.utm_term}`,
    (utm.utm_source || utm.utm_medium) && `Fonte / mídia: ${utm.utm_source ?? "-"} / ${utm.utm_medium ?? "-"}`,
  ].filter(Boolean) as string[];
  const linhas = [
    c.avisoCadastroAnterior ? "Cadastro anterior à implantação deste aviso." : "",
    "Novo cadastro no checkout do Atendimento com IA no WhatsApp.",
    "",
    `Nome: ${c.responsavel}`,
    `E-mail: ${c.email}`,
    `WhatsApp: ${c.telefone}`,
    ...(wa ? [`Abrir conversa no WhatsApp: https://wa.me/${wa}`] : []),
    `Cadastro em: ${BRASILIA.format(new Date(c.criadoEm))} (Brasília)`,
    `Contratação: ${c.id}`,
    `Oferta: Atendimento com IA no WhatsApp · ${valor} ${cycleLabel()}`,
    "",
    "Origem:",
    ...(origem.length ? origem : ["Sem UTM registrada."]),
    "",
    "Situação no momento do aviso: cadastro recebido e link de pagamento gerado; pagamento ainda não confirmado.",
    "",
    "Este aviso não confirma uma venda nem abandono. A pessoa pode concluir o pagamento depois. Confira a situação atual antes de entrar em contato.",
    `Para conferir: no Mercado Pago, a assinatura tem a referência externa ${c.id}.`,
  ];
  return { subject: c.avisoCadastroAnterior ? `${ASSUNTO} (cadastro anterior à implantação)` : ASSUNTO, text: linhas.filter((l, i) => l || i > 0).join("\n") };
}

/** Situação atual impede o aviso? Devolve o motivo, sem dados pessoais. */
function motivoParaNaoAvisar(c: Contratacao) {
  if (c.utm?.validacao === "interna") return "validacao_interna";
  if (c.primeiroPagamentoEm) return "pagamento_confirmado";
  if (isCancelled(c.mpStatus) || c.etapa === "cancelada") return "cancelada";
  if (c.etapa !== "aguardando_pagamento" && c.etapa !== "assinatura_autorizada") return `etapa_${c.etapa}`;
  if (!c.mpPreapprovalId || !c.mpCheckoutUrl) return "sem_link";
  return null;
}

/**
 * Tenta enviar o aviso de uma contratação. Reserva atômica (uma execução por vez), relê a situação e só envia
 * se o pagamento continua pendente. Nunca lança erro: quem chama não pode ser interrompido pelo e-mail.
 */
export async function processarAvisoCadastro(id: string) {
  const s = store();
  try {
    const c = await s.claimNotice(id, MAX_TENTATIVAS);
    if (!c) return { id, estado: "sem_reserva" };
    const motivo = motivoParaNaoAvisar(c);
    if (motivo) {
      await s.update(id, { avisoCadastroStatus: "descartado", avisoCadastroErro: motivo });
      console.info(`[atendimento-ia] aviso de cadastro ${id}: descartado (${motivo})`);
      return { id, estado: "descartado", motivo };
    }
    const { subject, text } = montarAviso(c);
    const r = await sendInternalEmail({ subject, text, idempotencyKey: `aviso-cadastro-${id}` });
    if (r.ok) {
      await s.update(id, { avisoCadastroStatus: "enviado", avisoCadastroEnviadoEm: new Date().toISOString(), avisoCadastroErro: null, avisoCadastroRef: r.id ?? null });
      console.info(`[atendimento-ia] aviso de cadastro ${id}: enviado`);
      return { id, estado: "enviado" };
    }
    await s.update(id, { avisoCadastroStatus: "falhou", avisoCadastroErro: r.erro.slice(0, 120) });
    console.warn(`[atendimento-ia] aviso de cadastro ${id}: falhou (${r.erro.slice(0, 80)})`);
    return { id, estado: "falhou" };
  } catch (e) {
    console.warn(`[atendimento-ia] aviso de cadastro ${id}: erro interno (${(e as Error).name})`);
    return { id, estado: "erro" };
  }
}

/** Rotina: repete os avisos pendentes, com falha ou interrompidos. */
export async function rotinaAvisosCadastro() {
  const out: string[] = [];
  for (const c of await store().pendingNotices(MAX_TENTATIVAS)) {
    const r = await processarAvisoCadastro(c.id);
    if (r.estado !== "sem_reserva") out.push(`${c.id}: aviso de cadastro ${r.estado}`);
  }
  return out;
}

/**
 * Cadastro anterior à implantação: agenda um único aviso se a contratação ainda não tem estado de aviso, não é
 * validação interna e o pagamento continua pendente. Não toca em registros que já têm estado.
 */
export async function avisoCadastroAnterior(id: string) {
  const s = store();
  const c = await s.get(id);
  if (!c) return { id, estado: "nao_encontrada" };
  if (c.avisoCadastroStatus) return { id, estado: `ja_tem_estado_${c.avisoCadastroStatus}` };
  const motivo = motivoParaNaoAvisar(c);
  if (motivo) return { id, estado: "nao_aplicavel", motivo };
  if (!(await s.claimLegacyNotice(id))) return { id, estado: "sem_reserva" };
  return processarAvisoCadastro(id);
}
