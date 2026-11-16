import { randomUUID } from "node:crypto";
import { db, type Db } from "./db";
import { registrarEvento } from "./entrada";
import { normWhatsapp } from "./normalizar";
import { ETAPAS_ABERTAS, fmtWhatsapp } from "./tipos";

// Regras da conversa de WhatsApp, independentes do provedor. O conector (src/lib/crm/whatsapp/ycloud.ts) traduz
// as notificações para os formatos abaixo; aqui fica o que elas significam para o atendimento.
//
// De quem é a vez NÃO é "a última notificação que chegou": é a comparação entre a hora real da última mensagem do
// interessado e a hora real da última resposta de uma pessoa. Assim uma notificação antiga que chega atrasada não
// apaga uma resposta nova que ainda espera retorno, e a ordem de chegada dos webhooks não importa.
//
// - Mensagem recebida      → pode deixar a oportunidade dependendo de nós e cancela a automação pendente.
// - Resposta humana        → pelo CRM ou pelo aplicativo (eco): assume o atendimento e cancela a automação.
// - Mensagem automática    → não é resposta humana; o eco dela é reconhecido pelos identificadores.
// - Entrega, leitura, eco da nossa automação, sincronização de histórico → nunca mudam de quem é a vez.

export type MidiaRef = { id?: string | null; mime?: string | null; nome?: string | null; legenda?: string | null };

export type EntradaWa = {
  provedor: string;
  provedorId: string;
  wamid?: string | null;
  /** telefone de quem escreveu, como veio do provedor (pode faltar: o WhatsApp permite esconder o número) */
  de: string | null;
  /** identificador do usuário no WhatsApp (BSUID), quando o provedor informa */
  usuarioWa?: string | null;
  nomePerfil?: string | null;
  /** text | image | audio | video | document | sticker | location | contacts | button | interactive | reaction | unsupported ... */
  tipo: string;
  texto?: string | null;
  midia?: MidiaRef | null;
  /** wamid da mensagem a que esta responde, quando o WhatsApp informa */
  respostaA?: string | null;
  /** hora real da mensagem (ISO) */
  em: string;
};

export type EcoWa = Omit<EntradaWa, "de" | "nomePerfil"> & { para: string | null };

/**
 * Resposta do número comercial que sai menos de 5 segundos depois da mensagem da pessoa não foi digitada por
 * ninguém: é a saudação ou a mensagem de ausência do aplicativo WhatsApp Business. Fica registrada como automática
 * e não conta como atendimento humano (senão esconderia uma resposta que ainda espera retorno). O recomendado é
 * desligar essas mensagens no aplicativo; isto é a proteção para o caso de ficarem ligadas.
 */
const AUTO_RESPOSTA_MS = 5000;

export type StatusWa = {
  provedor: string;
  provedorId?: string | null;
  wamid?: string | null;
  /** id que o CRM mandou junto no envio (o id da nossa mensagem) */
  externalId?: string | null;
  status: "aceita" | "enviada" | "entregue" | "lida" | "falhou";
  erro?: string | null;
  em?: string | null;
};

const ROTULO_TIPO: Record<string, string> = {
  image: "Imagem",
  audio: "Áudio",
  voice: "Áudio",
  video: "Vídeo",
  document: "Documento",
  sticker: "Figurinha",
  location: "Localização",
  contacts: "Contato compartilhado",
  order: "Pedido",
  system: "Aviso do WhatsApp",
};
const TIPOS_COM_TEXTO = new Set(["text", "button", "interactive", "template", "reaction"]);

