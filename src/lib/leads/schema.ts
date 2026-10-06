// Formato e validação de leads, compartilhados entre os formulários (cliente) e a API (servidor).

export type LeadTipo = "analise" | "projeto";

export type LeadPayload = {
  tipo: LeadTipo;
  /** Formulário de origem (ex.: home, sites, contato, pagina-analise) */
  origem: string;
  /** Caminho da página onde o formulário foi enviado */
  pagina?: string;
  nome: string;
  empresa: string;
  whatsapp: string;
  email: string;
  site?: string;
  semSite?: boolean;
  melhorias?: string[];
  servicos?: string[];
  mensagem?: string;
  urgencia?: string;
  referrer?: string;
  utm?: Record<string, string>;
};

export type LeadErrors = Partial<Record<keyof LeadPayload, string>>;

export const LIMITS = { curto: 200, url: 500, mensagem: 4000, lista: 12 } as const;

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateLead(data: Partial<LeadPayload>): LeadErrors {
  const errors: LeadErrors = {};
  if (!data.nome || data.nome.trim().length < 2) errors.nome = "Informe seu nome.";
  if (!data.empresa || data.empresa.trim().length < 2) errors.empresa = "Informe o nome da empresa.";
  const digits = (data.whatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) errors.whatsapp = "Informe um WhatsApp com DDD.";
  if (!data.email || !emailRe.test(data.email.trim())) errors.email = "Informe um e-mail válido.";
  if (data.tipo === "analise" && !data.semSite && !data.site?.trim()) errors.site = "Informe o endereço do site.";
  if ((data.mensagem ?? "").length > LIMITS.mensagem) errors.mensagem = "Mensagem muito longa.";
  return errors;
}

export function normalizeUrl(url: string) {
  const v = url.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
