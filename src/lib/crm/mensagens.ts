import { randomUUID } from "node:crypto";
import { site } from "@/lib/site";
import { db, type Db } from "./db";
import { registrarEvento } from "./entrada";

// Mensagens para o interessado: modelos editáveis e envio pelo canal integrado.
//
// Hoje o único canal em que o CRM envia de verdade é o E-MAIL (Resend). WhatsApp e Instagram não têm
// integração oficial conectada: nesses canais o CRM só prepara o texto, abre a conversa no aplicativo e
// registra o que a pessoa responsável informar. Nada aqui simula envio, entrega ou resposta.
//
// Envio pelo sistema: pendente → enviando → enviada | falhou | cancelada. A chave única impede a mesma
// mensagem de entrar duas vezes; a reserva (enviando) impede duas instâncias de enviarem a mesma; a chave de
// idempotência do provedor cobre a repetição depois de uma resposta perdida. "enviada" = o provedor aceitou.

const env = (k: string) => (process.env[k] ?? "").trim();
export const MENSAGEM_MAX_TENTATIVAS = 5;

/* ───────────────────────────── modelos ───────────────────────────── */

export type Modelo = { id: string; titulo: string; quando: string; canal: "whatsapp" | "instagram" | "email"; assunto?: string; corpo: string };

/** Padrões. O que for editado em /leads/configuracoes fica em crm_config (chave modelo:<id>) e prevalece. */
export const MODELOS_PADRAO: Modelo[] = [
  {
    id: "whatsapp-formulario",
    titulo: "WhatsApp · primeiro contato",
    quando: "Quem preencheu um formulário do site e informou o WhatsApp.",
    canal: "whatsapp",
    corpo:
      "Oi, {{primeiro_nome}}! Aqui é {{meu_nome}}, da Spolaor Tecnologia. Recebi seu pedido pelo site ({{servico}}). Posso te fazer duas perguntas rápidas para entender o que você precisa?",
  },
  {
    id: "whatsapp-recepcao",
    titulo: "WhatsApp · recepção",
    quando: "Quem escreveu primeiro no WhatsApp.",
    canal: "whatsapp",
    corpo: "Oi, {{primeiro_nome}}! Aqui é {{meu_nome}}, da Spolaor Tecnologia. Vi sua mensagem e já vou te atender. Me conta um pouco mais do que você precisa?",
  },
  {
    id: "instagram-recepcao",
    titulo: "Instagram · recepção",
    quando: "Quem escreveu no Direct.",
    canal: "instagram",
    corpo: "Oi, {{primeiro_nome}}! Aqui é {{meu_nome}}, da Spolaor Tecnologia. Obrigado pela mensagem. Me conta o que você está precisando que eu já te respondo por aqui.",
  },
  {
    id: "email-formulario",
    titulo: "E-mail · primeiro contato",
    quando: "Quem preencheu um formulário do site e informou o e-mail. É o texto usado pelo envio automático, quando ligado.",
    canal: "email",
    assunto: "Recebemos seu pedido · Spolaor Tecnologia",
    corpo:
      "Olá, {{primeiro_nome}}.\n\nRecebemos seu pedido pelo site ({{servico}}). Vamos ler com atenção e falar com você em seguida, pelo WhatsApp ou por este e-mail.\n\nSe quiser adiantar algum detalhe, é só responder esta mensagem.\n\nSpolaor Tecnologia",
  },
  {
    id: "email-recepcao",
    titulo: "E-mail · recepção",
    quando: "Quem escreveu para o e-mail comercial.",
    canal: "email",
    assunto: "Re: seu contato com a Spolaor Tecnologia",
    corpo: "Olá, {{primeiro_nome}}.\n\nRecebi sua mensagem e vou responder com calma. Se puder, me conte um pouco mais sobre o que você precisa.\n\n{{meu_nome}}\nSpolaor Tecnologia",
  },
];

export async function modelos(): Promise<Modelo[]> {
  const sql = await db();
  const rows = await sql<{ chave: string; valor: { assunto?: string; corpo?: string } }[]>`select chave, valor from crm_config where chave like 'modelo:%'`;
  const edit = new Map(rows.map((r) => [r.chave.slice(7), r.valor]));
  return MODELOS_PADRAO.map((m) => {
    const e = edit.get(m.id);
    return e?.corpo ? { ...m, corpo: e.corpo, assunto: m.canal === "email" ? e.assunto || m.assunto : undefined } : m;
  });
}

export async function salvarModelo(id: string, assunto: string | null, corpo: string, usuarioId: string) {
  if (!MODELOS_PADRAO.some((m) => m.id === id)) throw new Error("modelo desconhecido");
  const sql = await db();
  await sql`
    insert into crm_config (chave, valor, usuario_id) values (${`modelo:${id}`}, ${sql.json({ assunto: assunto ?? undefined, corpo })}, ${usuarioId})
    on conflict (chave) do update set valor = excluded.valor, usuario_id = excluded.usuario_id, atualizado_em = now()`;
}

