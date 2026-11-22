// Formato e validação de leads, compartilhados entre os formulários (cliente) e a API (servidor).

// analise: diagnóstico gratuito (home, landings de segmento, /automacao e /analise).
// projeto: pedido direto, sem diagnóstico (/contato e o pedido de orçamento de /sites).
export type LeadTipo = "analise" | "projeto";

/**
 * Página onde o lead foi gerado. É o campo usado para medir qual página traz mais leads e
 * vendas. Os formulários informam o valor; a API aceita só os desta lista e, se vier outro,
 * deduz a partir do caminho da página.
 */
export const LEAD_ORIGENS = [
  "home",
  "corretores",
  "clinicas",
  "orcamentos",
  "pagina-analise",
  "sites",
  "automacao",
  "contato",
  "lojas-virtuais",
  "agendamento-online",
  "diagnostico-site",
  "atendimento-ia",
] as const;
export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

/**
 * Interesse comercial de cada origem, para diferenciar os leads no e-mail e nos relatórios.
 * É definido pelo servidor a partir da origem; o navegador não escolhe esse valor.
 */
export const INTERESSES: Record<LeadOrigem, string> = {
  home: "Diagnóstico geral (home)",
  corretores: "Diagnóstico · corretores de imóveis",
  clinicas: "Diagnóstico · clínicas e consultórios",
  orcamentos: "Diagnóstico · empresas que vendem por orçamento",
  "pagina-analise": "Diagnóstico geral",
  sites: "Site ou landing page",
  automacao: "Automação da rotina",
  contato: "Contato direto",
  "lojas-virtuais": "Loja virtual",
  "agendamento-online": "Agendamento online",
  "diagnostico-site": "Diagnóstico e melhoria de site",
  "atendimento-ia": "Atendimento com IA no WhatsApp",
};

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

/**
 * Texto exibido nos formulários junto ao botão de envio. É o pedido de retorno pelo WhatsApp da Spolaor: o CRM
 * só envia a primeira mensagem automática pelo WhatsApp para envios que trouxerem a versão vigente deste texto.
 * Ao mudar o texto, mude a versão (data). Envios antigos, sem versão, não ganham autorização retroativa.
 */
export const AVISO_RETORNO = {
  versao: "2026-11-16",
  texto: "Ao enviar, você pede que a Spolaor Tecnologia responda pelo WhatsApp informado.",
} as const;

/**
 * O que a pessoa diz precisar no formulário de pedido (home, /analise e /contato). É a RESPOSTA do visitante: o CRM a
 * mostra como "serviço solicitado" e só ela define o serviço; a página do formulário não escolhe por ele.
 * `pergunta` é a pergunta curta mostrada depois da escolha (a resposta é obrigatória e vai em `mensagem`).
 * Ao mudar uma pergunta, os envios antigos continuam com o texto que estava no formulário (gravado pelo servidor).
 */
export const PEDIDOS = {
  site: {
    rotulo: "Site ou landing page",
    pergunta: "O que o site precisa resolver para o seu negócio?",
    exemplo: "Ex.: mostrar meus serviços e receber pedidos de orçamento pelo WhatsApp",
  },
  loja: {
    rotulo: "Loja virtual",
    pergunta: "O que você vende e como quer receber os pedidos?",
    exemplo: "Ex.: roupas femininas; hoje vendo pelo Instagram e anoto tudo à mão",
  },
  agendamento: {
    rotulo: "Agendamento online",
    pergunta: "Que atendimento seus clientes vão agendar?",
    exemplo: "Ex.: corte e barba, com horários de segunda a sábado",
  },
  automacao: {
    rotulo: "Automação",
    pergunta: "Que tarefa ou atendimento você quer que funcione sozinho?",
    exemplo: "Ex.: responder quem pede orçamento fora do horário",
  },
  "nao-sei": {
    rotulo: "Ainda não sei: quero ajuda para identificar a solução",
    pergunta: "O que está atrapalhando suas vendas ou seu atendimento hoje?",
    exemplo: "Ex.: demoro para responder e perco clientes no WhatsApp",
  },
} as const;
export type PedidoChave = keyof typeof PEDIDOS;
export const PEDIDO_CHAVES = Object.keys(PEDIDOS) as PedidoChave[];
export const isPedido = (v: unknown): v is PedidoChave => typeof v === "string" && Object.hasOwn(PEDIDOS, v);

