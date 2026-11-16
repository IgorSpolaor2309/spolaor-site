"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acessoPronto, entrarComCodigo, exigirUsuario, renomearUsuario, sair, solicitarCodigo } from "@/lib/crm/auth";
import { enviarAviso } from "@/lib/crm/aviso";
import { db } from "@/lib/crm/db";
import { associarMensagens, conferirMensagens, efeitosDoEnvioAceito, reclassificarEco } from "@/lib/crm/conversa";
import { cadastrarManual, criarParaContato, registrarEvento } from "@/lib/crm/entrada";
import { emailCliente, enfileirarEmail, enviarMensagem, restaurarModelo, salvarModelo } from "@/lib/crm/mensagens";
import { normEmail, normWhatsapp, texto, valorMonetario } from "@/lib/crm/normalizar";
import {
  adicionarCusto,
  adicionarNota,
  assumirAtendimento,
  definirProximaAcao,
  definirResponsavel,
  editarContato,
  editarServico,
  marcarTeste,
  registrarContatoFeito,
  registrarResposta,
  removerCusto,
  salvarNegocio,
} from "@/lib/crm/operacoes";
import { CATEGORIAS, deInputLocal, ETAPAS, isCanal, isCanalMensagem, isCategoria, isCustoTipo, isEtapa, type Categoria } from "@/lib/crm/tipos";
import { definirCanalAutomacao, salvarFrases, salvarLimitesAutomacao, salvarModeloPrimeiroContato, salvarNumerosControle, salvarTextosAutomaticosApp, textosAutomaticosApp, VARIAVEIS_MODELO, waEnvio } from "@/lib/crm/whatsapp/config";
import { iniciarValidacao } from "@/lib/crm/whatsapp/validacao";
import { enviarWhatsapp } from "@/lib/crm/whatsapp/envio";
import { listarModelos, modeloAprovado } from "@/lib/crm/whatsapp/ycloud";
import { randomUUID } from "node:crypto";

// Ações do CRM. TODAS (menos as duas de entrada) começam por exigirUsuario(): uma Server Action é um endpoint
// público, então a sessão é conferida aqui, não só na página que mostra o botão.

const uuid = (v: FormDataEntryValue | null) => (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : null);
const s = (fd: FormData, k: string, max = 500) => texto(fd.get(k), max);
const ficha = (id: string, msg?: string) => `/leads/o/${id}${msg ? `?msg=${msg}` : ""}`;

function atualizar(id?: string) {
  revalidatePath("/leads", "layout");
  if (id) revalidatePath(ficha(id));
}

/* ───────────────────────────── entrada e saída ───────────────────────────── */

export type EstadoEntrada = { etapa: "email" | "codigo"; email: string; erro?: string };

export async function pedirCodigoAction(_prev: EstadoEntrada, fd: FormData): Promise<EstadoEntrada> {
  const email = normEmail(String(fd.get("email") ?? ""));
  if (!email) return { etapa: "email", email: "", erro: "Informe um e-mail válido." };
  if (!acessoPronto().pronto) return { etapa: "email", email, erro: "O acesso ainda não está configurado neste ambiente." };
  try {
    if ((await solicitarCodigo(email)) === "falha_envio") return { etapa: "email", email, erro: "Não foi possível enviar o código agora. Tente de novo em instantes." };
  } catch {
    return { etapa: "email", email, erro: "O banco de dados não respondeu. Tente de novo em instantes." };
  }
  return { etapa: "codigo", email };
}

export async function entrarAction(prev: EstadoEntrada, fd: FormData): Promise<EstadoEntrada> {
  const email = String(fd.get("email") ?? prev.email);
  let ok = false;
  try {
    ok = await entrarComCodigo(email, String(fd.get("codigo") ?? ""));
  } catch {
    return { etapa: "codigo", email, erro: "O banco de dados não respondeu. Tente de novo em instantes." };
  }
  if (!ok) return { etapa: "codigo", email, erro: "Código incorreto ou vencido. Confira os 6 dígitos ou peça um novo código." };
  redirect("/leads");
}

export async function sairAction() {
  await sair();
  redirect("/leads/entrar");
}

/* ───────────────────────────── oportunidade ───────────────────────────── */

