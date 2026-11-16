import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db";
import type { EcoWa, EntradaWa, MidiaRef, StatusWa } from "../conversa";
import { waEnv } from "./config";

// Conector da YCloud (https://docs.ycloud.com), conferido contra a documentação e o OpenAPI v2 em 16/11/2026.
// É o único arquivo que conhece os formatos do provedor; o resto do CRM usa os tipos de ../conversa.
//
// O que a YCloud NÃO oferece, e que molda o envio:
// - não há idempotência: `externalId` é só correlação ("does not make repeated POST requests safe");
// - não há busca de mensagens por `externalId`, só GET /whatsapp/messages/{id} com o id da própria YCloud.
// Por isso um envio sem resposta fica "incerto" e nunca é repetido sozinho: só uma notificação
// (whatsapp.message.updated traz o externalId), o eco do aplicativo ou uma pessoa o resolvem.

/* ───────────────────────────── envio ───────────────────────────── */

export type EnvioWa = { tipo: "texto"; para: string; texto: string } | { tipo: "modelo"; para: string; modelo: string; idioma: string; parametros: string[] };

export type RespostaEnvio =
  | { resultado: "aceita"; provedorId: string; wamid: string | null; status: "aceita" | "enviada" }
  | { resultado: "recusada"; erro: string; tentarDepois: boolean }
  | { resultado: "incerta"; erro: string };

type ErroYCloud = { error?: { status?: number; code?: string; message?: string; whatsappApiError?: { code?: string | number; message?: string; error_data?: { details?: string } | string } } };

/** Motivo da recusa em português, a partir do código da YCloud e do código original da Meta. */
function motivoDaRecusa(http: number, body: ErroYCloud): string {
  const code = body.error?.code ?? "";
  const meta = String(body.error?.whatsappApiError?.code ?? "");
  const por: Record<string, string> = {
    "131047": "A janela de 24 horas fechou: fora dela só um modelo aprovado pode ser enviado.",
    "131026": "O WhatsApp não consegue entregar para este número (pode não ter WhatsApp ou não aceitar mensagens de empresas).",
    "131049": "O WhatsApp reteve a mensagem para proteger a pessoa de excesso de mensagens de empresas.",
    "131050": "A pessoa optou por não receber mensagens de marketing pelo WhatsApp.",
    "131048": "O número comercial atingiu um limite por suspeita de spam.",
    "131056": "Muitas mensagens para o mesmo número em pouco tempo.",
    "131042": "Problema de pagamento na conta do WhatsApp Business.",
    "131045": "O número comercial não está registrado na API do WhatsApp.",
    "133010": "O número comercial não está registrado na API do WhatsApp.",
    "132000": "As variáveis enviadas não batem com as do modelo aprovado.",
    "132012": "O formato das variáveis não bate com o do modelo aprovado.",
    "132001": "O modelo não existe nesse idioma ou não está aprovado.",
    "132015": "O modelo foi pausado pela Meta por baixa qualidade.",
    "132016": "O modelo foi desativado pela Meta.",
    BALANCE_INSUFFICIENT: "Saldo insuficiente na YCloud para enviar a mensagem.",
    WHATSAPP_TEMPLATE_UNAVAILABLE: "O modelo não existe ou não está aprovado.",
    WHATSAPP_PHONE_NUMBER_UNAVAILABLE: "O número comercial não está disponível na YCloud (desconectado ou não registrado).",
    WHATSAPP_WABA_UNAVAILABLE: "A conta do WhatsApp Business não está disponível na YCloud.",
    ACCOUNT_LIMITED: "A conta da YCloud está limitada (contas em teste só enviam para números verificados).",
    ACCOUNT_UNAVAILABLE: "A conta da YCloud está indisponível.",
    RECIPIENT_UNSUBSCRIBED: "O destinatário está marcado como descadastrado na YCloud.",
    RECIPIENT_IN_BLOCK_LIST: "O destinatário está na lista de bloqueio da YCloud.",
    UNAUTHORIZED: "A chave da API da YCloud foi recusada.",
    FORBIDDEN: "A YCloud recusou a operação para esta chave.",
  };
  const dados = body.error?.whatsappApiError?.error_data;
  const detalhe = (typeof dados === "object" ? dados?.details : dados) ?? body.error?.whatsappApiError?.message ?? body.error?.message ?? "";
  return (por[meta] ?? por[code] ?? `O provedor recusou a mensagem${detalhe ? `: ${detalhe}` : ""}`) + ` (${meta || code || `HTTP ${http}`})`;
}

