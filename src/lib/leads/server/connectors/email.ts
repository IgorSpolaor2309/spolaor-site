import { FORMULARIOS, PEDIDOS } from "../../schema";
import type { LeadConnector, LeadRecord } from "../types";

// Entrega cada lead por e-mail, a partir do servidor, usando a API HTTP do Resend.
// Credenciais só em variáveis de ambiente (Vercel), nunca no navegador:
//   RESEND_API_KEY    chave da API (obrigatória)
//   LEAD_EMAIL_TO     destinatário dos leads (obrigatória; vários separados por vírgula)
//   LEAD_EMAIL_FROM   remetente aprovado no provedor, ex.: "Site Spolaor <site@seudominio.com.br>" (obrigatória)
//   RESEND_API_URL    opcional; só para testes locais com um servidor simulado
// É persistente: o visitante só vê sucesso se o provedor ACEITAR o envio. Aceitação não prova
// chegada à caixa de entrada.

const env = (k: string) => (process.env[k] ?? "").trim();
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

const rows: [string, (l: LeadRecord) => string | undefined][] = [
  ["Interesse", (l) => l.interesse],
  ["Precisa de", (l) => (l.pedido ? PEDIDOS[l.pedido].rotulo : undefined)],
  ["Pergunta", (l) => l.pergunta],
  ["Resposta", (l) => (l.pergunta ? l.mensagem : undefined)],
  ["Nome", (l) => l.nome],
  ["Empresa", (l) => l.empresa || (l.semEmpresa ? "Ainda está começando" : undefined)],
  ["WhatsApp", (l) => l.whatsapp],
  ["E-mail", (l) => l.email],
  ["Site", (l) => l.site || (l.semSite ? "Ainda não tem site nem Instagram" : undefined)],
  ["Instagram", (l) => (l.instagram ? `@${l.instagram}` : undefined)],
  ["Segmento", (l) => l.segmento],
  ["Principal problema", (l) => l.problema],
  ["Serviços de interesse", (l) => l.servicos?.join(", ")],
  ["Melhorias", (l) => l.melhorias?.join(", ")],
  ["Urgência/prazo", (l) => l.urgencia],
  ["Mensagem", (l) => (l.pergunta ? undefined : l.mensagem)],
  ["Origem do lead", (l) => l.origem],
  ["Formulário", (l) => (l.formulario ? FORMULARIOS[l.formulario] : undefined)],
  ["Tipo", (l) => l.tipo],
  ["Página do envio", (l) => l.pagina],
  ["Primeira página da visita", (l) => l.entrada],
  ["Veio de", (l) => l.referrer],
  ["UTM", (l) => (l.utm && Object.keys(l.utm).length ? Object.entries(l.utm).map(([k, v]) => `${k}=${v}`).join(" · ") : undefined)],
  ["ID", (l) => l.id],
  ["Recebido em", (l) => l.createdAt],
];

/** Complementos do aviso quando o CRM está ligado: link da ficha, ou alerta de que o lead só existe neste e-mail. */
export type LeadEmailExtra = { crmUrl?: string; semCrm?: boolean; idempotencyKey?: string };

export function buildLeadEmail(lead: LeadRecord, extra: LeadEmailExtra = {}) {
  const isTest = /^\s*teste\b/i.test(lead.nome);
  const subject = oneLine(`${isTest ? "TESTE — formulário do site · " : "Novo lead · "}${lead.interesse ?? lead.origem} · ${lead.nome}${lead.empresa ? ` (${lead.empresa})` : ""}`).slice(0, 200);
  const text = rows
    .map(([label, get]) => [label, get(lead)] as const)
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => `${label}: ${v}`)
    .join("\n");
  const crm = extra.crmUrl
    ? `\nAbrir no CRM: ${extra.crmUrl}\n`
    : extra.semCrm
      ? "\nATENÇÃO: este contato NÃO foi gravado no CRM (o banco não respondeu). Cadastre manualmente em /leads/novo.\n"
      : "";
  return { subject, text: `${isTest ? "ESTE É UM ENVIO DE TESTE DO FORMULÁRIO DO SITE.\n\n" : ""}${text}\n${crm}` };
}

export const emailConnector: LeadConnector = {
  id: "email",
  persistent: true,
  isConfigured: () => !!(env("RESEND_API_KEY") && env("LEAD_EMAIL_TO") && env("LEAD_EMAIL_FROM")),
  send: (lead) => sendLeadEmail(lead),
};

/** Envia o aviso do lead pelo Resend. Lança erro se o provedor não aceitar. */
export async function sendLeadEmail(lead: LeadRecord, extra: LeadEmailExtra = {}) {
  const { subject, text } = buildLeadEmail(lead, extra);
  const replyTo = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/.test(lead.email.trim()) ? lead.email.trim() : undefined;
  const res = await fetch(env("RESEND_API_URL") || "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "content-type": "application/json",
      // Mesma chave em toda nova tentativa do mesmo aviso: o provedor não entrega duas vezes.
      ...(extra.idempotencyKey ? { "idempotency-key": extra.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: env("LEAD_EMAIL_FROM"),
      to: env("LEAD_EMAIL_TO").split(",").map((s) => s.trim()).filter(Boolean),
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Provedor de e-mail recusou o envio (HTTP ${res.status})`);
}
