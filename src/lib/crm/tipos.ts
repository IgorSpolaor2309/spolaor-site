// Vocabulário do CRM, compartilhado entre servidor e telas. Sem acesso a banco aqui.

export const ETAPAS = ["novo", "aguardando_resposta", "em_conversa", "proposta_enviada", "ganho", "perdido"] as const;
export type Etapa = (typeof ETAPAS)[number];
export const ETAPA_ROTULO: Record<Etapa, string> = {
  novo: "Novo",
  aguardando_resposta: "Aguardando resposta",
  em_conversa: "Em conversa",
  proposta_enviada: "Proposta enviada",
  ganho: "Ganho",
  perdido: "Perdido",
};
export const ETAPAS_ABERTAS: Etapa[] = ["novo", "aguardando_resposta", "em_conversa", "proposta_enviada"];
export const isEtapa = (v: unknown): v is Etapa => typeof v === "string" && (ETAPAS as readonly string[]).includes(v);

export const CANAIS = ["formulario", "whatsapp", "instagram", "email", "telefone", "indicacao", "outro"] as const;
export type Canal = (typeof CANAIS)[number];
export const CANAL_ROTULO: Record<Canal, string> = {
  formulario: "Formulário do site",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "E-mail",
  telefone: "Telefone",
  indicacao: "Indicação",
  outro: "Outro",
};
export const isCanal = (v: unknown): v is Canal => typeof v === "string" && (CANAIS as readonly string[]).includes(v);

/** Canais em que uma mensagem pode ser registrada na conversa. */
export const CANAIS_MENSAGEM = ["whatsapp", "instagram", "email", "telefone", "outro"] as const;
export type CanalMensagem = (typeof CANAIS_MENSAGEM)[number];
export const isCanalMensagem = (v: unknown): v is CanalMensagem => typeof v === "string" && (CANAIS_MENSAGEM as readonly string[]).includes(v);

/** Serviços oferecidos no site, para o cadastro manual e os filtros (texto livre também é aceito). */
export const SERVICOS = [
  "Site ou landing page",
  "Loja virtual",
  "Agendamento online",
  "Automação da rotina",
  "Atendimento com IA no WhatsApp",
  "Diagnóstico e melhoria de site",
  "Sistema sob medida",
  "Consultoria",
] as const;

export const CUSTO_TIPOS = ["meta_verba", "crush_taxa", "crush_assinatura", "outro"] as const;
export type CustoTipo = (typeof CUSTO_TIPOS)[number];
export const CUSTO_ROTULO: Record<CustoTipo, string> = {
  meta_verba: "Verba de anúncios na Meta",
  crush_taxa: "Taxa do Autopilot (Crush)",
  crush_assinatura: "Assinatura da Crush",
  outro: "Outro custo de aquisição",
};
export const isCustoTipo = (v: unknown): v is CustoTipo => typeof v === "string" && (CUSTO_TIPOS as readonly string[]).includes(v);

export type Usuario = { id: string; email: string; nome: string };

export type Contato = {
  id: string;
  nome: string;
  empresa: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  site: string | null;
};

export type Oportunidade = {
  id: string;
  contatoId: string;
  etapa: Etapa;
  aguardando: "nos" | "cliente" | null;
  servico: string | null;
  canal: Canal;
  origem: string | null;
  registro: "automatico" | "manual";
  tipo: string | null;
  mensagem: string | null;
  dados: Record<string, unknown>;
  pagina: string | null;
  entrada: string | null;
  referrer: string | null;
  utm: Record<string, string>;
  metaCampaignId: string | null;
  metaAdsetId: string | null;
  metaAdId: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  primeiroContatoEm: string | null;
  ultimoContatoEm: string | null;
  assumidaEm: string | null;
  valorProposta: number | null;
  propostaEm: string | null;
  valorFechado: number | null;
  fechadoEm: string | null;
  motivoPerda: string | null;
  perdidoEm: string | null;
  teste: boolean;
  recebidoEm: string;
  criadoEm: string;
  atualizadoEm: string;
  contato: Contato;
  /** Há aviso por e-mail ou mensagem do sistema com falha pendente de ação. */
  falha: boolean;
};

export type Mensagem = {
  id: string;
  canal: CanalMensagem;
  direcao: "saida" | "entrada";
  modo: "sistema" | "manual";
  automatica: boolean;
  assunto: string | null;
  corpo: string;
  status: "pendente" | "enviando" | "enviada" | "falhou" | "cancelada" | "registrada";
  tentativas: number;
  erro: string | null;
  enviadoEm: string | null;
  criadoEm: string;
  usuarioNome: string | null;
};