/** Texto mostrado na conversa. O CRM guarda só texto e a referência da mídia; o arquivo fica no WhatsApp. */
export function corpoDaMensagem(tipo: string, texto: string | null | undefined, midia: MidiaRef | null | undefined): string {
  const t = (texto ?? "").trim();
  if (TIPOS_COM_TEXTO.has(tipo)) return t || (tipo === "reaction" ? "(reação removida)" : "(mensagem sem texto)");
  const rotulo = ROTULO_TIPO[tipo];
  const legenda = (midia?.legenda ?? t).trim();
  if (rotulo) return `[${rotulo}${midia?.nome ? `: ${midia.nome}` : ""}]${legenda ? ` ${legenda}` : ""} · abra no aplicativo do WhatsApp para ver`;
  return "[Conteúdo que o CRM não mostra] · confira no aplicativo do WhatsApp";
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * A pessoa pediu para parar? Só frases curtas e claras; na dúvida, não. Um falso positivo apenas suspende contatos
 * automáticos e pede conferência humana, nunca responde nada.
 */
export function pediuParaParar(texto: string | null | undefined): boolean {
  const t = semAcento((texto ?? "").trim()).replace(/\s+/g, " ");
  if (!t || t.length > 120) return false;
  if (/^(parar|pare|para|sair|stop|cancelar|cancela|descadastrar|remover|remova)[.!\s]*$/.test(t)) return true;
  return /\b(pare|para|parem) de (me )?(mandar|enviar|chamar|escrever)\b|\bnao (quero|desejo) (mais )?(receber|contato|mensagens?|ser contatad[oa])\b|\bnao (me )?(mande|envie|chame|escreva)m? mais\b|\b(nao tenho|sem) interesse\b|\bme tir[ae] d(a|essa) lista\b/.test(t);
}

/** Recalcula de quem é a vez pela hora real das mensagens. `motivo` só vale se a oportunidade passar a depender de nós. */
export async function recalcularVez(tx: Db, oportunidadeId: string, motivo?: string | null) {
  await tx`
    update crm_oportunidades o set
      aguardando = v.vez,
      pendencia = case
        when v.vez <> 'nos' or v.vez is null then null
        when ${motivo ?? null}::text is null then coalesce(o.pendencia, 'resposta')
        when o.pendencia = 'pediu_parar' then o.pendencia
        else ${motivo ?? null} end,
      atualizado_em = now()
    from (
      select id, case
        when etapa in ('ganho', 'perdido') then null
        when ultima_entrada_em is not null and (ultima_saida_humana_em is null or ultima_entrada_em > ultima_saida_humana_em) then 'nos'
        when ultimo_contato_em is not null then 'cliente'
        else aguardando end as vez
      from crm_oportunidades where id = ${oportunidadeId}
    ) v
    where o.id = v.id`;
}

/**
 * A qual oportunidade pertence uma mensagem da conversa. Sem adivinhar: resposta a uma mensagem nossa → a
 * oportunidade dela; uma única oportunidade aberta → ela; várias abertas → a única que já tem conversa no WhatsApp;
 * fora disso fica sem oportunidade, para uma pessoa associar.
 */
export async function oportunidadeDaConversa(tx: Db, contatoId: string, respostaA?: string | null): Promise<string | null> {
  if (respostaA) {
    const [m] = await tx<{ oportunidade_id: string | null }[]>`
      select m.oportunidade_id from crm_mensagens m join crm_oportunidades o on o.id = m.oportunidade_id
      where m.wamid = ${respostaA} and m.contato_id = ${contatoId} and o.etapa in ${tx(ETAPAS_ABERTAS)}`;
    if (m?.oportunidade_id) return m.oportunidade_id;
  }
  const abertas = await tx<{ id: string; tem_conversa: boolean }[]>`
    select o.id, exists (select 1 from crm_mensagens m where m.oportunidade_id = o.id and m.canal = 'whatsapp' and m.modo = 'sistema') as tem_conversa
    from crm_oportunidades o where o.contato_id = ${contatoId} and o.etapa in ${tx(ETAPAS_ABERTAS)}`;
  if (abertas.length === 1) return abertas[0].id;
  const comConversa = abertas.filter((o) => o.tem_conversa);
  return comConversa.length === 1 ? comConversa[0].id : null;
}

/** Para a automação daquela pessoa: tarefas e mensagens automáticas que ainda não saíram. */
export async function cancelarAutomacao(tx: Db, contatoId: string, motivo: string) {
  await tx`
    update crm_tarefas set status = 'cancelada', resultado = ${motivo}, atualizado_em = now()
    where status = 'pendente' and oportunidade_id in (select id from crm_oportunidades where contato_id = ${contatoId})`;
  await tx`
    update crm_mensagens set status = 'cancelada', erro = ${motivo}
    where automatica and status in ('pendente', 'falhou') and oportunidade_id in (select id from crm_oportunidades where contato_id = ${contatoId})`;
}

async function travarContato(tx: Db, chave: string) {
  await tx`select pg_advisory_xact_lock(hashtextextended(${`crm-contato:${chave}`}, 0))`;
}

/** Contato da conversa: pelo telefone normalizado; sem telefone, pelo identificador do usuário no WhatsApp. Nunca por nome. */
async function contatoDaConversa(tx: Db, fone: string | null, usuarioWa: string | null): Promise<{ id: string; wa_ultima_entrada_em: Date | null } | undefined> {
  let c: { id: string; wa_ultima_entrada_em: Date | null } | undefined;
  if (fone) [c] = await tx<{ id: string; wa_ultima_entrada_em: Date | null }[]>`select id, wa_ultima_entrada_em from crm_contatos where whatsapp = ${fone} order by criado_em limit 1`;
  if (!c && usuarioWa) [c] = await tx<{ id: string; wa_ultima_entrada_em: Date | null }[]>`select id, wa_ultima_entrada_em from crm_contatos where wa_usuario_id = ${usuarioWa} order by criado_em limit 1`;
  if (c && usuarioWa) await tx`update crm_contatos set wa_usuario_id = coalesce(wa_usuario_id, ${usuarioWa}) where id = ${c.id}`;
  return c;
}

export type ResultadoEntrada =
  | { resultado: "gravada"; mensagemId: string; contatoId: string; oportunidadeId: string | null; contatoNovo: boolean; pediuParar: boolean }
  | { resultado: "duplicada" | "sem_telefone" };

/** Mensagem recebida do interessado. Idempotente pelos identificadores do provedor. */
export async function registrarEntrada(e: EntradaWa): Promise<ResultadoEntrada> {
  const fone = normWhatsapp(e.de);
  const usuarioWa = (e.usuarioWa ?? "").trim() || null;
  if (!fone && !usuarioWa) return { resultado: "sem_telefone" };
  const sql = await db();
  return (await sql.begin(async (tx) => {
    await travarContato(tx, fone ?? `wa:${usuarioWa}`);
    const [ja] = await tx`select 1 from crm_mensagens where (provedor = ${e.provedor} and provedor_id = ${e.provedorId}) or (${e.wamid ?? null}::text is not null and wamid = ${e.wamid ?? null}) limit 1`;
    if (ja) return { resultado: "duplicada" };

    let contato: { id: string } | undefined = await contatoDaConversa(tx, fone, usuarioWa);
    const contatoNovo = !contato;
    if (!contato) {
      contato = { id: randomUUID() };
      await tx`
        insert into crm_contatos (id, nome, whatsapp, wa_usuario_id)
        values (${contato.id}, ${(e.nomePerfil ?? "").trim().slice(0, 120) || (fone ? fmtWhatsapp(fone) : "Contato do WhatsApp (número oculto)")}, ${fone}, ${usuarioWa})`;
    }
    await tx`
      update crm_contatos set
        wa_ultima_entrada_em = greatest(coalesce(wa_ultima_entrada_em, ${e.em}), ${e.em}),
        wa_nome_perfil = coalesce(${(e.nomePerfil ?? "").trim().slice(0, 120) || null}, wa_nome_perfil),
        atualizado_em = now()
      where id = ${contato.id}`;

    const oportunidadeId = await oportunidadeDaConversa(tx, contato.id, e.respostaA);
    const mensagemId = randomUUID();
    await tx`
      insert into crm_mensagens (id, oportunidade_id, contato_id, canal, direcao, modo, via, tipo, corpo, midia, status, provedor, provedor_id, wamid, resposta_a, ocorrida_em)
      values (${mensagemId}, ${oportunidadeId}, ${contato.id}, 'whatsapp', 'entrada', 'sistema', 'webhook', ${e.tipo}, ${corpoDaMensagem(e.tipo, e.texto, e.midia).slice(0, 8000)},
        ${e.midia ? tx.json(e.midia as never) : null}, 'recebida', ${e.provedor}, ${e.provedorId}, ${e.wamid ?? null}, ${e.respostaA ?? null}, ${e.em})`;

    // Reação (curtida numa mensagem) fica registrada, mas não é uma resposta que peça retorno.
    if (e.tipo === "reaction") return { resultado: "gravada", mensagemId, contatoId: contato.id, oportunidadeId, contatoNovo, pediuParar: false };

    const parar = e.tipo === "text" && pediuParaParar(e.texto);
    if (parar) {
      await tx`update crm_contatos set wa_bloqueado_em = coalesce(wa_bloqueado_em, ${e.em}), wa_bloqueio_motivo = ${(e.texto ?? "").slice(0, 200)} where id = ${contato.id}`;
    }
    await cancelarAutomacao(tx, contato.id, parar ? "O interessado pediu para parar." : "O interessado respondeu antes do envio automático.");

    if (oportunidadeId) {
      const naoMostra = !TIPOS_COM_TEXTO.has(e.tipo) && !ROTULO_TIPO[e.tipo];
      const [antes] = await tx<{ aguardando: string | null }[]>`select aguardando from crm_oportunidades where id = ${oportunidadeId} for update`;
      await tx`update crm_oportunidades set ultima_entrada_em = greatest(coalesce(ultima_entrada_em, ${e.em}), ${e.em}) where id = ${oportunidadeId}`;
      await recalcularVez(tx, oportunidadeId, parar ? "pediu_parar" : naoMostra ? "nao_suportado" : "resposta");
      const [depois] = await tx<{ aguardando: string | null }[]>`
        update crm_oportunidades set etapa = case when aguardando = 'nos' and ${!parar} and etapa in ('novo', 'aguardando_resposta') then 'em_conversa' else etapa end
        where id = ${oportunidadeId} returning aguardando`;
      if (parar) await registrarEvento(tx, { oportunidadeId, tipo: "pediu_parar", texto: "O interessado pediu para parar. Contatos automáticos suspensos para este número.", em: e.em });
      else if (antes?.aguardando !== "nos" && depois?.aguardando === "nos") await registrarEvento(tx, { oportunidadeId, tipo: "resposta", texto: "Resposta recebida pelo WhatsApp.", em: e.em });
    }
    return { resultado: "gravada", mensagemId, contatoId: contato.id, oportunidadeId, contatoNovo, pediuParar: parar };
  })) as ResultadoEntrada;
}

/**
 * Efeitos de uma resposta humana a uma pessoa (pelo CRM, pelo aplicativo ou registrada à mão no WhatsApp):
 * a automação daquela pessoa para; o que dependia de nós e é anterior à resposta deixa de depender.
 */
export async function aplicarRespostaHumana(tx: Db, r: { contatoId: string; oportunidadeId: string | null; em: string; usuarioId?: string | null; origem: "crm" | "app" }) {
  await cancelarAutomacao(tx, r.contatoId, "Atendimento assumido por uma pessoa antes do envio.");
  const afetadas = await tx<{ id: string; assumiu: boolean }[]>`
    update crm_oportunidades o set
      assumida_em = coalesce(o.assumida_em, ${r.em}),
      responsavel_id = coalesce(o.responsavel_id, ${r.usuarioId ?? null}),
      ultima_saida_humana_em = case
        when o.id = ${r.oportunidadeId}::uuid or (o.ultima_entrada_em is not null and o.ultima_entrada_em <= ${r.em})
          then greatest(coalesce(o.ultima_saida_humana_em, ${r.em}), ${r.em})
        else o.ultima_saida_humana_em end,
      atualizado_em = now()
    from (select id, assumida_em is null as assumiu from crm_oportunidades where contato_id = ${r.contatoId} and etapa in ${tx(ETAPAS_ABERTAS)} for update) antes
    where o.id = antes.id
    returning o.id, antes.assumiu`;
  if (r.oportunidadeId) {
    await tx`
      update crm_oportunidades set
        primeiro_contato_em = coalesce(primeiro_contato_em, ${r.em}),
        ultimo_contato_em = greatest(coalesce(ultimo_contato_em, ${r.em}), ${r.em}),
        ultima_saida_humana_em = greatest(coalesce(ultima_saida_humana_em, ${r.em}), ${r.em}),
        etapa = case when etapa = 'novo' then 'aguardando_resposta' else etapa end
      where id = ${r.oportunidadeId}`;
  }
  for (const o of afetadas) {
    await recalcularVez(tx, o.id);
    if (o.assumiu) {
      await registrarEvento(tx, {
        oportunidadeId: o.id,
        tipo: "assumido",
        texto: r.origem === "app" ? "Atendimento assumido: resposta enviada pelo aplicativo do WhatsApp." : "Atendimento assumido.",
        usuarioId: r.usuarioId ?? null,
      });
    }
  }
}

const igual = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

export type ResultadoEco = { resultado: "propria" | "humana" | "automatica_do_app" | "duplicada" | "fora_do_crm" | "sem_telefone"; mensagemId?: string; oportunidadeId?: string | null };

/**
 * Mensagem enviada pelo número da empresa e sincronizada pelo provedor (eco). Pode ser uma resposta humana pelo
 * aplicativo OU o eco de uma mensagem que o próprio CRM enviou pela API. É "própria" quando os identificadores batem
 * com uma mensagem nossa, ou quando há uma mensagem nossa recém-enviada, ainda sem identificador do WhatsApp, com o
 * mesmo texto para a mesma pessoa. Eco próprio nunca conta como atendimento humano.
 */
export async function registrarEco(e: EcoWa): Promise<ResultadoEco> {
  const fone = normWhatsapp(e.para);
  const usuarioWa = (e.usuarioWa ?? "").trim() || null;
  if (!fone && !usuarioWa) return { resultado: "sem_telefone" };
  const sql = await db();
  return (await sql.begin(async (tx) => {
    await travarContato(tx, fone ?? `wa:${usuarioWa}`);
    const [ja] = await tx<{ id: string; via: string | null; wamid: string | null }[]>`
      select id, via, wamid from crm_mensagens
      where (provedor = ${e.provedor} and provedor_id = ${e.provedorId}) or (${e.wamid ?? null}::text is not null and wamid = ${e.wamid ?? null}) limit 1`;
    if (ja) return { resultado: ja.via === "api" ? "propria" : "duplicada", mensagemId: ja.id };

    const contato = await contatoDaConversa(tx, fone, usuarioWa);
    // Conversa do número da empresa com alguém que não está no CRM (fornecedor, parceiro): não vira contato.
    if (!contato) return { resultado: "fora_do_crm" };

    const corpo = corpoDaMensagem(e.tipo, e.texto, e.midia).slice(0, 8000);
    // Nossa mensagem pela API cujo identificador do WhatsApp ainda não chegou (resposta lenta ou envio incerto).
    const candidatas = await tx<{ id: string; corpo: string; status: string }[]>`
      select id, corpo, status from crm_mensagens
      where contato_id = ${contato.id} and canal = 'whatsapp' and direcao = 'saida' and via = 'api' and wamid is null
        and status in ('enviando', 'incerta', 'aceita', 'enviada')
        and criado_em between ${e.em}::timestamptz - interval '10 minutes' and ${e.em}::timestamptz + interval '2 minutes'
      order by criado_em desc`;
    const nossa = candidatas.find((c) => igual(c.corpo, corpo));
    if (nossa) {
      await tx`
        update crm_mensagens set wamid = ${e.wamid ?? null}, ocorrida_em = coalesce(ocorrida_em, ${e.em}),
          status = case when status in ('enviando', 'incerta', 'aceita') then 'enviada' else status end,
          enviado_em = coalesce(enviado_em, ${e.em}), erro = case when status = 'incerta' then null else erro end
        where id = ${nossa.id}`;
      return { resultado: "propria", mensagemId: nossa.id };
    }

    const oportunidadeId = await oportunidadeDaConversa(tx, contato.id, e.respostaA);
    const desdeEntrada = contato.wa_ultima_entrada_em ? new Date(e.em).getTime() - new Date(contato.wa_ultima_entrada_em).getTime() : -1;
    const autoResposta = desdeEntrada >= 0 && desdeEntrada < AUTO_RESPOSTA_MS;
    const mensagemId = randomUUID();
    await tx`
      insert into crm_mensagens (id, oportunidade_id, contato_id, canal, direcao, modo, via, tipo, automatica, corpo, midia, status, provedor, provedor_id, wamid, resposta_a, ocorrida_em, enviado_em)
      values (${mensagemId}, ${oportunidadeId}, ${contato.id}, 'whatsapp', 'saida', 'sistema', 'app', ${e.tipo}, ${autoResposta}, ${corpo}, ${e.midia ? tx.json(e.midia as never) : null},
        'enviada', ${e.provedor}, ${e.provedorId}, ${e.wamid ?? null}, ${e.respostaA ?? null}, ${e.em}, ${e.em})`;
    if (autoResposta) return { resultado: "automatica_do_app", mensagemId, oportunidadeId };
    await aplicarRespostaHumana(tx, { contatoId: contato.id, oportunidadeId, em: e.em, origem: "app" });
    return { resultado: "humana", mensagemId, oportunidadeId };
  })) as ResultadoEco;
}

const ORDEM: Record<string, number> = { pendente: 0, enviando: 1, incerta: 1, aceita: 2, enviada: 3, entregue: 4, lida: 5 };

/**
 * Mensagem nossa aceita (ou confirmada depois de um resultado incerto): a oportunidade passa a aguardar o
 * interessado. Mensagem automática não assume o atendimento nem conta como resposta humana.
 */
export async function efeitosDoEnvioAceito(tx: Db, mensagemId: string, em: string) {
  const [m] = await tx<{ oportunidade_id: string | null; contato_id: string | null; automatica: boolean; usuario_id: string | null }[]>`
    select oportunidade_id, contato_id, automatica, usuario_id from crm_mensagens where id = ${mensagemId}`;
  if (!m?.oportunidade_id) return;
  if (m.automatica) {
    await tx`
      update crm_oportunidades set
        primeiro_contato_em = coalesce(primeiro_contato_em, ${em}), ultimo_contato_em = greatest(coalesce(ultimo_contato_em, ${em}), ${em}),
        etapa = case when etapa = 'novo' then 'aguardando_resposta' else etapa end
      where id = ${m.oportunidade_id}`;
    await recalcularVez(tx, m.oportunidade_id);
    // Inclui a tarefa que tinha falhado e cuja mensagem saiu numa nova tentativa (e-mail reenviado pela rotina).
    await tx`update crm_tarefas set status = 'concluida', resultado = 'Primeiro contato enviado.', atualizado_em = now() where mensagem_id = ${mensagemId} and status in ('processando', 'incerta', 'falhou')`;
  } else if (m.contato_id) {
    await aplicarRespostaHumana(tx, { contatoId: m.contato_id, oportunidadeId: m.oportunidade_id, em, usuarioId: m.usuario_id, origem: "crm" });
  }
}

/** Mensagem automática que falhou de vez: o contato volta a ser um novo sem primeiro contato, para ação manual. */
async function efeitosDaFalha(tx: Db, mensagemId: string, erro: string) {
  const [m] = await tx<{ oportunidade_id: string | null; automatica: boolean }[]>`select oportunidade_id, automatica from crm_mensagens where id = ${mensagemId}`;
  if (!m?.oportunidade_id) return;
  if (m.automatica) {
    await tx`
      update crm_oportunidades o set
        etapa = case when o.etapa = 'aguardando_resposta' and o.assumida_em is null then 'novo' else o.etapa end,
        aguardando = case when o.assumida_em is null and o.ultima_entrada_em is null then null else o.aguardando end,
        primeiro_contato_em = case when exists (
            select 1 from crm_mensagens x where x.oportunidade_id = o.id and x.direcao = 'saida' and x.id <> ${mensagemId}
              and x.status in ('aceita', 'enviada', 'entregue', 'lida', 'registrada')) then o.primeiro_contato_em else null end,
        atualizado_em = now()
      where o.id = ${m.oportunidade_id}`;
    await tx`update crm_tarefas set status = 'falhou', resultado = ${`O WhatsApp não entregou o primeiro contato: ${erro}`.slice(0, 300)}, atualizado_em = now() where mensagem_id = ${mensagemId}`;
  }
  await registrarEvento(tx, { oportunidadeId: m.oportunidade_id, tipo: "mensagem_falhou", texto: `A mensagem de WhatsApp falhou: ${erro}`.slice(0, 300) });
}

export type ResultadoStatus = { resultado: "atualizada" | "sem_mudanca" | "desconhecida"; mensagemId?: string };

/**
 * Estado de uma mensagem nossa (aceita, enviada, entregue, lida, falhou). Só avança: uma notificação antiga que
 * chega depois não rebaixa o estado. Também resolve um envio de resultado incerto. Nunca muda de quem é a vez por
 * entrega ou leitura.
 */
export async function aplicarStatus(s: StatusWa): Promise<ResultadoStatus> {
  const sql = await db();
  const ext = s.externalId && /^[0-9a-f-]{36}$/.test(s.externalId) ? s.externalId : null;
  return (await sql.begin(async (tx) => {
    const [m] = await tx<{ id: string; status: string }[]>`
      select id, status from crm_mensagens
      where direcao = 'saida' and ((${ext}::uuid is not null and id = ${ext}::uuid)
        or (${s.provedorId ?? null}::text is not null and provedor = ${s.provedor} and provedor_id = ${s.provedorId ?? null})
        or (${s.wamid ?? null}::text is not null and wamid = ${s.wamid ?? null}))
      order by (id = ${ext}::uuid) desc nulls last limit 1 for update`;
    if (!m) return { resultado: "desconhecida" };
    const em = s.em ?? new Date().toISOString();
    // Completa os identificadores do provedor que ainda faltavam (só se nenhuma outra linha já os usa).
    await tx`
      update crm_mensagens m set provedor = coalesce(m.provedor, ${s.provedor}), provedor_id = coalesce(m.provedor_id, ${s.provedorId ?? null}), wamid = coalesce(m.wamid, ${s.wamid ?? null})
      where m.id = ${m.id} and (m.provedor_id is null or m.wamid is null)
        and not exists (select 1 from crm_mensagens x where x.id <> m.id
          and ((${s.wamid ?? null}::text is not null and x.wamid = ${s.wamid ?? null})
            or (${s.provedorId ?? null}::text is not null and x.provedor = ${s.provedor} and x.provedor_id = ${s.provedorId ?? null})))`;
    const antes = ORDEM[m.status] ?? (m.status === "falhou" ? 2 : 9);
    if (s.status === "falhou") {
      // Falha depois de entregue ou lida não faz sentido: ignora. Falha repetida: nada a fazer.
      if (m.status === "falhou" || antes >= ORDEM.entregue) return { resultado: "sem_mudanca", mensagemId: m.id };
      await tx`update crm_mensagens set status = 'falhou', erro = ${(s.erro ?? "O WhatsApp recusou a mensagem.").slice(0, 300)} where id = ${m.id}`;
      await efeitosDaFalha(tx, m.id, s.erro ?? "o WhatsApp recusou a mensagem");
      return { resultado: "atualizada", mensagemId: m.id };
    }
    const novo = ORDEM[s.status];
    if (m.status === "cancelada" || novo <= antes) {
      // Mesmo sem avançar, guarda a hora de entrega/leitura se ainda não havia.
      if (s.status === "entregue") await tx`update crm_mensagens set entregue_em = coalesce(entregue_em, ${em}) where id = ${m.id}`;
      if (s.status === "lida") await tx`update crm_mensagens set lida_em = coalesce(lida_em, ${em}) where id = ${m.id}`;
      return { resultado: "sem_mudanca", mensagemId: m.id };
    }
    await tx`
      update crm_mensagens set status = ${s.status}, erro = null,
        enviado_em = coalesce(enviado_em, ${em}),
        ocorrida_em = coalesce(ocorrida_em, ${em}),
        entregue_em = case when ${s.status} in ('entregue', 'lida') then coalesce(entregue_em, ${em}) else entregue_em end,
        lida_em = case when ${s.status} = 'lida' then coalesce(lida_em, ${em}) else lida_em end
      where id = ${m.id}`;
    // Saiu de "enviando", "resultado incerto" ou de uma falha provisória para um estado confirmado: aplica os efeitos do envio.
    if (antes < ORDEM.aceita || m.status === "falhou") await efeitosDoEnvioAceito(tx, m.id, em);
    return { resultado: "atualizada", mensagemId: m.id };
  })) as ResultadoStatus;
}

/** Associa à oportunidade as mensagens da pessoa que ficaram sem oportunidade e recalcula de quem é a vez. */
export async function associarMensagens(oportunidadeId: string, usuarioId: string): Promise<number> {
  const sql = await db();
  return (await sql.begin(async (tx) => {
    const [o] = await tx<{ contato_id: string }[]>`select contato_id from crm_oportunidades where id = ${oportunidadeId} for update`;
    if (!o) return 0;
    const ms = await tx<{ direcao: string; via: string | null; em: Date; automatica: boolean }[]>`
      update crm_mensagens set oportunidade_id = ${oportunidadeId}
      where contato_id = ${o.contato_id} and oportunidade_id is null
      returning direcao, via, coalesce(ocorrida_em, criado_em) as em, automatica`;
    if (!ms.length) return 0;
    const max = (xs: Date[]) => (xs.length ? new Date(Math.max(...xs.map((d) => new Date(d).getTime()))).toISOString() : null);
    const entrada = max(ms.filter((m) => m.direcao === "entrada").map((m) => m.em));
    const saida = max(ms.filter((m) => m.direcao === "saida" && !m.automatica).map((m) => m.em));
    await tx`
      update crm_oportunidades set
        ultima_entrada_em = case when ${entrada}::timestamptz is null then ultima_entrada_em else greatest(coalesce(ultima_entrada_em, ${entrada}), ${entrada}) end,
        ultima_saida_humana_em = case when ${saida}::timestamptz is null then ultima_saida_humana_em else greatest(coalesce(ultima_saida_humana_em, ${saida}), ${saida}) end,
        ultimo_contato_em = case when ${saida}::timestamptz is null then ultimo_contato_em else greatest(coalesce(ultimo_contato_em, ${saida}), ${saida}) end,
        primeiro_contato_em = case when ${saida}::timestamptz is null then primeiro_contato_em else coalesce(primeiro_contato_em, ${saida}) end
      where id = ${oportunidadeId}`;
    await recalcularVez(tx, oportunidadeId, "resposta");
    await tx`update crm_oportunidades set etapa = 'em_conversa' where id = ${oportunidadeId} and aguardando = 'nos' and etapa in ('novo', 'aguardando_resposta')`;
    await registrarEvento(tx, { oportunidadeId, tipo: "mensagens_associadas", texto: `${ms.length} ${ms.length === 1 ? "mensagem do WhatsApp associada" : "mensagens do WhatsApp associadas"} a esta oportunidade.`, usuarioId });
    return ms.length;
  })) as number;
}

/** Marca como conferidas as mensagens sem oportunidade de um contato (não era um pedido comercial). */
export async function conferirMensagens(contatoId: string): Promise<void> {
  const sql = await db();
  await sql`update crm_mensagens set conferida_em = now() where contato_id = ${contatoId} and oportunidade_id is null and conferida_em is null`;
}
