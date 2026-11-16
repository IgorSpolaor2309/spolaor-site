import { randomUUID } from "node:crypto";
import { iaConfig } from "@/lib/ia/config";
import { efeitosDoEnvioAceito } from "./conversa";
import { db } from "./db";
import { registrarEvento } from "./entrada";
import { emailCliente, enfileirarEmail, enviarMensagem, modelos, preencher } from "./mensagens";
import { canalAutomacao, frases, modeloPrimeiroContato, parametrosDoModelo, textoDoModelo, waEnvio } from "./whatsapp/config";
import { enviarWhatsapp } from "./whatsapp/envio";
import { modeloAprovado } from "./whatsapp/ycloud";
import { isCategoria } from "./tipos";

// Tarefa de primeiro contato: a intenção nasce na mesma transação do lead (entrada.ts) e é executada aqui.
//
// Disparo: logo depois da resposta ao visitante, a tarefa é publicada no QStash, que chama /api/leads/tarefas em
// seguida (e tenta de novo se a chamada falhar). Sem QStash, ou se a publicação falhar, a tarefa roda ali mesmo; e a
// rotina de 15 minutos recupera o que tiver ficado pendente. A tarefa nunca some: ela está no banco.
//
// Execução: uma instância por vez (reserva no banco), uma mensagem por oportunidade (chave única) e todas as
// condições conferidas de novo no momento do envio. Resultado desconhecido (timeout depois de o provedor talvez ter
// aceitado) NÃO é reenviado sozinho: fica como "resultado incerto" até uma notificação do provedor ou uma pessoa
// resolver.

const env = (k: string) => (process.env[k] ?? "").trim();
/** Contato mais antigo que isto não recebe primeiro contato automático (nada de disparo retroativo). */
const LIMITE_HORAS = 12;
/** A mesma pessoa não recebe duas recepções automáticas neste intervalo, mesmo pedindo serviços diferentes. */
const INTERVALO_RECEPCAO_HORAS = 72;