export async function assumirAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  if (!id) return;
  await assumirAtendimento(id, u.id);
  atualizar(id);
}

export async function negocioAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  const etapa = fd.get("etapa");
  if (!id || !isEtapa(etapa)) return;
  await salvarNegocio(id, { etapa, valorProposta: valorMonetario(fd.get("valorProposta")), valorFechado: valorMonetario(fd.get("valorFechado")), motivoPerda: s(fd, "motivoPerda", 300) }, u.id);
  atualizar(id);
  redirect(ficha(id, "salvo"));
}

/** Botão "Avançar" do funil: só entre etapas abertas, sem mexer em valores. */
export async function avancarAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  if (!id) return;
  const sql = await db();
  const [o] = await sql<{ etapa: (typeof ETAPAS)[number]; valor_proposta: string | null; valor_fechado: string | null }[]>`
    select etapa, valor_proposta, valor_fechado from crm_oportunidades where id = ${id}`;
  const i = o ? ETAPAS.indexOf(o.etapa) : -1;
  if (i < 0 || i > 2) return;
  await salvarNegocio(id, { etapa: ETAPAS[i + 1], valorProposta: o.valor_proposta === null ? null : Number(o.valor_proposta), valorFechado: null, motivoPerda: null }, u.id);
  atualizar(id);
}

export async function proximaAcaoAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  if (!id) return;
  const concluir = fd.get("concluir") === "1";
  const quando = concluir ? null : deInputLocal(fd.get("quando"));
  const oQue = concluir ? null : s(fd, "texto", 300);
  if (!concluir && !quando) redirect(ficha(id, "data"));
  await definirProximaAcao(id, oQue, quando, u.id);
  atualizar(id);
  redirect(ficha(id, "salvo"));
}

export async function contatoFeitoAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  const canal = fd.get("canal");
  if (!id || !isCanalMensagem(canal)) return;
  await registrarContatoFeito(id, canal, s(fd, "corpo", 4000), u.id);
  atualizar(id);
  redirect(ficha(id, "contato"));
}

export async function respostaAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  const canal = fd.get("canal");
  if (!id || !isCanalMensagem(canal)) return;
  await registrarResposta(id, canal, s(fd, "corpo", 4000), u.id);
  atualizar(id);
  redirect(ficha(id, "resposta"));
}

/** Envia um e-mail ao interessado pelo provedor (Resend). É o único canal em que o CRM envia de verdade. */
export async function enviarEmailAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  const assunto = s(fd, "assunto", 200);
  const corpo = s(fd, "corpo", 8000);
  const chave = s(fd, "chave", 80);
  if (!id) return;
  if (!emailCliente().pronto) redirect(ficha(id, "email-config"));
  if (!assunto || !corpo || !chave) redirect(ficha(id, "email-vazio"));
  const sql = await db();
  // A chave vem do formulário aberto: reenviar o mesmo formulário (clique duplo, voltar e enviar) não duplica.
  const msgId = await enfileirarEmail(sql, { oportunidadeId: id, assunto, corpo, chave: `manual:${id}:${chave}`, automatica: false, usuarioId: u.id });
  if (!msgId) redirect(ficha(id, "email-repetido"));
  const r = await enviarMensagem(msgId);
  if (r === "enviada") {
    await sql.begin(async (tx) => {
      await tx`
        update crm_oportunidades set assumida_em = coalesce(assumida_em, now()), responsavel_id = coalesce(responsavel_id, ${u.id}), aguardando = 'cliente',
          etapa = case when etapa = 'novo' then 'aguardando_resposta' else etapa end, atualizado_em = now()
        where id = ${id}`;
      await tx`
        update crm_mensagens set status = 'cancelada', erro = 'Atendimento assumido por uma pessoa antes do envio.'
        where oportunidade_id = ${id} and automatica and status in ('pendente', 'falhou')`;
    });
  }
  atualizar(id);
  redirect(ficha(id, r === "enviada" ? "email-enviado" : "email-falhou"));
}

export async function reenviarMensagemAction(fd: FormData) {
  await exigirUsuario();
  const id = uuid(fd.get("id"));
  const msg = uuid(fd.get("mensagem"));
  if (!id || !msg) return;
  const r = await enviarMensagem(msg, true);
  atualizar(id);
  redirect(ficha(id, r === "enviada" ? "email-enviado" : r === "cancelada" ? "email-cancelado" : r === "ignorada" ? "salvo" : "email-falhou"));
}

