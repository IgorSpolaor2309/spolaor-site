import { FORMULARIOS, INTERESSES, PEDIDOS, isFormulario, isOrigem, isPedido } from "@/lib/leads/schema";
import { SEGMENTO_DA_ORIGEM } from "@/lib/segments";
import { atribuicao, CATEGORIA_DO_PEDIDO, CATEGORIA_ROTULO, CANAL_ROTULO, PENDENCIA_ROTULO, POR_ESCOLHA, POR_ORIGEM, type Oportunidade } from "./tipos";

// O pedido como a pessoa o fez, para a ficha e a fila. Sem banco: recebe a oportunidade (e o envio original, quando há).
// Regras:
// - o que a pessoa respondeu aparece com as palavras dela; nada é resumido nem completado;
// - "serviço solicitado" é só o que a pessoa disse (ou a página de serviço em que ela pediu); a classificação interna
//   (categoria) aparece separada, com o motivo;
// - dado ausente aparece como "Não informado"; o antigo rótulo "Diagnóstico geral" é valor fixo da página, não pedido.

export const NAO_INFORMADO = "Não informado";

type Payload = Record<string, unknown>;
const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);

/** Páginas que são de um serviço: quem pede por elas pediu esse serviço, mesmo sem escolher numa lista. */
const PAGINA_DE_SERVICO: Record<string, { servico: string; pagina: string }> = {
  sites: { servico: "Site ou landing page", pagina: "/sites" },
  "lojas-virtuais": { servico: "Loja virtual", pagina: "/lojas-virtuais" },
  "agendamento-online": { servico: "Agendamento online", pagina: "/agendamento-online" },
  "atendimento-ia": { servico: "Atendimento com IA no WhatsApp", pagina: "/atendimento-ia" },
  "diagnostico-site": { servico: "Diagnóstico de um site existente", pagina: "/diagnostico-site" },
};

export type Linha = { rotulo: string; valor: string; ausente?: boolean; link?: string; nota?: string };
const linha = (rotulo: string, valor: string | null | undefined, extra: Partial<Linha> = {}): Linha =>
  valor ? { rotulo, valor, ...extra } : { rotulo, valor: NAO_INFORMADO, ausente: true, ...extra, link: undefined };

/** Serviço que a pessoa pediu, com a base da afirmação. `informado` = false quando ela não disse. */
export function servicoSolicitado(o: Pick<Oportunidade, "dados" | "origem" | "canal" | "registro" | "servico">): { texto: string; base: string; informado: boolean } {
  const pedido = o.dados.pedido;
  if (isPedido(pedido)) return { texto: PEDIDOS[pedido].rotulo, base: "Resposta do visitante no formulário", informado: true };
  if (o.registro === "manual") {
    return o.servico ? { texto: o.servico, base: "Anotado por quem cadastrou", informado: true } : { texto: NAO_INFORMADO, base: "Cadastro manual sem serviço anotado", informado: false };
  }
  if (o.canal !== "formulario") return { texto: NAO_INFORMADO, base: `Chegou por ${CANAL_ROTULO[o.canal]}, sem formulário`, informado: false };
  const marcadas = lista(o.dados.servicos);
  const pagina = o.origem ? PAGINA_DE_SERVICO[o.origem] : undefined;
  if (o.origem === "contato" && marcadas.length) {
    return { texto: marcadas.join(", "), base: marcadas.length === 1 ? "Opção marcada pelo visitante" : "Opções marcadas pelo visitante", informado: true };
  }
  // Uma única opção que é um serviço (ex.: "Loja virtual" no formulário de /sites) vale mais que a página.
  if (marcadas.length === 1 && POR_ESCOLHA.some(([re]) => re.test(marcadas[0].trim()))) {
    return { texto: marcadas[0], base: `Opção marcada pelo visitante${pagina ? ` no formulário da página ${pagina.pagina}` : ""}`, informado: true };
  }
  if (pagina) return { texto: pagina.servico, base: `Pedido feito no formulário da página ${pagina.pagina}`, informado: true };
  return { texto: NAO_INFORMADO, base: "O formulário usado não perguntava qual serviço a pessoa queria", informado: false };
}

/**
 * Serviço para o texto das mensagens à pessoa ({{servico}}): só o que ela pediu. Sem isso, null (o modelo usa
 * "seu pedido"); nunca o rótulo interno ("Diagnóstico geral (home)", "Pedido: …").
 */
export function servicoParaMensagem(o: { dados: Record<string, unknown> | null; origem: string | null; canal: string; registro: string; servico: string | null }): string | null {
  const s = servicoSolicitado({ ...o, dados: o.dados ?? {}, canal: o.canal as Oportunidade["canal"], registro: o.registro as Oportunidade["registro"] });
  return s.informado ? s.texto : null;
}

