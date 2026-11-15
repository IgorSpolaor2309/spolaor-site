import type { LeadConnector } from "../types";
import { crmConnector } from "./crm";
import { emailConnector } from "./email";

/**
 * Destinos de leads.
 *
 * - `crm`: grava no banco do site e alimenta /leads (fonte de verdade quando há DATABASE_URL).
 * - `email`: aviso de cada lead pelo Resend.
 *
 * A ordem e a regra de sucesso estão em ../pipeline.ts. Para ligar outro destino (n8n, Make...), crie um
 * arquivo nesta pasta implementando `LeadConnector` com `persistent: false` e adicione-o a esta lista
 * (veja README.md ao lado). Os formulários e a API não precisam mudar.
 */
export const connectors: LeadConnector[] = [crmConnector, emailConnector];
