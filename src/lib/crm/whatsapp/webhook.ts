import { aplicarStatus, registrarEco, registrarEntrada } from "../conversa";
import { crmConfigured, db } from "../db";
import { listarModelos, traduzir, type EventoYCloud, type MotivoRecusa } from "./ycloud";

// Recebimento das notificações da YCloud.
//
// 1. A assinatura é conferida na rota (corpo cru) antes de qualquer coisa.
// 2. O evento é gravado como chegou (crm_webhook_eventos), com o id do evento como chave: uma repetição não entra
//    duas vezes. A YCloud mantém o id do evento nas novas tentativas.
// 3. O processamento vem depois de gravado. Se falhar, o evento continua gravado e sem "processado_em"; a rotina
//    o processa de novo. Cada efeito é idempotente pelos identificadores da MENSAGEM (não só do evento), porque a
//    YCloud avisa que a mesma interação pode gerar outro id de evento.
// 4. A ordem de chegada não importa: de quem é a vez é decidido pela hora real das mensagens (../conversa.ts).

const MAX_TENTATIVAS = 6;

async function processar(ev: EventoYCloud): Promise<string> {
  const t = traduzir(ev);
  switch (t.classe) {
    case "entrada": {
      const r = await registrarEntrada(t.entrada);
      return r.resultado === "gravada" ? `mensagem recebida${r.oportunidadeId ? "" : " (sem oportunidade)"}${r.pediuParar ? " · pediu para parar" : ""}` : `entrada ${r.resultado}`;
    }
    case "eco": {
      const r = await registrarEco(t.eco);
      return `eco: ${r.resultado}`;
    }
    case "status": {
      const r = await aplicarStatus(t.status);
      return `estado ${t.status.status}: ${r.resultado}`;
    }
    case "modelo": {
      const r = await listarModelos(true);
      return r.ok ? "modelos atualizados" : `modelos não atualizados (${r.erro})`;
    }
    case "numero":
    case "conta": {
      // Último aviso sobre o número ou a conta (qualidade, desconexão, remoção): aparece em Integrações.
      const sql = await db();
      await sql`
        insert into crm_config (chave, valor) values (${`whatsapp:evento-${t.classe}`}, ${sql.json(t.evento as never)})
        on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`;
      return `${t.classe} atualizado`;
    }
    default:
      return `ignorado: ${t.motivo}`;
  }
}

/** Grava e processa uma notificação já autenticada. Devolve o que aconteceu (para o log). Nunca lança erro. */
export async function receberEvento(ev: EventoYCloud): Promise<{ gravado: boolean; resultado: string }> {
  if (!ev || typeof ev.id !== "string" || !ev.id || typeof ev.type !== "string") return { gravado: false, resultado: "evento sem id ou tipo" };
  if (!crmConfigured()) return { gravado: false, resultado: "sem banco" };
  const sql = await db();
  const chave = `ycloud:${ev.id.slice(0, 200)}`;
  const novo = await sql`
    insert into crm_webhook_eventos (id, provedor, tipo, payload) values (${chave}, 'ycloud', ${ev.type.slice(0, 120)}, ${sql.json(ev as never)})
    on conflict (id) do nothing`;
  if (!novo.count) {
    // Repetição. Se a primeira entrega já foi processada, nada a fazer; se não, tenta agora.
    const [e] = await sql<{ processado_em: Date | null }[]>`select processado_em from crm_webhook_eventos where id = ${chave}`;
    if (e?.processado_em) return { gravado: true, resultado: "repetido (já processado)" };
  }
  return { gravado: true, resultado: await processarGravado(chave, ev) };
}

async function processarGravado(chave: string, ev: EventoYCloud): Promise<string> {
  const sql = await db();
  try {
    const resultado = await processar(ev);
    await sql`update crm_webhook_eventos set processado_em = now(), resultado = ${resultado.slice(0, 300)}, erro = null, tentativas = tentativas + 1 where id = ${chave}`;
    return resultado;
  } catch (e) {
    const erro = (e as Error).message.slice(0, 300);
    console.error(`[crm] webhook ${chave} não processado: ${erro}`);
    await sql`update crm_webhook_eventos set erro = ${erro}, tentativas = tentativas + 1 where id = ${chave}`.catch(() => {});
    return `erro: ${erro}`;
  }
}

