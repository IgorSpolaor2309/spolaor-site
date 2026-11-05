import { NextResponse } from "next/server";
import { contratacaoAutorizada } from "@/lib/ia/access";
import { publicStatus } from "@/lib/ia/public-status";
import { refreshFromZm } from "@/lib/ia/process";

// Andamento da contratação para a página de acompanhamento. Só lê o que já foi confirmado (o
// retorno do checkout não altera nada aqui). Com o acesso liberado, relê o cliente no ZappMillion
// no máximo a cada minuto, para mostrar a conexão do WhatsApp sem esperar o cron.
export async function GET(req: Request) {
  const u = new URL(req.url);
  let c = await contratacaoAutorizada(u.searchParams.get("c"), u.searchParams.get("t"));
  if (!c) return NextResponse.json({ ok: false }, { status: 404 });
  if (c.zmStatus === "ACTIVE" && c.whatsappStatus !== "CONNECTED" && Date.now() - new Date(c.atualizadoEm).getTime() > 60_000) {
    c = (await refreshFromZm(c).catch(() => null)) ?? c;
  }
  const painelUrl = (process.env.IA_PAINEL_URL ?? "").trim() || null;
  return NextResponse.json({ ok: true, status: publicStatus(c), painelUrl }, { headers: { "cache-control": "no-store" } });
}
