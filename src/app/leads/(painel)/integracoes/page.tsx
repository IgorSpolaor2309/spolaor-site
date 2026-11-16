import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { validacaoAction } from "@/app/leads/actions";
import { Enviar } from "@/components/crm/enviar";
import { Aviso, btnPrimary, Campo, input, Painel, Titulo } from "@/components/crm/ui";
import { emailsAutorizados, exigirUsuario } from "@/lib/crm/auth";
import { avisoConfigurado } from "@/lib/crm/aviso";
import { estadoFormularios, estadoMensagens } from "@/lib/crm/consultas";
import { db, dbStatus } from "@/lib/crm/db";
import { emailCliente } from "@/lib/crm/mensagens";
import { CATEGORIA_ROTULO, CATEGORIAS, fmtDataHora, fmtWhatsapp } from "@/lib/crm/tipos";
import { canalAutomacao, modeloPrimeiroContato, numerosControle, textosAutomaticosApp, waEnv, waEnvio } from "@/lib/crm/whatsapp/config";
import { estadoValidacao } from "@/lib/crm/whatsapp/validacao";
import { estadoRecusas, estadoWebhook, MOTIVO_RECUSA_ROTULO } from "@/lib/crm/whatsapp/webhook";
import { estadoNumero, modeloAprovado } from "@/lib/crm/whatsapp/ycloud";

export const metadata: Metadata = { title: "Integrações" };

type Estado = "conectado" | "parcial" | "manual" | "desconectado";
const ESTADO: Record<Estado, { rotulo: string; cor: string }> = {
  conectado: { rotulo: "Conectado", cor: "bg-[#1a7f4b]" },
  parcial: { rotulo: "Parcial", cor: "bg-royal" },
  manual: { rotulo: "Manual", cor: "bg-ink-600" },
  desconectado: { rotulo: "Não conectado", cor: "bg-ember" },
};

function Canal({ nome, estado, children }: { nome: string; estado: Estado; children: ReactNode }) {
  return (
    <li className="border-b border-line px-4 py-5 last:border-b-0 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-[family-name:var(--font-display)] text-[1.05rem] font-semibold">{nome}</h2>
        <p className="inline-flex items-center gap-1.5 text-[0.84rem] font-semibold">
          <span aria-hidden className={`h-2 w-2 rounded-[2px] ${ESTADO[estado].cor}`} />
          {ESTADO[estado].rotulo}
        </p>
      </div>
      <div className="mt-2 grid max-w-3xl gap-2 text-[0.9rem] leading-relaxed text-muted [&_strong]:text-fg">{children}</div>
    </li>
  );
}

// Estado REAL de cada canal, lido da configuração e do banco no momento. "Conectado" só aparece quando o CRM de
// fato recebe ou envia por ali. O que depende de credencial, aprovação ou decisão fica dito como tal.
const MSG_VALIDACAO: Record<string, { tom: "ok" | "alerta"; texto: string }> = {
  validacao: { tom: "ok", texto: "Validação iniciada. Acompanhe os passos abaixo; cada um só aparece como comprovado com evidência." },
  "validacao-numero": { tom: "alerta", texto: "Escolha um número cadastrado como número de controle." },
  "validacao-config": { tom: "alerta", texto: "O WhatsApp ainda não está configurado no servidor (chave da YCloud e número comercial)." },
  "validacao-modelo": { tom: "alerta", texto: "Não há modelo de primeiro contato aprovado. Escolha um modelo aprovado em Configurações." },
  "validacao-aberta": { tom: "alerta", texto: "Este número já tem uma oportunidade real aberta para esse serviço. Escolha outro serviço para a validação." },
};

const ROTULO_CURTO_RECUSA: Record<keyof typeof MOTIVO_RECUSA_ROTULO, string> = {
  sem_assinatura: "sem assinatura",
  formato_invalido: "formato inválido",
  fora_do_prazo: "fora do prazo",
  assinatura_diferente: "assinatura diferente",
};