/** Rotina: notificações gravadas que não chegaram a ser processadas; e limpeza do que já tem mais de 90 dias. */
export async function rotinaWebhooks(): Promise<string[]> {
  const sql = await db();
  const rows = await sql<{ id: string; payload: EventoYCloud }[]>`
    select id, payload from crm_webhook_eventos
    where processado_em is null and tentativas < ${MAX_TENTATIVAS} and recebido_em < now() - interval '1 minute'
    order by recebido_em limit 30`;
  const out: string[] = [];
  for (const r of rows) out.push(`webhook ${r.id.slice(-8)}: ${await processarGravado(r.id, r.payload)}`);
  await sql`delete from crm_webhook_eventos where processado_em is not null and recebido_em < now() - interval '90 days'`.catch(() => {});
  return out;
}

/* ───────────────────────────── notificações recusadas ─────────────────────────────
 *
 * Uma notificação recusada (HTTP 401) não é gravada: não se sabe quem a enviou. O que fica registrado é só o MOTIVO
 * e a hora, para a tela de Integrações dizer por que o webhook não está entrando. Nunca o cabeçalho, a assinatura,
 * o segredo nem o corpo.
 *
 * A rota é pública, então o registro tem teto: no máximo MAX_REGISTROS gravações por JANELA_MS em cada instância do
 * servidor. O que passar disso é só contado na memória e entra junto na próxima gravação permitida. Em operação
 * normal (as novas tentativas da YCloud são poucas por minuto) a contagem é exata; sob enxurrada ela é um piso.
 */

export const MOTIVO_RECUSA_ROTULO: Record<MotivoRecusa, string> = {
  sem_assinatura: "a chamada veio sem o cabeçalho de assinatura da YCloud (não partiu da YCloud, ou foi um teste manual)",
  formato_invalido: "o cabeçalho de assinatura veio fora do formato esperado",
  fora_do_prazo: "o horário assinado difere do relógio do servidor em mais de 6 horas",
  assinatura_diferente:
    "a assinatura não confere com YCLOUD_WEBHOOK_SECRET: o segredo salvo no servidor é diferente do segredo do endpoint na YCloud (copie o valor inteiro pelo botão “Copy secret”, salve na Vercel e refaça o deploy)",
};
const MOTIVOS = Object.keys(MOTIVO_RECUSA_ROTULO) as MotivoRecusa[];
const CHAVE_RECUSAS = "whatsapp:webhook-recusas";
const JANELA_MS = 60_000;
const MAX_REGISTROS = 30;
let janelaInicio = 0;
let registrosNaJanela = 0;
const acumulado = new Map<MotivoRecusa, number>();

type Recusas = { desde: string; total: number; ultimaEm: string; ultimoMotivo: MotivoRecusa; porMotivo: Partial<Record<MotivoRecusa, number>> };

