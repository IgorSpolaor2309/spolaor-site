import type { LeadConnector } from "../types";
import { emailConnector } from "./email";

// Grava cada lead no CRM (/leads), no Postgres do site (DATABASE_URL). É a fonte de verdade dos contatos:
// o mesmo id de lead nunca é gravado duas vezes e o histórico não depende do aviso por e-mail.
export const crmConnector: LeadConnector = {
  id: "crm",
  persistent: true,
  isConfigured: () => !!process.env.DATABASE_URL,
  async send(lead) {
    const { registrarEnvio } = await import("@/lib/crm/entrada");
    await registrarEnvio(lead, emailConnector.isConfigured());
  },
};