/**
 * Qual formulário gerou o envio. O navegador informa; o servidor aceita só estes valores (os envios antigos não têm
 * o campo e o CRM deduz pelo tipo e pela origem).
 * - pedido: "O que você precisa?" (home, /analise, /contato), com pergunta adaptada ao serviço;
 * - orcamento: pedido de orçamento das páginas de serviço (/sites, /lojas-virtuais, /agendamento-online, /atendimento-ia);
 * - diagnostico: diagnóstico do atendimento em passos (landings de segmento e /automacao);
 * - diagnostico-site: análise de um site existente (/diagnostico-site).
 */
export const FORMULARIOS = {
  pedido: "Pedido: o que você precisa",
  orcamento: "Pedido de orçamento da página do serviço",
  diagnostico: "Diagnóstico do atendimento (segmento e principal problema)",
  "diagnostico-site": "Diagnóstico de site existente",
} as const;
export type FormularioId = keyof typeof FORMULARIOS;
export const isFormulario = (v: unknown): v is FormularioId => typeof v === "string" && Object.hasOwn(FORMULARIOS, v);

/** Formulários em que a pergunta "o que quer resolver" é obrigatória. */
const MENSAGEM_OBRIGATORIA: FormularioId[] = ["pedido", "orcamento"];

export type LeadPayload = {
  tipo: LeadTipo;
  /** Formulário que gerou o envio (veja FORMULARIOS) */
  formulario?: FormularioId;
  /** Serviço escolhido pelo visitante no formulário de pedido (veja PEDIDOS) */
  pedido?: PedidoChave;
  /** Pergunta mostrada ao visitante e respondida em `mensagem`; preenchida pelo servidor */
  pergunta?: string;
  /** Marcou "ainda estou começando" no lugar do nome do negócio */
  semEmpresa?: boolean;
  /** Usuário do Instagram informado no campo "site ou Instagram" (sem @); preenchido pelo servidor */
  instagram?: string;
  /** Página de origem do lead (veja LEAD_ORIGENS) */
  origem: string;
  /** Interesse comercial (veja INTERESSES); preenchido pelo servidor */
  interesse?: string;
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
  /** Versão do texto AVISO_RETORNO que estava no formulário enviado (preenchida pelo formulário, conferida pelo servidor). */
  aviso?: string;
};

export type LeadErrors = Partial<Record<keyof LeadPayload, string>>;

export const LIMITS = { curto: 200, url: 500, mensagem: 4000, lista: 12 } as const;

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Endereço de site digitado à mão: com ou sem http(s), precisa de um domínio com ponto e sem espaços.
const siteRe = /^(https?:\/\/)?[^\s/.]+(\.[^\s/.]+)*\.[a-z]{2,}(\/\S*)?$/i;