/** Registra que uma notificação foi recusada e por quê. Nunca lança erro: falhar aqui não pode mudar a resposta da rota. */
export async function registrarRecusa(motivo: MotivoRecusa, agora = Date.now()): Promise<void> {
  console.warn(`[crm] webhook ycloud recusado: ${motivo}`);
  if (!MOTIVOS.includes(motivo) || !crmConfigured()) return;
  acumulado.set(motivo, (acumulado.get(motivo) ?? 0) + 1);
  if (agora - janelaInicio >= JANELA_MS) {
    janelaInicio = agora;
    registrosNaJanela = 0;
  }
  if (registrosNaJanela >= MAX_REGISTROS) return; // teto: fica na memória até a próxima gravação permitida
  registrosNaJanela++;
  const lote = new Map(acumulado);
  acumulado.clear();
  const quando = new Date(agora).toISOString();
  try {
    const sql = await db();
    await sql.begin(async (tx) => {
      const vazio: Recusas = { desde: quando, total: 0, ultimaEm: quando, ultimoMotivo: motivo, porMotivo: {} };
      await tx`insert into crm_config (chave, valor) values (${CHAVE_RECUSAS}, ${tx.json(vazio as never)}) on conflict (chave) do nothing`;
      const [r] = await tx<{ valor: Partial<Recusas> }[]>`select valor from crm_config where chave = ${CHAVE_RECUSAS} for update`;
      const v = r?.valor ?? {};
      const porMotivo: Partial<Record<MotivoRecusa, number>> = {};
      for (const m of MOTIVOS) {
        const n = (Number(v.porMotivo?.[m]) || 0) + (lote.get(m) ?? 0);
        if (n > 0) porMotivo[m] = n;
      }
      const novo: Recusas = {
        desde: typeof v.desde === "string" ? v.desde : quando,
        total: MOTIVOS.reduce((s, m) => s + (porMotivo[m] ?? 0), 0),
        ultimaEm: quando,
        ultimoMotivo: motivo,
        porMotivo,
      };
      await tx`update crm_config set valor = ${tx.json(novo as never)}, atualizado_em = now() where chave = ${CHAVE_RECUSAS}`;
    });
  } catch (e) {
    // Não gravou: devolve o lote à memória para a próxima tentativa.
    for (const [m, n] of lote) acumulado.set(m, (acumulado.get(m) ?? 0) + n);
    console.error(`[crm] recusa do webhook não registrada: ${(e as Error).message.slice(0, 200)}`);
  }
}

export type EstadoRecusas = { total: number; desde: string; ultimaEm: string; ultimoMotivo: MotivoRecusa; porMotivo: { motivo: MotivoRecusa; n: number }[] } | null;

/** Notificações recusadas desde que o registro existe (null se nenhuma). */
export async function estadoRecusas(): Promise<EstadoRecusas> {
  const sql = await db();
  const [r] = await sql<{ valor: Partial<Recusas> }[]>`select valor from crm_config where chave = ${CHAVE_RECUSAS}`;
  const v = r?.valor;
  if (!v || !v.total || typeof v.ultimaEm !== "string" || !v.ultimoMotivo || !MOTIVOS.includes(v.ultimoMotivo)) return null;
  return {
    total: Number(v.total) || 0,
    desde: typeof v.desde === "string" ? v.desde : v.ultimaEm,
    ultimaEm: v.ultimaEm,
    ultimoMotivo: v.ultimoMotivo,
    porMotivo: MOTIVOS.map((m) => ({ motivo: m, n: Number(v.porMotivo?.[m]) || 0 })).filter((x) => x.n > 0),
  };
}

export type EstadoWebhook = {
  total: number;
  ultimoEm: string | null;
  ultimaEntradaEm: string | null;
  ultimoEcoEm: string | null;
  ultimoEstadoEm: string | null;
  semProcessar: number;
  historico: number;
};

/** O que já chegou do provedor, para a tela de Integrações mostrar evidência e não suposição. */
export async function estadoWebhook(): Promise<EstadoWebhook> {
  const sql = await db();
  const [r] = await sql`
    select count(*)::int as total, max(recebido_em) as ultimo,
      max(recebido_em) filter (where tipo = 'whatsapp.inbound_message.received') as entrada,
      max(recebido_em) filter (where tipo in ('whatsapp.smb.message.echoes', 'whatsapp.smb.message.created')) as eco,
      max(recebido_em) filter (where tipo = 'whatsapp.message.updated') as estado,
      count(*) filter (where processado_em is null)::int as pendentes,
      count(*) filter (where tipo = 'whatsapp.smb.history')::int as historico
    from crm_webhook_eventos where provedor = 'ycloud'`;
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  return { total: r.total, ultimoEm: iso(r.ultimo), ultimaEntradaEm: iso(r.entrada), ultimoEcoEm: iso(r.eco), ultimoEstadoEm: iso(r.estado), semProcessar: r.pendentes, historico: r.historico };
}
