import { sitesOperacional } from "./config";
import { MpError } from "./mercadopago";
import { sincronizarPagamento } from "./process";
import { sitesStore } from "./store";

/**
 * Notificação "order" do Mercado Pago (tópico "Order (Mercado Pago)") já com a assinatura x-signature validada por
 * quem chamou. Ignora entregas repetidas, relê a order no Mercado Pago e aplica ao pedido de site dela; orders de
 * outra origem são ignoradas. Usada pela rota própria e pela rota de Webhooks da aplicação (a mesma da IA), que
 * só repassa este tipo. O corpo da notificação nunca é prova de pagamento.
 */
export async function processarNotificacaoOrdem(dataId: string | null, requestId: string): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!dataId) return { status: 200, body: { ok: true, ignored: "sem data.id" } };
  // só precisa do token: um pedido pendente continua sendo confirmado mesmo se a contratação for fechada depois
  if (!sitesOperacional()) return { status: 503, body: { ok: false } };
  const s = sitesStore();
  const key = `order:${dataId}:${requestId}`;
  if (!(await s.markEvent(key))) return { status: 200, body: { ok: true, duplicate: true } };
  try {
    return { status: 200, body: { ok: true, result: await sincronizarPagamento(dataId, "webhook") } };
  } catch (e) {
    // order inexistente (ex.: notificação simulada pelo painel com um id inventado): 200, sem novas tentativas.
    // O Mercado Pago responde 404 (order_not_found) ou, para id em formato inválido, 400 (invalid_path_param).
    if (e instanceof MpError && (e.status === 404 || (e.status === 400 && e.causes.includes("invalid_path_param"))))
      return { status: 200, body: { ok: true, ignored: "recurso inexistente no Mercado Pago" } };
    await s.unmarkEvent(key);
    console.error(`[sites-pacote] falha ao processar order ${dataId}:`, (e as Error).message);
    return { status: 500, body: { ok: false } };
  }
}
