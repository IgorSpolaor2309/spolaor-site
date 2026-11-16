import { randomUUID } from "node:crypto";
import type { LeadRecord } from "@/lib/leads/server/types";
import { db, type Db } from "./db";
import { normEmail, normInstagram, normWhatsapp } from "./normalizar";
import { categoriaDoEnvio, ETAPAS_ABERTAS, type Canal, type Categoria } from "./tipos";
import { numerosControle } from "./whatsapp/config";

// Entrada de contatos no CRM: formulários do site (registrarEnvio) e cadastro manual (usa acharOuCriarContato).
// Regras:
// - o mesmo envio (id do lead) nunca é gravado duas vezes;
// - a pessoa é reconhecida só por WhatsApp ou e-mail idênticos; nome parecido não une registros;
// - a mesma pessoa pedindo outro serviço vira outra oportunidade; pedindo de novo o mesmo serviço, com a
//   oportunidade ainda aberta, o novo envio entra no histórico dela e ela volta para a fila;
// - cada oportunidade NOVA de formulário nasce com a tarefa de primeiro contato, na mesma transação: se o lead
//   foi gravado, a intenção de contato também foi (src/lib/crm/tarefas.ts decide se e por onde ela sai).

export type DadosContato = { nome: string; empresa?: string | null; whatsapp?: string | null; email?: string | null; instagram?: string | null; site?: string | null };

/** Trava por chave de contato dentro da transação: dois envios simultâneos da mesma pessoa não criam dois contatos. */
async function travar(tx: Db, chaves: string[]) {
  for (const k of [...new Set(chaves)].sort()) await tx`select pg_advisory_xact_lock(hashtextextended(${`crm-contato:${k}`}, 0))`;
}

export async function acharOuCriarContato(tx: Db, d: DadosContato): Promise<{ id: string; novo: boolean }> {
  const whatsapp = normWhatsapp(d.whatsapp);
  const email = normEmail(d.email);
  const instagram = normInstagram(d.instagram);
  await travar(tx, [whatsapp, email].filter((x): x is string => !!x));
  let found: { id: string } | undefined;
  if (whatsapp) [found] = await tx<{ id: string }[]>`select id from crm_contatos where whatsapp = ${whatsapp} order by criado_em limit 1`;
  if (!found && email) [found] = await tx<{ id: string }[]>`select id from crm_contatos where email = ${email} order by criado_em limit 1`;
  if (found) {
    // Completa só o que estava vazio; o que já foi conferido à mão não é sobrescrito por um formulário.
    await tx`
      update crm_contatos set
        empresa = coalesce(empresa, ${d.empresa?.trim() || null}),
        whatsapp = coalesce(whatsapp, ${whatsapp}),
        email = coalesce(email, ${email}),
        instagram = coalesce(instagram, ${instagram}),
        site = coalesce(site, ${d.site?.trim() || null}),
        atualizado_em = now()
      where id = ${found.id}`;
    return { id: found.id, novo: false };
  }
  const id = randomUUID();
  await tx`
    insert into crm_contatos (id, nome, empresa, whatsapp, email, instagram, site)
    values (${id}, ${d.nome.trim()}, ${d.empresa?.trim() || null}, ${whatsapp}, ${email}, ${instagram}, ${d.site?.trim() || null})`;
  return { id, novo: true };
}

export async function registrarEvento(
  tx: Db,
  e: { oportunidadeId: string; tipo: string; texto?: string | null; dados?: Record<string, unknown>; usuarioId?: string | null; em?: string },
) {
  await tx`
    insert into crm_eventos (id, oportunidade_id, tipo, texto, dados, usuario_id, criado_em)
    values (${randomUUID()}, ${e.oportunidadeId}, ${e.tipo}, ${e.texto ?? null}, ${tx.json((e.dados ?? {}) as never)}, ${e.usuarioId ?? null}, ${e.em ?? new Date().toISOString()})`;
}

const idMeta = (v?: string) => (v && /^\d{5,25}$/.test(v) ? v : null);

export type ResultadoEnvio = {
  oportunidadeId: string;
  contatoId: string;
  /** false = este id de lead já estava gravado (nada foi criado de novo) */
  gravado: boolean;
  /** true = oportunidade criada agora; false = envio anexado a uma oportunidade aberta do mesmo serviço */
  novaOportunidade: boolean;
  teste: boolean;
  /** envio de um número de controle: validação do fluxo, sem conversão publicitária */
  validacao: boolean;
  /** tarefa de primeiro contato criada com a oportunidade (null quando o envio foi anexado ou já existia) */
  tarefaId: string | null;
};

/**
 * Grava um envio de formulário aceito pela API. `avisoLigado` = há e-mail de aviso configurado para este envio.
 * Se o WhatsApp informado é um número de controle, o envio é uma VALIDAÇÃO: fica fora dos indicadores e quem chamou
 * (a API) avisa o navegador para não registrar conversão.
 */
