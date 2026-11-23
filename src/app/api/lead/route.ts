import { NextResponse } from "next/server";
import { AVISO_RETORNO, INTERESSES, LIMITS, PEDIDOS, isFormulario, isOrigem, isPedido, lerPresenca, normalizeUrl, origemFromPath, validateLead, type LeadPayload } from "@/lib/leads/schema";
import { NoLeadDestinationError, processLead } from "@/lib/leads/server/pipeline";
import type { LeadRecord } from "@/lib/leads/server/types";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const strList = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, LIMITS.lista).map((x) => x.slice(0, LIMITS.curto)) : [];

// Recebe os leads de todos os formulários e entrega aos conectores configurados.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "requisicao_invalida" }, { status: 400 });
  }

  // Honeypot anti-spam: campo invisível para pessoas
  if (body.website) return NextResponse.json({ ok: true });

  const pagina = str(body.pagina, LIMITS.url);
  const origem = isOrigem(body.origem) ? body.origem : origemFromPath(pagina);
  const formulario = isFormulario(body.formulario) ? body.formulario : undefined;
  // Serviço escolhido pela pessoa: só no formulário de pedido e só entre as opções existentes.
  const pedido = formulario === "pedido" && isPedido(body.pedido) ? body.pedido : undefined;
  const lead: LeadPayload = {
    tipo: body.tipo === "projeto" ? "projeto" : "analise",
    formulario,
    pedido,
    // A pergunta respondida é a do formulário vigente para o serviço escolhido; o navegador não manda o texto.
    pergunta: pedido ? PEDIDOS[pedido].pergunta : undefined,
    semEmpresa: body.semEmpresa === true,
    // Origem só aceita os valores conhecidos; senão é deduzida da página do envio.
    origem: origem ?? "desconhecida",
    // Interesse (rótulo interno do envio): o serviço que a pessoa escolheu; sem escolha, o da página do formulário.
    // O navegador não escreve esse texto.
    interesse: pedido ? `Pedido: ${PEDIDOS[pedido].rotulo}` : origem ? INTERESSES[origem] : undefined,
    pagina,
    entrada: str(body.entrada, LIMITS.url),
    segmento: str(body.segmento, LIMITS.curto),
    problema: str(body.problema, LIMITS.curto),
    nome: str(body.nome, LIMITS.curto) ?? "",
    empresa: str(body.empresa, LIMITS.curto) ?? "",
    whatsapp: str(body.whatsapp, 40) ?? "",
    email: str(body.email, LIMITS.curto) ?? "",
    site: str(body.site, LIMITS.url),
    semSite: body.semSite === true,
    mensagem: str(body.mensagem, LIMITS.mensagem),
    urgencia: str(body.urgencia, LIMITS.curto),
    melhorias: strList(body.melhorias),
    servicos: strList(body.servicos),
    referrer: str(body.referrer, LIMITS.url),
    utm:
      body.utm && typeof body.utm === "object"
        ? Object.fromEntries(Object.entries(body.utm as Record<string, unknown>).slice(0, 12).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)]))
        : {},
    // Só vale a versão vigente do texto de retorno pelo WhatsApp; qualquer outro valor fica sem registro.
    aviso: body.aviso === AVISO_RETORNO.versao ? AVISO_RETORNO.versao : undefined,
  };

  const errors = validateLead(lead);
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  // "Site ou Instagram": um @usuário ou link do Instagram vira o Instagram do contato; um endereço vira o site; texto que
  // não é nenhum dos dois fica como foi digitado. No diagnóstico de site o endereço já foi validado como site.
  const presenca: ReturnType<typeof lerPresenca> = lead.origem === "diagnostico-site" && lead.site ? { site: normalizeUrl(lead.site) } : lerPresenca(lead.site);
  const record: LeadRecord = {
    ...lead,
    site: presenca.site ?? presenca.texto,
    instagram: presenca.instagram,
    // Quem marcou "ainda não tenho site nem Instagram" e mesmo assim digitou algo: vale o que foi digitado.
    semSite: lead.semSite && !lead.site?.trim() ? true : undefined,
    semEmpresa: lead.semEmpresa && !lead.empresa.trim() ? true : undefined,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? undefined,
  };

  let medir = true;
  try {
    medir = (await processLead(record)).medir;
  } catch (err) {
    if (err instanceof NoLeadDestinationError) {
      console.error("[lead] recebido sem destino configurado; nada foi salvo");
      return NextResponse.json({ ok: false, error: "destino_nao_configurado" }, { status: 503 });
    }
    console.error("[lead] falha ao registrar", err);
    return NextResponse.json({ ok: false, error: "falha_ao_registrar" }, { status: 502 });
  }

  // medir: false só para números de controle cadastrados no CRM (validação do WhatsApp): o lead é gravado e o fluxo
  // roda inteiro, mas o navegador não dispara o evento de conversão.
  return NextResponse.json({ ok: true, id: record.id, ...(medir ? {} : { medir: false }) });
}
