import type { Metadata } from "next";
import { automacaoAction, modeloAction, nomeAction } from "@/app/leads/actions";
import { Enviar } from "@/components/crm/enviar";
import { Aviso, btnPrimary, btnQuiet, btnSecondary, Campo, input, Painel, Titulo } from "@/components/crm/ui";
import { exigirUsuario } from "@/lib/crm/auth";
import { automacaoEmailAtiva, emailCliente, modelos, MODELOS_PADRAO } from "@/lib/crm/mensagens";

export const metadata: Metadata = { title: "Configurações" };

const MSG: Record<string, { tom: "ok" | "alerta"; texto: string }> = {
  salvo: { tom: "ok", texto: "Salvo." },
  "modelo-salvo": { tom: "ok", texto: "Modelo salvo." },
  "modelo-vazio": { tom: "alerta", texto: "A mensagem do modelo não pode ficar vazia." },
  automacao: { tom: "ok", texto: "Primeiro contato automático atualizado." },
  "email-config": { tom: "alerta", texto: "Não dá para ligar: o envio de e-mail ao interessado ainda não está configurado." },
};

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const [mods, automacao] = await Promise.all([modelos(), automacaoEmailAtiva()]);
  const email = emailCliente();
  const msg = typeof sp.msg === "string" ? MSG[sp.msg] : undefined;
  return (
    <>
      <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">Configurações</h1>
      {msg && (
        <div className="mt-4">
          <Aviso tom={msg.tom}>{msg.texto}</Aviso>
        </div>
      )}

      <Painel className="mt-5">
        <Titulo nota={automacao ? "Ligado" : "Desligado"}>Primeiro contato automático por e-mail</Titulo>
        <div className="grid gap-3 px-4 py-4 sm:px-5">
          <p className="max-w-3xl text-[0.9rem] leading-relaxed text-muted">
            Quando ligado, quem preenche um formulário do site e informa e-mail recebe o modelo “E-mail · primeiro contato” logo depois do envio. Uma mensagem por oportunidade,
            nunca repetida; não sai para envios de teste, para quem já tem conversa aberta do mesmo serviço, nem depois que alguém assumiu o atendimento. Falha de envio é tentada
            de novo e aparece em Atendimento. Por WhatsApp e Instagram não há envio automático (sem integração oficial).
          </p>
          {!email.pronto && <Aviso tom="alerta">Envio de e-mail ao interessado não configurado. Falta: {email.falta.join(", ")}.</Aviso>}
          {email.pronto && (
            <p className="text-[0.84rem] text-dim">
              Sai de <strong>{email.from}</strong>; as respostas vão para <strong>{email.replyTo}</strong>.
            </p>
          )}
          <form action={automacaoAction}>
            <input type="hidden" name="ativo" value={automacao ? "0" : "1"} />
            <Enviar className={automacao ? btnSecondary : btnPrimary}>{automacao ? "Desligar o envio automático" : "Ligar o envio automático"}</Enviar>
          </form>
        </div>
      </Painel>

      <h2 className="mt-8 font-[family-name:var(--font-display)] text-[1.15rem] font-semibold">Modelos de mensagem</h2>
      <p className="mt-1.5 max-w-3xl text-[0.9rem] leading-relaxed text-muted">
        Texto inicial de cada canal. Na ficha ele aparece já preenchido e pode ser ajustado antes de enviar. Variáveis: <code>{"{{primeiro_nome}}"}</code>,{" "}
        <code>{"{{nome}}"}</code>, <code>{"{{empresa}}"}</code>, <code>{"{{servico}}"}</code> e <code>{"{{meu_nome}}"}</code>.
      </p>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {mods.map((m) => {
          const padrao = MODELOS_PADRAO.find((p) => p.id === m.id)!;
          const editado = padrao.corpo !== m.corpo || (padrao.assunto ?? "") !== (m.assunto ?? "");
          return (
            <Painel key={m.id}>
              <Titulo nota={editado ? "Editado" : "Texto padrão"}>{m.titulo}</Titulo>
              <form action={modeloAction} className="grid gap-3 px-4 py-4 sm:px-5">
                <input type="hidden" name="id" value={m.id} />
                <p className="text-[0.84rem] leading-snug text-dim">{m.quando}</p>
                {m.canal === "email" && (
                  <Campo rotulo="Assunto">
                    <input name="assunto" defaultValue={m.assunto ?? ""} maxLength={200} className={input} />
                  </Campo>
                )}
                <Campo rotulo="Mensagem">
                  <textarea name="corpo" defaultValue={m.corpo} required maxLength={4000} className={`${input} min-h-[150px] leading-relaxed`} />
                </Campo>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Enviar className={btnSecondary}>Salvar modelo</Enviar>
                  {editado && (
                    <Enviar name="restaurar" value="1" className={btnQuiet}>
                      Voltar ao texto padrão
                    </Enviar>
                  )}
                </div>
              </form>
            </Painel>
          );
        })}
      </div>

      <Painel className="mt-8 max-w-xl">
        <Titulo nota={usuario.email}>Seu nome nas mensagens e no histórico</Titulo>
        <form action={nomeAction} className="flex flex-wrap items-end gap-2.5 px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <Campo rotulo="Nome">
              <input name="nome" defaultValue={usuario.nome} required minLength={2} maxLength={60} className={input} />
            </Campo>
          </div>
          <Enviar className={btnSecondary}>Salvar</Enviar>
        </form>
      </Painel>
    </>
  );
}
