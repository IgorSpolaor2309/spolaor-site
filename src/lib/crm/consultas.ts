import { db, type Db } from "./db";
import {
  atribuicao,
  ETAPAS_ABERTAS,
  fmtRelativo,
  PENDENCIA_ROTULO,
  type Canal,
  type Categoria,
  type CustoTipo,
  type Envio,
  type Etapa,
  type Evento,
  type Mensagem,
  type Oportunidade,
  type Usuario,
} from "./tipos";

// Leituras do CRM. Só o servidor chama; quem chama já conferiu a sessão (exigirUsuario).

const iso = (d: Date | string | null): string | null => (d ? new Date(d).toISOString() : null);
const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

type Row = Record<string, unknown> & { id: string };

function mapOp(r: Row): Oportunidade {
  const s = (k: string) => (r[k] as string | null) ?? null;
  const d = (k: string) => iso(r[k] as Date | null);
  return {
    id: r.id,
    contatoId: r.contato_id as string,
    etapa: r.etapa as Etapa,
    aguardando: s("aguardando") as Oportunidade["aguardando"],
    servico: s("servico"),
    categoria: (s("categoria") ?? "a-classificar") as Categoria,
    canal: r.canal as Canal,
    origem: s("origem"),
    registro: r.registro as Oportunidade["registro"],
    tipo: s("tipo"),
    mensagem: s("mensagem"),
    dados: (r.dados as Record<string, unknown>) ?? {},
    pagina: s("pagina"),
    entrada: s("entrada"),
    referrer: s("referrer"),
    utm: (r.utm as Record<string, string>) ?? {},
    metaCampaignId: s("meta_campaign_id"),
    metaAdsetId: s("meta_adset_id"),
    metaAdId: s("meta_ad_id"),
    responsavelId: s("responsavel_id"),
    responsavelNome: s("responsavel_nome"),
    proximaAcao: s("proxima_acao"),
    proximaAcaoEm: d("proxima_acao_em"),
    primeiroContatoEm: d("primeiro_contato_em"),
    ultimoContatoEm: d("ultimo_contato_em"),
    assumidaEm: d("assumida_em"),
    valorProposta: num(r.valor_proposta as string | null),
    propostaEm: d("proposta_em"),
    valorFechado: num(r.valor_fechado as string | null),
    fechadoEm: d("fechado_em"),
    motivoPerda: s("motivo_perda"),
    perdidoEm: d("perdido_em"),
    teste: r.teste as boolean,
    validacao: r.validacao === true,
    recebidoEm: d("recebido_em")!,
    criadoEm: d("criado_em")!,
    atualizadoEm: d("atualizado_em")!,
    contato: {
      id: r.contato_id as string,
      nome: r.c_nome as string,
      empresa: s("c_empresa"),
      whatsapp: s("c_whatsapp"),
      email: s("c_email"),
      instagram: s("c_instagram"),
      site: s("c_site"),
    },
    falha: r.falha === true,
    pendencia: s("pendencia"),
    ultimaEntradaEm: d("ultima_entrada_em"),
    avisoVersao: s("aviso_versao"),
    ultimaMensagem: r.um_corpo ? { corpo: r.um_corpo as string, direcao: r.um_direcao as "saida" | "entrada", em: iso(r.um_em as Date)!, tipo: r.um_tipo as string, automatica: r.um_automatica === true } : null,
    tarefa: r.t_status ? { status: r.t_status as string, resultado: s("t_resultado") } : null,
    contatoBloqueado: r.c_bloqueado === true,
  };
}

