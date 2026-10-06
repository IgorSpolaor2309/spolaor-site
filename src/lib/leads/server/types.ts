import type { LeadPayload } from "../schema";

/** Lead já validado e normalizado, pronto para ser entregue aos conectores. */
export type LeadRecord = LeadPayload & {
  id: string;
  createdAt: string;
  userAgent?: string;
};

/**
 * Um destino de leads (banco, CRM, n8n, Make, e-mail...).
 *
 * - `persistent: true`  → é a fonte de verdade (ex.: banco). O envio só é confirmado ao
 *   visitante se TODOS os conectores persistentes funcionarem.
 * - `persistent: false` → notificações e automações. Rodam depois da resposta; uma falha
 *   é registrada, mas não perde o lead.
 */
export interface LeadConnector {
  id: string;
  persistent: boolean;
  /** true quando as variáveis de ambiente necessárias existem */
  isConfigured(): boolean;
  send(lead: LeadRecord): Promise<void>;
}
