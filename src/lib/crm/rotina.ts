import { rotinaAvisos } from "./aviso";
import { crmConfigured } from "./db";
import { rotinaMensagens } from "./mensagens";
import { rotinaTarefas } from "./tarefas";
import { rotinaWebhooks } from "./whatsapp/webhook";

/**
 * Rotina periódica do CRM (chamada pela rotina já agendada do site, /api/atendimento-ia/cron): tenta de novo
 * os avisos de lead e as mensagens que falharam ou ficaram pendentes, recupera tarefas de primeiro contato que não
 * foram acionadas e reprocessa notificações do provedor de WhatsApp que ficaram sem processar. Nunca lança erro.
 */
export async function rotinaCrm(): Promise<string[]> {
  if (!crmConfigured()) return [];
  try {
    return [...(await rotinaAvisos()), ...(await rotinaTarefas()), ...(await rotinaMensagens()), ...(await rotinaWebhooks())];
  } catch (e) {
    console.error("[crm] rotina falhou:", (e as Error).message);
    return [`crm: erro (${(e as Error).message.slice(0, 120)})`];
  }
}
