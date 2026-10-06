import type { LeadConnector } from "../types";

// Só para desenvolvimento local: mostra o lead no terminal. Nunca ativo em produção.
export const devConsoleConnector: LeadConnector = {
  id: "dev-console",
  persistent: true,
  isConfigured: () => process.env.NODE_ENV !== "production",
  async send(lead) {
    console.info("[lead] (dev, nenhum destino configurado)", JSON.stringify(lead, null, 2));
  },
};
