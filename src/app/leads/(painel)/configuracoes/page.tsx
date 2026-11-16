import type { Metadata } from "next";
import { automacaoAction, limitesAction, modeloAction, modeloWhatsappAction, nomeAction, numerosControleAction, textosAutomaticosAction } from "@/app/leads/actions";
import { Enviar } from "@/components/crm/enviar";
import { Aviso, btnPrimary, btnQuiet, btnSecondary, Campo, input, Painel, Titulo } from "@/components/crm/ui";
import { exigirUsuario } from "@/lib/crm/auth";
import { emailCliente, modelos, MODELOS_PADRAO } from "@/lib/crm/mensagens";
import { CATEGORIA_ROTULO, CATEGORIAS, fmtDataHora, fmtWhatsapp } from "@/lib/crm/tipos";
import {
  canalAutomacao,
  frases,
  LIMITES_FAIXA,
  LIMITES_PADRAO,
  limitesAutomacao,
  MODELO_SUGERIDO,
  modeloPrimeiroContato,
  numerosControle,
  textosAutomaticosApp,
  VARIAVEIS_MODELO,
  waEnvio,
} from "@/lib/crm/whatsapp/config";
import { listarModelos } from "@/lib/crm/whatsapp/ycloud";

export const metadata: Metadata = { title: "Configurações" };

