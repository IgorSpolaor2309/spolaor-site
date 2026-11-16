import { NextResponse } from "next/server";
import { waEnv } from "@/lib/crm/whatsapp/config";
import { receberEvento } from "@/lib/crm/whatsapp/webhook";
import { assinaturaValida, type EventoYCloud } from "@/lib/crm/whatsapp/ycloud";

// Webhook da YCloud (WhatsApp). Endereço a cadastrar no painel da YCloud:
//   https://www.spolaortecnologia.com.br/api/leads/webhooks/ycloud
// Eventos: whatsapp.inbound_message.received, whatsapp.message.updated, whatsapp.smb.message.echoes,
// whatsapp.smb.message.created, whatsapp.template.reviewed, whatsapp.template.category_updated,
// whatsapp.phone_number.quality_updated, whatsapp.business_account.updated, whatsapp.business_account.deleted.
//
// Só aceita notificação com assinatura válida (YCloud-Signature, HMAC do corpo cru com YCLOUD_WEBHOOK_SECRET).
// Responde 200 assim que o evento está gravado: mesmo que o processamento falhe, ele não se perde (a rotina o
// processa de novo) e a YCloud não precisa repetir. Só responde erro quando não conseguiu gravar.
export async function POST(req: Request) {
  if (!waEnv.webhookSecret()) return NextResponse.json({ ok: false, error: "nao_configurado" }, { status: 503 });
  const cru = await req.text();
  if (!assinaturaValida(cru, req.headers.get("ycloud-signature"))) return NextResponse.json({ ok: false }, { status: 401 });
  let ev: EventoYCloud;
  try {
    ev = JSON.parse(cru) as EventoYCloud;
  } catch {
    return NextResponse.json({ ok: false, error: "corpo_invalido" }, { status: 400 });
  }
  try {
    const r = await receberEvento(ev);
    if (!r.gravado && r.resultado !== "evento sem id ou tipo") return NextResponse.json({ ok: false }, { status: 503 });
    // Só o tipo e o desfecho vão para o log privado; nada do conteúdo da mensagem.
    console.info(`[crm] webhook ycloud ${String(ev.type).slice(0, 60)}: ${r.resultado}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[crm] webhook ycloud não gravado: ${(e as Error).message}`);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
