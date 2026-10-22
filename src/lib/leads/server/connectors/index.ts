import type { LeadConnector } from "../types";
import { emailConnector } from "./email";

/**
 * Conectores de leads ativos.
 *
 * Nenhum destino externo foi escolhido ainda. Para ligar Supabase, CRM, n8n, Make ou e-mail,
 * crie um arquivo nesta pasta implementando `LeadConnector` e adicione-o a esta lista
 * (veja README.md ao lado). Os formulários e a API não precisam mudar.
 */
export const connectors: LeadConnector[] = [emailConnector];
