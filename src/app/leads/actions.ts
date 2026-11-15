"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acessoPronto, entrarComCodigo, exigirUsuario, renomearUsuario, sair, solicitarCodigo } from "@/lib/crm/auth";
import { enviarAviso } from "@/lib/crm/aviso";
import { db } from "@/lib/crm/db";
import { cadastrarManual } from "@/lib/crm/entrada";
import { definirAutomacaoEmail, emailCliente, enfileirarEmail, enviarMensagem, restaurarModelo, salvarModelo } from "@/lib/crm/mensagens";
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
import { deInputLocal, ETAPAS, isCanal, isCanalMensagem, isCustoTipo, isEtapa } from "@/lib/crm/tipos";

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
  redirect(ficha(id, r === "enviada" ? "email-enviado" : r === "cancelada" ? "email-cancelado" : "email-falhou"));
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
  if (r.ok) await editarServico(id, s(fd, "servico", 200), u.id);
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

export async function automacaoAction(fd: FormData) {
  const u = await exigirUsuario();
  const ligar = fd.get("ativo") === "1";
  if (ligar && !emailCliente().pronto) redirect("/leads/configuracoes?msg=email-config");
  await definirAutomacaoEmail(ligar, u.id);
  revalidatePath("/leads", "layout");
  redirect("/leads/configuracoes?msg=automacao");
}

export async function nomeAction(fd: FormData) {
  const u = await exigirUsuario();
  const nome = s(fd, "nome", 60);
  if (nome && nome.length >= 2) await renomearUsuario(u.id, nome);
  revalidatePath("/leads", "layout");
  redirect("/leads/configuracoes?msg=salvo");
}
