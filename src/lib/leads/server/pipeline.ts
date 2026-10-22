import { after } from "next/server";
import { connectors } from "./connectors";
import { devConsoleConnector } from "./connectors/dev-console";
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
 * Entrega o lead aos conectores ativos.
 * Persistentes são aguardados (se falharem, o envio falha); os demais rodam após a resposta.
 */
export async function processLead(lead: LeadRecord) {
  let active = connectors.filter((c) => c.isConfigured());
  if (!active.some((c) => c.persistent)) {
    if (!devConsoleConnector.isConfigured()) throw new NoLeadDestinationError();
    active = [devConsoleConnector, ...active];
  }

  await Promise.all(active.filter((c) => c.persistent).map((c) => c.send(lead)));

  const background = active.filter((c) => !c.persistent);
  if (background.length) {
    after(async () => {
      const results = await Promise.allSettled(background.map((c) => c.send(lead)));
      results.forEach((r, i) => {
        if (r.status === "rejected") console.error(`[lead] conector ${background[i].id} falhou`, lead.id, r.reason);
      });
    });
  }
}