/** Classificação interna (categoria usada nos filtros) e por que ela é essa. */
export function classificacaoInterna(o: Pick<Oportunidade, "categoria" | "dados" | "origem" | "registro" | "servico">): { texto: string; base: string; rotuloPagina: string | null } {
  const pedido = o.dados.pedido;
  const texto = CATEGORIA_ROTULO[o.categoria];
  // Rótulo antigo gravado pela página do formulário ("Diagnóstico geral (home)", "Diagnóstico · corretores"…).
  const rotuloPagina = o.origem && isOrigem(o.origem) && o.servico === INTERESSES[o.origem] ? o.servico : null;
  let base: string;
  if (isPedido(pedido) && CATEGORIA_DO_PEDIDO[pedido] === o.categoria)
    base = pedido === "nao-sei" ? "A pessoa pediu ajuda para identificar a solução" : "Pela resposta do visitante";
  else if (o.registro === "manual") base = "Escolhida no cadastro manual ou na ficha";
  else if (o.origem && POR_ORIGEM[o.origem] === o.categoria) base = "Pela página do formulário";
  else if (o.categoria === "a-classificar") base = "Sem informação suficiente para identificar o serviço";
  else base = "Alterada por alguém no CRM";
  return { texto, base, rotuloPagina };
}

/** Formulário que gerou o envio. Envios antigos não gravavam o nome do formulário: é deduzido pelo tipo e pela origem. */
export function formularioDeEntrada(o: Pick<Oportunidade, "dados" | "origem" | "tipo" | "canal" | "registro">): string {
  const f = o.dados.formulario;
  if (isFormulario(f)) return FORMULARIOS[f];
  if (o.registro === "manual") return "Cadastro manual no CRM";
  if (o.canal !== "formulario") return CANAL_ROTULO[o.canal];
  if (o.origem === "diagnostico-site") return `${FORMULARIOS["diagnostico-site"]} (versão anterior)`;
  if (o.tipo === "analise") return "Diagnóstico gratuito: segmento, principal problema e contato (versão anterior)";
  if (o.tipo === "projeto") return "Pedido de orçamento: opções, mensagem e prazo (versão anterior)";
  return NAO_INFORMADO;
}

/**
 * Objetivo e respostas do formulário, com a pergunta que a pessoa viu quando ela é conhecida. Usa o envio original
 * (payload) quando existe; senão, o que ficou gravado na oportunidade.
 */
export function respostas(o: Pick<Oportunidade, "dados" | "mensagem" | "origem" | "tipo" | "canal">, payload?: Payload | null): { objetivo: Linha; outras: Linha[] } {
  const d: Payload = { ...o.dados, ...(payload ?? {}) };
  const mensagem = txt(payload ? payload.mensagem : o.mensagem) ?? txt(o.mensagem);
  const pergunta = txt(d.pergunta);
  const formulario = isFormulario(d.formulario) ? d.formulario : null;
  const outras: Linha[] = [];
  const problema = txt(d.problema);
  const segmento = txt(d.segmento);
  const fixo = o.origem && isOrigem(o.origem) ? SEGMENTO_DA_ORIGEM[o.origem] : undefined;
  let objetivo: Linha;

  if (pergunta) {
    objetivo = linha(pergunta, mensagem);
  } else if (o.canal !== "formulario") {
    objetivo = linha("Primeira mensagem", mensagem);
  } else if (o.tipo === "analise" && o.origem !== "diagnostico-site") {
    // Diagnóstico em passos: o objetivo era uma escolha da lista "O que mais pesa hoje?"; o texto era opcional.
    objetivo = linha("O que mais pesa hoje? (escolha da lista)", problema);
    outras.push(linha("Conte mais, se quiser (opcional)", mensagem));
  } else {
    objetivo = linha(o.origem === "diagnostico-site" ? "O que incomoda no site" : "Mensagem", mensagem ?? problema);
  }

  if (o.canal === "formulario") {
    if (segmento) outras.push(linha(fixo && fixo === segmento ? "Segmento (definido pela página)" : "Qual é o seu negócio?", segmento));
    if (problema && !(o.tipo === "analise" && !pergunta && o.origem !== "diagnostico-site")) outras.push(linha("Principal problema", problema));
    const marcadas = lista(d.servicos);
    if (marcadas.length) outras.push(linha(o.origem === "lojas-virtuais" ? "Como vende hoje" : "Opções marcadas", marcadas.join(", ")));
    const melhorias = lista(d.melhorias);
    if (melhorias.length) outras.push(linha("O que quer melhorar no site", melhorias.join(", ")));
    if (txt(d.urgencia)) outras.push(linha("Prazo", txt(d.urgencia)));
    if (formulario === "orcamento" && !pergunta && mensagem && objetivo.valor !== mensagem) outras.push(linha("Mensagem", mensagem));
  }
  return { objetivo, outras };
}

