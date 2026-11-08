import { after, NextResponse } from "next/server";
import { processarAvisoCadastro } from "@/lib/ia/aviso-cadastro";
import { readiness, validationOk } from "@/lib/ia/config";
import { PedidoError, startContratacao } from "@/lib/ia/process";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/;
const CHAVE = /^[A-Za-z0-9-]{16,64}$/;

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

  // O checkout pede só o nome completo: é o nome do cliente no ZappMillion ("Nome do cliente", campo
  // obrigatório que vira o nome da organização) e nos avisos da operação. Nada é preenchido com valor fictício.
  const responsavel = str(body.responsavel, 120);
  const data = {
    empresa: str(body.empresa, 120) || responsavel,
    responsavel,
    email: str(body.email, 160).toLowerCase(),
    telefone: str(body.telefone, 30),
    segmento: str(body.segmento, 80) || undefined,
  };
  const errors: Record<string, string> = {};
  if (data.responsavel.length < 2) errors.responsavel = "Informe o seu nome completo.";
  if (!EMAIL.test(data.email)) errors.email = "Informe um e-mail válido. O acesso será enviado para ele.";
  if (data.telefone.replace(/\D/g, "").length < 10) errors.telefone = "Informe o WhatsApp com DDD.";
  if (body.aceite !== true) errors.aceite = "É preciso aceitar as condições para continuar.";
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const utm =
    body.utm && typeof body.utm === "object"
      ? Object.fromEntries(Object.entries(body.utm as Record<string, unknown>).slice(0, 10).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)]))
      : {};
  try {
    const chavePedido = typeof body.chavePedido === "string" && CHAVE.test(body.chavePedido) ? body.chavePedido : null;
    const r = await startContratacao({ ...data, chavePedido, utm: validation ? { ...utm, validacao: "interna" } : utm });
    // Aviso interno só para contratação nova (o token só existe na criação); roda depois da resposta e nunca
    // atrasa nem bloqueia o encaminhamento ao pagamento. A rotina repete se falhar.
    if (r.token) after(() => processarAvisoCadastro(r.id));
    return NextResponse.json({ ok: true, id: r.id, checkoutUrl: r.checkoutUrl, acompanhar: r.token ? `/atendimento-ia/acompanhar?c=${r.id}&t=${r.token}` : null });
  } catch (e) {
    if (e instanceof PedidoError) return NextResponse.json({ ok: false, error: e.codigo }, { status: 409 });
    console.error("[atendimento-ia] falha ao iniciar a contratação:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "falha_checkout" }, { status: 502 });
  }
}