// "falha" = algo que não saiu ou não se sabe se saiu: aviso de lead recusado, mensagem recusada ou de resultado incerto.
const base = (sql: Db) => sql`
  select o.*, c.nome as c_nome, c.empresa as c_empresa, c.whatsapp as c_whatsapp, c.email as c_email, c.instagram as c_instagram, c.site as c_site,
    c.wa_bloqueado_em is not null as c_bloqueado,
    u.nome as responsavel_nome,
    (exists (select 1 from crm_envios e where e.oportunidade_id = o.id and e.aviso_status = 'falhou')
      or exists (select 1 from crm_mensagens m where m.oportunidade_id = o.id and m.status in ('falhou', 'incerta'))) as falha,
    um.corpo as um_corpo, um.direcao as um_direcao, um.em as um_em, um.tipo as um_tipo, um.automatica as um_automatica,
    t.status as t_status, t.resultado as t_resultado
  from crm_oportunidades o
  join crm_contatos c on c.id = o.contato_id
  left join crm_usuarios u on u.id = o.responsavel_id
  left join lateral (
    select m.corpo, m.direcao, m.tipo, m.automatica, coalesce(m.ocorrida_em, m.criado_em) as em from crm_mensagens m
    where m.oportunidade_id = o.id and m.status <> 'cancelada' order by coalesce(m.ocorrida_em, m.criado_em) desc limit 1
  ) um on true
  left join crm_tarefas t on t.oportunidade_id = o.id and t.tipo = 'primeiro_contato'`;

/* ───────────────────────────── fila de atendimento ───────────────────────────── */

export type ItemFila = {
  o: Oportunidade;
  /** por que este item está na fila (texto pronto para a tela) */
  motivo: string;
  /** desde quando espera (ISO) */
  desde: string;
  alerta: boolean;
};

/** Conversa de WhatsApp com mensagens que o CRM não conseguiu ligar a uma oportunidade. */
export type ConversaSolta = {
  contatoId: string;
  nome: string;
  whatsapp: string | null;
  mensagens: number;
  ultima: string;
  desde: string;
  /** oportunidades da mesma pessoa, para associar com um clique */
  oportunidades: { id: string; servico: string | null; categoria: string | null; etapa: Etapa }[];
};

export type Fila = {
  /** "Depende de mim": cada oportunidade aparece uma vez, no primeiro grupo em que se encaixa. */
  respostas: ItemFila[];
  retornosVencidos: ItemFila[];
  acaoManual: ItemFila[];
  semResponsavel: ItemFila[];
  conversasSoltas: ConversaSolta[];
  /** Fora da fila principal. */
  aguardandoInteressado: Oportunidade[];
  retornosFuturos: Oportunidade[];
  automacaoNaFila: Oportunidade[];
  testesOcultos: number;
  agora: number;
};

const ms = (i: string | null) => (i ? new Date(i).getTime() : 0);

