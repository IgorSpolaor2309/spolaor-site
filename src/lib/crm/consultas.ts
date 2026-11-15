import { db, type Db } from "./db";
import { atribuicao, ETAPAS_ABERTAS, type Canal, type CustoTipo, type Envio, type Etapa, type Evento, type Mensagem, type Oportunidade, type Usuario } from "./tipos";

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
  };
}

const base = (sql: Db) => sql`
  select o.*, c.nome as c_nome, c.empresa as c_empresa, c.whatsapp as c_whatsapp, c.email as c_email, c.instagram as c_instagram, c.site as c_site,
    u.nome as responsavel_nome,
    (exists (select 1 from crm_envios e where e.oportunidade_id = o.id and e.aviso_status = 'falhou')
      or exists (select 1 from crm_mensagens m where m.oportunidade_id = o.id and m.status = 'falhou')) as falha
  from crm_oportunidades o
  join crm_contatos c on c.id = o.contato_id
  left join crm_usuarios u on u.id = o.responsavel_id`;

/* ───────────────────────────── fila de atendimento ───────────────────────────── */

export type Fila = {
  novos: Oportunidade[];
  aguardandoRetorno: Oportunidade[];
  retornos: Oportunidade[]; // com próxima ação marcada (atrasadas primeiro)
  aguardandoInteressado: Oportunidade[];
  falhas: Oportunidade[];
  /** envios de teste abertos, fora da fila (aparecem na lista com o filtro de testes) */
  testesOcultos: number;
  agora: number;
};

export async function fila(): Promise<Fila> {
  const sql = await db();
  const rows = (await sql`${base(sql)} where o.teste = false and o.etapa in ${sql(ETAPAS_ABERTAS)} order by o.recebido_em desc limit 500`).map((r) => mapOp(r as Row));
  const [{ n: testesOcultos }] = await sql<{ n: number }[]>`select count(*)::int as n from crm_oportunidades where teste and etapa in ${sql(ETAPAS_ABERTAS)}`;
  // Falha de comunicação também aparece para oportunidades já encerradas: o aviso precisa de ação mesmo assim.
  const falhasFechadas = (await sql`${base(sql)} where o.teste = false and o.etapa not in ${sql(ETAPAS_ABERTAS)} and (
      exists (select 1 from crm_envios e where e.oportunidade_id = o.id and e.aviso_status = 'falhou')
      or exists (select 1 from crm_mensagens m where m.oportunidade_id = o.id and m.status = 'falhou')) limit 50`).map((r) => mapOp(r as Row));
  const t = (o: Oportunidade) => new Date(o.proximaAcaoEm!).getTime();
  return {
    novos: rows.filter((o) => o.etapa === "novo"),
    aguardandoRetorno: rows.filter((o) => o.etapa !== "novo" && o.aguardando === "nos"),
    retornos: rows.filter((o) => o.proximaAcaoEm).sort((a, b) => t(a) - t(b)),
    aguardandoInteressado: rows.filter((o) => o.etapa !== "novo" && o.aguardando === "cliente" && !o.proximaAcaoEm),
    falhas: [...rows.filter((o) => o.falha), ...falhasFechadas],
    testesOcultos,
    agora: Date.now(),
  };
}

/* ───────────────────────────── lista e funil ───────────────────────────── */

export type FiltroLista = { q?: string; etapa?: Etapa; servico?: string; origem?: string; canal?: Canal; testes?: boolean; pagina?: number };
export const POR_PAGINA = 50;

export async function lista(f: FiltroLista): Promise<{ itens: Oportunidade[]; total: number }> {
  const sql = await db();
  const q = f.q?.trim();
  const like = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;
  const digitos = q ? q.replace(/\D/g, "") : "";
  const onde = sql`
    where (${f.testes === true} or o.teste = false)
      ${f.etapa ? sql`and o.etapa = ${f.etapa}` : sql``}
      ${f.servico ? sql`and o.servico = ${f.servico}` : sql``}
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

export async function opcoesFiltro(): Promise<{ servicos: string[]; origens: string[] }> {
  const sql = await db();
  const s = await sql<{ v: string }[]>`select distinct servico as v from crm_oportunidades where servico is not null order by 1`;
  const o = await sql<{ v: string }[]>`select distinct origem as v from crm_oportunidades where origem is not null order by 1`;
  return { servicos: s.map((r) => r.v), origens: o.map((r) => r.v) };
}

/** Funil: todas as abertas e as encerradas dos últimos 60 dias (testes fora). */
export async function funil(): Promise<Oportunidade[]> {
  const sql = await db();
  return (
    await sql`${base(sql)}
      where o.teste = false and (o.etapa in ${sql(ETAPAS_ABERTAS)} or coalesce(o.fechado_em, o.perdido_em, o.atualizado_em) > now() - interval '60 days')
      order by o.recebido_em desc limit 600`
  ).map((r) => mapOp(r as Row));
}

/* ───────────────────────────── ficha ───────────────────────────── */

export type Ficha = { oportunidade: Oportunidade; mensagens: Mensagem[]; eventos: Evento[]; envios: Envio[]; outras: Oportunidade[] };

export async function ficha(id: string): Promise<Ficha | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const sql = await db();
  const [r] = await sql`${base(sql)} where o.id = ${id}`;
  if (!r) return null;
  const oportunidade = mapOp(r as Row);
  const [msgs, evs, envs, outras] = await Promise.all([
    sql`select m.*, u.nome as usuario_nome from crm_mensagens m left join crm_usuarios u on u.id = m.usuario_id where m.oportunidade_id = ${id} order by m.criado_em`,
    sql`select e.*, u.nome as usuario_nome from crm_eventos e left join crm_usuarios u on u.id = e.usuario_id where e.oportunidade_id = ${id} order by e.criado_em desc, e.id`,
    sql`select * from crm_envios where oportunidade_id = ${id} order by recebido_em desc`,
    sql`${base(sql)} where o.contato_id = ${oportunidade.contatoId} and o.id <> ${id} order by o.recebido_em desc limit 20`,
  ]);
  return {
    oportunidade,
    mensagens: msgs.map((m) => ({
      id: m.id,
      canal: m.canal,
      direcao: m.direcao,
      modo: m.modo,
      automatica: m.automatica,
      assunto: m.assunto,
      corpo: m.corpo,
      status: m.status,
      tentativas: m.tentativas,
      erro: m.erro,
      enviadoEm: iso(m.enviado_em),
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
