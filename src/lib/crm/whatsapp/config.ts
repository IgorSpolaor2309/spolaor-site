import { db } from "../db";
import { normWhatsapp } from "../normalizar";
import { CATEGORIAS, type Categoria } from "../tipos";

// Configuração do WhatsApp pela API oficial (provedor YCloud, com coexistência: o mesmo número segue no aplicativo
// WhatsApp Business do celular). Credenciais só em variáveis de ambiente do servidor:
//   YCLOUD_API_KEY          chave da API da YCloud
//   YCLOUD_WEBHOOK_SECRET   segredo do endpoint de webhook (assinatura das notificações)
//   WHATSAPP_NUMERO         número comercial conectado, com DDI (ex.: 5547999999999)
//   YCLOUD_API_URL          opcional; só para testes locais com provedor simulado
// O que NÃO é segredo (modelo usado, frases, canal do primeiro contato) fica em crm_config e é editado em
// /leads/configuracoes.

const env = (k: string) => (process.env[k] ?? "").trim();

export const waEnv = {
  apiKey: () => env("YCLOUD_API_KEY"),
  webhookSecret: () => env("YCLOUD_WEBHOOK_SECRET"),
  numero: () => normWhatsapp(env("WHATSAPP_NUMERO")),
  apiUrl: () => (env("YCLOUD_API_URL") || "https://api.ycloud.com/v2").replace(/\/+$/, ""),
};

/** O que falta para o CRM conseguir ENVIAR. Ter tudo definido ainda não prova que o número está conectado. */
export function waEnvio(): { pronto: boolean; falta: string[] } {
  const falta = [!waEnv.apiKey() && "YCLOUD_API_KEY", !waEnv.numero() && "WHATSAPP_NUMERO"].filter((x): x is string => !!x);
  return { pronto: falta.length === 0, falta };
}

/* ───────────────────────────── primeiro contato automático ───────────────────────────── */

export type CanalAutomacao = "desligado" | "whatsapp" | "email";

/**
 * Por onde sai o primeiro contato automático. Um canal só: a mesma recepção nunca sai por WhatsApp e por e-mail.
 * Padrão: desligado. (A chave antiga `automacao:email` continua valendo como "email" enquanto a nova não existir.)
 */
export async function canalAutomacao(): Promise<CanalAutomacao> {
  const sql = await db();
  const rows = await sql<{ chave: string; valor: { canal?: string; ativo?: boolean } }[]>`
    select chave, valor from crm_config where chave in ('automacao:primeiro-contato', 'automacao:email')`;
  const novo = rows.find((r) => r.chave === "automacao:primeiro-contato")?.valor?.canal;
  if (novo === "whatsapp" || novo === "email" || novo === "desligado") return novo;
  return rows.find((r) => r.chave === "automacao:email")?.valor?.ativo === true ? "email" : "desligado";
}

export async function definirCanalAutomacao(canal: CanalAutomacao, usuarioId: string) {
  const sql = await db();
  await sql`
    insert into crm_config (chave, valor, usuario_id) values ('automacao:primeiro-contato', ${sql.json({ canal })}, ${usuarioId})
    on conflict (chave) do update set valor = excluded.valor, usuario_id = excluded.usuario_id, atualizado_em = now()`;
}

/* ───────────────────────────── modelo aprovado e frases ───────────────────────────── */

/**
 * Para iniciar conversa pela API o WhatsApp exige um modelo aprovado pela Meta. O texto do modelo é editado e
 * aprovado no painel do provedor; aqui ficam o nome do modelo a usar e o que entra em cada variável.
 * Variáveis disponíveis: primeiro_nome, pedido (frase da categoria do serviço), nome, empresa.
 */
export type ModeloPrimeiroContato = { nome: string; idioma: string; variaveis: string[] };
export const MODELO_PADRAO: ModeloPrimeiroContato = { nome: "", idioma: "pt_BR", variaveis: ["primeiro_nome", "pedido"] };
export const VARIAVEIS_MODELO = ["primeiro_nome", "pedido", "nome", "empresa"] as const;

