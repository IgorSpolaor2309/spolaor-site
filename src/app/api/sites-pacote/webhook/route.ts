import { NextResponse } from "next/server";
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { sitesConfig } from "@/lib/sites/config";
import { processarNotificacaoOrdem } from "@/lib/sites/notificacao";

// Notificações do Mercado Pago das orders do pacote de sites (tópico "Order (Mercado Pago)"). Em produção o
// Mercado Pago envia para a URL de Webhooks da aplicação (rota da IA), que repassa o tipo "order" para a mesma
// função usada aqui; esta rota serve se a URL do painel apontar para cá. Protocolo: (1) valida x-signature com o
// validador oficial; (2) ignora entregas repetidas; (3) relê a order no Mercado Pago. O corpo nunca é prova de
// pagamento. Orders de outra origem são ignoradas.
export async function POST(req: Request) {
  const url = new URL(req.url);
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await req.json();
  } catch {
    // algumas entregas vêm só com a query string
  }
  const dataId = url.searchParams.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  console.info(`[sites-pacote] notificação recebida type=${type || "?"} data.id=${dataId ?? "?"} request-id=${requestId || "?"}`);

  if (!sitesConfig.mpWebhookSecret()) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers.get("x-signature") ?? undefined,
      xRequestId: requestId || undefined,
      // o Mercado Pago assina o data.id alfanumérico (ORD…) em minúsculas
      dataId: dataId ? dataId.toLowerCase() : undefined,
      secret: sitesConfig.mpWebhookSecret(),
      toleranceSeconds: 300,
    });
  } catch (e) {
    const reason = e instanceof InvalidWebhookSignatureError ? e.reason : "erro";
    console.warn(`[sites-pacote] notificação recusada (${reason}) request-id=${requestId}`);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (type !== "order") return NextResponse.json({ ok: true, ignored: `tipo ${type || "?"}` });
  const r = await processarNotificacaoOrdem(dataId, requestId);
  return NextResponse.json(r.body, { status: r.status });
}