/** Publica a tarefa no QStash. Devolve false se não há QStash configurado ou se a publicação falhou. */
async function publicar(id: string): Promise<boolean> {
  const token = env("QSTASH_TOKEN");
  const site = iaConfig.siteUrl();
  const segredo = iaConfig.cronSecret();
  if (!token || !site || !segredo) return false;
  const base = (env("QSTASH_URL") || "https://qstash.upstash.io").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/v2/publish/${site}/api/leads/tarefas`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "Upstash-Method": "POST",
        "Upstash-Retries": "3",
        "Upstash-Deduplication-Id": `crm-tarefa-${id}`,
        "Upstash-Forward-Authorization": `Bearer ${segredo}`,
      },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Aciona a tarefa prontamente. Nunca lança erro: no pior caso a rotina a encontra pendente. */
export async function despacharTarefa(id: string): Promise<"publicada" | "executada" | "pendente"> {
  try {
    if (await publicar(id)) {
      const sql = await db();
      await sql`update crm_tarefas set publicada_em = now() where id = ${id}`;
      return "publicada";
    }
    await processarTarefa(id);
    return "executada";
  } catch (e) {
    console.error(`[crm] tarefa ${id} não foi acionada agora: ${(e as Error).message}`);
    return "pendente";
  }
}

type Encerramento = { status: "cancelada" | "falhou" | "concluida"; resultado: string; pendencia?: string };

async function encerrar(id: string, oportunidadeId: string, e: Encerramento) {
  const sql = await db();
  await sql.begin(async (tx) => {
    await tx`update crm_tarefas set status = ${e.status}, resultado = ${e.resultado.slice(0, 300)}, atualizado_em = now() where id = ${id}`;
    if (e.pendencia) {
      // Não saiu contato automático e a pessoa já está em conversa: o novo pedido vai direto para atendimento humano.
      await tx`
        update crm_oportunidades set aguardando = 'nos', pendencia = ${e.pendencia}, ultima_entrada_em = coalesce(ultima_entrada_em, recebido_em), atualizado_em = now()
        where id = ${oportunidadeId} and etapa = 'novo'`;
    }
    if (e.status === "falhou") await registrarEvento(tx, { oportunidadeId, tipo: "primeiro_contato_manual", texto: `Primeiro contato automático não enviado: ${e.resultado}` });
  });
  return `${e.status}: ${e.resultado}`;
}

/** Executa uma tarefa de primeiro contato. Devolve um resumo legível (para o log e os testes). Nunca lança erro. */
export async function processarTarefa(id: string): Promise<string> {
  try {
    return await executar(id);
  } catch (e) {
    console.error(`[crm] tarefa ${id} falhou ao executar: ${(e as Error).message}`);
    return `erro: ${(e as Error).message.slice(0, 120)}`;
  }
}

async function executar(id: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return "id inválido";
  const sql = await db();
  // Reserva: pendente (na hora) ou "processando" travada há mais de 3 minutos (a instância anterior morreu).
  const [t] = await sql<{ oportunidade_id: string; mensagem_id: string | null; retomada: boolean; tentativas: number }[]>`
    update crm_tarefas t set status = 'processando', tentativas = t.tentativas + 1, tentado_em = now(), atualizado_em = now()
    from (select id, status = 'processando' as retomada from crm_tarefas where id = ${id} for update) antes
    where t.id = antes.id and ((t.status = 'pendente' and t.proxima_em <= now() + interval '5 seconds')
      or (t.status = 'processando' and t.tentado_em < now() - interval '3 minutes'))
    returning t.oportunidade_id, t.mensagem_id, antes.retomada, t.tentativas`;
  if (!t) return "ignorada: já executada, em execução ou ainda não é a hora";

  // Execução anterior interrompida DEPOIS de criar a mensagem: não dá para saber se saiu. Não reenvia.
  if (t.retomada && t.mensagem_id) {
    const [m] = await sql<{ status: string }[]>`select status from crm_mensagens where id = ${t.mensagem_id}`;
    if (m && ["enviando", "incerta"].includes(m.status)) {
      await sql.begin(async (tx) => {
        await tx`update crm_mensagens set status = 'incerta', erro = 'Envio interrompido antes da resposta do provedor.' where id = ${t.mensagem_id}`;
        await tx`update crm_tarefas set status = 'incerta', resultado = 'Envio interrompido: não se sabe se a mensagem saiu. Confira no aplicativo antes de reenviar.', atualizado_em = now() where id = ${id}`;
      });
      return "incerta: execução anterior interrompida durante o envio";
    }
    if (m && ["aceita", "enviada", "entregue", "lida"].includes(m.status)) {
      await sql.begin(async (tx) => efeitosDoEnvioAceito(tx, t.mensagem_id!, new Date().toISOString()));
      return "concluida: a mensagem já tinha saído";
    }
  }

  const [o] = await sql<
    {
      id: string; etapa: string; teste: boolean; assumida_em: Date | null; recebido_em: Date; categoria: string | null; servico: string | null; aviso_versao: string | null;
      contato_id: string; nome: string; empresa: string | null; whatsapp: string | null; email: string | null; wa_bloqueado_em: Date | null;
      respondeu: boolean; recepcao_recente: boolean; em_conversa: boolean;
    }[]
  >`
    select o.id, o.etapa, o.teste, o.assumida_em, o.recebido_em, o.categoria, o.servico, o.aviso_versao,
      c.id as contato_id, c.nome, c.empresa, c.whatsapp, c.email, c.wa_bloqueado_em,
      exists (select 1 from crm_mensagens m where m.contato_id = c.id and m.direcao = 'entrada' and coalesce(m.ocorrida_em, m.criado_em) >= o.recebido_em) as respondeu,
      exists (select 1 from crm_mensagens m where m.contato_id = c.id and m.automatica and m.direcao = 'saida' and m.oportunidade_id <> o.id
        and m.status in ('enviando', 'incerta', 'aceita', 'enviada', 'entregue', 'lida') and m.criado_em > now() - ${`${INTERVALO_RECEPCAO_HORAS} hours`}::interval) as recepcao_recente,
      exists (select 1 from crm_oportunidades x where x.contato_id = c.id and x.id <> o.id and x.etapa in ('aguardando_resposta', 'em_conversa', 'proposta_enviada')) as em_conversa
    from crm_oportunidades o join crm_contatos c on c.id = o.contato_id where o.id = ${t.oportunidade_id}`;
  if (!o) return encerrar(id, t.oportunidade_id, { status: "cancelada", resultado: "Oportunidade não encontrada." });

  const canal = await canalAutomacao();
  // O que encerra sem pedir nada de especial: o contato segue como um novo contato comum.
  if (canal === "desligado") return encerrar(id, o.id, { status: "cancelada", resultado: "Primeiro contato automático desligado." });
  if (o.teste) return encerrar(id, o.id, { status: "cancelada", resultado: "Envio de teste: sem mensagem automática." });
  if (o.assumida_em || o.etapa !== "novo") return encerrar(id, o.id, { status: "cancelada", resultado: "Atendimento já assumido por uma pessoa." });
  if (o.respondeu) return encerrar(id, o.id, { status: "cancelada", resultado: "O interessado já escreveu antes do envio automático." });
  if (Date.now() - new Date(o.recebido_em).getTime() > LIMITE_HORAS * 3600_000)
    return encerrar(id, o.id, { status: "cancelada", resultado: `Contato recebido há mais de ${LIMITE_HORAS} horas: sem envio automático retroativo.` });
  if (o.recepcao_recente || o.em_conversa)
    return encerrar(id, o.id, { status: "cancelada", resultado: "A pessoa já recebeu a recepção ou já está em conversa: novo pedido para atendimento humano.", pendencia: "novo_pedido" });

  if (canal === "email") return primeiroContatoEmail(id, o);

  // WhatsApp. O que impede o envio aqui pede ação manual e aparece na fila com o motivo.
  if (!o.whatsapp) return encerrar(id, o.id, { status: "falhou", resultado: "O contato não tem WhatsApp válido." });
  if (o.wa_bloqueado_em) return encerrar(id, o.id, { status: "falhou", resultado: "Este número pediu para parar de receber mensagens." });
  if (!o.aviso_versao) return encerrar(id, o.id, { status: "falhou", resultado: "O envio não registrou o pedido de retorno pelo WhatsApp (formulário antigo)." });
  const cfg = waEnvio();
  if (!cfg.pronto) return encerrar(id, o.id, { status: "falhou", resultado: `WhatsApp não configurado (${cfg.falta.join(", ")}).` });
  const modelo = await modeloPrimeiroContato();
  if (!modelo.nome) return encerrar(id, o.id, { status: "falhou", resultado: "Nenhum modelo de primeiro contato escolhido em Configurações." });
  const aprovado = await modeloAprovado(modelo.nome, modelo.idioma);
  if (!aprovado.ok) return encerrar(id, o.id, { status: "falhou", resultado: aprovado.motivo });

  const fr = await frases();
  const parametros = parametrosDoModelo(modelo, { nome: o.nome, empresa: o.empresa, pedido: fr[isCategoria(o.categoria) ? o.categoria : "a-classificar"] });
  const mensagemId = randomUUID();
  const criada = await sql.begin(async (tx) => {
    const r = await tx`
      insert into crm_mensagens (id, oportunidade_id, contato_id, canal, direcao, modo, via, tipo, automatica, corpo, status, chave, provedor, modelo, tentativas, tentado_em)
      values (${mensagemId}, ${o.id}, ${o.contato_id}, 'whatsapp', 'saida', 'sistema', 'api', 'template', true, ${textoDoModelo(aprovado.corpo, parametros, modelo.nome)},
        'enviando', ${`primeiro-contato:${o.id}`}, 'ycloud', ${modelo.nome}, 1, now())
      on conflict (chave) do nothing`;
    if (!r.count) return false;
    await tx`update crm_tarefas set mensagem_id = ${mensagemId}, canal = 'whatsapp' where id = ${id}`;
    return true;
  });
  if (!criada) return encerrar(id, o.id, { status: "cancelada", resultado: "A primeira mensagem desta oportunidade já tinha sido criada." });

  // Última conferência, colada ao envio: alguém assumiu ou a pessoa escreveu enquanto a tarefa era preparada?
  const [agora] = await sql<{ livre: boolean }[]>`
    select (o.assumida_em is null and o.etapa = 'novo' and c.wa_bloqueado_em is null
      and not exists (select 1 from crm_mensagens m where m.contato_id = c.id and m.direcao = 'entrada' and coalesce(m.ocorrida_em, m.criado_em) >= o.recebido_em)) as livre
    from crm_oportunidades o join crm_contatos c on c.id = o.contato_id where o.id = ${o.id}`;
  if (!agora?.livre) {
    await sql`update crm_mensagens set status = 'cancelada', erro = 'Atendimento assumido ou resposta recebida antes do envio.' where id = ${mensagemId} and status = 'enviando'`;
    return encerrar(id, o.id, { status: "cancelada", resultado: "Atendimento assumido ou resposta recebida antes do envio." });
  }

  const r = await enviarWhatsapp(mensagemId, { tipo: "modelo", para: o.whatsapp, modelo: modelo.nome, idioma: modelo.idioma, parametros });
  if (r === "aceita") return "concluida: primeiro contato pelo WhatsApp aceito pelo provedor";
  if (r === "incerta") {
    await sql`update crm_tarefas set status = 'incerta', resultado = 'O provedor não respondeu a tempo: não se sabe se a mensagem saiu. Confira no aplicativo antes de reenviar.', atualizado_em = now() where id = ${id}`;
    return "incerta: sem resposta do provedor";
  }
  if (r === "tentar_depois" && t.tentativas < 3) {
    // Limite de requisições do provedor: nada saiu, com certeza. A mesma mensagem volta para a fila.
    await sql.begin(async (tx) => {
      // Primeiro solta a referência da tarefa; depois remove a mensagem (a chave única dela fica livre para a nova tentativa).
      await tx`update crm_tarefas set status = 'pendente', mensagem_id = null, proxima_em = now() + interval '2 minutes', atualizado_em = now() where id = ${id}`;
      await tx`delete from crm_mensagens where id = ${mensagemId} and status = 'falhou'`;
    });
    return "pendente: provedor pediu para tentar depois";
  }
  const [m] = await sql<{ erro: string | null }[]>`select erro from crm_mensagens where id = ${mensagemId}`;
  return encerrar(id, o.id, { status: "falhou", resultado: m?.erro ?? "O provedor recusou a mensagem." });
}

async function primeiroContatoEmail(id: string, o: { id: string; nome: string; empresa: string | null; servico: string | null; email: string | null }) {
  const sql = await db();
  const cfg = emailCliente();
  if (!cfg.pronto) return encerrar(id, o.id, { status: "falhou", resultado: `E-mail ao interessado não configurado (${cfg.falta.join(", ")}).` });
  if (!o.email) return encerrar(id, o.id, { status: "falhou", resultado: "O contato não informou e-mail." });
  const modelo = (await modelos()).find((m) => m.id === "email-formulario")!;
  const v = { nome: o.nome, empresa: o.empresa, servico: o.servico };
  const mid = await enfileirarEmail(sql, { oportunidadeId: o.id, assunto: preencher(modelo.assunto ?? "", v), corpo: preencher(modelo.corpo, v), chave: `primeiro-contato:${o.id}`, automatica: true });
  if (!mid) return encerrar(id, o.id, { status: "cancelada", resultado: "A primeira mensagem desta oportunidade já tinha sido criada." });
  await sql`update crm_tarefas set mensagem_id = ${mid}, canal = 'email' where id = ${id}`;
  const r = await enviarMensagem(mid);
  if (r === "enviada") return "concluida: primeiro contato por e-mail aceito pelo provedor";
  if (r === "cancelada") return encerrar(id, o.id, { status: "cancelada", resultado: "Atendimento assumido antes do envio." });
  // Falha de e-mail: a mensagem fica na fila de reenvio (rotinaMensagens); a tarefa acompanha a mensagem.
  await sql`update crm_tarefas set status = 'falhou', resultado = 'O e-mail falhou; novas tentativas pela rotina.', atualizado_em = now() where id = ${id}`;
  return "falhou: e-mail não aceito agora";
}

/** Rotina: tarefas que ficaram pendentes (publicação perdida, instância interrompida). */
export async function rotinaTarefas(): Promise<string[]> {
  const sql = await db();
  const rows = await sql<{ id: string }[]>`
    select id from crm_tarefas
    where (status = 'pendente' and proxima_em <= now() and criado_em < now() - interval '45 seconds')
       or (status = 'processando' and tentado_em < now() - interval '3 minutes')
    order by criado_em limit 20`;
  const out: string[] = [];
  for (const r of rows) out.push(`tarefa ${r.id.slice(0, 8)}: ${await processarTarefa(r.id)}`);
  return out;
}
