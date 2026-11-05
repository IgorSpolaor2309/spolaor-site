import { NextResponse } from "next/server";
import { contratacaoAutorizada } from "@/lib/ia/access";
import { publicStatus } from "@/lib/ia/public-status";
import { reconcileWithMp, refreshFromZm } from "@/lib/ia/process";
import { store } from "@/lib/ia/store";

// Andamento da contratação para a página de acompanhamento. O retorno do checkout não confirma nada:
// enquanto o pagamento não foi confirmado, a página confere direto no Mercado Pago (no máximo a cada
// 30 s, com as mesmas regras idempotentes das notificações), para não depender só do webhook. Com o
// acesso liberado, relê o cliente no ZappMillion no máximo a cada minuto (conexão do WhatsApp).
export async function GET(req: Request) {
  const u = new URL(req.url);
  let c = await contratacaoAutorizada(u.searchParams.get("c"), u.searchParams.get("t"));
  if (!c) return NextResponse.json({ ok: false }, { status: 404 });
  const idle = Date.now() - new Date(c.atualizadoEm).getTime();
  if (!c.primeiroPagamentoEm && c.mpPreapprovalId && (c.etapa === "aguardando_pagamento" || c.etapa === "assinatura_autorizada") && idle > 30_000) {
    await reconcileWithMp(c).catch((e) => console.warn(`[atendimento-ia] conferência pelo acompanhamento falhou: ${(e as Error).message}`));
    c = (await store().get(c.id)) ?? c;
  } else if (c.zmStatus === "ACTIVE" && c.whatsappStatus !== "CONNECTED" && idle > 60_000) {
    c = (await refreshFromZm(c).catch(() => null)) ?? c;
  }
  const painelUrl = (process.env.IA_PAINEL_URL ?? "").trim() || null;
  return NextResponse.json({ ok: true, status: publicStatus(c), painelUrl }, { headers: { "cache-control": "no-store" } });
}
