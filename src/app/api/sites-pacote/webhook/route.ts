import { NextResponse } from "next/server";
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";
import { sitesConfig, sitesOperacional } from "@/lib/sites/config";
import { MpError } from "@/lib/sites/mercadopago";
import { sincronizarPagamento } from "@/lib/sites/process";
import { sitesStore } from "@/lib/sites/store";

// Notificações do Mercado Pago dos pagamentos do pacote de sites (notification_url de cada pagamento). Mesmo
// protocolo da rota da IA: (1) valida x-signature com o validador oficial; (2) ignora entregas repetidas;
// (3) relê o pagamento no Mercado Pago. O corpo nunca é prova de pagamento. Pagamentos de outra oferta são ignorados.
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

  // só precisa do segredo e do token: um pedido pendente continua sendo confirmado mesmo se a contratação for fechada depois
  if (!sitesConfig.mpWebhookSecret() || !sitesOperacional()) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers.get("x-signature") ?? undefined,
      xRequestId: requestId || undefined,
      dataId: dataId ? dataId.toLowerCase() : undefined,
      secret: sitesConfig.mpWebhookSecret(),
      toleranceSeconds: 300,
    });
  } catch (e) {
    const reason = e instanceof InvalidWebhookSignatureError ? e.reason : "erro";
    console.warn(`[sites-pacote] notificação recusada (${reason}) request-id=${requestId}`);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!dataId || type !== "payment") return NextResponse.json({ ok: true, ignored: dataId ? `tipo ${type}` : "sem data.id" });

  const s = sitesStore();
  const key = `${type}:${dataId}:${requestId}`;
  if (!(await s.markEvent(key))) return NextResponse.json({ ok: true, duplicate: true });
  try {
    return NextResponse.json({ ok: true, result: await sincronizarPagamento(dataId, "webhook") });
  } catch (e) {
    if (e instanceof MpError && e.status === 404) return NextResponse.json({ ok: true, ignored: "recurso inexistente no Mercado Pago" });
    await s.unmarkEvent(key);
    console.error(`[sites-pacote] falha ao processar payment ${dataId}:`, (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
