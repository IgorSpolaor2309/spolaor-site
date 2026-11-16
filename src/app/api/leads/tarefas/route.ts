import { NextResponse } from "next/server";
import { bearerOk } from "@/lib/ia/access";
import { iaConfig } from "@/lib/ia/config";
import { crmConfigured } from "@/lib/crm/db";
import { processarTarefa } from "@/lib/crm/tarefas";

// Execução de uma tarefa de primeiro contato, chamada pelo QStash logo depois que o lead é gravado
// (Authorization: Bearer CRON_SECRET, encaminhado pelo QStash). Responder 200 encerra as novas tentativas do
// QStash; a tarefa em si é idempotente (reserva no banco), então uma chamada repetida não envia duas vezes.
export async function POST(req: Request) {
  if (!bearerOk(req, iaConfig.cronSecret())) return NextResponse.json({ ok: false }, { status: 401 });
  if (!crmConfigured()) return NextResponse.json({ ok: true, skipped: "sem banco" });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id)) return NextResponse.json({ ok: false, error: "id_invalido" }, { status: 400 });
  const resultado = await processarTarefa(body.id);
  // O detalhe fica só no log privado; a resposta não leva dados de contato.
  console.info(`[crm] tarefa ${body.id.slice(0, 8)}: ${resultado}`);
  return NextResponse.json({ ok: true });
}
