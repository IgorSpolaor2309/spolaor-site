import { NextResponse } from "next/server";
import { sitesReadiness } from "@/lib/sites/config";
import { MpError } from "@/lib/sites/mercadopago";
import { estadoPublico, pagarCartao, pedidoComToken, PedidoErro } from "@/lib/sites/process";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Pagamento com cartão: recebe só o token de uso único gerado pelo formulário seguro do Mercado Pago e os dados
// que o próprio formulário devolve (bandeira, emissor, parcelas). Valor e parcelas cobrados saem do pedido.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "requisicao_invalida" }, { status: 400 });
  }
  if (!sitesReadiness().ready) return NextResponse.json({ ok: false, error: "contratacao_indisponivel" }, { status: 503 });
  const p = await pedidoComToken(body.id, body.t);
  if (!p) return NextResponse.json({ ok: false, error: "pedido_nao_encontrado" }, { status: 404 });
  const f = (body.formData && typeof body.formData === "object" ? body.formData : {}) as Record<string, unknown>;
  const payer = (f.payer && typeof f.payer === "object" ? f.payer : {}) as Record<string, unknown>;
  const ident = (payer.identification && typeof payer.identification === "object" ? payer.identification : null) as Record<string, unknown> | null;
  const dados = {
    token: str(f.token, 200),
    paymentMethodId: str(f.payment_method_id, 30),
    issuerId: f.issuer_id != null && String(f.issuer_id).trim() ? String(f.issuer_id).trim().slice(0, 20) : null,
    installments: Number(f.installments),
    payer: {
      email: str(payer.email, 160).toLowerCase(),
      ...(ident && str(ident.type, 10) && str(ident.number, 30) ? { identification: { type: str(ident.type, 10), number: str(ident.number, 30).replace(/\D/g, "") } } : {}),
    },
  };
  if (!dados.token || !dados.paymentMethodId || !Number.isInteger(dados.installments)) return NextResponse.json({ ok: false, error: "cartao_invalido" }, { status: 422 });
  try {
    const r = await pagarCartao(p, dados);
    return NextResponse.json({ ok: true, pedido: estadoPublico(r) });
  } catch (e) {
    if (e instanceof PedidoErro) return NextResponse.json({ ok: false, error: e.codigo, message: e.mensagem }, { status: e.http });
    if (e instanceof MpError && e.status >= 400 && e.status < 500) {
      console.warn("[sites-pacote] cartão recusado na criação:", e.message);
      return NextResponse.json(
        { ok: false, error: "cartao_recusado", message: "O Mercado Pago não aceitou os dados do cartão. Nada foi cobrado. Confira os dados e tente de novo." },
        { status: 422 },
      );
    }
    console.error("[sites-pacote] falha no pagamento com cartão:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "falha_pagamento" }, { status: 502 });
  }
}