export async function fila(categoria?: Categoria): Promise<Fila> {
  const sql = await db();
  const cat = categoria ? sql`and o.categoria = ${categoria}` : sql``;
  const rows = (await sql`${base(sql)} where (o.teste = false or o.validacao) and o.etapa in ${sql(ETAPAS_ABERTAS)} ${cat} order by o.recebido_em desc limit 500`).map((r) => mapOp(r as Row));
  // Falha de comunicação também aparece para oportunidades já encerradas: precisa de ação mesmo assim.
  const fechadasComFalha = (await sql`${base(sql)} where o.teste = false and o.etapa not in ${sql(ETAPAS_ABERTAS)} ${cat} and (
      exists (select 1 from crm_envios e where e.oportunidade_id = o.id and e.aviso_status = 'falhou')
      or exists (select 1 from crm_mensagens m where m.oportunidade_id = o.id and m.status in ('falhou', 'incerta'))) limit 50`).map((r) => mapOp(r as Row));
  const [{ n: testesOcultos }] = await sql<{ n: number }[]>`select count(*)::int as n from crm_oportunidades where teste and not validacao and etapa in ${sql(ETAPAS_ABERTAS)}`;
  const soltas = await sql`
    select c.id, c.nome, c.whatsapp, count(*)::int as mensagens, min(coalesce(m.ocorrida_em, m.criado_em)) as desde,
      (array_agg(m.corpo order by coalesce(m.ocorrida_em, m.criado_em) desc))[1] as ultima,
      coalesce((select json_agg(json_build_object('id', o.id, 'servico', o.servico, 'categoria', o.categoria, 'etapa', o.etapa) order by o.recebido_em desc)
        from crm_oportunidades o where o.contato_id = c.id and o.teste = false), '[]'::json) as oportunidades
    from crm_mensagens m join crm_contatos c on c.id = m.contato_id
    where m.oportunidade_id is null and m.conferida_em is null and m.direcao = 'entrada' and m.tipo <> 'reaction'
    group by c.id order by 5 limit 100`;

  const agora = Date.now();
  const usadas = new Set<string>();
  const pegar = (filtro: (o: Oportunidade) => boolean, item: (o: Oportunidade) => Omit<ItemFila, "o">): ItemFila[] => {
    const out: ItemFila[] = [];
    for (const o of rows) {
      if (usadas.has(o.id) || !filtro(o)) continue;
      usadas.add(o.id);
      out.push({ o, ...item(o) });
    }
    return out.sort((a, b) => ms(a.desde) - ms(b.desde));
  };

  const respostas = pegar(
    (o) => o.aguardando === "nos",
    (o) => ({ motivo: PENDENCIA_ROTULO[o.pendencia ?? "resposta"] ?? PENDENCIA_ROTULO.resposta, desde: o.ultimaEntradaEm ?? o.atualizadoEm, alerta: o.pendencia === "pediu_parar" }),
  );
  const retornosVencidos = pegar(
    (o) => !!o.proximaAcaoEm && ms(o.proximaAcaoEm) < agora,
    (o) => ({ motivo: `Retorno vencido ${fmtRelativo(o.proximaAcaoEm, agora)}${o.proximaAcao ? `: ${o.proximaAcao}` : ""}`, desde: o.proximaAcaoEm!, alerta: true }),
  );
  // Primeiro contato automático ainda vai sair: não depende de ninguém agora.
  const automacaoNaFila = rows.filter((o) => !usadas.has(o.id) && o.etapa === "novo" && !!o.tarefa && ["pendente", "processando"].includes(o.tarefa.status));
  automacaoNaFila.forEach((o) => usadas.add(o.id));
  const acaoManual = pegar(
    (o) => o.falha || o.etapa === "novo",
    (o) => ({
      motivo: o.falha
        ? o.tarefa && ["falhou", "incerta"].includes(o.tarefa.status) && o.tarefa.resultado
          ? o.tarefa.resultado
          : "Falha ou resultado incerto de envio: abra a ficha"
        : o.tarefa?.status === "falhou" && o.tarefa.resultado
          ? `Sem primeiro contato automático: ${o.tarefa.resultado}`
          : "Novo contato sem primeiro atendimento",
      desde: o.recebidoEm,
      alerta: o.falha,
    }),
  );
  const semResponsavel = pegar(
    (o) => !o.responsavelId && (o.etapa === "em_conversa" || o.etapa === "proposta_enviada"),
    (o) => ({ motivo: "Em andamento sem responsável definido", desde: o.atualizadoEm, alerta: false }),
  );
  for (const o of fechadasComFalha) acaoManual.push({ o, motivo: "Falha de envio em oportunidade encerrada: abra a ficha", desde: o.atualizadoEm, alerta: true });

  const resto = rows.filter((o) => !usadas.has(o.id));
  return {
    respostas,
    retornosVencidos,
    acaoManual,
    semResponsavel,
    conversasSoltas: categoria
      ? []
      : soltas.map((r) => ({ contatoId: r.id, nome: r.nome, whatsapp: r.whatsapp, mensagens: r.mensagens, ultima: r.ultima, desde: iso(r.desde)!, oportunidades: r.oportunidades })),
    aguardandoInteressado: resto.filter((o) => !o.proximaAcaoEm),
    retornosFuturos: resto.filter((o) => o.proximaAcaoEm).sort((a, b) => ms(a.proximaAcaoEm) - ms(b.proximaAcaoEm)),
    automacaoNaFila,
    testesOcultos,
    agora,
  };
}

/** Carimbo barato do estado do CRM: muda quando chega mensagem, lead, estado de envio ou alguém altera algo. */
export async function pulso(): Promise<string> {
  const sql = await db();
  const [r] = await sql<{ p: string }[]>`
    select concat_ws(':',
      (select coalesce(extract(epoch from max(atualizado_em))::bigint, 0) from crm_oportunidades),
      (select count(*) from crm_oportunidades),
      (select coalesce(extract(epoch from max(greatest(criado_em, coalesce(entregue_em, criado_em), coalesce(lida_em, criado_em), coalesce(enviado_em, criado_em))))::bigint, 0) from crm_mensagens),
      (select count(*) from crm_mensagens),
      (select count(*) from crm_tarefas where status in ('pendente', 'processando'))) as p`;
  return r.p;
}