export async function reenviarAvisoAction(fd: FormData) {
  await exigirUsuario();
  const id = uuid(fd.get("id"));
  const envio = uuid(fd.get("envio"));
  if (!id || !envio) return;
  const r = await enviarAviso(envio, true);
  atualizar(id);
  redirect(ficha(id, r === "enviado" ? "aviso-enviado" : "aviso-falhou"));
}

export async function notaAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  const nota = s(fd, "nota", 4000);
  if (!id || !nota) return;
  await adicionarNota(id, nota, u.id);
  atualizar(id);
  redirect(ficha(id, "nota"));
}

export async function responsavelAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  if (!id) return;
  await definirResponsavel(id, uuid(fd.get("responsavel")), u.id);
  atualizar(id);
  redirect(ficha(id, "salvo"));
}

export async function testeAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  if (!id) return;
  await marcarTeste(id, fd.get("teste") === "1", u.id);
  atualizar(id);
  redirect(ficha(id, "salvo"));
}

export async function contatoAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  if (!id) return;
  const r = await editarContato(
    id,
    { nome: String(fd.get("nome") ?? ""), empresa: s(fd, "empresa", 200), whatsapp: s(fd, "whatsapp", 40), email: s(fd, "email", 200), instagram: s(fd, "instagram", 80), site: s(fd, "site", 300) },
    u.id,
  );
  const categoria = fd.get("categoria");
  if (r.ok && isCategoria(categoria)) await editarServico(id, categoria, s(fd, "servico", 200), u.id);
  atualizar(id);
  redirect(ficha(id, r.ok ? "salvo" : r.erro));
}

/* ───────────────────────────── cadastro manual ───────────────────────────── */

export type EstadoCadastro = { erro?: string };

export async function cadastrarAction(_prev: EstadoCadastro, fd: FormData): Promise<EstadoCadastro> {
  const u = await exigirUsuario();
  const nome = s(fd, "nome", 200);
  const canal = fd.get("canal");
  const whatsappRaw = s(fd, "whatsapp", 40);
  const emailRaw = s(fd, "email", 200);
  if (!nome || nome.length < 2) return { erro: "Informe o nome da pessoa." };
  if (!isCanal(canal) || canal === "formulario") return { erro: "Escolha por onde o contato chegou." };
  if (whatsappRaw && !normWhatsapp(whatsappRaw)) return { erro: "WhatsApp inválido: informe DDD e número." };
  if (emailRaw && !normEmail(emailRaw)) return { erro: "E-mail inválido." };
  const recebido = deInputLocal(fd.get("recebidoEm")) ?? new Date().toISOString();
  if (new Date(recebido).getTime() > Date.now() + 5 * 60_000) return { erro: "A data de chegada não pode estar no futuro." };
  const r = await cadastrarManual({
    nome,
    empresa: s(fd, "empresa", 200),
    whatsapp: whatsappRaw,
    email: emailRaw,
    instagram: s(fd, "instagram", 80),
    site: s(fd, "site", 300),
    servico: s(fd, "servico", 200),
    categoria: isCategoria(fd.get("categoria")) ? (fd.get("categoria") as Categoria) : "a-classificar",
    canal,
    origem: s(fd, "origem", 200),
    mensagem: s(fd, "mensagem", 4000),
    recebidoEm: recebido,
    usuarioId: u.id,
  });
  atualizar();
  redirect(ficha(r.oportunidadeId, r.contatoExistente ? "contato-existente" : "criado"));
}

/* ───────────────────────────── custos, modelos, automação ───────────────────────────── */

export async function custoAction(fd: FormData) {
  const u = await exigirUsuario();
  const tipo = fd.get("tipo");
  const inicio = String(fd.get("inicio") ?? "");
  const fim = String(fd.get("fim") ?? "");
  const valor = valorMonetario(fd.get("valor"));
  const dataOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
  if (!isCustoTipo(tipo) || !dataOk(inicio) || !dataOk(fim) || fim < inicio || valor === null) redirect("/leads/indicadores?msg=custo-invalido#custos");
  await adicionarCusto({ tipo, inicio, fim, valor, estimado: fd.get("estimado") === "1", nota: s(fd, "nota", 300) }, u.id);
  revalidatePath("/leads/indicadores");
  redirect("/leads/indicadores?msg=custo-salvo#custos");
}