/**
 * Envia pelo endpoint síncrono (sendDirectly): a recusa da Meta (janela fechada, modelo indisponível) volta na própria
 * resposta, em vez de só aparecer depois por notificação. Sem resposta, 5xx ou 408 = resultado incerto.
 */
export async function enviar(e: EnvioWa, externalId: string): Promise<RespostaEnvio> {
  const corpo =
    e.tipo === "texto"
      ? { type: "text", text: { body: e.texto } }
      : {
          type: "template",
          template: {
            name: e.modelo,
            language: { code: e.idioma },
            ...(e.parametros.length ? { components: [{ type: "body", parameters: e.parametros.map((text) => ({ type: "text", text })) }] } : {}),
          },
        };
  let res: Response;
  try {
    res = await fetch(`${waEnv.apiUrl()}/whatsapp/messages/sendDirectly`, {
      method: "POST",
      headers: { "X-API-Key": waEnv.apiKey(), "content-type": "application/json" },
      body: JSON.stringify({ from: `+${waEnv.numero()}`, to: `+${e.para}`, externalId, ...corpo }),
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    return { resultado: "incerta", erro: `Sem resposta do provedor (${(err as Error).name}).` };
  }
  if (res.ok) {
    const b = (await res.json().catch(() => ({}))) as { id?: string; wamid?: string; status?: string };
    // 200 sem id: o provedor aceitou, mas não dá para correlacionar por id; a notificação chega pelo externalId.
    if (!b.id) return { resultado: "incerta", erro: "O provedor respondeu sem identificar a mensagem." };
    return { resultado: "aceita", provedorId: b.id, wamid: b.wamid ?? null, status: b.status === "sent" ? "enviada" : "aceita" };
  }
  const body = (await res.json().catch(() => ({}))) as ErroYCloud;
  if (res.status === 429) return { resultado: "recusada", erro: "O provedor pediu para tentar depois (limite de requisições).", tentarDepois: true };
  if (res.status >= 500 || res.status === 408) return { resultado: "incerta", erro: `O provedor respondeu com erro (HTTP ${res.status}); não se sabe se a mensagem saiu.` };
  return { resultado: "recusada", erro: motivoDaRecusa(res.status, body), tentarDepois: false };
}

/* ───────────────────────────── modelos e número ───────────────────────────── */

export type ModeloProvedor = { nome: string; idioma: string; status: string; categoria: string | null; qualidade: string | null; corpo: string | null };
type Cache = { em: string; itens: ModeloProvedor[] };
const VALIDADE_CACHE_MS = 10 * 60_000;

async function get<T>(caminho: string): Promise<{ ok: true; body: T } | { ok: false; erro: string }> {
  if (!waEnv.apiKey()) return { ok: false, erro: "YCLOUD_API_KEY não definida" };
  try {
    const res = await fetch(`${waEnv.apiUrl()}${caminho}`, { headers: { "X-API-Key": waEnv.apiKey() }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as ErroYCloud;
      return { ok: false, erro: res.status === 401 ? "a YCloud recusou a chave da API" : `a YCloud respondeu HTTP ${res.status}${b.error?.code ? ` (${b.error.code})` : ""}` };
    }
    return { ok: true, body: (await res.json()) as T };
  } catch (e) {
    return { ok: false, erro: `sem resposta da YCloud (${(e as Error).name})` };
  }
}

/** Modelos da conta, lidos da YCloud e guardados por 10 minutos (crm_config). `forcar` ignora o que está guardado. */
export async function listarModelos(forcar = false): Promise<{ ok: true; em: string; itens: ModeloProvedor[] } | { ok: false; erro: string; antigo: Cache | null }> {
  const sql = await db();
  const [c] = await sql<{ valor: Cache }[]>`select valor from crm_config where chave = 'whatsapp:modelos'`;
  const antigo = c?.valor?.itens ? c.valor : null;
  if (!forcar && antigo && Date.now() - new Date(antigo.em).getTime() < VALIDADE_CACHE_MS) return { ok: true, ...antigo };
  type T = { name: string; language: string; status: string; category?: string; qualityRating?: string; components?: { type: string; text?: string }[] };
  const r = await get<{ items?: T[] }>("/whatsapp/templates?limit=100");
  if (!r.ok) return { ok: false, erro: r.erro, antigo };
  const itens = (r.body.items ?? []).map((t) => ({
    nome: t.name,
    idioma: t.language,
    status: t.status,
    categoria: t.category ?? null,
    qualidade: t.qualityRating ?? null,
    corpo: t.components?.find((x) => x.type?.toUpperCase() === "BODY")?.text ?? null,
  }));
  const novo: Cache = { em: new Date().toISOString(), itens };
  await sql`
    insert into crm_config (chave, valor) values ('whatsapp:modelos', ${sql.json(novo as never)})
    on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`;
  return { ok: true, ...novo };
}

/** O modelo existe, nesse idioma, e está APROVADO agora? Devolve o texto dele para guardar o que foi enviado. */
export async function modeloAprovado(nome: string, idioma: string, forcar = false): Promise<{ ok: true; corpo: string | null; categoria: string | null } | { ok: false; motivo: string }> {
  const r = await listarModelos(forcar);
  // Sem conseguir ler a YCloud agora, vale o que estava guardado (o envio em si ainda é conferido pelo provedor).
  const itens = r.ok ? r.itens : r.antigo?.itens;
  if (!itens) return { ok: false, motivo: `Não foi possível conferir o modelo: ${r.ok ? "" : r.erro}.` };
  const doNome = itens.filter((t) => t.nome === nome);
  const m = doNome.find((t) => t.idioma === idioma);
  if (!m) return { ok: false, motivo: doNome.length ? `O modelo "${nome}" não existe no idioma ${idioma}.` : `O modelo "${nome}" não existe na conta da YCloud.` };
  if (m.status !== "APPROVED") return { ok: false, motivo: `O modelo "${nome}" não está aprovado (estado na Meta: ${m.status}).` };
  return { ok: true, corpo: m.corpo, categoria: m.categoria };
}

export type EstadoNumero =
  | { ok: true; encontrado: true; status: string; qualidade: string | null; limite: string | null; nomeVerificado: string | null }
  | { ok: true; encontrado: false; numeros: number }
  | { ok: false; erro: string };

/** Estado do número comercial na YCloud, lido agora. É o que prova (ou não) que o número está conectado. */
export async function estadoNumero(): Promise<EstadoNumero> {
  const numero = waEnv.numero();
  if (!numero) return { ok: false, erro: "WHATSAPP_NUMERO não definido" };
  type P = { phoneNumber?: string; status?: string; qualityRating?: string; messagingLimit?: string; verifiedName?: string };
  const r = await get<{ items?: P[] }>("/whatsapp/phoneNumbers?limit=100");
  if (!r.ok) return { ok: false, erro: r.erro };
  const itens = r.body.items ?? [];
  const p = itens.find((x) => (x.phoneNumber ?? "").replace(/\D/g, "") === numero);
  if (!p) return { ok: true, encontrado: false, numeros: itens.length };
  return { ok: true, encontrado: true, status: p.status ?? "UNKNOWN", qualidade: p.qualityRating ?? null, limite: p.messagingLimit ?? null, nomeVerificado: p.verifiedName ?? null };
}

/* ───────────────────────────── webhook ───────────────────────────── */

/**
 * Confere a assinatura da notificação: cabeçalho `YCloud-Signature: t=<unix>,s=<hex>`, HMAC-SHA256 de
 * "<t>.<corpo cru>" com o segredo do endpoint. A tolerância do horário é de 6 horas porque a YCloud tenta de novo por
 * até ~5h40 e não documenta se reassina; a proteção contra repetição é o id do evento (crm_webhook_eventos).
 */
/**
 * Por que uma notificação foi recusada. Só a categoria: nunca o cabeçalho, a assinatura, o segredo nem o corpo.
 * - sem_segredo: YCLOUD_WEBHOOK_SECRET não definido (a rota responde 503 antes de chegar aqui);
 * - sem_assinatura: a chamada veio sem o cabeçalho YCloud-Signature;
 * - formato_invalido: o cabeçalho não tem `t` numérico e `s` com 64 dígitos hexadecimais;
 * - fora_do_prazo: o horário assinado difere do relógio do servidor em mais de 6 horas;
 * - assinatura_diferente: o HMAC calculado com o segredo do servidor não bate com o recebido.
 */
export type MotivoRecusa = "sem_assinatura" | "formato_invalido" | "fora_do_prazo" | "assinatura_diferente";
export type ResultadoAssinatura = { ok: true } | { ok: false; motivo: MotivoRecusa | "sem_segredo" };

/** Tolerância entre o horário assinado e o relógio do servidor (a YCloud tenta de novo por cerca de 5h40). */
const TOLERANCIA_ASSINATURA_S = 6 * 3600;

/** Confere a assinatura da YCloud sobre o corpo cru. Os critérios e a ordem são os mesmos de sempre; a diferença é devolver o motivo. */
export function conferirAssinatura(corpoCru: string, cabecalho: string | null, agora = Date.now()): ResultadoAssinatura {
  const segredo = waEnv.webhookSecret();
  if (!segredo) return { ok: false, motivo: "sem_segredo" };
  if (!cabecalho) return { ok: false, motivo: "sem_assinatura" };
  const partes = Object.fromEntries(
    cabecalho.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(partes.t);
  if (!Number.isFinite(t) || !/^[0-9a-f]{64}$/i.test(partes.s ?? "")) return { ok: false, motivo: "formato_invalido" };
  if (Math.abs(agora / 1000 - t) > TOLERANCIA_ASSINATURA_S) return { ok: false, motivo: "fora_do_prazo" };
  const esperado = createHmac("sha256", segredo).update(`${partes.t}.${corpoCru}`).digest();
  const recebido = Buffer.from(partes.s, "hex");
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? { ok: true } : { ok: false, motivo: "assinatura_diferente" };
}

export function assinaturaValida(corpoCru: string, cabecalho: string | null, agora = Date.now()): boolean {
  return conferirAssinatura(corpoCru, cabecalho, agora).ok;
}

type MidiaY = { id?: string; mime_type?: string; filename?: string; caption?: string };
type MsgY = {
  id?: string;
  wamid?: string;
  from?: string;
  to?: string;
  fromUserId?: string;
  toUserId?: string;
  recipientUserId?: string;
  customerProfile?: { name?: string; username?: string };
  type?: string;
  status?: string;
  externalId?: string;
  errorCode?: string;
  errorMessage?: string;
  whatsappApiError?: { code?: string | number; message?: string; error_data?: { details?: string } | string };
  createTime?: string;
  sendTime?: string;
  deliverTime?: string;
  readTime?: string;
  text?: { body?: string };
  image?: MidiaY;
  video?: MidiaY;
  audio?: MidiaY;
  document?: MidiaY;
  sticker?: MidiaY;
  button?: { text?: string; payload?: string };
  interactive?: { type?: string; button_reply?: { title?: string }; list_reply?: { title?: string; description?: string }; nfm_reply?: { body?: string } };
  reaction?: { emoji?: string; message_id?: string };
  location?: { name?: string; address?: string };
  template?: { name?: string };
  context?: { id?: string };
  system?: { type?: string };
};

export type EventoYCloud = {
  id?: string;
  type?: string;
  createTime?: string;
  whatsappInboundMessage?: MsgY;
  whatsappMessage?: MsgY;
  whatsappTemplate?: { name?: string; language?: string; status?: string; category?: string };
  whatsappPhoneNumber?: { phoneNumber?: string; qualityRating?: string; messagingLimit?: string; updateEvent?: string; qualityUpdateEvent?: string };
  whatsappBusinessAccount?: { id?: string; removedReason?: string; updateEvent?: string; banState?: string };
};

const dataValida = (v: string | undefined, reserva: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : reserva);

function conteudo(m: MsgY): { tipo: string; texto: string | null; midia: MidiaRef | null } {
  const tipo = m.type ?? "unsupported";
  const mid = (x?: MidiaY): MidiaRef | null => (x ? { id: x.id ?? null, mime: x.mime_type ?? null, nome: x.filename ?? null, legenda: x.caption ?? null } : null);
  switch (tipo) {
    case "text":
      return { tipo, texto: m.text?.body ?? null, midia: null };
    case "button":
      return { tipo, texto: m.button?.text ?? m.button?.payload ?? null, midia: null };
    case "interactive": {
      const i = m.interactive;
      return { tipo, texto: i?.button_reply?.title ?? i?.list_reply?.title ?? i?.nfm_reply?.body ?? null, midia: null };
    }
    case "reaction":
      return { tipo, texto: m.reaction?.emoji ?? null, midia: null };
    case "template":
      return { tipo, texto: m.template?.name ? `[Modelo ${m.template.name}]` : null, midia: null };
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker":
      return { tipo, texto: null, midia: mid(m[tipo]) };
    case "location":
      return { tipo, texto: [m.location?.name, m.location?.address].filter(Boolean).join(" · ") || null, midia: null };
    default:
      return { tipo, texto: null, midia: null };
  }
}

export type EventoTraduzido =
  | { classe: "entrada"; entrada: EntradaWa }
  | { classe: "eco"; eco: EcoWa }
  | { classe: "status"; status: StatusWa }
  | { classe: "modelo" }
  | { classe: "numero"; evento: Record<string, unknown> }
  | { classe: "conta"; evento: Record<string, unknown> }
  | { classe: "ignorado"; motivo: string };

/** Traduz uma notificação da YCloud para o que ela significa no CRM. Tipo desconhecido nunca derruba o recebimento. */
export function traduzir(ev: EventoYCloud): EventoTraduzido {
  const agora = dataValida(ev.createTime, new Date().toISOString());
  switch (ev.type) {
    case "whatsapp.inbound_message.received": {
      const m = ev.whatsappInboundMessage;
      if (!m?.id) return { classe: "ignorado", motivo: "mensagem recebida sem id" };
      // Avisos do WhatsApp (troca de número, primeira abertura da conversa) não são mensagens do interessado.
      if (m.type === "system" || m.type === "request_welcome") return { classe: "ignorado", motivo: `aviso do WhatsApp (${m.type})` };
      const c = conteudo(m);
      return {
        classe: "entrada",
        entrada: { provedor: "ycloud", provedorId: m.id, wamid: m.wamid ?? null, de: m.from ?? null, usuarioWa: m.fromUserId ?? null, nomePerfil: m.customerProfile?.name ?? null, ...c, respostaA: m.context?.id ?? m.reaction?.message_id ?? null, em: dataValida(m.sendTime, agora) },
      };
    }
    // Mensagem enviada pelo aplicativo WhatsApp Business (coexistência). Os dois eventos têm o mesmo formato; a
    // repetição entre eles é barrada pelos identificadores da mensagem.
    case "whatsapp.smb.message.echoes":
    case "whatsapp.smb.message.created": {
      const m = ev.whatsappMessage;
      if (!m?.id) return { classe: "ignorado", motivo: "eco sem id" };
      const c = conteudo(m);
      return {
        classe: "eco",
        eco: { provedor: "ycloud", provedorId: m.id, wamid: m.wamid ?? null, para: m.to ?? null, usuarioWa: m.toUserId ?? m.recipientUserId ?? null, ...c, respostaA: m.context?.id ?? null, em: dataValida(m.sendTime ?? m.createTime, agora) },
      };
    }
    case "whatsapp.message.updated": {
      const m = ev.whatsappMessage;
      if (!m?.id) return { classe: "ignorado", motivo: "atualização sem mensagem (grupo ou outro objeto)" };
      const mapa: Record<string, StatusWa["status"]> = { accepted: "aceita", sent: "enviada", delivered: "entregue", read: "lida", failed: "falhou" };
      const status = mapa[m.status ?? ""];
      if (!status) return { classe: "ignorado", motivo: `estado desconhecido (${m.status})` };
      const dados = m.whatsappApiError?.error_data;
      const detalhe = (typeof dados === "object" ? dados?.details : dados) ?? m.errorMessage ?? m.whatsappApiError?.message ?? null;
      const em = status === "lida" ? m.readTime : status === "entregue" ? m.deliverTime : status === "enviada" ? m.sendTime : undefined;
      return {
        classe: "status",
        status: {
          provedor: "ycloud",
          provedorId: m.id,
          wamid: m.wamid ?? null,
          externalId: m.externalId ?? null,
          status,
          erro: status === "falhou" ? motivoDaRecusa(0, { error: { code: m.errorCode, message: detalhe ?? undefined, whatsappApiError: { code: m.whatsappApiError?.code ?? m.errorCode, message: detalhe ?? undefined } } }) : null,
          em: dataValida(em, agora),
        },
      };
    }
    // Importação do histórico do aplicativo: fica registrada, mas não vira mensagem, pendência, oportunidade nem
    // abre janela de atendimento.
    case "whatsapp.smb.history":
      return { classe: "ignorado", motivo: "histórico do aplicativo (não importado)" };
    case "whatsapp.template.reviewed":
    case "whatsapp.template.category_updated":
    case "whatsapp.template.quality_updated":
      return { classe: "modelo" };
    case "whatsapp.phone_number.quality_updated":
    case "whatsapp.phone_number.deleted":
      return { classe: "numero", evento: { tipo: ev.type, em: agora, ...(ev.whatsappPhoneNumber ?? {}) } };
    case "whatsapp.business_account.deleted":
    case "whatsapp.business_account.updated":
      return { classe: "conta", evento: { tipo: ev.type, em: agora, ...(ev.whatsappBusinessAccount ?? {}) } };
    default:
      return { classe: "ignorado", motivo: `tipo não tratado (${String(ev.type).slice(0, 60)})` };
  }
}