export async function registrarEnvio(lead: LeadRecord, avisoLigado: boolean): Promise<ResultadoEnvio> {
  const sql = await db();
  const fone = normWhatsapp(lead.whatsapp);
  const validacao = !!fone && (await numerosControle()).includes(fone);
  return (await sql.begin(async (tx) => {
    const [ja] = await tx<{ oportunidade_id: string; contato_id: string; teste: boolean; validacao: boolean }[]>`
      select e.oportunidade_id, o.contato_id, o.teste, o.validacao from crm_envios e join crm_oportunidades o on o.id = e.oportunidade_id where e.id = ${lead.id}`;
    if (ja) return { oportunidadeId: ja.oportunidade_id, contatoId: ja.contato_id, gravado: false, novaOportunidade: false, teste: ja.teste, validacao: ja.validacao, tarefaId: null };

    const contato = await acharOuCriarContato(tx, { nome: lead.nome, empresa: lead.empresa, whatsapp: lead.whatsapp, email: lead.email, site: lead.site });
    const servico = lead.interesse ?? null;
    const categoria = categoriaDoEnvio(lead.origem, lead.servicos);
    // Validação também conta como teste: nunca entra nos indicadores.
    const teste = validacao || /^\s*teste\b/i.test(lead.nome);

    let oportunidadeId: string | undefined;
    let novaOportunidade = false;
    let tarefaId: string | null = null;
    if (!contato.novo) {
      // Cada validação começa do zero: encerra as validações anteriores ainda abertas deste número.
      if (validacao) {
        await tx`
          update crm_oportunidades set etapa = 'perdido', motivo_perda = 'Validação encerrada', perdido_em = now(), aguardando = null, pendencia = null,
            proxima_acao = null, proxima_acao_em = null, atualizado_em = now()
          where contato_id = ${contato.id} and validacao and etapa in ${tx(ETAPAS_ABERTAS)}`;
        await tx`
          update crm_tarefas set status = 'cancelada', resultado = 'Validação anterior encerrada.', atualizado_em = now()
          where status = 'pendente' and oportunidade_id in (select id from crm_oportunidades where contato_id = ${contato.id} and validacao)`;
      }
      const [aberta] = await tx<{ id: string; etapa: string }[]>`
        select id, etapa from crm_oportunidades
        where contato_id = ${contato.id} and servico is not distinct from ${servico} and etapa in ${tx(ETAPAS_ABERTAS)}
        order by recebido_em desc limit 1 for update`;
      if (aberta) {
        oportunidadeId = aberta.id;
        // A pessoa escreveu de novo: se já houve atendimento, volta para "Depende de mim". Se ainda é um contato
        // novo, continua novo (o primeiro contato já está previsto e não é repetido).
        await tx`
          update crm_oportunidades set
            ultima_entrada_em = case when etapa = 'novo' then ultima_entrada_em else greatest(coalesce(ultima_entrada_em, ${lead.createdAt}), ${lead.createdAt}) end,
            aguardando = case when etapa = 'novo' then aguardando else 'nos' end,
            pendencia = case when etapa = 'novo' then pendencia else 'novo_envio' end,
            aviso_versao = coalesce(${lead.aviso ?? null}, aviso_versao),
            aviso_em = case when ${lead.aviso ?? null}::text is not null then ${lead.createdAt} else aviso_em end,
            atualizado_em = now()
          where id = ${aberta.id}`;
        await registrarEvento(tx, {
          oportunidadeId: aberta.id,
          tipo: "novo_envio",
          texto: lead.mensagem || lead.problema || null,
          dados: { envio: lead.id, pagina: lead.pagina ?? null, origem: lead.origem },
          em: lead.createdAt,
        });
      }
    }
    if (!oportunidadeId) {
      oportunidadeId = randomUUID();
      novaOportunidade = true;
      const dados = Object.fromEntries(
        Object.entries({
          segmento: lead.segmento,
          problema: lead.problema,
          urgencia: lead.urgencia,
          melhorias: lead.melhorias?.length ? lead.melhorias : undefined,
          servicos: lead.servicos?.length ? lead.servicos : undefined,
          site: lead.site,
          semSite: lead.semSite || undefined,
        }).filter(([, v]) => v !== undefined && v !== ""),
      );
      const utm = lead.utm ?? {};
      await tx`
        insert into crm_oportunidades (id, contato_id, etapa, servico, categoria, canal, origem, registro, tipo, mensagem, dados, pagina, entrada, referrer, utm,
          meta_campaign_id, meta_adset_id, meta_ad_id, teste, validacao, recebido_em, aviso_versao, aviso_em)
        values (${oportunidadeId}, ${contato.id}, 'novo', ${servico}, ${categoria}, 'formulario', ${lead.origem}, 'automatico', ${lead.tipo}, ${lead.mensagem ?? null},
          ${tx.json(dados as never)}, ${lead.pagina ?? null}, ${lead.entrada ?? null}, ${lead.referrer ?? null}, ${tx.json(utm)},
          ${idMeta(utm.campaign_id)}, ${idMeta(utm.adset_id)}, ${idMeta(utm.ad_id)}, ${teste}, ${validacao}, ${lead.createdAt},
          ${lead.aviso ?? null}, ${lead.aviso ? lead.createdAt : null})`;
      await registrarEvento(tx, {
        oportunidadeId,
        tipo: "criado",
        texto: validacao ? `Validação com número de controle (${lead.origem}). Fora dos indicadores e sem conversão publicitária.` : `Contato recebido pelo formulário do site (${lead.origem}).`,
        dados: { envio: lead.id, contatoExistente: !contato.novo, aviso: lead.aviso ?? null, validacao },
        em: lead.createdAt,
      });
      // Intenção de primeiro contato, na mesma transação do lead. Uma por oportunidade (chave única).
      tarefaId = randomUUID();
      await tx`
        insert into crm_tarefas (id, tipo, oportunidade_id, envio_id, status) values (${tarefaId}, 'primeiro_contato', ${oportunidadeId}, ${lead.id}, 'pendente')`;
    }
    await tx`
      insert into crm_envios (id, oportunidade_id, payload, recebido_em, aviso_status)
      values (${lead.id}, ${oportunidadeId}, ${tx.json(lead as never)}, ${lead.createdAt}, ${avisoLigado ? "pendente" : "desligado"})`;
    return { oportunidadeId, contatoId: contato.id, gravado: true, novaOportunidade, teste, validacao, tarefaId };
  })) as ResultadoEnvio;
}