export async function restaurarModelo(id: string) {
  const sql = await db();
  await sql`delete from crm_config where chave = ${`modelo:${id}`}`;
}

export type Variaveis = { nome: string; empresa?: string | null; servico?: string | null; meuNome?: string | null };

/** Troca {{nome}}, {{primeiro_nome}}, {{empresa}}, {{servico}} e {{meu_nome}}. Variável sem valor vira texto neutro. */
export function preencher(textoModelo: string, v: Variaveis) {
  const primeiro = v.nome.trim().split(/\s+/)[0] ?? "";
  const mapa: Record<string, string> = {
    nome: v.nome.trim(),
    primeiro_nome: primeiro,
    empresa: v.empresa?.trim() || "sua empresa",
    servico: v.servico?.trim() || "seu pedido",
    meu_nome: v.meuNome?.trim() || "a equipe",
  };
  return textoModelo.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k: string) => mapa[k.toLowerCase()] ?? m);
}

/* ───────────────────────────── e-mail para o interessado ───────────────────────────── */

/** Remetente e endereço de resposta dos e-mails para interessados. Sem endereço de resposta lido por alguém, não envia. */
export function emailCliente() {
  const from = env("CRM_EMAIL_FROM") || env("LEAD_EMAIL_FROM");
  const replyTo = env("CRM_EMAIL_REPLY_TO") || site.email || "";
  const falta = [!env("RESEND_API_KEY") && "RESEND_API_KEY", !from && "CRM_EMAIL_FROM ou LEAD_EMAIL_FROM", !replyTo && "CRM_EMAIL_REPLY_TO ou NEXT_PUBLIC_CONTACT_EMAIL"].filter(
    (x): x is string => !!x,
  );
  return { pronto: falta.length === 0, from, replyTo, falta };
}

export async function automacaoEmailAtiva(): Promise<boolean> {
  const sql = await db();
  const [r] = await sql<{ valor: { ativo?: boolean } }[]>`select valor from crm_config where chave = 'automacao:email'`;
  return r?.valor?.ativo === true;
}

export async function definirAutomacaoEmail(ativo: boolean, usuarioId: string) {
  const sql = await db();
  await sql`
    insert into crm_config (chave, valor, usuario_id) values ('automacao:email', ${sql.json({ ativo })}, ${usuarioId})
    on conflict (chave) do update set valor = excluded.valor, usuario_id = excluded.usuario_id, atualizado_em = now()`;
}

/** Coloca um e-mail na fila. Devolve o id, ou null se a chave já existia (mesma mensagem pedida de novo). */
export async function enfileirarEmail(
  tx: Db,
  m: { oportunidadeId: string; assunto: string; corpo: string; chave: string; automatica: boolean; usuarioId?: string | null },
): Promise<string | null> {
  const id = randomUUID();
  const r = await tx`
    insert into crm_mensagens (id, oportunidade_id, canal, direcao, modo, automatica, assunto, corpo, status, chave, usuario_id)
    values (${id}, ${m.oportunidadeId}, 'email', 'saida', 'sistema', ${m.automatica}, ${m.assunto.slice(0, 200)}, ${m.corpo.slice(0, 8000)}, 'pendente', ${m.chave}, ${m.usuarioId ?? null})
    on conflict (chave) do nothing`;
  return r.count ? id : null;
}

/**
 * Envia uma mensagem da fila (só e-mail). Nunca lança erro. Mensagem automática é cancelada, em vez de enviada,
 * se alguém já assumiu a conversa ou a oportunidade saiu de "Novo": a automação não fala por cima de uma pessoa.
 */