/** Texto sugerido para o modelo (a cadastrar no provedor). {{1}} = primeiro nome, {{2}} = frase do pedido. */
export const MODELO_SUGERIDO =
  "Olá, {{1}}! Aqui é a Spolaor Tecnologia. Recebemos {{2}} pelo nosso site. Posso continuar seu atendimento por aqui?";

/** O que entra em {{pedido}} para cada categoria: curto e ligado ao que a pessoa pediu no formulário. */
export const FRASES_PADRAO: Record<Categoria, string> = {
  sites: "seu pedido de orçamento de site",
  lojas: "seu pedido sobre loja virtual",
  agendamento: "seu pedido sobre agendamento online",
  automacao: "seu pedido sobre automação de processos",
  "atendimento-ia": "seu pedido sobre atendimento com IA no WhatsApp",
  diagnostico: "seu pedido de diagnóstico do site",
  sistemas: "seu pedido sobre um sistema sob medida",
  consultoria: "seu pedido de consultoria",
  "a-classificar": "seu contato",
};

export async function modeloPrimeiroContato(): Promise<ModeloPrimeiroContato> {
  const sql = await db();
  const [r] = await sql<{ valor: Partial<ModeloPrimeiroContato> }[]>`select valor from crm_config where chave = 'whatsapp:modelo'`;
  const v = r?.valor ?? {};
  return {
    nome: typeof v.nome === "string" ? v.nome.trim() : "",
    idioma: typeof v.idioma === "string" && v.idioma.trim() ? v.idioma.trim() : MODELO_PADRAO.idioma,
    variaveis: Array.isArray(v.variaveis) ? v.variaveis.filter((x): x is string => (VARIAVEIS_MODELO as readonly string[]).includes(x)).slice(0, 4) : MODELO_PADRAO.variaveis,
  };
}

export async function salvarModeloPrimeiroContato(m: ModeloPrimeiroContato, usuarioId: string) {
  const sql = await db();
  await sql`
    insert into crm_config (chave, valor, usuario_id) values ('whatsapp:modelo', ${sql.json(m)}, ${usuarioId})
    on conflict (chave) do update set valor = excluded.valor, usuario_id = excluded.usuario_id, atualizado_em = now()`;
}

export async function frases(): Promise<Record<Categoria, string>> {
  const sql = await db();
  const [r] = await sql<{ valor: Record<string, string> }[]>`select valor from crm_config where chave = 'whatsapp:frases'`;
  const out = { ...FRASES_PADRAO };
  for (const c of CATEGORIAS) {
    const v = r?.valor?.[c];
    if (typeof v === "string" && v.trim()) out[c] = v.trim().slice(0, 120);
  }
  return out;
}

export async function salvarFrases(f: Partial<Record<Categoria, string>>, usuarioId: string) {
  const sql = await db();
  await sql`
    insert into crm_config (chave, valor, usuario_id) values ('whatsapp:frases', ${sql.json(f as never)}, ${usuarioId})
    on conflict (chave) do update set valor = excluded.valor, usuario_id = excluded.usuario_id, atualizado_em = now()`;
}

/** Preenche as variáveis do modelo, na ordem configurada. O WhatsApp recusa variável vazia, quebra de linha e tabulação. */
export function parametrosDoModelo(m: ModeloPrimeiroContato, v: { nome: string; empresa: string | null; pedido: string }): string[] {
  const limpa = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 120);
  const mapa: Record<string, string> = {
    primeiro_nome: limpa(v.nome).split(" ")[0] || "tudo bem",
    nome: limpa(v.nome) || "tudo bem",
    empresa: limpa(v.empresa ?? "") || "sua empresa",
    pedido: limpa(v.pedido) || FRASES_PADRAO["a-classificar"],
  };
  return m.variaveis.map((k) => mapa[k] ?? "");
}