export type CadastroManual = DadosContato & {
  servico: string | null;
  categoria: Categoria;
  canal: Canal;
  origem: string | null;
  mensagem: string | null;
  recebidoEm: string;
  usuarioId: string;
};

/**
 * Cadastro manual (WhatsApp, Instagram, e-mail, indicação, registro antigo). Nunca gera evento de conversão nem
 * tarefa de contato automático: quem cadastra à mão é quem atende.
 */
export async function cadastrarManual(c: CadastroManual): Promise<{ oportunidadeId: string; contatoExistente: boolean }> {
  const sql = await db();
  return (await sql.begin(async (tx) => {
    const contato = await acharOuCriarContato(tx, c);
    const id = randomUUID();
    await tx`
      insert into crm_oportunidades (id, contato_id, etapa, servico, categoria, canal, origem, registro, mensagem, responsavel_id, recebido_em)
      values (${id}, ${contato.id}, 'novo', ${c.servico}, ${c.categoria}, ${c.canal}, ${c.origem}, 'manual', ${c.mensagem}, ${c.usuarioId}, ${c.recebidoEm})`;
    await registrarEvento(tx, {
      oportunidadeId: id,
      tipo: "criado",
      texto: "Cadastrado manualmente.",
      dados: { contatoExistente: !contato.novo },
      usuarioId: c.usuarioId,
    });
    return { oportunidadeId: id, contatoExistente: !contato.novo };
  })) as { oportunidadeId: string; contatoExistente: boolean };
}

/** Oportunidade nova para uma pessoa que escreveu no WhatsApp sem ter oportunidade (ou só com encerradas). Fica "a classificar". */
export async function criarParaContato(contatoId: string, usuarioId: string): Promise<string | null> {
  const sql = await db();
  return (await sql.begin(async (tx) => {
    const [c] = await tx<{ id: string; primeira: Date | null; texto: string | null }[]>`
      select c.id,
        (select min(coalesce(m.ocorrida_em, m.criado_em)) from crm_mensagens m where m.contato_id = c.id and m.oportunidade_id is null and m.direcao = 'entrada') as primeira,
        (select m.corpo from crm_mensagens m where m.contato_id = c.id and m.oportunidade_id is null and m.direcao = 'entrada' order by coalesce(m.ocorrida_em, m.criado_em) limit 1) as texto
      from crm_contatos c where c.id = ${contatoId}`;
    if (!c) return null;
    const id = randomUUID();
    await tx`
      insert into crm_oportunidades (id, contato_id, etapa, categoria, canal, origem, registro, mensagem, responsavel_id, recebido_em)
      values (${id}, ${c.id}, 'novo', 'a-classificar', 'whatsapp', 'Escreveu no WhatsApp', 'manual', ${c.texto}, ${usuarioId}, ${c.primeira ?? new Date()})`;
    await registrarEvento(tx, { oportunidadeId: id, tipo: "criado", texto: "Oportunidade criada a partir de uma conversa do WhatsApp.", usuarioId });
    return id;
  })) as string | null;
}
