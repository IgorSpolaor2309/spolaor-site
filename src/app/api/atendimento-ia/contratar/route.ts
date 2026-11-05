import { NextResponse } from "next/server";
import { readiness, validationOk } from "@/lib/ia/config";
import { startContratacao } from "@/lib/ia/process";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/;

// Inicia a contratação: grava os dados, cria a assinatura no Mercado Pago com o preço definido
// pelo servidor e devolve o link do checkout hospedado. Nada é liberado aqui.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "requisicao_invalida" }, { status: 400 });
  }
  const validation = validationOk(body.acesso);
  if (!readiness({ validation }).ready) return NextResponse.json({ ok: false, error: "contratacao_indisponivel" }, { status: 503 });
  if (body.website) return NextResponse.json({ ok: false, error: "requisicao_invalida" }, { status: 400 });

  const data = {
    empresa: str(body.empresa, 120),
    responsavel: str(body.responsavel, 120),
    email: str(body.email, 160).toLowerCase(),
    telefone: str(body.telefone, 30),
    segmento: str(body.segmento, 80) || undefined,
  };
  const errors: Record<string, string> = {};
  if (data.empresa.length < 2) errors.empresa = "Informe o nome da empresa.";
  if (data.responsavel.length < 2) errors.responsavel = "Informe o nome do responsável.";
  if (!EMAIL.test(data.email)) errors.email = "Informe um e-mail válido. O acesso será enviado para ele.";
  if (data.telefone.replace(/\D/g, "").length < 10) errors.telefone = "Informe o telefone com DDD.";
  if (body.aceite !== true) errors.aceite = "É preciso aceitar as condições para continuar.";
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const utm =
    body.utm && typeof body.utm === "object"
      ? Object.fromEntries(Object.entries(body.utm as Record<string, unknown>).slice(0, 10).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)]))
      : {};
  try {
    const r = await startContratacao({ ...data, utm: validation ? { ...utm, validacao: "interna" } : utm });
    return NextResponse.json({ ok: true, id: r.id, checkoutUrl: r.checkoutUrl, acompanhar: `/atendimento-ia/acompanhar?c=${r.id}&t=${r.token}` });
  } catch (e) {
    console.error("[atendimento-ia] falha ao iniciar a contratação:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "falha_checkout" }, { status: 502 });
  }
}