/** Texto final de um modelo com as variáveis ({{1}}, {{2}}…) preenchidas, para guardar na conversa o que foi enviado. */
export function textoDoModelo(corpo: string | null, parametros: string[], nome: string): string {
  if (!corpo) return `[Modelo ${nome}] ${parametros.join(" · ")}`;
  return corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n: string) => parametros[Number(n) - 1] ?? m);
}

/* ───────────────────────────── limites do envio automático ───────────────────────────── */

/**
 * Dois limites de tempo do primeiro contato automático (valem para WhatsApp e e-mail):
 *
 * - `horasMaximas` (padrão 12): idade máxima do contato para ainda receber a primeira mensagem automática. Conta
 *   da chegada do formulário até o momento em que a tarefa é executada. Normalmente a tarefa roda em segundos; o
 *   limite só age quando ela atrasa (fila fora do ar, deploy, banco indisponível) ou é reprocessada depois. Passado
 *   o limite, nada é enviado e o contato aparece como novo sem primeiro atendimento. É também o que impede disparo
 *   retroativo ao ligar a automação.
 * - `horasEntreRecepcoes` (padrão 72): intervalo em que a MESMA pessoa não recebe outra recepção automática, mesmo
 *   pedindo outro serviço. Conta do envio da recepção anterior (automática do CRM, ou automática do aplicativo
 *   reconhecida). Dentro do intervalo, o novo pedido vai direto para "Depende de mim". Fora dele, um novo pedido
 *   recebe nova recepção, a não ser que a pessoa já esteja em conversa de verdade (respondeu ou alguém assumiu).
 *
 * Editáveis em /leads/configuracoes, dentro das faixas abaixo.
 */
export type LimitesAutomacao = { horasMaximas: number; horasEntreRecepcoes: number };
export const LIMITES_PADRAO: LimitesAutomacao = { horasMaximas: 12, horasEntreRecepcoes: 72 };
export const LIMITES_FAIXA = { horasMaximas: [1, 48], horasEntreRecepcoes: [1, 720] } as const;

const naFaixa = (v: unknown, [min, max]: readonly [number, number], padrao: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
};

export async function limitesAutomacao(): Promise<LimitesAutomacao> {
  const sql = await db();
  const [r] = await sql<{ valor: Partial<LimitesAutomacao> }[]>`select valor from crm_config where chave = 'automacao:limites'`;
  return {
    horasMaximas: naFaixa(r?.valor?.horasMaximas, LIMITES_FAIXA.horasMaximas, LIMITES_PADRAO.horasMaximas),
    horasEntreRecepcoes: naFaixa(r?.valor?.horasEntreRecepcoes, LIMITES_FAIXA.horasEntreRecepcoes, LIMITES_PADRAO.horasEntreRecepcoes),
  };
}

/** Grava os limites. Valor fora da faixa é recusado (devolve false), não ajustado em silêncio. */
export async function salvarLimitesAutomacao(l: { horasMaximas: unknown; horasEntreRecepcoes: unknown }, usuarioId: string): Promise<boolean> {
  const a = Math.round(Number(l.horasMaximas));
  const b = Math.round(Number(l.horasEntreRecepcoes));
  const ok = (n: number, [min, max]: readonly [number, number]) => Number.isFinite(n) && n >= min && n <= max;
  if (!ok(a, LIMITES_FAIXA.horasMaximas) || !ok(b, LIMITES_FAIXA.horasEntreRecepcoes)) return false;
  const sql = await db();
  await sql`
    insert into crm_config (chave, valor, usuario_id) values ('automacao:limites', ${sql.json({ horasMaximas: a, horasEntreRecepcoes: b })}, ${usuarioId})
    on conflict (chave) do update set valor = excluded.valor, usuario_id = excluded.usuario_id, atualizado_em = now()`;
  return true;
}

/* ───────────────────────────── mensagens automáticas do aplicativo ───────────────────────────── */

