import { randomUUID } from "node:crypto";
import { AVISO_RETORNO, INTERESSES, type LeadOrigem } from "@/lib/leads/schema";
import type { LeadRecord } from "@/lib/leads/server/types";
import { db } from "../db";
import { registrarEnvio } from "../entrada";
import { normWhatsapp } from "../normalizar";
import { despacharTarefa } from "../tarefas";
import type { Categoria, Usuario } from "../tipos";
import { modeloPrimeiroContato, numerosControle, waEnvio } from "./config";
import { modeloAprovado } from "./ycloud";

// Validação do WhatsApp com um NÚMERO DE CONTROLE (telefone da própria equipe).
//
// Objetivo: exercitar o fluxo real de ponta a ponta (lead gravado → tarefa → fila → provedor → entrega → resposta →
// eco do aplicativo → resposta pelo CRM) sem abordar cliente e sem gerar conversão publicitária.
//
// Duas formas de começar, com o mesmo caminho depois:
// - pelo CRM (iniciarValidacao): o lead nasce no servidor, pela mesma função dos formulários. Não há navegador
//   público envolvido, então nenhum evento de Pixel existe;
// - pelo formulário público do site, informando um número de controle: a API grava o lead normalmente e responde
//   `medir: false`; o navegador não dispara o evento Lead (nem a conversão do Google). PageView e FormStart saem,
//   como em qualquer visita, e não são conversões.
//
// Nos dois casos a oportunidade fica marcada como validação (fora dos indicadores), o primeiro contato automático
// roda pelo WhatsApp mesmo com a automação desligada para os demais, e só para números que estão na lista.
//
// Cada passo abaixo só aparece como comprovado com evidência gravada (resposta do provedor, notificação recebida).

const ORIGEM: Partial<Record<Categoria, LeadOrigem>> = {
  sites: "sites",
  lojas: "lojas-virtuais",
  agendamento: "agendamento-online",
  automacao: "automacao",
  "atendimento-ia": "atendimento-ia",
  diagnostico: "diagnostico-site",
};
export const PAGINA_VALIDACAO = "/leads/integracoes";
export type ErroValidacao = "validacao-numero" | "validacao-config" | "validacao-modelo" | "validacao-aberta";

export async function iniciarValidacao(numeroBruto: string, categoria: Categoria, usuario: Usuario): Promise<{ ok: true; oportunidadeId: string } | { ok: false; erro: ErroValidacao }> {
  const numero = normWhatsapp(numeroBruto);
  if (!numero || !(await numerosControle()).includes(numero)) return { ok: false, erro: "validacao-numero" };
  const cfg = waEnvio();
  if (!cfg.pronto) return { ok: false, erro: "validacao-config" };
  const modelo = await modeloPrimeiroContato();
  if (!modelo.nome) return { ok: false, erro: "validacao-modelo" };
  const aprovado = await modeloAprovado(modelo.nome, modelo.idioma, true);
  if (!aprovado.ok) return { ok: false, erro: "validacao-modelo" };

  const origem: LeadOrigem = ORIGEM[categoria] ?? "contato";
  const lead: LeadRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    tipo: "projeto",
    origem,
    interesse: INTERESSES[origem],
    pagina: PAGINA_VALIDACAO,
    nome: usuario.nome,
    empresa: "Validação com número de controle",
    whatsapp: numero,
    email: "",
    mensagem: "Validação do WhatsApp iniciada pelo CRM.",
    utm: {},
    // Quem inicia é o dono do número, pedindo a mensagem para si: é o mesmo pedido de retorno do formulário.
    aviso: AVISO_RETORNO.versao,
  };
  const r = await registrarEnvio(lead, false);
  if (!r.validacao) return { ok: false, erro: "validacao-numero" };
  if (!r.tarefaId) return { ok: false, erro: "validacao-aberta" };
  await despacharTarefa(r.tarefaId);
  return { ok: true, oportunidadeId: r.oportunidadeId };
}