export async function removerCustoAction(fd: FormData) {
  await exigirUsuario();
  const id = uuid(fd.get("id"));
  if (!id) return;
  await removerCusto(id);
  revalidatePath("/leads/indicadores");
  redirect("/leads/indicadores?msg=custo-removido#custos");
}

export async function modeloAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = String(fd.get("id") ?? "");
  if (fd.get("restaurar") === "1") await restaurarModelo(id);
  else {
    const corpo = s(fd, "corpo", 4000);
    if (!corpo) redirect("/leads/configuracoes?msg=modelo-vazio");
    await salvarModelo(id, s(fd, "assunto", 200), corpo, u.id);
  }
  revalidatePath("/leads", "layout");
  redirect("/leads/configuracoes?msg=modelo-salvo");
}

/** Canal do primeiro contato automático: desligado, WhatsApp ou e-mail. Um só, para a mesma recepção não sair duas vezes. */
export async function automacaoAction(fd: FormData) {
  const u = await exigirUsuario();
  const canal = fd.get("canal");
  if (canal !== "desligado" && canal !== "whatsapp" && canal !== "email") return;
  if (canal === "email" && !emailCliente().pronto) redirect("/leads/configuracoes?msg=email-config");
  // WhatsApp só liga com tudo o que o envio precisa: credenciais, número e um modelo aprovado escolhido.
  if (canal === "whatsapp") {
    if (!waEnvio().pronto) redirect("/leads/configuracoes?msg=wa-config");
    const m = await (await import("@/lib/crm/whatsapp/config")).modeloPrimeiroContato();
    if (!m.nome) redirect("/leads/configuracoes?msg=wa-modelo");
    const ok = await modeloAprovado(m.nome, m.idioma, true);
    if (!ok.ok) redirect("/leads/configuracoes?msg=wa-modelo");
  }
  await definirCanalAutomacao(canal, u.id);
  revalidatePath("/leads", "layout");
  redirect("/leads/configuracoes?msg=automacao");
}

/** Modelo aprovado usado no primeiro contato pelo WhatsApp, o que entra em cada variável e a frase de cada serviço. */
export async function modeloWhatsappAction(fd: FormData) {
  const u = await exigirUsuario();
  const nome = (s(fd, "nome", 120) ?? "").toLowerCase();
  if (nome && !/^[a-z0-9_]{1,120}$/.test(nome)) redirect("/leads/configuracoes?msg=wa-nome");
  const variaveis = [1, 2, 3, 4].map((i) => String(fd.get(`var${i}`) ?? "")).filter((v) => (VARIAVEIS_MODELO as readonly string[]).includes(v));
  await salvarModeloPrimeiroContato({ nome, idioma: s(fd, "idioma", 12) ?? "pt_BR", variaveis }, u.id);
  const fr: Partial<Record<Categoria, string>> = {};
  for (const c of CATEGORIAS) {
    const v = s(fd, `frase-${c}`, 120);
    if (v) fr[c] = v;
  }
  await salvarFrases(fr, u.id);
  await listarModelos(true).catch(() => null);
  revalidatePath("/leads", "layout");
  redirect("/leads/configuracoes?msg=wa-salvo");
}

export async function nomeAction(fd: FormData) {
  const u = await exigirUsuario();
  const nome = s(fd, "nome", 60);
  if (nome && nome.length >= 2) await renomearUsuario(u.id, nome);
  revalidatePath("/leads", "layout");
  redirect("/leads/configuracoes?msg=salvo");
}

/* ───────────────────────────── WhatsApp pelo CRM ───────────────────────────── */

/**
 * Envia uma mensagem de WhatsApp pelo número da empresa. Dentro da janela de 24 h (contada da última mensagem da
 * pessoa) vai o texto escrito; fora dela a Meta só aceita o modelo aprovado. A chave vem do formulário aberto:
 * clique duplo ou reenvio do mesmo formulário não manda duas vezes.
 */
