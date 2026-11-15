import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Painel } from "@/components/crm/ui";
import { emailsAutorizados, exigirUsuario } from "@/lib/crm/auth";
import { avisoConfigurado } from "@/lib/crm/aviso";
import { estadoFormularios, estadoMensagens } from "@/lib/crm/consultas";
import { dbStatus } from "@/lib/crm/db";
import { automacaoEmailAtiva, emailCliente } from "@/lib/crm/mensagens";
import { fmtDataHora } from "@/lib/crm/tipos";

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
export default async function IntegracoesPage() {
  await exigirUsuario();
  const [banco, forms, msgs, automacao] = await Promise.all([dbStatus(), estadoFormularios(), estadoMensagens(), automacaoEmailAtiva()]);
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
                <Link href="/leads#falhas" className="font-semibold text-sky underline-offset-4 hover:underline">
                  Atendimento
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
              <strong>Primeiro contato automático:</strong> {automacao ? "ligado" : "desligado"} (
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

          <Canal nome="WhatsApp" estado="manual">
            <p>
              <strong>Sem integração oficial.</strong> O número de atendimento é pessoal: o CRM não lê nem envia mensagens. O que existe: botão que abre a conversa no WhatsApp com o
              texto do modelo, e registro manual do que foi enviado e respondido.
            </p>
            <p>
              Para automatizar é preciso a WhatsApp Business Platform (API oficial da Meta), o que exige uma decisão sua: número comercial separado, ou migrar o atual para o
              WhatsApp Business e usar a coexistência (aplicativo e API no mesmo número, por um parceiro da Meta). Mensagem iniciada pela empresa só com modelo aprovado e
              consentimento da pessoa; as mensagens pela API são cobradas.
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
    </>
  );
}