export type PassoValidacao = { id: string; titulo: string; ok: boolean; evidencia: string; opcional?: boolean };
export type EstadoValidacao = {
  oportunidadeId: string;
  numero: string | null;
  iniciadaEm: string;
  origem: "crm" | "formulario";
  passos: PassoValidacao[];
  /** todos os passos obrigatórios têm evidência */
  completa: boolean;
  faltam: string[];
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Estado da validação mais recente, montado só com o que está gravado. null = nenhuma validação feita. */
export async function estadoValidacao(): Promise<EstadoValidacao | null> {
  const sql = await db();
  const [o] = await sql<
    { id: string; contato_id: string; recebido_em: Date; whatsapp: string | null; pagina: string | null; t_status: string | null; t_resultado: string | null; t_criado: Date | null; t_publicada: Date | null; t_tentado: Date | null }[]
  >`
    select o.id, o.contato_id, o.recebido_em, c.whatsapp, o.pagina, t.status as t_status, t.resultado as t_resultado, t.criado_em as t_criado, t.publicada_em as t_publicada, t.tentado_em as t_tentado
    from crm_oportunidades o join crm_contatos c on c.id = o.contato_id
    left join crm_tarefas t on t.oportunidade_id = o.id and t.tipo = 'primeiro_contato'
    where o.validacao order by o.recebido_em desc limit 1`;
  if (!o) return null;
  const ms = await sql<
    { oportunidade_id: string | null; direcao: string; via: string | null; automatica: boolean; status: string; provedor_id: string | null; erro: string | null; em: Date; enviado_em: Date | null; entregue_em: Date | null; lida_em: Date | null }[]
  >`
    select oportunidade_id, direcao, via, automatica, status, provedor_id, erro, coalesce(ocorrida_em, criado_em) as em, enviado_em, entregue_em, lida_em
    from crm_mensagens
    -- A conversa é por pessoa: vale tudo o que aconteceu com o número de controle desde o início desta validação,
    -- mesmo que alguma mensagem tenha ficado sem oportunidade.
    where contato_id = ${o.contato_id} and canal = 'whatsapp' and (oportunidade_id = ${o.id} or coalesce(ocorrida_em, criado_em) >= ${o.recebido_em})
    order by coalesce(ocorrida_em, criado_em)`;
  const hora = (d: Date | null | undefined) =>
    d ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(d)) : "";
  const auto = ms.find((m) => m.oportunidade_id === o.id && m.direcao === "saida" && m.via === "api" && m.automatica);
  const saiu = !!auto && ["aceita", "enviada", "entregue", "lida"].includes(auto.status);
  const entrada = ms.find((m) => m.direcao === "entrada" && (!auto || m.em >= auto.em));
  const eco = ms.find((m) => m.direcao === "saida" && m.via === "app" && !m.automatica);
  const peloCrm = ms.find((m) => m.direcao === "saida" && m.via === "api" && !m.automatica && ["aceita", "enviada", "entregue", "lida"].includes(m.status));
  const origem = o.pagina === PAGINA_VALIDACAO ? "crm" : "formulario";

  const passos: PassoValidacao[] = [
    {
      id: "conversao",
      titulo: "Sem conversão publicitária",
      ok: true,
      evidencia:
        origem === "crm"
          ? "Iniciada pelo CRM: o lead nasceu no servidor, sem navegador público e sem evento de Pixel."
          : "Enviada pelo formulário público com um número de controle: a API respondeu que o navegador não deve registrar conversão.",
    },
    { id: "tarefa", titulo: "Tarefa gravada junto com o lead", ok: !!o.t_criado, evidencia: o.t_criado ? `Lead e tarefa gravados em ${hora(o.t_criado)}.` : "Nenhuma tarefa encontrada para esta validação." },
    {
      id: "acionada",
      titulo: "Tarefa acionada logo em seguida",
      ok: !!o.t_tentado,
      evidencia: o.t_tentado
        ? `${o.t_publicada ? `Publicada na fila em ${hora(o.t_publicada)} e executada` : "Executada (sem a fila)"} em ${hora(o.t_tentado)}${o.t_criado ? `, ${Math.max(0, Math.round((new Date(o.t_tentado).getTime() - new Date(o.t_criado).getTime()) / 1000))} s depois do lead` : ""}.`
        : "Ainda não executada.",
    },
    {
      id: "aceita",
      titulo: "Primeira mensagem aceita pelo provedor",
      ok: saiu,
      evidencia: saiu
        ? `A YCloud aceitou o envio (id ${auto!.provedor_id ?? "não informado"}).`
        : auto
          ? `Não aceita: ${auto.status === "incerta" ? "resultado incerto" : (auto.erro ?? auto.status)}.`
          : o.t_status && o.t_status !== "pendente" && o.t_status !== "processando"
            ? `Não enviada: ${o.t_resultado ?? o.t_status}.`
            : "Aguardando o envio.",
    },
    {
      id: "entregue",
      titulo: "Entrega confirmada pelo WhatsApp",
      ok: !!auto?.entregue_em || auto?.status === "lida",
      evidencia: auto?.entregue_em ? `Notificação de entrega recebida (${hora(auto.entregue_em)}).` : "Sem notificação de entrega até agora. Ela chega pelo webhook.",
    },
    {
      id: "lida",
      titulo: "Leitura confirmada",
      opcional: true,
      ok: !!auto?.lida_em,
      evidencia: auto?.lida_em ? `Notificação de leitura recebida (${hora(auto.lida_em)}).` : "Sem notificação de leitura. Não aparece se o número de controle desligou a confirmação de leitura.",
    },
    {
      id: "resposta",
      titulo: "Resposta do número de controle recebida",
      ok: !!entrada,
      evidencia: entrada ? `Mensagem recebida pelo webhook (${hora(entrada.em)}). Confira que a conversa apareceu em “Depende de mim”.` : "Responda do número de controle à mensagem recebida.",
    },
    {
      id: "eco",
      titulo: "Resposta pelo aplicativo sincronizada",
      ok: !!eco,
      evidencia: eco ? `Mensagem enviada pelo aplicativo chegou ao CRM (${hora(eco.em)}).` : "Responda pelo WhatsApp Business do celular comercial e veja a mensagem entrar aqui.",
    },
    {
      id: "crm",
      titulo: "Resposta pelo CRM aceita pelo provedor",
      ok: !!peloCrm,
      evidencia: peloCrm ? `Mensagem enviada pela ficha aceita pela YCloud (${hora(peloCrm.em)}).` : "Depois de uma resposta do número de controle (janela aberta), envie uma mensagem pela ficha.",
    },
  ];
  const faltam = passos.filter((p) => !p.ok && !p.opcional).map((p) => p.titulo);
  return { oportunidadeId: o.id, numero: o.whatsapp, iniciadaEm: iso(o.recebido_em)!, origem, passos, completa: faltam.length === 0, faltam };
}
