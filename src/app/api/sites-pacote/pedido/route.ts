import { after, NextResponse } from "next/server";
import { sitesReadiness } from "@/lib/sites/config";
import { MpError } from "@/lib/sites/mercadopago";
import { avisoPedidoNovo, estadoPublico, iniciarPedido, pagarPix, PedidoErro } from "@/lib/sites/process";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/;
const CHAVE = /^[A-Za-z0-9-]{16,64}$/;

// Cria o pedido do pacote de sites (venda avulsa). O valor nunca vem do navegador: a condição é um id da tabela
// aprovada (lib/sites/oferta.ts). Para Pix, já gera o QR Code; para cartão, o pagamento é feito na página do pedido.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "requisicao_invalida" }, { status: 400 });
  }
  if (!sitesReadiness().ready) return NextResponse.json({ ok: false, error: "contratacao_indisponivel" }, { status: 503 });
  if (body.website) return NextResponse.json({ ok: false, error: "requisicao_invalida" }, { status: 400 });

  const dados = {
    nome: str(body.nome, 120),
    email: str(body.email, 160).toLowerCase(),
    whatsapp: str(body.whatsapp, 30),
    condicao: str(body.condicao, 20),
  };
  const errors: Record<string, string> = {};
  if (dados.nome.length < 2) errors.nome = "Informe o seu nome.";
  if (!EMAIL.test(dados.email)) errors.email = "Informe um e-mail válido.";
  const dig = dados.whatsapp.replace(/\D/g, "");
  if (dig.length < 10 || dig.length > 13) errors.whatsapp = "Informe o WhatsApp com DDD.";
  if (!dados.condicao) errors.condicao = "Escolha a forma de pagamento.";
  if (body.aceite !== true) errors.aceite = "É preciso concordar com as condições do pacote para continuar.";
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const utm =
    body.utm && typeof body.utm === "object"
      ? Object.fromEntries(Object.entries(body.utm as Record<string, unknown>).slice(0, 10).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)]))
      : {};
  const chavePedido = typeof body.chavePedido === "string" && CHAVE.test(body.chavePedido) ? body.chavePedido : null;
  try {
    const r = await iniciarPedido({ ...dados, chavePedido, utm });
    let pedido = r.pedido;
    // aviso interno de pedido novo depois da resposta (não atrasa o comprador; não sai se já estiver pago)
    if (r.novo) after(() => avisoPedidoNovo(pedido.id));
    if (pedido.meio === "pix") pedido = await pagarPix(pedido);
    return NextResponse.json({ ok: true, id: pedido.id, token: r.token, pedido: estadoPublico(pedido), acompanhar: `/sites/pacote/pedido?p=${pedido.id}&t=${r.token}` });
  } catch (e) {
    if (e instanceof PedidoErro) return NextResponse.json({ ok: false, error: e.codigo, message: e.mensagem }, { status: e.http });
    console.error("[sites-pacote] falha ao criar o pedido:", e instanceof MpError ? e.message : (e as Error).message);
    return NextResponse.json({ ok: false, error: "falha_pedido" }, { status: 502 });
  }
}