export async function enviarMensagem(id: string, forcar = false): Promise<"enviada" | "falhou" | "cancelada" | "ignorada"> {
  const sql = await db();
  const [m] = await sql<{ oportunidade_id: string; automatica: boolean; assunto: string | null; corpo: string; canal: string }[]>`
    update crm_mensagens set status = 'enviando', tentativas = tentativas + 1, tentado_em = now()
    where id = ${id} and modo = 'sistema' and direcao = 'saida'
      and (status in ('pendente', 'falhou') or (status = 'enviando' and tentado_em < now() - interval '10 minutes'))
      and (${forcar} or tentativas < ${MENSAGEM_MAX_TENTATIVAS})
    returning oportunidade_id, automatica, assunto, corpo, canal`;
  if (!m) return "ignorada";
  const [o] = await sql<{ etapa: string; assumida_em: Date | null; email: string | null }[]>`
    select o.etapa, o.assumida_em, c.email from crm_oportunidades o join crm_contatos c on c.id = o.contato_id where o.id = ${m.oportunidade_id}`;
  const cancelar = async (motivo: string) => {
    await sql`update crm_mensagens set status = 'cancelada', erro = ${motivo} where id = ${id}`;
    return "cancelada" as const;
  };
  if (m.automatica && (o.assumida_em || o.etapa !== "novo")) return cancelar("Atendimento assumido por uma pessoa antes do envio.");
  const cfg = emailCliente();
  const falhar = async (erro: string) => {
    console.error(`[crm] mensagem ${id} falhou: ${erro}`);
    await sql.begin(async (tx) => {
      const [u] = await tx<{ tentativas: number }[]>`update crm_mensagens set status = 'falhou', erro = ${erro.slice(0, 300)} where id = ${id} returning tentativas`;
      if (u?.tentativas === 1) await registrarEvento(tx, { oportunidadeId: m.oportunidade_id, tipo: "mensagem_falhou", texto: `O e-mail para o interessado falhou: ${erro.slice(0, 200)}` });
    });
    return "falhou" as const;
  };
  if (m.canal !== "email") return falhar("Canal sem integração de envio.");
  if (!cfg.pronto) return falhar(`Envio de e-mail não configurado (${cfg.falta.join(", ")}).`);
  if (!o.email) return falhar("O contato não tem e-mail.");
  try {
    const res = await fetch(env("RESEND_API_URL") || "https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json", "idempotency-key": `crm-mensagem-${id}` },
      body: JSON.stringify({ from: cfg.from, to: [o.email], reply_to: cfg.replyTo, subject: m.assunto ?? "Spolaor Tecnologia", text: m.corpo }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return falhar(`Provedor de e-mail recusou o envio (HTTP ${res.status})`);
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    await sql.begin(async (tx) => {
      await tx`update crm_mensagens set status = 'enviada', enviado_em = now(), erro = null, provedor_id = ${body.id ?? null} where id = ${id}`;
      await tx`
        update crm_oportunidades set primeiro_contato_em = coalesce(primeiro_contato_em, now()), ultimo_contato_em = now(), atualizado_em = now()
        where id = ${m.oportunidade_id}`;
      await registrarEvento(tx, {
        oportunidadeId: m.oportunidade_id,
        tipo: "mensagem_enviada",
        texto: m.automatica ? "Primeiro contato automático por e-mail aceito pelo provedor." : "E-mail enviado pelo CRM (aceito pelo provedor).",
      });
    });
    return "enviada";
  } catch (e) {
    return falhar(`Falha de rede ao enviar (${(e as Error).name})`);
  }
}

/**
 * Primeiro contato automático de um envio de formulário. Só age se a automação de e-mail estiver ligada, o envio
 * tiver criado uma oportunidade nova (não um reenvio), não for teste, houver e-mail e ninguém tiver assumido.
 * Uma mensagem por oportunidade (chave única): reprocessar o mesmo envio não duplica.
 */
export async function primeiroContatoDoEnvio(envioId: string): Promise<string> {
  if (!emailCliente().pronto) return "e-mail não configurado";
  if (!(await automacaoEmailAtiva())) return "automação desligada";
  const sql = await db();
  const [o] = await sql<{ id: string; etapa: string; assumida_em: Date | null; teste: boolean; servico: string | null; nome: string; empresa: string | null; email: string | null; primeiro: string }[]>`
    select o.id, o.etapa, o.assumida_em, o.teste, o.servico, c.nome, c.empresa, c.email,
      (select e2.id from crm_envios e2 where e2.oportunidade_id = o.id order by e2.recebido_em, e2.id limit 1) as primeiro
    from crm_envios e join crm_oportunidades o on o.id = e.oportunidade_id join crm_contatos c on c.id = o.contato_id
    where e.id = ${envioId}`;
  if (!o) return "envio não encontrado";
  if (o.primeiro !== envioId) return "reenvio: sem nova mensagem";
  if (o.teste) return "teste: sem mensagem";
  if (!o.email) return "sem e-mail";
  if (o.assumida_em || o.etapa !== "novo") return "já assumido";
  const modelo = (await modelos()).find((m) => m.id === "email-formulario")!;
  const v = { nome: o.nome, empresa: o.empresa, servico: o.servico };
  const id = await enfileirarEmail(sql, {
    oportunidadeId: o.id,
    assunto: preencher(modelo.assunto ?? "", v),
    corpo: preencher(modelo.corpo, v),
    chave: `primeiro-contato:${o.id}`,
    automatica: true,
  });
  if (!id) return "já enfileirada";
  return enviarMensagem(id);
}

/** Rotina: mensagens do sistema pendentes, falhas ou travadas, dentro do limite de tentativas. */
export async function rotinaMensagens(): Promise<string[]> {
  const sql = await db();
  const rows = await sql<{ id: string }[]>`
    select id from crm_mensagens
    where modo = 'sistema' and direcao = 'saida' and tentativas < ${MENSAGEM_MAX_TENTATIVAS}
      and (status = 'falhou'
        or (status = 'pendente' and criado_em < now() - interval '2 minutes')
        or (status = 'enviando' and tentado_em < now() - interval '10 minutes'))
    order by criado_em limit 20`;
  const out: string[] = [];
  for (const r of rows) out.push(`mensagem ${r.id.slice(0, 8)}: ${await enviarMensagem(r.id)}`);
  return out;
}
