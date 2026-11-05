import { NextResponse } from "next/server";
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { iaConfig } from "@/lib/ia/config";
import { store } from "@/lib/ia/store";
import { syncAuthorizedPayment, syncChargeback, syncPayment, syncPreapproval } from "@/lib/ia/process";

// Notificações do Mercado Pago (Webhooks). Ordem: (1) valida a assinatura x-signature com o
// validador oficial do SDK (HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;",
// tolerância de 5 minutos); (2) ignora entregas repetidas; (3) relê o recurso no Mercado Pago
// e aplica o estado atual. O corpo da notificação nunca é tratado como prova de pagamento.
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

  if (!iaConfig.mpWebhookSecret()) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers.get("x-signature") ?? undefined,
      xRequestId: requestId || undefined,
      dataId: dataId ?? undefined,
      secret: iaConfig.mpWebhookSecret(),
      toleranceSeconds: 300,
    });
  } catch (e) {
    const reason = e instanceof InvalidWebhookSignatureError ? e.reason : "erro";
    console.warn(`[atendimento-ia] notificação recusada (${reason}) request-id=${requestId}`);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!dataId) return NextResponse.json({ ok: true, ignored: "sem data.id" });

  const s = store();
  const key = `${type}:${dataId}:${requestId}`;
  if (!(await s.markEvent(key))) return NextResponse.json({ ok: true, duplicate: true });
  try {
    let result: unknown;
    if (type === "subscription_preapproval") result = await syncPreapproval(dataId);
    else if (type === "subscription_authorized_payment") result = await syncAuthorizedPayment(dataId);
    else if (type === "payment") result = await syncPayment(dataId);
    else if (type === "topic_chargebacks_wh" || type === "chargebacks") result = await syncChargeback(dataId);
    else result = { ignored: `tipo ${type}` };
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    // Libera a chave para que a nova tentativa do Mercado Pago seja processada.
    await s.unmarkEvent(key);
    console.error(`[atendimento-ia] falha ao processar ${type} ${dataId}:`, (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