export async function enviarWhatsappAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  const chave = s(fd, "chave", 80);
  const modo = fd.get("modo") === "modelo" ? "modelo" : "texto";
  const corpo = s(fd, "corpo", 4000);
  if (!id || !chave) return;
  if (!waEnvio().pronto) redirect(ficha(id, "wa-config"));
  const sql = await db();
  const [o] = await sql<{ contato_id: string; whatsapp: string | null; nome: string; empresa: string | null; categoria: string | null; janela: boolean }[]>`
    select o.contato_id, c.whatsapp, c.nome, c.empresa, o.categoria,
      (c.wa_ultima_entrada_em is not null and c.wa_ultima_entrada_em > now() - interval '24 hours') as janela
    from crm_oportunidades o join crm_contatos c on c.id = o.contato_id where o.id = ${id}`;
  if (!o?.whatsapp) redirect(ficha(id, "wa-sem-numero"));

  let envio: Parameters<typeof enviarWhatsapp>[1];
  let texto: string;
  let nomeModelo: string | null = null;
  if (modo === "texto") {
    if (!corpo) redirect(ficha(id, "wa-vazio"));
    // A janela é conferida aqui, no servidor, com a hora da última mensagem recebida.
    if (!o.janela) redirect(ficha(id, "wa-janela"));
    envio = { tipo: "texto", para: o.whatsapp, texto: corpo };
    texto = corpo;
  } else {
    const cfg = await import("@/lib/crm/whatsapp/config");
    const m = await cfg.modeloPrimeiroContato();
    const aprovado = m.nome ? await modeloAprovado(m.nome, m.idioma) : ({ ok: false, motivo: "" } as const);
    if (!aprovado.ok) redirect(ficha(id, "wa-modelo"));
    const fr = await cfg.frases();
    const parametros = cfg.parametrosDoModelo(m, { nome: o.nome, empresa: o.empresa, pedido: fr[isCategoria(o.categoria) ? o.categoria : "a-classificar"] });
    envio = { tipo: "modelo", para: o.whatsapp, modelo: m.nome, idioma: m.idioma, parametros };
    texto = cfg.textoDoModelo(aprovado.corpo, parametros, m.nome);
    nomeModelo = m.nome;
  }
  const mensagemId = randomUUID();
  const r0 = await sql`
    insert into crm_mensagens (id, oportunidade_id, contato_id, canal, direcao, modo, via, tipo, automatica, corpo, status, chave, provedor, modelo, usuario_id, tentativas, tentado_em)
    values (${mensagemId}, ${id}, ${o.contato_id}, 'whatsapp', 'saida', 'sistema', 'api', ${modo === "modelo" ? "template" : "text"}, false, ${texto}, 'enviando',
      ${`manual-wa:${id}:${chave}`}, 'ycloud', ${nomeModelo}, ${u.id}, 1, now())
    on conflict (chave) do nothing`;
  if (!r0.count) redirect(ficha(id, "wa-repetido"));
  const r = await enviarWhatsapp(mensagemId, envio);
  atualizar(id);
  redirect(ficha(id, r === "aceita" ? "wa-enviado" : r === "incerta" ? "wa-incerto" : "wa-falhou"));
}

/**
 * Uma pessoa resolve um envio de resultado incerto depois de conferir no aplicativo: "saiu" confirma a mensagem
 * (com os efeitos de um envio aceito); "nao_saiu" cancela, e aí é seguro escrever de novo.
 */
export async function resolverIncertaAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  const msg = uuid(fd.get("mensagem"));
  const saiu = fd.get("decisao") === "saiu";
  if (!id || !msg) return;
  const sql = await db();
  await sql.begin(async (tx) => {
    const [m] = await tx<{ id: string }[]>`
      update crm_mensagens set status = ${saiu ? "enviada" : "cancelada"}, erro = ${saiu ? null : "Conferido no aplicativo: a mensagem não saiu."},
        enviado_em = case when ${saiu} then coalesce(enviado_em, tentado_em, now()) else enviado_em end,
        ocorrida_em = case when ${saiu} then coalesce(ocorrida_em, tentado_em, now()) else ocorrida_em end
      where id = ${msg} and oportunidade_id = ${id} and status = 'incerta' returning id`;
    if (!m) return;
    if (saiu) await efeitosDoEnvioAceito(tx, msg, new Date().toISOString());
    else await tx`update crm_tarefas set status = 'falhou', resultado = 'Conferido no aplicativo: o primeiro contato automático não saiu.', atualizado_em = now() where mensagem_id = ${msg} and status = 'incerta'`;
    await registrarEvento(tx, { oportunidadeId: id, tipo: "incerta_resolvida", texto: saiu ? "Envio incerto conferido no aplicativo: a mensagem saiu." : "Envio incerto conferido no aplicativo: a mensagem não saiu.", usuarioId: u.id });
  });
  atualizar(id);
  redirect(ficha(id, "salvo"));
}

