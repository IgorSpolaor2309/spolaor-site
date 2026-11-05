import { NextResponse } from "next/server";
import { iaConfig } from "@/lib/ia/config";
import { bearerOk } from "@/lib/ia/access";
import { store } from "@/lib/ia/store";
import { provision, syncPreapproval } from "@/lib/ia/process";
import { zm } from "@/lib/ia/zappmillion";

// Ações da operação (Authorization: Bearer IA_ADMIN_TOKEN):
//   { "acao": "listar" }                                → contratações e etapas
//   { "acao": "retentar", "id": "<contratação>" }        → nova tentativa segura de criar o acesso
//   { "acao": "sincronizar", "id": "..." }               → relê a assinatura no Mercado Pago
//   { "acao": "reenviar-convite", "id": "..." }          → novo e-mail de acesso (ZappMillion)
export async function POST(req: Request) {
  if (!bearerOk(req, iaConfig.adminToken())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { acao?: string; id?: string };
  const s = store();
  if (body.acao === "listar") {
    const all = await s.list({});
    return NextResponse.json({
      ok: true,
      contratacoes: all.map((c) => ({ id: c.id, empresa: c.empresa, etapa: c.etapa, mpStatus: c.mpStatus, zmStatus: c.zmStatus, pagoAte: c.pagoAte, whatsapp: c.whatsappStatus, ultimoErro: c.ultimoErro })),
    });
  }
  const c = body.id ? await s.get(body.id) : null;
  if (!c) return NextResponse.json({ ok: false, error: "nao_encontrada" }, { status: 404 });
  switch (body.acao) {
    case "retentar":
      return NextResponse.json({ ok: true, result: await provision({ ...c, tentativas: c.tentativas }) });
    case "sincronizar":
      return NextResponse.json({ ok: true, result: c.mpPreapprovalId ? await syncPreapproval(c.mpPreapprovalId) : "sem assinatura" });
    case "reenviar-convite":
      if (c.zmStatus !== "ACTIVE") return NextResponse.json({ ok: false, error: "acesso_nao_criado" }, { status: 409 });
      await zm.resendInvite(c.externalId);
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ ok: false, error: "acao_desconhecida" }, { status: 400 });
  }
}