export default async function IntegracoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirUsuario();
  const sp = await searchParams;
  const msgValidacao = typeof sp.msg === "string" ? MSG_VALIDACAO[sp.msg] : undefined;
  const [banco, forms, msgs, canal] = await Promise.all([dbStatus(), estadoFormularios(), estadoMensagens(), canalAutomacao()]);
  // WhatsApp: cada linha abaixo é uma evidência lida agora (configuração, YCloud, notificações recebidas), não uma suposição.
  const wa = waEnvio();
  const segredo = !!waEnv.webhookSecret();
  const [numero, wh, recusas, modeloWa, controle, validacao, autoApp] = await Promise.all([
    wa.pronto ? estadoNumero() : null,
    estadoWebhook(),
    estadoRecusas(),
    modeloPrimeiroContato(),
    numerosControle(),
    estadoValidacao(),
    textosAutomaticosApp(),
  ]);
  const modeloEstado = wa.pronto && modeloWa.nome ? await modeloAprovado(modeloWa.nome, modeloWa.idioma) : null;
  const sql = await db();
  const [falhasWa] = await sql<{ falhas: number; incertas: number }[]>`
    select count(*) filter (where status = 'falhou')::int as falhas, count(*) filter (where status = 'incerta')::int as incertas
    from crm_mensagens where canal = 'whatsapp' and via = 'api' and criado_em > now() - interval '7 days'`;
  const avisos = await sql<{ chave: string; valor: Record<string, string>; atualizado_em: Date }[]>`
    select chave, valor, atualizado_em from crm_config where chave in ('whatsapp:evento-numero', 'whatsapp:evento-conta')`;
  const conectadoNaYCloud = !!numero && numero.ok && numero.encontrado && numero.status === "CONNECTED";
  const estadoWa: Estado = !wa.pronto || !conectadoNaYCloud ? "desconectado" : segredo && wh.total > 0 ? "conectado" : "parcial";
  const aviso = avisoConfigurado();
  const email = emailCliente();
  const autorizados = emailsAutorizados();
  const listaPropria = !!(process.env.CRM_ACESSO_EMAILS ?? "").trim();
  return (
    <>
      <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">Integrações</h1>
      <p className="mt-2 max-w-3xl text-[0.9rem] leading-relaxed text-muted">
        O que este CRM recebe e envia sozinho hoje, e o que ainda é feito à mão. Nada aqui é simulado: canal sem integração não mostra conversas, entregas nem respostas.
      </p>
      <Painel className="mt-5">
        <ul>
          <Canal nome="Formulários do site" estado={banco.ok ? "conectado" : "desconectado"}>
            <p>
              Todo envio aceito por <code>/api/lead</code> é gravado no banco antes do aviso por e-mail.{" "}
              {banco.ok ? (
                <>
                  <strong>{forms.total}</strong> {forms.total === 1 ? "envio gravado" : "envios gravados"}
                  {forms.ultimoEm ? <>, o último em {fmtDataHora(forms.ultimoEm)}</> : <> (nenhum ainda desde a ativação)</>}.
                </>
              ) : (
                <strong>O banco não respondeu agora: {banco.erro}</strong>
              )}
            </p>
            <p>Contatos anteriores à ativação do CRM existem só nos e-mails de aviso; para trazê-los, use “Cadastrar contato” com a data real.</p>
          </Canal>

          <Canal nome="Aviso de novo lead por e-mail" estado={aviso ? "conectado" : "desconectado"}>
            {aviso ? (
              <p>
                Enviado pelo Resend a cada envio de formulário. Aceitos pelo provedor: <strong>{forms.avisosEnviados}</strong>
                {forms.ultimoAvisoEm ? <> (último em {fmtDataHora(forms.ultimoAvisoEm)})</> : null} · na fila: <strong>{forms.avisosPendentes}</strong> · com falha:{" "}
                <strong>{forms.avisosFalhos}</strong>. Falhas são tentadas de novo pela rotina do site e aparecem em{" "}
                <Link href="/leads#manual" className="font-semibold text-sky underline-offset-4 hover:underline">
                  Depende de mim
                </Link>
                . “Aceito” não comprova chegada à caixa de entrada.
              </p>
            ) : (
              <p>Sem RESEND_API_KEY, LEAD_EMAIL_TO e LEAD_EMAIL_FROM neste ambiente, os contatos são gravados aqui mas nenhum aviso sai.</p>
            )}
          </Canal>

          <Canal nome="E-mail para o interessado" estado={email.pronto ? "parcial" : "desconectado"}>
            <p>
              <strong>Envio:</strong>{" "}
              {email.pronto ? (
                <>
                  pronto pelo Resend, com respostas indo para <strong>{email.replyTo}</strong>. Enviados pelo CRM: {msgs.enviadas} · com falha: {msgs.falhas} · na fila:{" "}
                  {msgs.pendentes}.
                </>
              ) : (
                <>indisponível. Falta configurar: {email.falta.join(", ")}.</>
              )}
            </p>
            <p>
              <strong>Primeiro contato automático por e-mail:</strong> {canal === "email" ? "ligado" : canal === "whatsapp" ? "desligado (o canal escolhido é o WhatsApp)" : "desligado"} (
              <Link href="/leads/configuracoes" className="font-semibold text-sky underline-offset-4 hover:underline">
                Configurações
              </Link>
              ). Só vale para quem preencheu um formulário e informou e-mail.
            </p>
            <p>
              <strong>Recebimento: não conectado.</strong> As respostas chegam na caixa de e-mail (hospedada no cPanel da HostGator), não aqui; registre a resposta na ficha. Para
              ler a caixa pelo CRM é preciso escolher o caminho (encaminhador para um endereço de recebimento do Resend, ou leitura IMAP periódica) e fornecer a credencial.
            </p>
          </Canal>

          <Canal nome="WhatsApp (YCloud, com o aplicativo no celular)" estado={estadoWa}>
            <p>
              <strong>Configuração no servidor:</strong>{" "}
              {wa.pronto ? `chave da YCloud definida; número comercial ${fmtWhatsapp(waEnv.numero())}` : `incompleta. Falta ${wa.falta.join(" e ")}`}
              {segredo ? "; segredo do webhook definido." : "; falta YCLOUD_WEBHOOK_SECRET (sem ele nenhuma notificação é aceita)."} Ter a chave não prova que o número
              funciona: veja as linhas abaixo.
            </p>
            <p data-wa-numero>
              <strong>Número na YCloud:</strong>{" "}
              {!numero
                ? "não consultado (configuração incompleta)."
                : !numero.ok
                  ? `não foi possível consultar agora: ${numero.erro}.`
                  : !numero.encontrado
                    ? `o número configurado não aparece na conta da YCloud (${numero.numeros} ${numero.numeros === 1 ? "número" : "números"} na conta).`
                    : `estado ${numero.status}${numero.nomeVerificado ? `, nome ${numero.nomeVerificado}` : ""}${numero.qualidade ? `, qualidade ${numero.qualidade}` : ""}${numero.limite ? `, limite ${numero.limite}` : ""}.`}
            </p>
            <p data-wa-modelo>
              <strong>Modelo do primeiro contato:</strong>{" "}
              {!modeloWa.nome
                ? "nenhum escolhido em Configurações."
                : !modeloEstado
                  ? `${modeloWa.nome} (não conferido: configuração incompleta).`
                  : modeloEstado.ok
                    ? `${modeloWa.nome} (${modeloWa.idioma}) aprovado${modeloEstado.categoria ? `, categoria ${modeloEstado.categoria}` : ""}.`
                    : `pendente ou indisponível. ${modeloEstado.motivo}`}
            </p>
            <p data-wa-webhook>
              <strong>Notificações recebidas:</strong>{" "}
              {wh.total === 0
                ? "nenhuma até agora. Enquanto nenhuma chegar, não há prova de que o webhook está ligado na YCloud."
                : `${wh.total} no total, a última em ${fmtDataHora(wh.ultimoEm)}. Última mensagem recebida: ${wh.ultimaEntradaEm ? fmtDataHora(wh.ultimaEntradaEm) : "nenhuma ainda"}. Última resposta sincronizada do aplicativo: ${wh.ultimoEcoEm ? fmtDataHora(wh.ultimoEcoEm) : "nenhuma ainda"}. Último estado de entrega: ${wh.ultimoEstadoEm ? fmtDataHora(wh.ultimoEstadoEm) : "nenhum ainda"}.`}
              {wh.semProcessar > 0 ? ` ${wh.semProcessar} aguardando processamento.` : ""}
              {wh.historico > 0 ? ` ${wh.historico} de histórico do aplicativo, guardadas sem virar mensagem nem pendência.` : ""}
            </p>
            {recusas && (
              <p data-wa-recusas data-motivo={recusas.ultimoMotivo} className={wh.ultimoEm && wh.ultimoEm > recusas.ultimaEm ? undefined : "text-ember"}>
                <strong className={wh.ultimoEm && wh.ultimoEm > recusas.ultimaEm ? undefined : "!text-ember"}>Notificações recusadas:</strong> ao menos {recusas.total} desde{" "}
                {fmtDataHora(recusas.desde)}; a última em {fmtDataHora(recusas.ultimaEm)}. Motivo da última: {MOTIVO_RECUSA_ROTULO[recusas.ultimoMotivo]}.
                {recusas.porMotivo.length > 1
                  ? ` Por motivo: ${recusas.porMotivo.map((x) => `${ROTULO_CURTO_RECUSA[x.motivo]} ${x.n}`).join(" · ")}.`
                  : ""}{" "}
                {wh.ultimoEm && wh.ultimoEm > recusas.ultimaEm
                  ? "Depois dela já chegaram notificações válidas."
                  : "Nenhuma notificação válida chegou depois dela: enquanto for assim, mensagens e estados de entrega não entram no CRM."}{" "}
                Uma notificação recusada não é gravada; o que fica é só o motivo.
              </p>
            )}
            <p>
              <strong>Primeiro contato automático pelo WhatsApp:</strong> {canal === "whatsapp" ? "ligado" : "desligado"} (
              <Link href="/leads/configuracoes" className="font-semibold text-sky underline-offset-4 hover:underline">
                Configurações
              </Link>
              ). Envios pelo CRM nos últimos 7 dias com falha: <strong>{falhasWa.falhas}</strong> · com resultado incerto: <strong>{falhasWa.incertas}</strong>.
            </p>
            {avisos.map((a) => (
              <p key={a.chave} className="text-ember">
                <strong className="!text-ember">Aviso da YCloud em {fmtDataHora(new Date(a.atualizado_em).toISOString())}:</strong>{" "}
                {a.chave.endsWith("numero")
                  ? `número ${a.valor.updateEvent ?? a.valor.qualityUpdateEvent ?? a.valor.tipo}${a.valor.qualityRating ? `, qualidade ${a.valor.qualityRating}` : ""}`
                  : `conta ${a.valor.removedReason ?? a.valor.updateEvent ?? a.valor.banState ?? a.valor.tipo}`}
                .
              </p>
            ))}
            <p>
              Sem a integração completa, o CRM segue no modo manual: abre a conversa no aplicativo e você registra o que enviou e o que a pessoa respondeu. Para a coexistência
              funcionar: use o WhatsApp Business (não o pessoal) no celular do número comercial, desligue a mensagem de saudação e a de ausência do aplicativo (senão a pessoa
              recebe duas recepções) e abra o aplicativo ao menos uma vez a cada duas semanas (a Meta desconecta números inativos).
            </p>
            <p data-wa-validacao>
              <strong>Validação com número de controle:</strong>{" "}
              {!validacao
                ? "nunca feita. Enquanto não houver uma validação completa, o envio e o recebimento reais não estão comprovados."
                : validacao.completa
                  ? `completa (iniciada em ${fmtDataHora(validacao.iniciadaEm)}).`
                  : `incompleta. Falta comprovar: ${validacao.faltam.join("; ")}.`}{" "}
              <strong>Mensagens automáticas do aplicativo cadastradas:</strong> {[autoApp.saudacao, autoApp.ausencia, ...autoApp.outras].filter((x) => x.trim()).length}.
            </p>
          </Canal>

          <Canal nome="Instagram Direct" estado="manual">
            <p>
              <strong>Sem integração.</strong> A conexão da Meta usada para anúncios não dá permissão de ler ou responder mensagens. O que existe: cadastro manual, botão que abre o
              Direct da pessoa e registro manual.
            </p>
            <p>
              Para conectar: aplicativo da Meta com a permissão de mensagens do Instagram, autorizado pela conta profissional da Spolaor, e um endereço de notificações (webhook)
              neste site. A API só permite responder depois que a pessoa escreve.
            </p>
          </Canal>

          <Canal nome="Campanhas da Meta (leitura de investimento)" estado="desconectado">
            <p>
              <strong>Não conectado.</strong> Campanhas, conjuntos, anúncios e gasto não são lidos; o investimento é informado à mão em{" "}
              <Link href="/leads/indicadores#custos" className="font-semibold text-sky underline-offset-4 hover:underline">
                Indicadores
              </Link>
              . Para conectar é preciso um token de leitura (<code>ads_read</code>) de um usuário de sistema do seu Gerenciador de Negócios. Esta conexão é só de leitura e
              separada do recebimento de leads: o CRM não altera campanha, orçamento nem configuração.
            </p>
            <p>
              Enquanto isso, os identificadores de campanha, conjunto e anúncio entram na ficha quando a URL do anúncio os trouxer (parâmetros <code>campaign_id</code>,{" "}
              <code>adset_id</code> e <code>ad_id</code>).
            </p>
          </Canal>

          <Canal nome="Crush" estado="desconectado">
            <p>
              <strong>Sem integração possível hoje.</strong> Não encontramos API, webhooks nem exportação oficial da Crush (pesquisa em 15/11/2026). O CRM funciona sem ela e não
              usa o painel nem a sessão da Crush. Assinatura e taxa do Autopilot são informadas à mão, em linhas separadas da verba da Meta.
            </p>
          </Canal>

          <Canal nome="Acesso a esta área" estado="conectado">
            <p>
              Entram só: <strong>{autorizados.join(", ") || "ninguém"}</strong>.{" "}
              {listaPropria
                ? "Lista definida em CRM_ACESSO_EMAILS."
                : "Como CRM_ACESSO_EMAILS não está definida, valem os destinatários dos avisos de lead (LEAD_EMAIL_TO). Defina CRM_ACESSO_EMAILS na Vercel para escolher quem entra."}
            </p>
          </Canal>
        </ul>
      </Painel>

      <Painel className="mt-5 scroll-mt-20" id="validacao">
        <Titulo nota={validacao ? (validacao.completa ? "Completa" : "Incompleta") : "Nunca feita"}>Validação do WhatsApp com número de controle</Titulo>
        <div className="grid gap-4 px-4 py-4 sm:px-5">
          <p className="max-w-3xl text-[0.9rem] leading-relaxed text-muted">
            Roda o fluxo real de ponta a ponta com um telefone da própria equipe: lead gravado, tarefa, fila, envio pelo provedor, entrega, resposta, resposta pelo
            aplicativo e resposta pelo CRM. Não aborda cliente, fica fora dos indicadores e <strong className="text-fg">não gera conversão nos anúncios</strong>: iniciada
            aqui, não passa pelo navegador público; pelo formulário do site com um número de controle, o site não dispara o evento Lead. Funciona com a automação
            desligada para todos os outros contatos.
          </p>
          {msgValidacao && <Aviso tom={msgValidacao.tom}>{msgValidacao.texto}</Aviso>}
          {controle.length === 0 ? (
            <p className="text-[0.9rem] font-semibold">
              Nenhum número de controle cadastrado.{" "}
              <Link href="/leads/configuracoes#controle" className="text-sky underline-offset-4 hover:underline">
                Cadastrar em Configurações
              </Link>
            </p>
          ) : (
            <form action={validacaoAction} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <Campo rotulo="Número de controle">
                <select name="numero" className={input}>
                  {controle.map((n) => (
                    <option key={n} value={n}>
                      {fmtWhatsapp(n)}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Serviço do pedido simulado">
                <select name="categoria" className={input} defaultValue="sites">
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_ROTULO[c]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Enviar className={btnPrimary}>Iniciar validação</Enviar>
            </form>
          )}
          {validacao && (
            <div data-validacao={validacao.completa ? "completa" : "incompleta"}>
              <p className="text-[0.86rem] text-dim">
                Última validação: {fmtWhatsapp(validacao.numero)}, iniciada em {fmtDataHora(validacao.iniciadaEm)} {validacao.origem === "crm" ? "pelo CRM" : "pelo formulário do site"}.{" "}
                <Link href={`/leads/o/${validacao.oportunidadeId}`} className="font-semibold text-sky underline-offset-4 hover:underline">
                  Abrir a ficha
                </Link>
              </p>
              <ol className="mt-2 border-t border-line">
                {validacao.passos.map((p) => (
                  <li key={p.id} data-passo={p.id} data-ok={p.ok ? "sim" : "nao"} className="flex gap-3 border-b border-line py-2.5">
                    <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px] ${p.ok ? "bg-[#1a7f4b]" : p.opcional ? "bg-ink-600" : "bg-ember"}`} />
                    <span className="min-w-0">
                      <span className="block text-[0.92rem] font-semibold">
                        {p.titulo}
                        <span className="font-normal text-dim"> · {p.ok ? "comprovado" : p.opcional ? "não comprovado (opcional)" : "não comprovado"}</span>
                      </span>
                      <span className="block text-[0.84rem] leading-snug text-muted">{p.evidencia}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </Painel>
    </>
  );
}