export function validateLead(data: Partial<LeadPayload>): LeadErrors {
  const errors: LeadErrors = {};
  // O diagnóstico de site pede só o endereço e um contato: o site já identifica a empresa,
  // então empresa, segmento e problema são opcionais nessa origem.
  const diagnosticoSite = data.origem === "diagnostico-site";
  // Formulários atuais (com `formulario`): nome do negócio opcional, porque quem está começando ainda não tem um.
  // Envios sem `formulario` (navegador com a página antiga aberta) seguem a regra anterior.
  const atual = isFormulario(data.formulario);
  if (!data.nome || data.nome.trim().length < 2) errors.nome = "Informe seu nome.";
  if (!atual && !diagnosticoSite && (!data.empresa || data.empresa.trim().length < 2)) errors.empresa = "Informe o nome da empresa.";
  if (data.formulario === "pedido" && !isPedido(data.pedido)) errors.pedido = "Escolha o que você precisa.";
  if (atual && MENSAGEM_OBRIGATORIA.includes(data.formulario!) && (data.mensagem ?? "").trim().length < 3) errors.mensagem = "Conte em poucas palavras o que você quer resolver.";
  if (!(data.whatsapp ?? "").replace(/\D/g, "")) errors.whatsapp = "Informe um WhatsApp com DDD.";
  else if (!whatsappNacional(data.whatsapp ?? "")) errors.whatsapp = "Confira o WhatsApp: DDD e número, com ou sem +55.";
  // No diagnóstico o e-mail é opcional (o retorno é pelo WhatsApp); se vier, precisa ser válido.
  const email = (data.email ?? "").trim();
  // E-mail obrigatório só no pedido de orçamento das páginas de serviço (e nos envios antigos de /contato); no pedido
  // geral e no diagnóstico o retorno é pelo WhatsApp. Se vier, precisa ser válido.
  const emailObrigatorio = data.tipo === "projeto" && data.formulario !== "pedido";
  if (emailObrigatorio ? !emailRe.test(email) : email && !emailRe.test(email)) errors.email = "Informe um e-mail válido.";
  // Segmento e principal problema são perguntas do diagnóstico em passos; o pedido geral não as faz.
  const diagnostico = data.tipo === "analise" && !diagnosticoSite && (!atual || data.formulario === "diagnostico");
  if (diagnostico && !data.segmento?.trim()) errors.segmento = "Escolha o segmento da empresa.";
  if (diagnostico && !data.problema?.trim()) errors.problema = "Escolha o principal problema.";
  if (diagnosticoSite && !data.site?.trim()) errors.site = "Informe o endereço do site que vamos analisar.";
  else if (diagnosticoSite && !siteRe.test(data.site!.trim())) errors.site = "Confira o endereço. Exemplo: suaempresa.com.br";
  if ((data.mensagem ?? "").length > LIMITS.mensagem) errors.mensagem = "Mensagem muito longa.";
  return errors;
}

/**
 * Lê o campo "site ou Instagram". Devolve o usuário do Instagram (sem @) quando é um @usuário ou um link do Instagram,
 * o site quando é um endereço, ou o texto como veio (sem inventar https://) quando não é nenhum dos dois.
 */
export function lerPresenca(valor: string | undefined): { site?: string; instagram?: string; texto?: string } {
  const v = (valor ?? "").trim();
  if (!v) return {};
  const ig = v.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i) ?? v.match(/^@([A-Za-z0-9._]{1,30})$/);
  if (ig) return { instagram: ig[1].toLowerCase() };
  if (siteRe.test(v)) return { site: normalizeUrl(v) };
  return { texto: v };
}

export function normalizeUrl(url: string) {
  const v = url.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * WhatsApp brasileiro em dígitos nacionais (DDD + número, sem DDI e sem zeros à esquerda), ou null se não
 * for um número possível. Aceita com ou sem o DDI 55. Regras: DDD de 11 a 99 sem zero; celular com 11 dígitos
 * e 9 depois do DDD; fixo com 10 dígitos começando por 2 a 5. Assim um número cortado ou com dígito a mais
 * é recusado em vez de virar, sem aviso, outro número válido (ex.: "(55) 13997-4723", resto de um +55 cortado).
 */
export function whatsappNacional(value: string): string | null {
  let d = value.replace(/\D/g, "").replace(/^0+/, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (!/^[1-9]{2}/.test(d)) return null;
  if (d.length === 11) return d[2] === "9" ? d : null;
  if (d.length === 10) return /[2-5]/.test(d[2]) ? d : null;
  return null;
}

/**
 * Máscara do campo WhatsApp. Aceita o número nacional (DDD + número) e também com o DDI do Brasil:
 * "+55 13 99747-2309" vira "+55 (13) 99747-2309" com os 13 dígitos preservados. Antes o campo cortava
 * tudo em 11 dígitos, então quem digitava o +55 perdia os dois últimos dígitos do número.
 * Zeros à esquerda (prefixo de operadora/longa distância digitado por hábito) são descartados.
 * Nenhum dígito digitado é descartado em silêncio: além do que cabe num número brasileiro (até 15 dígitos),
 * o valor fica só com os dígitos, sem formatação, e a validação (whatsappNacional) recusa.
 */
export function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 15);
  if (d.length <= 11) return maskNacional(d);
  if (d.length <= 13 && d.startsWith("55")) return `+55 ${maskNacional(d.slice(2))}`;
  return d;
}

function maskNacional(d: string) {
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