const link = (v: string) => (/^https?:\/\//i.test(v) ? v : /^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(v) ? `https://${v}` : undefined);

/** Nome, negócio e links como a pessoa informou no formulário (ou, sem envio, como estão no contato). */
export function informadoPelaPessoa(o: Pick<Oportunidade, "contato" | "dados">, payload?: Payload | null): Linha[] {
  const p: Payload = payload ?? {};
  const de = (k: string, contato: string | null) => (payload ? txt(p[k]) : contato);
  const nome = de("nome", o.contato.nome);
  const empresa = de("empresa", o.contato.empresa);
  const site = de("site", o.contato.site);
  const instagram = de("instagram", o.contato.instagram) ?? txt(o.dados.instagram);
  const semEmpresa = p.semEmpresa === true || o.dados.semEmpresa === true;
  const semSite = p.semSite === true || o.dados.semSite === true;
  const out: Linha[] = [linha("Nome", nome)];
  out.push(empresa ? linha("Negócio", empresa) : semEmpresa ? { rotulo: "Negócio", valor: "Ainda está começando (marcou no formulário)" } : linha("Negócio", null));
  if (site || instagram) {
    if (site) out.push({ rotulo: "Site", valor: site, link: link(site) });
    if (instagram) out.push({ rotulo: "Instagram", valor: `@${instagram}`, link: `https://instagram.com/${instagram}` });
  } else out.push(semSite ? { rotulo: "Site ou Instagram", valor: "Ainda não tem (marcou no formulário)" } : linha("Site ou Instagram", null));
  return out;
}

/** Prévia do pedido para a fila e a lista: as palavras da pessoa ou, sem texto, a escolha que ela fez. */
export function previaPedido(o: Pick<Oportunidade, "mensagem" | "dados" | "canal">): { texto: string; ausente: boolean } {
  const m = txt(o.mensagem);
  if (m) return { texto: m, ausente: false };
  const problema = txt(o.dados.problema);
  if (problema) return { texto: `Escolheu “${problema}” (sem mensagem escrita)`, ausente: false };
  return { texto: o.canal === "formulario" ? "Pedido sem mensagem escrita" : NAO_INFORMADO, ausente: true };
}

export type Estado = { tipo: "falha" | "novo" | "aguardando"; rotulo: string; detalhe: string | null };

/** Situação do atendimento para a fila: falha de envio (com o motivo), novo pedido ou aguardando atendimento. */
export function estadoAtendimento(o: Pick<Oportunidade, "falha" | "falhaMotivo" | "tarefa" | "etapa" | "primeiroContatoEm" | "aguardando" | "pendencia">): Estado | null {
  // O resultado da tarefa de primeiro contato é o motivo mais específico quando foi ela que falhou ou ficou incerta.
  const tarefaFalhou = !!o.tarefa && ["falhou", "incerta"].includes(o.tarefa.status) && !!o.tarefa.resultado;
  if (o.falha) return { tipo: "falha", rotulo: "Falha de envio", detalhe: tarefaFalhou ? o.tarefa!.resultado! : (o.falhaMotivo ?? "Motivo não registrado: abra a ficha") };
  if (tarefaFalhou)
    return { tipo: "falha", rotulo: "Falha de envio", detalhe: `Sem primeiro contato automático: ${o.tarefa!.resultado}` };
  if (o.aguardando === "nos") return { tipo: "aguardando", rotulo: "Aguardando atendimento", detalhe: PENDENCIA_ROTULO[o.pendencia ?? "resposta"] ?? PENDENCIA_ROTULO.resposta };
  if (o.etapa === "novo" && !o.primeiroContatoEm) return { tipo: "novo", rotulo: "Novo pedido", detalhe: "Ainda sem primeiro contato" };
  return null;
}

/** Origem disponível do pedido: fonte, campanha e identificadores do anúncio quando vieram na URL. */
export function origemDoPedido(o: Pick<Oportunidade, "utm" | "referrer" | "registro" | "metaCampaignId" | "metaAdsetId" | "metaAdId">): Linha[] {
  const atr = atribuicao(o);
  const out: Linha[] = [{ rotulo: "Fonte", valor: atr.fonte, nota: atr.base }];
  const u = o.utm ?? {};
  if (u.utm_campaign) out.push({ rotulo: "Campanha", valor: u.utm_campaign });
  if (u.utm_content) out.push({ rotulo: "Anúncio (utm_content)", valor: u.utm_content });
  const ids = [o.metaCampaignId && `campanha ${o.metaCampaignId}`, o.metaAdsetId && `conjunto ${o.metaAdsetId}`, o.metaAdId && `anúncio ${o.metaAdId}`].filter(Boolean).join(" · ");
  out.push(ids ? { rotulo: "Identificadores do anúncio", valor: ids } : linha("Identificadores do anúncio", null));
  return out;
}
