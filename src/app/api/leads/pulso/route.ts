import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/crm/auth";
import { pulso } from "@/lib/crm/consultas";

// Carimbo do estado do CRM para a atualização automática das telas (components/crm/atualizador.tsx).
// Rota privada: sem sessão responde 401. Devolve só o carimbo, nenhum dado de contato.
export async function GET() {
  const usuario = await usuarioAtual().catch(() => null);
  if (!usuario) return NextResponse.json({ ok: false }, { status: 401, headers: { "cache-control": "no-store" } });
  try {
    return NextResponse.json({ ok: true, pulso: await pulso() }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
