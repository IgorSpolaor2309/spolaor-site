import { after } from "next/server";
import { connectors } from "./connectors";
import { crmConnector } from "./connectors/crm";
import { devConsoleConnector } from "./connectors/dev-console";
import { emailConnector, sendLeadEmail } from "./connectors/email";
import type { LeadRecord } from "./types";

export class NoLeadDestinationError extends Error {
  constructor() {
    super("Nenhum destino de leads configurado.");
  }
}

/**
 * Há para onde mandar o lead? Lido no build das páginas (são estáticas): os formulários avisam e
 * não deixam enviar enquanto for false. Depois de ligar um conector na Vercel, faça Redeploy.
 */
export function leadsAvailable() {
  return connectors.some((c) => c.persistent && c.isConfigured()) || devConsoleConnector.isConfigured();
}

/**
 * Registra o lead. O visitante só vê sucesso se o lead ficou guardado em pelo menos um lugar durável:
 *
 * 1. CRM (banco), quando configurado: é a fonte de verdade. Gravado, o lead está aceito; o aviso por e-mail
 *    sai em seguida com estado próprio (src/lib/crm/aviso.ts) e, se falhar, é tentado de novo pela rotina,
 *    sem perder o contato nem trocar o sucesso por erro.
 * 2. Se o banco não responder (ou não existir), vale a regra anterior: o e-mail é o registro e precisa ser
 *    aceito pelo provedor, senão o envio falha. Nesse caso o e-mail avisa que o contato não entrou no CRM.
 *
 * Os demais conectores (não persistentes) rodam depois da resposta, como antes.
 */
export async function processLead(lead: LeadRecord) {
  const crm = crmConnector.isConfigured();
  const email = emailConnector.isConfigured();
  if (!crm && !email) {
    if (!devConsoleConnector.isConfigured()) throw new NoLeadDestinationError();
    await devConsoleConnector.send(lead);
  }

  let gravado = false;
  let tarefaId: string | null = null;
  if (crm) {
    try {
      const { registrarEnvio } = await import("@/lib/crm/entrada");
      tarefaId = (await registrarEnvio(lead, email)).tarefaId;
      gravado = true;
    } catch (err) {
      console.error("[lead] CRM não gravou o lead", lead.id, (err as Error).message);
      if (!email) throw err;
    }
  }
  if (email) {
    if (gravado) {
      const { enviarAviso } = await import("@/lib/crm/aviso");
      await enviarAviso(lead.id).catch((e) => console.error("[lead] aviso por e-mail falhou", lead.id, (e as Error).message));
    } else {
      await sendLeadEmail(lead, { semCrm: crm });
    }
  }
  if (tarefaId) {
    // A tarefa de primeiro contato já está gravada com o lead (mesma transação). Aqui ela só é acionada logo depois
    // da resposta ao visitante: publicada no QStash ou, sem ele, executada ali mesmo. Se isto falhar, a rotina a
    // encontra pendente no banco.
    const id = tarefaId;
    after(async () => {
      try {
        const { despacharTarefa } = await import("@/lib/crm/tarefas");
        await despacharTarefa(id);
      } catch (e) {
        console.error("[lead] tarefa de primeiro contato não acionada agora", lead.id, (e as Error).message);
      }
    });
  }

  const background = connectors.filter((c) => !c.persistent && c.isConfigured());
  if (background.length) {
    after(async () => {
      const results = await Promise.allSettled(background.map((c) => c.send(lead)));
      results.forEach((r, i) => {
        if (r.status === "rejected") console.error(`[lead] conector ${background[i].id} falhou`, lead.id, r.reason);
      });
    });
  }
}