/** Associa a esta oportunidade as mensagens de WhatsApp da pessoa que ficaram sem oportunidade. */
export async function associarAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  if (!id) return;
  await associarMensagens(id, u.id);
  atualizar(id);
  redirect(ficha(id, "associado"));
}

export async function criarDaConversaAction(fd: FormData) {
  const u = await exigirUsuario();
  const contato = uuid(fd.get("contato"));
  if (!contato) return;
  const id = await criarParaContato(contato, u.id);
  if (!id) return;
  await associarMensagens(id, u.id);
  atualizar(id);
  redirect(ficha(id, "criado"));
}

export async function conferirConversaAction(fd: FormData) {
  await exigirUsuario();
  const contato = uuid(fd.get("contato"));
  if (!contato) return;
  await conferirMensagens(contato);
  atualizar();
  redirect("/leads#sem-associacao");
}

/* ───────────────────────────── limites, textos automáticos do aplicativo e validação ───────────────────────────── */

/** Limites de tempo do primeiro contato automático (idade máxima do contato e intervalo entre recepções). */
export async function limitesAction(fd: FormData) {
  const u = await exigirUsuario();
  const ok = await salvarLimitesAutomacao({ horasMaximas: fd.get("horasMaximas"), horasEntreRecepcoes: fd.get("horasEntreRecepcoes") }, u.id);
  revalidatePath("/leads", "layout");
  redirect(`/leads/configuracoes?msg=${ok ? "limites" : "limites-invalidos"}#automacao`);
}

/** Textos da saudação e da ausência do aplicativo: é por eles (e só por eles) que uma resposta do aplicativo é tratada como automática. */
export async function textosAutomaticosAction(fd: FormData) {
  const u = await exigirUsuario();
  const atual = await textosAutomaticosApp();
  const remover = new Set(fd.getAll("remover").map(String));
  await salvarTextosAutomaticosApp(
    { saudacao: String(fd.get("saudacao") ?? ""), ausencia: String(fd.get("ausencia") ?? ""), outras: atual.outras.filter((_, i) => !remover.has(String(i))) },
    u.id,
  );
  revalidatePath("/leads", "layout");
  redirect("/leads/configuracoes?msg=textos#aplicativo");
}

/** Números de controle (telefones da própria equipe) usados na validação do WhatsApp. */
export async function numerosControleAction(fd: FormData) {
  const u = await exigirUsuario();
  const r = await salvarNumerosControle(String(fd.get("numeros") ?? "").split(/[\n,;]+/), u.id);
  revalidatePath("/leads", "layout");
  redirect(`/leads/configuracoes?msg=${r.invalidos.length ? "controle-invalido" : "controle"}#controle`);
}

/** Inicia uma validação do WhatsApp com um número de controle: o fluxo real, sem conversão publicitária. */
export async function validacaoAction(fd: FormData) {
  const u = await exigirUsuario();
  const categoria = fd.get("categoria");
  const r = await iniciarValidacao(String(fd.get("numero") ?? ""), isCategoria(categoria) ? categoria : "sites", u);
  atualizar();
  redirect(`/leads/integracoes?msg=${r.ok ? "validacao" : r.erro}#validacao`);
}

/** Correção de quem enviou uma mensagem sincronizada do aplicativo: "não fui eu" (automática) ou "fui eu". */
export async function reclassificarEcoAction(fd: FormData) {
  const u = await exigirUsuario();
  const id = uuid(fd.get("id"));
  const msg = uuid(fd.get("mensagem"));
  if (!id || !msg) return;
  await reclassificarEco(msg, fd.get("automatica") === "1", u.id);
  atualizar(id);
  redirect(ficha(id, "origem"));
}