const MSG: Record<string, { tom: "ok" | "alerta"; texto: string }> = {
  salvo: { tom: "ok", texto: "Salvo." },
  "modelo-salvo": { tom: "ok", texto: "Modelo salvo." },
  "modelo-vazio": { tom: "alerta", texto: "A mensagem do modelo não pode ficar vazia." },
  automacao: { tom: "ok", texto: "Primeiro contato automático atualizado." },
  "email-config": { tom: "alerta", texto: "Não dá para ligar: o envio de e-mail ao interessado ainda não está configurado." },
  "wa-config": { tom: "alerta", texto: "Não dá para ligar: o WhatsApp ainda não está configurado no servidor (chave da YCloud e número comercial)." },
  "wa-modelo": { tom: "alerta", texto: "Não dá para ligar: escolha abaixo um modelo que esteja aprovado pela Meta." },
  "wa-nome": { tom: "alerta", texto: "Nome de modelo inválido: use o nome exato cadastrado no provedor (minúsculas, números e sublinhado)." },
  "wa-salvo": { tom: "ok", texto: "Modelo e frases do WhatsApp salvos." },
  limites: { tom: "ok", texto: "Limites do envio automático salvos." },
  "limites-invalidos": { tom: "alerta", texto: "Limites não alterados: informe números inteiros dentro das faixas indicadas." },
  textos: { tom: "ok", texto: "Mensagens automáticas do aplicativo salvas." },
  controle: { tom: "ok", texto: "Números de controle salvos." },
  "controle-invalido": { tom: "alerta", texto: "Algum número não foi reconhecido e ficou de fora. Informe DDD e número, um por linha." },
};
const CANAIS = [
  { v: "desligado", rotulo: "Desligado", texto: "Nenhuma mensagem automática. Todo contato novo aparece em “Depende de mim”." },
  { v: "whatsapp", rotulo: "WhatsApp", texto: "Modelo aprovado enviado pelo número comercial logo depois do formulário." },
  { v: "email", rotulo: "E-mail", texto: "Modelo “E-mail · primeiro contato”, para quem informou e-mail." },
] as const;
const VAR_ROTULO: Record<string, string> = { primeiro_nome: "Primeiro nome", pedido: "Frase do pedido (por serviço)", nome: "Nome completo", empresa: "Empresa" };

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const wa = waEnvio();
  const [mods, canal, modeloWa, fr, lista, limites, autoApp, controle] = await Promise.all([
    modelos(),
    canalAutomacao(),
    modeloPrimeiroContato(),
    frases(),
    wa.pronto ? listarModelos() : null,
    limitesAutomacao(),
    textosAutomaticosApp(),
    numerosControle(),
  ]);
  const email = emailCliente();
  const msg = typeof sp.msg === "string" ? MSG[sp.msg] : undefined;
  const itens = lista ? (lista.ok ? lista.itens : (lista.antigo?.itens ?? [])) : [];
  const escolhido = itens.find((t) => t.nome === modeloWa.nome && t.idioma === modeloWa.idioma);
  return (
    <>
      <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">Configurações</h1>
      {msg && (
        <div className="mt-4">
          <Aviso tom={msg.tom}>{msg.texto}</Aviso>
        </div>
      )}

      <Painel className="mt-5" id="automacao">
        <Titulo nota={`Agora: ${CANAIS.find((c) => c.v === canal)!.rotulo}`}>Primeiro contato automático</Titulo>
        <div className="grid gap-3 px-4 py-4 sm:px-5">
          <p className="max-w-3xl text-[0.9rem] leading-relaxed text-muted">
            Vale só para formulários do site, uma mensagem por oportunidade, por um canal só (a mesma recepção nunca sai por WhatsApp e por e-mail). A tarefa é gravada
            junto com o contato e sai em seguida. Não sai para envios de teste, depois que alguém assumiu o atendimento, depois que a pessoa respondeu, nem fora dos
            dois limites de tempo abaixo. Ligar não dispara nada para quem chegou antes.
          </p>
          <form action={automacaoAction} className="grid gap-2.5">
            <div role="radiogroup" aria-label="Canal do primeiro contato" className="grid gap-2 sm:grid-cols-3">
              {CANAIS.map((c) => (
                <label key={c.v} className="flex cursor-pointer gap-2.5 rounded-[10px] border border-line-strong bg-white px-3 py-2.5 has-[:checked]:border-royal has-[:checked]:bg-royal/[0.04]">
                  <input type="radio" name="canal" value={c.v} defaultChecked={canal === c.v} className="mt-1 h-4 w-4 accent-royal" />
                  <span>
                    <span className="block text-[0.92rem] font-semibold">{c.rotulo}</span>
                    <span className="block text-[0.82rem] leading-snug text-muted">{c.texto}</span>
                  </span>
                </label>
              ))}
            </div>
            <div>
              <Enviar className={btnPrimary}>Salvar canal</Enviar>
            </div>
          </form>
          {!wa.pronto && <p className="text-[0.84rem] text-dim">WhatsApp indisponível: falta configurar no servidor {wa.falta.join(" e ")}.</p>}
          {!email.pronto && <p className="text-[0.84rem] text-dim">E-mail ao interessado indisponível: falta {email.falta.join(", ")}.</p>}
        </div>
        <form action={limitesAction} className="grid gap-3 border-t border-line px-4 py-4 sm:px-5" id="limites">
          <h3 className="text-[0.95rem] font-semibold">Limites de tempo do envio automático</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Idade máxima do contato (horas)"
              dica={`Padrão ${LIMITES_PADRAO.horasMaximas}; de ${LIMITES_FAIXA.horasMaximas[0]} a ${LIMITES_FAIXA.horasMaximas[1]}. Conta da chegada do formulário até a hora em que a tarefa roda. Normalmente são segundos; o limite só age quando a tarefa atrasa (fila ou banco fora do ar) e é o que impede disparo retroativo. Passado o limite, nada é enviado e o contato fica como novo sem primeiro atendimento.`}
            >
              <input name="horasMaximas" type="number" inputMode="numeric" min={LIMITES_FAIXA.horasMaximas[0]} max={LIMITES_FAIXA.horasMaximas[1]} step={1} required defaultValue={limites.horasMaximas} className={input} />
            </Campo>
            <Campo
              rotulo="Intervalo entre recepções para a mesma pessoa (horas)"
              dica={`Padrão ${LIMITES_PADRAO.horasEntreRecepcoes}; de ${LIMITES_FAIXA.horasEntreRecepcoes[0]} a ${LIMITES_FAIXA.horasEntreRecepcoes[1]}. Conta da recepção automática anterior (do CRM ou do aplicativo) até o novo pedido. Dentro do intervalo a pessoa não recebe outra recepção, mesmo pedindo outro serviço: o novo pedido vai para “Depende de mim”. Quem já está em conversa (respondeu ou foi atendido) nunca recebe outra, com qualquer intervalo.`}
            >
              <input name="horasEntreRecepcoes" type="number" inputMode="numeric" min={LIMITES_FAIXA.horasEntreRecepcoes[0]} max={LIMITES_FAIXA.horasEntreRecepcoes[1]} step={1} required defaultValue={limites.horasEntreRecepcoes} className={input} />
            </Campo>
          </div>
          <div>
            <Enviar className={btnSecondary}>Salvar limites</Enviar>
          </div>
        </form>
      </Painel>

      <Painel className="mt-5" id="whatsapp">
        <Titulo nota={escolhido ? `Estado na Meta: ${escolhido.status}${escolhido.categoria ? ` · categoria ${escolhido.categoria}` : ""}` : modeloWa.nome ? "Modelo não encontrado na conta" : "Nenhum modelo escolhido"}>
          WhatsApp: modelo do primeiro contato
        </Titulo>
        <form action={modeloWhatsappAction} className="grid gap-4 px-4 py-4 sm:px-5">
          <p className="max-w-3xl text-[0.9rem] leading-relaxed text-muted">
            Para iniciar uma conversa pela API, o WhatsApp exige um modelo aprovado pela Meta. O texto do modelo é criado e aprovado no painel da YCloud; aqui você
            escolhe qual usar e o que entra em cada variável. Texto sugerido: <em>{MODELO_SUGERIDO}</em>
          </p>
          {escolhido?.corpo && (
            <div>
              <p className="mb-1.5 text-[0.8rem] font-semibold text-muted">Texto aprovado (lido da YCloud{lista?.ok ? ` em ${fmtDataHora(lista.em)}` : ""})</p>
              <p className="whitespace-pre-wrap rounded-[10px] border border-line bg-ink-850 px-3 py-2.5 text-[0.92rem] leading-relaxed">{escolhido.corpo}</p>
            </div>
          )}
          {escolhido?.categoria === "MARKETING" && (
            <Aviso tom="alerta">A Meta classificou este modelo como MARKETING: cada envio custa bem mais que um modelo de utilidade. Confira o texto e a categoria no painel da YCloud.</Aviso>
          )}
          {lista && !lista.ok && <Aviso tom="alerta">Não foi possível ler os modelos da YCloud agora: {lista.erro}.</Aviso>}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Campo rotulo="Nome do modelo na YCloud" dica={itens.length ? `Modelos na conta: ${itens.map((t) => `${t.nome} (${t.idioma}, ${t.status})`).join(" · ")}` : "Use o nome exato do modelo cadastrado no provedor."}>
              <input name="nome" defaultValue={modeloWa.nome} placeholder="ex.: primeiro_contato_site" className={input} autoComplete="off" />
            </Campo>
            <Campo rotulo="Idioma">
              <input name="idioma" defaultValue={modeloWa.idioma} className={input} maxLength={12} autoComplete="off" />
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Campo key={i} rotulo={`Variável {{${i}}}`}>
                <select name={`var${i}`} defaultValue={modeloWa.variaveis[i - 1] ?? ""} className={input}>
                  <option value="">(o modelo não tem)</option>
                  {VARIAVEIS_MODELO.map((v) => (
                    <option key={v} value={v}>
                      {VAR_ROTULO[v]}
                    </option>
                  ))}
                </select>
              </Campo>
            ))}
          </div>
          <div>
            <p className="text-[0.92rem] font-semibold">Frase do pedido, por serviço</p>
            <p className="mt-1 max-w-3xl text-[0.82rem] leading-snug text-dim">
              É o que entra na variável “Frase do pedido”, para a mensagem falar do que a pessoa pediu. Editar aqui não exige nova aprovação da Meta.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIAS.map((c) => (
                <Campo key={c} rotulo={CATEGORIA_ROTULO[c]}>
                  <input name={`frase-${c}`} defaultValue={fr[c]} maxLength={120} className={input} />
                </Campo>
              ))}
            </div>
          </div>
          <div>
            <Enviar className={btnSecondary}>Salvar modelo e frases</Enviar>
          </div>
        </form>
      </Painel>

      <Painel className="mt-5" id="aplicativo">
        <Titulo nota={autoApp.saudacao || autoApp.ausencia || autoApp.outras.length ? "Textos cadastrados" : "Nenhum texto cadastrado"}>WhatsApp: mensagens automáticas do aplicativo</Titulo>
        <form action={textosAutomaticosAction} className="grid gap-4 px-4 py-4 sm:px-5">
          <p className="max-w-3xl text-[0.9rem] leading-relaxed text-muted">
            O recomendado é <strong className="text-fg">desligar</strong> a mensagem de saudação e a de ausência no WhatsApp Business, para ninguém receber duas recepções. Se
            alguma ficar ligada, cole o texto exato aqui. Uma resposta sincronizada do aplicativo só é tratada como automática quando o texto dela é igual a um destes;
            qualquer outra é tratada como escrita por uma pessoa. O tempo de resposta não entra na conta: resposta rápida não prova automação, nem resposta demorada prova
            que foi alguém. Se o CRM classificar errado, corrija na ficha (“Não fui eu”) e o texto passa a ser reconhecido.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Mensagem de saudação (texto exato)">
              <textarea name="saudacao" defaultValue={autoApp.saudacao} maxLength={1000} className={`${input} min-h-[90px]`} />
            </Campo>
            <Campo rotulo="Mensagem de ausência (texto exato)">
              <textarea name="ausencia" defaultValue={autoApp.ausencia} maxLength={1000} className={`${input} min-h-[90px]`} />
            </Campo>
          </div>
          {autoApp.outras.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[0.8rem] font-semibold text-muted">Aprendidas pela correção na ficha (marque para esquecer)</legend>
              {autoApp.outras.map((t, i) => (
                <label key={i} className="flex items-start gap-2 text-[0.88rem] leading-snug">
                  <input type="checkbox" name="remover" value={i} className="mt-1 h-4 w-4 accent-royal" />
                  <span className="[overflow-wrap:anywhere]">{t}</span>
                </label>
              ))}
            </fieldset>
          )}
          <div>
            <Enviar className={btnSecondary}>Salvar mensagens automáticas</Enviar>
          </div>
        </form>
      </Painel>

      <Painel className="mt-5" id="controle">
        <Titulo nota={controle.length ? controle.map((n) => fmtWhatsapp(n)).join(" · ") : "Nenhum cadastrado"}>WhatsApp: números de controle</Titulo>
        <form action={numerosControleAction} className="grid gap-3 px-4 py-4 sm:px-5">
          <p className="max-w-3xl text-[0.9rem] leading-relaxed text-muted">
            Telefones da própria equipe usados para validar o WhatsApp (até 5). Para eles o formulário do site <strong className="text-fg">não gera conversão</strong> nos
            anúncios, o contato fica fora dos indicadores e o primeiro contato automático roda mesmo com a automação desligada para os demais. Nunca cadastre aqui o
            número de um cliente. A validação é feita em Integrações.
          </p>
          <Campo rotulo="Números de controle (um por linha, com DDD)">
            <textarea name="numeros" defaultValue={controle.map((n) => fmtWhatsapp(n)).join("\n")} className={`${input} min-h-[80px]`} />
          </Campo>
          <div>
            <Enviar className={btnSecondary}>Salvar números de controle</Enviar>
          </div>
        </form>
      </Painel>

      <h2 className="mt-8 font-[family-name:var(--font-display)] text-[1.15rem] font-semibold">Modelos de mensagem do CRM</h2>
      <p className="mt-1.5 max-w-3xl text-[0.9rem] leading-relaxed text-muted">
        Texto inicial quando você abre o aplicativo pelo CRM ou envia e-mail. Na ficha ele aparece preenchido e pode ser ajustado antes de enviar. Variáveis:{" "}
        <code>{"{{primeiro_nome}}"}</code>, <code>{"{{nome}}"}</code>, <code>{"{{empresa}}"}</code>, <code>{"{{servico}}"}</code> e <code>{"{{meu_nome}}"}</code>.
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
