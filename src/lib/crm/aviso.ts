import type { LeadRecord } from "@/lib/leads/server/types";
import { emailConnector, sendLeadEmail } from "@/lib/leads/server/connectors/email";
import { site } from "@/lib/site";
import { db } from "./db";
import { registrarEvento } from "./entrada";

// Aviso interno de cada envio de formulário (o mesmo e-mail "Novo lead" de antes), agora com estado no banco:
// pendente → enviando → enviado | falhou. Uma falha do provedor não perde o contato (ele já está gravado) e é
// tentada de novo pela rotina. "enviado" = o provedor aceitou; não comprova chegada à caixa de entrada.

export const AVISO_MAX_TENTATIVAS = 6;

export const avisoConfigurado = () => emailConnector.isConfigured();

const linkFicha = (oportunidadeId: string) => (site.url ? `${site.url}/leads/o/${oportunidadeId}` : undefined);

/**
 * Tenta enviar o aviso de um envio. Reserva antes (uma instância por vez) e nunca lança erro.
 * `forcar` zera o limite de tentativas (botão "Tentar de novo" na ficha).
 */
export async function enviarAviso(envioId: string, forcar = false): Promise<"enviado" | "falhou" | "ignorado"> {
  if (!avisoConfigurado()) return "ignorado";
  const sql = await db();
  const [row] = await sql<{ payload: LeadRecord; oportunidade_id: string }[]>`
    update crm_envios set aviso_status = 'enviando', aviso_tentativas = aviso_tentativas + 1, aviso_tentado_em = now()
    where id = ${envioId}
      and (aviso_status in ('pendente', 'falhou') or (aviso_status = 'enviando' and aviso_tentado_em < now() - interval '10 minutes'))
      and (${forcar} or aviso_tentativas < ${AVISO_MAX_TENTATIVAS})
    returning payload, oportunidade_id`;
  if (!row) return "ignorado";
  try {
    await sendLeadEmail(row.payload, { crmUrl: linkFicha(row.oportunidade_id), idempotencyKey: `lead-aviso-${envioId}` });
    await sql`update crm_envios set aviso_status = 'enviado', aviso_enviado_em = now(), aviso_erro = null where id = ${envioId}`;
    return "enviado";
  } catch (e) {
    const erro = (e as Error).message.slice(0, 300);
    console.error(`[crm] aviso do envio ${envioId} falhou: ${erro}`);
    await sql.begin(async (tx) => {
      const [u] = await tx<{ aviso_tentativas: number }[]>`
        update crm_envios set aviso_status = 'falhou', aviso_erro = ${erro} where id = ${envioId} returning aviso_tentativas`;
      // Um registro no histórico na primeira falha (as novas tentativas não repetem a linha).
      if (u?.aviso_tentativas === 1) await registrarEvento(tx, { oportunidadeId: row.oportunidade_id, tipo: "aviso_falhou", texto: `O aviso por e-mail deste contato falhou: ${erro}` });
    });
    return "falhou";
  }
}

/** Rotina: avisos pendentes há mais de 2 minutos, falhos ou travados, dentro do limite de tentativas. */
export async function rotinaAvisos(): Promise<string[]> {
  if (!avisoConfigurado()) return [];
  const sql = await db();
  const rows = await sql<{ id: string }[]>`
    select id from crm_envios
    where aviso_tentativas < ${AVISO_MAX_TENTATIVAS}
      and (aviso_status = 'falhou'
        or (aviso_status = 'pendente' and recebido_em < now() - interval '2 minutes')
        or (aviso_status = 'enviando' and aviso_tentado_em < now() - interval '10 minutes'))
    order by recebido_em limit 20`;
  const out: string[] = [];
  for (const r of rows) out.push(`aviso ${r.id.slice(0, 8)}: ${await enviarAviso(r.id)}`);
  return out;
}