/* ───────────────────────────── lista e funil ───────────────────────────── */

export type FiltroLista = { q?: string; etapa?: Etapa; categoria?: Categoria; origem?: string; canal?: Canal; testes?: boolean; pagina?: number };
export const POR_PAGINA = 50;

export async function lista(f: FiltroLista): Promise<{ itens: Oportunidade[]; total: number }> {
  const sql = await db();
  const q = f.q?.trim();
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const digitos = q ? q.replace(/\D/g, "") : "";
  const onde = sql`
    where (${f.testes === true} or o.teste = false)
      ${f.etapa ? sql`and o.etapa = ${f.etapa}` : sql``}
      ${f.categoria ? sql`and o.categoria = ${f.categoria}` : sql``}
      ${f.origem ? sql`and o.origem = ${f.origem}` : sql``}
      ${f.canal ? sql`and o.canal = ${f.canal}` : sql``}
      ${
        like
          ? sql`and (c.nome ilike ${like} or c.empresa ilike ${like} or c.email ilike ${like} or o.mensagem ilike ${like} or o.servico ilike ${like}
              ${digitos.length >= 4 ? sql`or c.whatsapp like ${`%${digitos}%`}` : sql``})`
          : sql``
      }`;
  const offset = Math.max(0, (f.pagina ?? 1) - 1) * POR_PAGINA;
  const itens = (await sql`${base(sql)} ${onde} order by o.recebido_em desc limit ${POR_PAGINA} offset ${offset}`).map((r) => mapOp(r as Row));
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from crm_oportunidades o join crm_contatos c on c.id = o.contato_id ${onde}`;
  return { itens, total: n };
}

export async function opcoesFiltro(): Promise<{ origens: string[] }> {
  const sql = await db();
  const o = await sql<{ v: string }[]>`select distinct origem as v from crm_oportunidades where origem is not null order by 1`;
  return { origens: o.map((r) => r.v) };
}

/** Funil: todas as abertas e as encerradas dos últimos 60 dias (testes fora). */
export async function funil(categoria?: Categoria): Promise<Oportunidade[]> {
  const sql = await db();
  return (
    await sql`${base(sql)}
      where o.teste = false and (o.etapa in ${sql(ETAPAS_ABERTAS)} or coalesce(o.fechado_em, o.perdido_em, o.atualizado_em) > now() - interval '60 days')
        ${categoria ? sql`and o.categoria = ${categoria}` : sql``}
      order by o.recebido_em desc limit 600`
  ).map((r) => mapOp(r as Row));
}

/* ───────────────────────────── ficha ───────────────────────────── */

export type Ficha = {
  oportunidade: Oportunidade;
  /** Mensagens desta oportunidade e toda a conversa de WhatsApp da pessoa (uma conversa por número). */
  mensagens: Mensagem[];
  eventos: Evento[];
  envios: Envio[];
  outras: Oportunidade[];
  /** Última mensagem recebida da pessoa no WhatsApp: a janela de 24 h para texto livre conta daqui. */
  waUltimaEntradaEm: string | null;
};

export async function ficha(id: string): Promise<Ficha | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const sql = await db();
  const [r] = await sql`${base(sql)} where o.id = ${id}`;
  if (!r) return null;
  const oportunidade = mapOp(r as Row);
  const [msgs, evs, envs, outras, contato] = await Promise.all([
    sql`
      select m.*, u.nome as usuario_nome from crm_mensagens m left join crm_usuarios u on u.id = m.usuario_id
      where m.oportunidade_id = ${id} or (m.contato_id = ${oportunidade.contatoId} and m.canal = 'whatsapp' and m.modo = 'sistema')
      order by coalesce(m.ocorrida_em, m.criado_em), m.criado_em`,
    sql`select e.*, u.nome as usuario_nome from crm_eventos e left join crm_usuarios u on u.id = e.usuario_id where e.oportunidade_id = ${id} order by e.criado_em desc, e.id`,
    sql`select * from crm_envios where oportunidade_id = ${id} order by recebido_em desc`,
    sql`${base(sql)} where o.contato_id = ${oportunidade.contatoId} and o.id <> ${id} order by o.recebido_em desc limit 20`,
    sql<{ wa_ultima_entrada_em: Date | null }[]>`select wa_ultima_entrada_em from crm_contatos where id = ${oportunidade.contatoId}`,
  ]);
  return {
    oportunidade,
    mensagens: msgs.map((m) => ({
      id: m.id,
      oportunidadeId: m.oportunidade_id,
      canal: m.canal,
      direcao: m.direcao,
      modo: m.modo,
      via: m.via ?? (m.modo === "manual" ? "registro" : null),
      tipo: m.tipo,
      automatica: m.automatica,
      assunto: m.assunto,
      corpo: m.corpo,
      status: m.status,
      tentativas: m.tentativas,
      erro: m.erro,
      enviadoEm: iso(m.enviado_em),
      entregueEm: iso(m.entregue_em),
      lidaEm: iso(m.lida_em),
      em: iso(m.ocorrida_em ?? m.enviado_em ?? m.criado_em)!,
      criadoEm: iso(m.criado_em)!,
      usuarioNome: m.usuario_nome,
    })),
    eventos: evs.map((e) => ({ id: e.id, tipo: e.tipo, texto: e.texto, dados: e.dados ?? {}, criadoEm: iso(e.criado_em)!, usuarioNome: e.usuario_nome })),
    envios: envs.map((e) => ({
      id: e.id,
      recebidoEm: iso(e.recebido_em)!,
      payload: e.payload,
      avisoStatus: e.aviso_status,
      avisoTentativas: e.aviso_tentativas,
      avisoErro: e.aviso_erro,
      avisoEnviadoEm: iso(e.aviso_enviado_em),
    })),
    outras: outras.map((x) => mapOp(x as Row)),
    waUltimaEntradaEm: iso(contato[0]?.wa_ultima_entrada_em ?? null),
  };
}

export async function usuarios(): Promise<Usuario[]> {
  const sql = await db();
  return sql<Usuario[]>`select id, email, nome from crm_usuarios order by nome`;
}

/* ───────────────────────────── indicadores ───────────────────────────── */

export type Custo = { id: string; tipo: CustoTipo; inicio: string; fim: string; valor: number; estimado: boolean; nota: string | null };

export async function custos(): Promise<Custo[]> {
  const sql = await db();
  const rows = await sql`select id, tipo, inicio::text as inicio, fim::text as fim, valor, estimado, nota from crm_custos order by inicio desc, criado_em desc limit 200`;
  return rows.map((r) => ({ id: r.id, tipo: r.tipo, inicio: r.inicio, fim: r.fim, valor: Number(r.valor), estimado: r.estimado, nota: r.nota }));
}

export type Contagem = { rotulo: string; total: number; comProposta: number; ganhos: number };

export type Indicadores = {
  inicio: string; // AAAA-MM-DD (inclusive), fuso de Brasília
  fim: string; // AAAA-MM-DD (inclusive)
  recebidos: number;
  testesFora: number;
  comPrimeiroContato: number;
  /** mediana, em minutos, entre a chegada e o primeiro contato nosso; null = nenhum contato feito no período */
  medianaPrimeiroContatoMin: number | null;
  semPrimeiroContato: number;
  responderam: number;
  propostas: number;
  valorPropostas: number | null;
  propostasSemValor: number;
  ganhos: number;
  valorGanhos: number | null;
  ganhosSemValor: number;
  perdidos: number;
  motivosPerda: { rotulo: string; total: number }[];
  porFonte: Contagem[];
  porServico: Contagem[];
  porOrigem: Contagem[];
  porCanal: Contagem[];
  /** contatos cuja URL declarou anúncio na Meta (utm_source da Meta com mídia paga ou campanha) */
  contatosMetaDeclarados: number;
  /** vendas com data de fechamento no período, qualquer que seja a data de chegada */
  fechamentosNoPeriodo: { total: number; valor: number | null };
  retornosAtrasadosAgora: number;
  novosSemContatoAgora: number;
  /** custos informados à mão, rateados pelos dias que caem no período; vazio = nada informado (não é zero) */
  custos: { tipo: CustoTipo; valor: number; estimado: boolean; lancamentos: number }[];
  ultimoCustoEm: string | null;
};

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const dias = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;

/** Indicadores dos contatos recebidos entre `inicio` e `fim` (datas no fuso de Brasília, inclusive). */
export async function indicadores(inicio: string, fim: string): Promise<Indicadores> {
  const sql = await db();
  const de = `${inicio}T00:00:00-03:00`;
  const ate = new Date(Date.parse(`${fim}T00:00:00-03:00`) + 86400000).toISOString();
  const rows = await sql`
    select o.id, o.etapa, o.servico, o.origem, o.canal, o.registro, o.utm, o.referrer, o.teste, o.recebido_em, o.primeiro_contato_em, o.proposta_em,
      o.valor_proposta, o.valor_fechado, o.motivo_perda,
      (o.etapa in ('em_conversa', 'proposta_enviada', 'ganho')
        or exists (select 1 from crm_mensagens m where m.oportunidade_id = o.id and m.direcao = 'entrada')) as respondeu
    from crm_oportunidades o where o.recebido_em >= ${de} and o.recebido_em < ${ate} limit 5000`;
  const reais = rows.filter((r) => !r.teste);
  const grupo = (chave: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, Contagem>();
    for (const r of reais) {
      const k = chave(r) || "Não informado";
      const c = m.get(k) ?? { rotulo: k, total: 0, comProposta: 0, ganhos: 0 };
      c.total++;
      if (r.proposta_em || r.etapa === "proposta_enviada") c.comProposta++;
      if (r.etapa === "ganho") c.ganhos++;
      m.set(k, c);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };
  const atr = (r: (typeof rows)[number]) => atribuicao({ utm: r.utm ?? {}, referrer: r.referrer, registro: r.registro });
  const tempos = reais.filter((r) => r.primeiro_contato_em).map((r) => (new Date(r.primeiro_contato_em).getTime() - new Date(r.recebido_em).getTime()) / 60000).filter((m) => m >= 0);
  const comProposta = reais.filter((r) => r.proposta_em || r.etapa === "proposta_enviada");
  const ganhos = reais.filter((r) => r.etapa === "ganho");
  const perdidos = reais.filter((r) => r.etapa === "perdido");
  const soma = (xs: (string | null)[]) => {
    const v = xs.filter((x): x is string => x !== null).map(Number);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  };
  const motivos = new Map<string, number>();
  for (const p of perdidos) motivos.set(p.motivo_perda || "Motivo não informado", (motivos.get(p.motivo_perda || "Motivo não informado") ?? 0) + 1);

  const [fech] = await sql<{ n: number; v: string | null }[]>`
    select count(*)::int as n, sum(valor_fechado) as v from crm_oportunidades
    where etapa = 'ganho' and teste = false and fechado_em >= ${de} and fechado_em < ${ate}`;
  const [agora] = await sql<{ atrasados: number; novos: number }[]>`
    select count(*) filter (where proxima_acao_em < now())::int as atrasados,
           count(*) filter (where etapa = 'novo' and primeiro_contato_em is null)::int as novos
    from crm_oportunidades where teste = false and etapa in ${sql(ETAPAS_ABERTAS)}`;

  // Custos: cada lançamento é rateado pelos dias dele que caem dentro do período.
  const cs = await sql`
    select tipo, inicio::text as inicio, fim::text as fim, valor, estimado, criado_em from crm_custos where inicio <= ${fim}::date and fim >= ${inicio}::date`;
  const porTipo = new Map<CustoTipo, { tipo: CustoTipo; valor: number; estimado: boolean; lancamentos: number }>();
  let ultimo: Date | null = null;
  for (const c of cs) {
    const a = c.inicio > inicio ? c.inicio : inicio;
    const b = c.fim < fim ? c.fim : fim;
    const parte = (Number(c.valor) * dias(a, b)) / dias(c.inicio, c.fim);
    const t = porTipo.get(c.tipo) ?? { tipo: c.tipo as CustoTipo, valor: 0, estimado: false, lancamentos: 0 };
    t.valor = Math.round((t.valor + parte) * 100) / 100;
    t.estimado ||= c.estimado;
    t.lancamentos++;
    porTipo.set(c.tipo, t);
    if (!ultimo || c.criado_em > ultimo) ultimo = c.criado_em;
  }

  return {
    inicio,
    fim,
    recebidos: reais.length,
    testesFora: rows.length - reais.length,
    comPrimeiroContato: reais.filter((r) => r.primeiro_contato_em).length,
    medianaPrimeiroContatoMin: mediana(tempos),
    semPrimeiroContato: reais.filter((r) => !r.primeiro_contato_em).length,
    responderam: reais.filter((r) => r.respondeu).length,
    propostas: comProposta.length,
    valorPropostas: soma(comProposta.map((r) => r.valor_proposta)),
    propostasSemValor: comProposta.filter((r) => r.valor_proposta === null).length,
    ganhos: ganhos.length,
    valorGanhos: soma(ganhos.map((r) => r.valor_fechado)),
    ganhosSemValor: ganhos.filter((r) => r.valor_fechado === null).length,
    perdidos: perdidos.length,
    motivosPerda: [...motivos.entries()].map(([rotulo, total]) => ({ rotulo, total })).sort((a, b) => b.total - a.total),
    porFonte: grupo((r) => atr(r).fonte),
    porServico: grupo((r) => r.servico),
    porOrigem: grupo((r) => r.origem),
    porCanal: grupo((r) => r.canal),
    contatosMetaDeclarados: reais.filter((r) => atr(r).metaPago).length,
    fechamentosNoPeriodo: { total: fech.n, valor: fech.v === null ? null : Number(fech.v) },
    retornosAtrasadosAgora: agora.atrasados,
    novosSemContatoAgora: agora.novos,
    custos: [...porTipo.values()],
    ultimoCustoEm: iso(ultimo),
  };
}

/* ───────────────────────────── estado das integrações ───────────────────────────── */

export type EstadoFormularios = { total: number; ultimoEm: string | null; avisosEnviados: number; avisosFalhos: number; avisosPendentes: number; ultimoAvisoEm: string | null };

export async function estadoFormularios(): Promise<EstadoFormularios> {
  const sql = await db();
  const [r] = await sql`
    select count(*)::int as total, max(recebido_em) as ultimo,
      count(*) filter (where aviso_status = 'enviado')::int as enviados,
      count(*) filter (where aviso_status = 'falhou')::int as falhos,
      count(*) filter (where aviso_status in ('pendente', 'enviando'))::int as pendentes,
      max(aviso_enviado_em) as ultimo_aviso
    from crm_envios`;
  return { total: r.total, ultimoEm: iso(r.ultimo), avisosEnviados: r.enviados, avisosFalhos: r.falhos, avisosPendentes: r.pendentes, ultimoAvisoEm: iso(r.ultimo_aviso) };
}

export async function estadoMensagens(): Promise<{ enviadas: number; falhas: number; pendentes: number; ultimaEm: string | null }> {
  const sql = await db();
  const [r] = await sql`
    select count(*) filter (where status = 'enviada')::int as enviadas, count(*) filter (where status = 'falhou')::int as falhas,
      count(*) filter (where status in ('pendente', 'enviando'))::int as pendentes, max(enviado_em) as ultima
    from crm_mensagens where modo = 'sistema'`;
  return { enviadas: r.enviadas, falhas: r.falhas, pendentes: r.pendentes, ultimaEm: iso(r.ultima) };
}

/** Linhas para exportação (CSV): uma por oportunidade, sem testes. */
export async function exportacao(): Promise<Oportunidade[]> {
  const sql = await db();
  return (await sql`${base(sql)} where o.teste = false order by o.recebido_em desc limit 10000`).map((r) => mapOp(r as Row));
}
