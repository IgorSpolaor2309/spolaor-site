import { rotinaAvisos } from "./aviso";
import { crmConfigured } from "./db";
import { rotinaMensagens } from "./mensagens";

/**
 * Rotina periódica do CRM (chamada pela rotina já agendada do site, /api/atendimento-ia/cron): tenta de novo
 * os avisos de lead e as mensagens que falharam ou ficaram pendentes. Nunca lança erro.
 */
export async function rotinaCrm(): Promise<string[]> {
  if (!crmConfigured()) return [];
  try {
    return [...(await rotinaAvisos()), ...(await rotinaMensagens())];
  } catch (e) {
    console.error("[crm] rotina falhou:", (e as Error).message);
    return [`crm: erro (${(e as Error).message.slice(0, 120)})`];
  }
}