export type Evento = {
  id: string;
  tipo: string;
  texto: string | null;
  dados: Record<string, unknown>;
  criadoEm: string;
  usuarioNome: string | null;
};

export type Envio = {
  id: string;
  recebidoEm: string;
  payload: Record<string, unknown>;
  avisoStatus: "pendente" | "enviando" | "enviado" | "falhou" | "desligado";
  avisoTentativas: number;
  avisoErro: string | null;
  avisoEnviadoEm: string | null;
};

/* ───────────────────────────── atribuição ───────────────────────────── */

export type Atribuicao = {
  /** Rótulo curto da fonte, para listas e indicadores. */
  fonte: string;
  /** O que sustenta o rótulo (para não tratar indício como prova). */
  base: string;
  /** A URL declarou tráfego pago da Meta (utm_source da Meta com mídia paga ou campanha). */
  metaPago: boolean;
};

const META_SOURCES = /^(facebook|fb|instagram|ig|meta|an|audience[_ -]?network|messenger)$/i;
const PAID_MEDIUM = /(cpc|ppc|paid|pago|ads?|anuncio|anúncio)/i;

/** Lê a origem de tráfego do que veio com o lead. Só afirma campanha quando a URL declarou. */
export function atribuicao(o: { utm: Record<string, string>; referrer: string | null; registro: string }): Atribuicao {
  const u = o.utm ?? {};
  const src = (u.utm_source ?? "").trim();
  const med = (u.utm_medium ?? "").trim();
  if (o.registro === "manual") return { fonte: "Cadastro manual", base: "Informado por quem cadastrou", metaPago: false };
  if (src) {
    const meta = META_SOURCES.test(src);
    const pago = meta && (PAID_MEDIUM.test(med) || !!u.utm_campaign);
    return {
      fonte: meta ? (pago ? "Anúncio na Meta" : `Meta (${src})`) : src,
      base: `Declarado na URL: utm_source=${src}${med ? `, utm_medium=${med}` : ""}${u.utm_campaign ? `, utm_campaign=${u.utm_campaign}` : ""}`,
      metaPago: pago,
    };
  }
  if (u.gclid) return { fonte: "Anúncio no Google", base: "Clique identificado (gclid), sem campanha declarada", metaPago: false };
  if (u.fbclid)
    return {
      fonte: "Clique vindo da Meta",
      base: "fbclid presente: veio de um link no Facebook ou Instagram. Não identifica campanha nem comprova que foi anúncio.",
      metaPago: false,
    };
  const ref = (o.referrer ?? "").trim();
  if (ref) {
    try {
      const host = new URL(ref).hostname.replace(/^www\./, "");
      if (/google\./.test(host)) return { fonte: "Busca no Google", base: `Página anterior: ${host}`, metaPago: false };
      if (/(facebook|instagram|fb)\./.test(host)) return { fonte: "Facebook ou Instagram", base: `Página anterior: ${host} (sem UTM)`, metaPago: false };
      return { fonte: host, base: `Página anterior: ${host}`, metaPago: false };
    } catch {
      // referrer ilegível: segue como direto
    }
  }
  return { fonte: "Direto ou não identificado", base: "Sem UTM, sem clique identificado e sem página anterior", metaPago: false };
}

/* ───────────────────────────── formatação ───────────────────────────── */

const TZ = "America/Sao_Paulo";
export const fmtData = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "";
export const fmtDataHora = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(",", " às")
    : "";
export const fmtMoeda = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** "há 3 h", "há 2 dias", "em 4 h". `agora` vem do servidor para o texto não mudar na hidratação. */
export function fmtRelativo(iso: string | null | undefined, agora: number) {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - agora;
  const min = Math.round(Math.abs(diff) / 60000);
  if (min < 1) return "agora";
  const txt = min < 60 ? `${min} min` : min < 60 * 36 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} dias`;
  return diff < 0 ? `há ${txt}` : `em ${txt}`;
}

export function fmtDuracao(minutos: number | null) {
  if (minutos === null) return "";
  if (minutos < 60) return `${Math.round(minutos)} min`;
  if (minutos < 60 * 48) return `${(minutos / 60).toFixed(1).replace(".", ",")} h`;
  return `${(minutos / 1440).toFixed(1).replace(".", ",")} dias`;
}

export function fmtWhatsapp(digits: string | null) {
  if (!digits) return "";
  const d = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `+${digits}`;
}

/** Valor de um <input type="datetime-local"> no fuso de Brasília (UTC−3, sem horário de verão). */
export function paraInputLocal(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16);
}
/** Lê um datetime-local digitado no fuso de Brasília. null se vazio ou inválido. */
export function deInputLocal(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  const d = new Date(`${v.slice(0, 16)}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
