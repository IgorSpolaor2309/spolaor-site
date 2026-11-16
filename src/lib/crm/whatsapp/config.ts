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