/**
 * Textos das mensagens automáticas do aplicativo WhatsApp Business (saudação e ausência), cadastrados por quem usa o
 * aplicativo. Uma mensagem sincronizada do aplicativo só é tratada como AUTOMÁTICA quando o texto dela é igual a um
 * destes. O tempo entre a mensagem da pessoa e a resposta não entra na decisão: resposta rápida não prova automação
 * e resposta demorada não prova que foi uma pessoa.
 */
export type TextosAutomaticos = { saudacao: string; ausencia: string; outras: string[] };

export const normalizarTexto = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

export async function textosAutomaticosApp(): Promise<TextosAutomaticos> {
  const sql = await db();
  const [r] = await sql<{ valor: Partial<TextosAutomaticos> }[]>`select valor from crm_config where chave = 'whatsapp:textos-automaticos'`;
  const v = r?.valor ?? {};
  return {
    saudacao: typeof v.saudacao === "string" ? v.saudacao : "",
    ausencia: typeof v.ausencia === "string" ? v.ausencia : "",
    outras: Array.isArray(v.outras) ? v.outras.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 10) : [],
  };
}

export async function salvarTextosAutomaticosApp(t: TextosAutomaticos, usuarioId: string | null) {
  const sql = await db();
  const limpo: TextosAutomaticos = {
    saudacao: t.saudacao.trim().slice(0, 1000),
    ausencia: t.ausencia.trim().slice(0, 1000),
    outras: [...new Set(t.outras.map((x) => x.trim().slice(0, 1000)).filter(Boolean))].slice(0, 10),
  };
  await sql`
    insert into crm_config (chave, valor, usuario_id) values ('whatsapp:textos-automaticos', ${sql.json(limpo)}, ${usuarioId})
    on conflict (chave) do update set valor = excluded.valor, usuario_id = excluded.usuario_id, atualizado_em = now()`;
}

/** O texto é igual (ignorando maiúsculas e espaços) a uma das mensagens automáticas cadastradas? */
export function ehTextoAutomatico(t: TextosAutomaticos, corpo: string): boolean {
  const alvo = normalizarTexto(corpo);
  if (!alvo) return false;
  return [t.saudacao, t.ausencia, ...t.outras].some((x) => x.trim() && normalizarTexto(x) === alvo);
}

/* ───────────────────────────── números de controle (validação) ───────────────────────────── */

/**
 * Números de controle: telefones da própria equipe usados para validar o WhatsApp de ponta a ponta. Para eles:
 * - o envio do formulário público não gera conversão publicitária (a resposta manda o navegador não medir);
 * - a oportunidade fica marcada como validação (fora dos indicadores);
 * - o primeiro contato automático pelo WhatsApp roda mesmo com a automação desligada para todos os outros.
 * Nunca cadastre aqui o número de um cliente.
 */
export async function numerosControle(): Promise<string[]> {
  const sql = await db();
  const [r] = await sql<{ valor: { numeros?: unknown } }[]>`select valor from crm_config where chave = 'whatsapp:numeros-controle'`;
  const lista = Array.isArray(r?.valor?.numeros) ? r!.valor.numeros : [];
  return [...new Set(lista.map((n) => normWhatsapp(String(n))).filter((n): n is string => !!n))].slice(0, 5);
}

export async function salvarNumerosControle(brutos: string[], usuarioId: string): Promise<{ salvos: string[]; invalidos: string[] }> {
  const salvos: string[] = [];
  const invalidos: string[] = [];
  for (const b of brutos.map((x) => x.trim()).filter(Boolean)) {
    const n = normWhatsapp(b);
    if (n) salvos.push(n);
    else invalidos.push(b.slice(0, 30));
  }
  const unicos = [...new Set(salvos)].slice(0, 5);
  const sql = await db();
  await sql`
    insert into crm_config (chave, valor, usuario_id) values ('whatsapp:numeros-controle', ${sql.json({ numeros: unicos })}, ${usuarioId})
    on conflict (chave) do update set valor = excluded.valor, usuario_id = excluded.usuario_id, atualizado_em = now()`;
  return { salvos: unicos, invalidos };
}
