// Formato e validação de leads, compartilhados entre os formulários (cliente) e a API (servidor).

// analise: diagnóstico gratuito (home, landings de segmento e /analise). projeto: /contato.
export type LeadTipo = "analise" | "projeto";

/**
 * Página onde o lead foi gerado. É o campo usado para medir qual página traz mais leads e
 * vendas. Os formulários informam o valor; a API aceita só os desta lista e, se vier outro,
 * deduz a partir do caminho da página.
 */
export const LEAD_ORIGENS = ["home", "corretores", "clinicas", "orcamentos", "pagina-analise", "sites", "contato"] as const;
export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

export function isOrigem(v: unknown): v is LeadOrigem {
  return typeof v === "string" && (LEAD_ORIGENS as readonly string[]).includes(v);
}

export function origemFromPath(path?: string): LeadOrigem | undefined {
  if (path === undefined) return undefined;
  const seg = path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  if (seg === "") return "home";
  if (seg === "analise") return "pagina-analise";
  return isOrigem(seg) ? seg : undefined;
}

export type LeadPayload = {
  tipo: LeadTipo;
  /** Página de origem do lead (veja LEAD_ORIGENS) */
  origem: string;
  /** Caminho da página onde o formulário foi enviado */
  pagina?: string;
  /** Primeira página vista na visita (porta de entrada), quando diferente da página do envio */
  entrada?: string;
  /** Segmento informado pelo visitante (ex.: Corretor de imóveis) */
  segmento?: string;
  /** Principal problema escolhido no formulário */
  problema?: string;
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
  // No diagnóstico o e-mail é opcional (o retorno é pelo WhatsApp); se vier, precisa ser válido.
  const email = (data.email ?? "").trim();
  if (data.tipo === "projeto" ? !emailRe.test(email) : email && !emailRe.test(email)) errors.email = "Informe um e-mail válido.";
  if (data.tipo === "analise" && !data.segmento?.trim()) errors.segmento = "Escolha o segmento da empresa.";
  if (data.tipo === "analise" && !data.problema?.trim()) errors.problema = "Escolha o principal problema.";
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
