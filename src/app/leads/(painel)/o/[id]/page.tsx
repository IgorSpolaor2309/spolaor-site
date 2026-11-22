import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  associarAction,
  assumirAction,
  contatoAction,
  negocioAction,
  notaAction,
  proximaAcaoAction,
  reclassificarEcoAction,
  reenviarAvisoAction,
  reenviarMensagemAction,
  resolverIncertaAction,
  responsavelAction,
  respostaAction,
  testeAction,
} from "@/app/leads/actions";
import { ContatoRapido } from "@/components/crm/contato-rapido";
import { Enviar } from "@/components/crm/enviar";
import { Aviso, btnPrimary, btnQuiet, btnSecondary, Campo, Dado, EtapaMarca, input, Painel, Titulo } from "@/components/crm/ui";
import { exigirUsuario } from "@/lib/crm/auth";
import { ficha, usuarios } from "@/lib/crm/consultas";
import { classificacaoInterna, formularioDeEntrada, informadoPelaPessoa, NAO_INFORMADO, origemDoPedido, respostas, servicoParaMensagem, servicoSolicitado } from "@/lib/crm/pedido";
import { emailCliente, modelos, preencher } from "@/lib/crm/mensagens";
import { frases, modeloPrimeiroContato, parametrosDoModelo, textoDoModelo, waEnvio } from "@/lib/crm/whatsapp/config";
import { modeloAprovado } from "@/lib/crm/whatsapp/ycloud";
import {
  atribuicao,
  CANAIS_MENSAGEM,
  CANAL_ROTULO,
  CATEGORIA_ROTULO,
  CATEGORIAS,
  ETAPAS,
  ETAPA_ROTULO,
  fmtDataCompleta,
  fmtDataHora,
  fmtMoeda,
  fmtRelativo,
  fmtWhatsapp,
  paraInputLocal,
  PENDENCIA_ROTULO,
  rotuloStatus,
} from "@/lib/crm/tipos";

export const metadata: Metadata = { title: "Oportunidade" };

const MSG: Record<string, { tom: "ok" | "alerta" | "info"; texto: string }> = {
  salvo: { tom: "ok", texto: "Salvo." },
  criado: { tom: "ok", texto: "Contato cadastrado." },
  "contato-existente": { tom: "info", texto: "Este WhatsApp ou e-mail já era de um contato cadastrado: a nova oportunidade foi ligada a ele." },
  contato: { tom: "ok", texto: "Contato registrado. A oportunidade agora aguarda a resposta do interessado." },
  resposta: { tom: "ok", texto: "Resposta registrada. A oportunidade está na fila de quem aguarda seu retorno." },
  nota: { tom: "ok", texto: "Anotação salva." },
  data: { tom: "alerta", texto: "Informe a data e a hora da próxima ação." },
  "email-enviado": { tom: "ok", texto: "E-mail aceito pelo provedor. Isso não confirma a chegada à caixa de entrada." },
  "email-falhou": { tom: "alerta", texto: "O e-mail não foi aceito pelo provedor. Veja o erro na conversa e tente de novo." },
  "email-cancelado": { tom: "info", texto: "A mensagem automática foi cancelada porque o atendimento já foi assumido." },
  "email-config": { tom: "alerta", texto: "O envio de e-mail pelo CRM não está configurado." },
  "email-vazio": { tom: "alerta", texto: "Preencha o assunto e a mensagem antes de enviar." },
  "email-repetido": { tom: "info", texto: "Esse e-mail já tinha sido enviado; nada foi mandado de novo." },
  "aviso-enviado": { tom: "ok", texto: "Aviso reenviado e aceito pelo provedor." },
  "aviso-falhou": { tom: "alerta", texto: "O aviso falhou de novo. O contato continua salvo aqui." },
  "contato-whatsapp": { tom: "alerta", texto: "Contato não alterado: WhatsApp inválido. Informe DDD e número." },
  "contato-email": { tom: "alerta", texto: "Contato não alterado: e-mail inválido." },
  "contato-nome": { tom: "alerta", texto: "Contato não alterado: informe o nome." },
  associado: { tom: "ok", texto: "Mensagens do WhatsApp associadas a esta oportunidade." },
  origem: { tom: "ok", texto: "Origem da mensagem corrigida. Mensagens do aplicativo com o mesmo texto passam a ser classificadas do mesmo jeito." },
  "wa-enviado": { tom: "ok", texto: "Mensagem aceita pelo provedor. Entrega e leitura aparecem na conversa quando o WhatsApp informar." },
  "wa-incerto": { tom: "alerta", texto: "O provedor não respondeu a tempo: não dá para saber se a mensagem saiu. Confira no aplicativo do WhatsApp antes de escrever de novo." },
  "wa-falhou": { tom: "alerta", texto: "O WhatsApp não aceitou a mensagem. O motivo está na conversa." },
  "wa-janela": { tom: "alerta", texto: "A janela de 24 horas fechou: texto livre não é mais aceito. Envie o modelo aprovado ou responda pelo aplicativo." },
  "wa-modelo": { tom: "alerta", texto: "Não há modelo aprovado disponível para iniciar a conversa. Veja Configurações e Integrações." },
  "wa-config": { tom: "alerta", texto: "O envio de WhatsApp pelo CRM não está configurado." },
  "wa-sem-numero": { tom: "alerta", texto: "Este contato não tem WhatsApp cadastrado." },
  "wa-vazio": { tom: "alerta", texto: "Escreva a mensagem antes de enviar." },
  "wa-repetido": { tom: "info", texto: "Essa mensagem já tinha sido enviada; nada foi mandado de novo." },
  "contato-duplicado": { tom: "alerta", texto: "Contato não alterado: esse WhatsApp ou e-mail já pertence a outro contato cadastrado. Os registros não são unidos automaticamente." },
};

export default async function FichaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await exigirUsuario();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const f = await ficha(id);
  if (!f) notFound();
  const [mods, equipe] = await Promise.all([modelos(), usuarios()]);
  const { oportunidade: o, mensagens, eventos, envios, outras } = f;
  const c = o.contato;
  const agora = Date.now();
  const atr = atribuicao(o);
  const msg = typeof sp.msg === "string" ? MSG[sp.msg] : undefined;
  const email = emailCliente();
  // {{servico}} nas mensagens: só o que a pessoa pediu (nunca o rótulo interno da página).
  const vars = { nome: c.nome, empresa: c.empresa, servico: servicoParaMensagem(o), meuNome: usuario.nome };
  const prontos = mods.map((m) => ({ id: m.id, titulo: m.titulo, canal: m.canal, assunto: m.assunto ? preencher(m.assunto, vars) : undefined, corpo: preencher(m.corpo, vars) }));
  // Para quem veio do formulário, o primeiro modelo de cada canal é o de primeiro contato; para os demais, o de recepção.
  const ordem = o.canal === "formulario" ? ["whatsapp-formulario", "email-formulario"] : ["whatsapp-recepcao", "email-recepcao"];
  prontos.sort((a, b) => Number(ordem.includes(b.id)) - Number(ordem.includes(a.id)));
  const atrasado = o.proximaAcaoEm ? new Date(o.proximaAcaoEm).getTime() < agora : false;
  const aberta = o.etapa !== "ganho" && o.etapa !== "perdido";
  const utm = Object.entries(o.utm);
  const autoPendente = (!!o.tarefa && ["pendente", "processando"].includes(o.tarefa.status)) || mensagens.some((m) => m.automatica && (m.status === "pendente" || m.status === "enviando"));
  // WhatsApp pelo CRM: só com as credenciais e o número definidos. A janela de 24 h conta da última mensagem da pessoa.
  const waCfg = waEnvio();
  const janelaAte = f.waUltimaEntradaEm ? new Date(f.waUltimaEntradaEm).getTime() + 24 * 3600_000 : 0;
  let waModelo: { texto: string } | null = null;
  let waModeloMotivo: string | null = null;
  if (waCfg.pronto && c.whatsapp) {
    const m = await modeloPrimeiroContato();
    if (!m.nome) waModeloMotivo = "Nenhum modelo aprovado escolhido em Configurações.";
    else {
      const ap = await modeloAprovado(m.nome, m.idioma);
      if (!ap.ok) waModeloMotivo = ap.motivo;
      else waModelo = { texto: textoDoModelo(ap.corpo, parametrosDoModelo(m, { nome: c.nome, empresa: c.empresa, pedido: (await frases())[o.categoria] }), m.nome) };
    }
  }
  const soltas = mensagens.filter((m) => m.oportunidadeId === null && m.direcao === "entrada").length;
  // O envio que criou a oportunidade (o mais antigo) guarda o pedido como chegou.
  const original = envios.length ? envios[envios.length - 1].payload : null;
  const pedidoSolicitado = servicoSolicitado(o);
  const classe = classificacaoInterna(o);
  const resp = respostas(o, original);
  const pessoa = informadoPelaPessoa(o, original);
  const origemPedido = origemDoPedido(o);
  // Outro pedido da mesma pessoa chegado perto deste: pode ser o mesmo pedido enviado duas vezes. O CRM não une.
  const vizinhas = outras.filter((x) => Math.abs(new Date(x.recebidoEm).getTime() - new Date(o.recebidoEm).getTime()) <= 30 * 60_000);

  return (
    <>
      <p className="text-[0.85rem]">
        <Link href="/leads" className="font-semibold text-sky underline-offset-4 hover:underline">
          ← Depende de mim
        </Link>
      </p>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">
            {c.nome}
            {c.empresa && <span className="font-normal text-muted"> · {c.empresa}</span>}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem] text-muted">
            <EtapaMarca etapa={o.etapa} />
            <span data-servico-solicitado>{pedidoSolicitado.informado ? pedidoSolicitado.texto : CATEGORIA_ROTULO[o.categoria]}</span>
            <span>
              chegou {fmtRelativo(o.recebidoEm, agora)} ({fmtDataHora(o.recebidoEm)})
            </span>
            {o.teste && <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-dim">{o.validacao ? "validação" : "teste"}</span>}
          </p>
        </div>
        {aberta && !o.assumidaEm && (
          <form action={assumirAction}>
            <input type="hidden" name="id" value={o.id} />
            <Enviar className={btnSecondary}>Assumir atendimento</Enviar>
          </form>
        )}
      </header>

      <div className="mt-4 grid gap-2.5">
        {msg && <Aviso tom={msg.tom}>{msg.texto}</Aviso>}
        {aberta && o.aguardando === "nos" && (
          <Aviso tom={o.pendencia === "pediu_parar" ? "alerta" : "info"}>
            Depende de você: {(PENDENCIA_ROTULO[o.pendencia ?? "resposta"] ?? PENDENCIA_ROTULO.resposta).toLowerCase()}
            {o.ultimaEntradaEm ? ` (${fmtRelativo(o.ultimaEntradaEm, agora)})` : ""}.
          </Aviso>
        )}
        {o.contatoBloqueado && <Aviso tom="alerta">Este número pediu para parar de receber mensagens. O CRM não envia mais nada automático para ele; qualquer contato é decisão sua.</Aviso>}
        {autoPendente && <Aviso>O primeiro contato automático está na fila. Se você assumir o atendimento antes de ele sair, ele é cancelado.</Aviso>}
        {o.tarefa && ["falhou", "incerta"].includes(o.tarefa.status) && o.tarefa.resultado && <Aviso tom="alerta">Primeiro contato automático: {o.tarefa.resultado}</Aviso>}
        {soltas > 0 && (
          <form action={associarAction} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-[#e9c9a8] bg-[#fdf3e7] px-3.5 py-2.5 text-[0.9rem] text-[#7a3a04]">
            <input type="hidden" name="id" value={o.id} />
            <span>
              {soltas} {soltas === 1 ? "mensagem desta pessoa no WhatsApp ainda não está ligada" : "mensagens desta pessoa no WhatsApp ainda não estão ligadas"} a nenhuma oportunidade.
            </span>
            <Enviar className={btnSecondary}>Associar a esta oportunidade</Enviar>
          </form>
        )}
      </div>

      {/* Celular: uma coluna só, com próxima ação e etapa logo depois de "Falar com" (as duas colunas viram
          "contents" e os painéis são ordenados por order-N). Computador: conteúdo à esquerda, dados à direita. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="contents min-w-0 lg:grid lg:gap-5">
          {/* Contexto antes das ações: o que a pessoa pediu, com as palavras dela, quem é, por onde e quando chegou. */}
          <Painel className="order-1 lg:order-none" id="pedido">
            <Titulo nota={`Recebido em ${fmtDataCompleta(o.recebidoEm)}`}>Pedido</Titulo>
            <div className="grid gap-5 px-4 py-4 sm:px-5" data-pedido>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Dado rotulo="Serviço solicitado" valor={pedidoSolicitado.texto} ausente={!pedidoSolicitado.informado} nota={pedidoSolicitado.base} forte />
                <Dado
                  rotulo="Classificação interna"
                  valor={classe.texto}
                  nota={`${classe.base}.${classe.rotuloPagina ? ` Rótulo antigo da página: “${classe.rotuloPagina}” (valor fixo, não foi escolha do visitante).` : ""}`}
                />
              </dl>
              <div>
                <p className="text-[0.78rem] font-semibold text-dim">{resp.objetivo.rotulo}</p>
                <p className={`mt-1 whitespace-pre-wrap break-words text-[1rem] leading-relaxed ${resp.objetivo.ausente ? "text-dim" : ""}`} data-objetivo>
                  {resp.objetivo.valor}
                </p>
              </div>
              {resp.outras.length > 0 && (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {resp.outras.map((l) => (
                    <Dado key={l.rotulo} rotulo={l.rotulo} valor={l.valor} ausente={l.ausente} />
                  ))}
                </dl>
              )}
              <dl className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                {pessoa.map((l) => (
                  <Dado key={l.rotulo} rotulo={`${l.rotulo} (informado)`} valor={l.valor} ausente={l.ausente} link={l.link} />
                ))}
                <Dado rotulo="Página do envio" valor={o.pagina ?? NAO_INFORMADO} ausente={!o.pagina} nota={o.entrada ? `Primeira página da visita: ${o.entrada}` : undefined} />
                <Dado rotulo="Formulário" valor={formularioDeEntrada(o)} />
                {origemPedido.map((l) => (
                  <Dado key={l.rotulo} rotulo={l.rotulo} valor={l.valor} ausente={l.ausente} nota={l.nota} />
                ))}
              </dl>
              {vizinhas.length > 0 && (
                <p className="rounded-[10px] border border-line bg-ink-850 px-3.5 py-2.5 text-[0.86rem] leading-snug text-muted" data-pedido-vizinho>
                  A mesma pessoa tem {vizinhas.length === 1 ? "outro pedido" : `${vizinhas.length} outros pedidos`} recebido{vizinhas.length === 1 ? "" : "s"} com menos de 30 minutos de diferença
                  ({vizinhas.map((x) => `${fmtDataHora(x.recebidoEm)}, ${x.pagina ?? x.origem ?? "sem página"}`).join("; ")}). Pode ser o mesmo pedido enviado duas vezes; o CRM não une registros sozinho.
                </p>
              )}
            </div>
          </Painel>

          <Painel className="order-2 lg:order-none">
            <Titulo>Falar com {c.nome.split(/\s+/)[0]}</Titulo>
            <ContatoRapido
              id={o.id}
              contato={{ whatsapp: c.whatsapp, email: c.email, instagram: c.instagram }}
              modelos={prontos}
              emailPeloCrm={email.pronto ? null : `falta configurar ${email.falta.join(", ")}.`}
              chave={randomUUID()}
              wa={
                waCfg.pronto && c.whatsapp
                  ? { janelaAberta: janelaAte > agora, janelaAte: janelaAte > agora ? fmtDataHora(new Date(janelaAte).toISOString()) : null, modelo: waModelo, modeloMotivo: waModeloMotivo }
                  : null
              }
            />
          </Painel>

          <Painel className="order-5 lg:order-none">
            <Titulo nota={waCfg.pronto ? "Para e-mail, ligação e outros canais. O WhatsApp do número comercial entra sozinho." : "Informado por você: o CRM ainda não recebe mensagens sozinho."}>
              Registrar resposta do interessado
            </Titulo>
            <form action={respostaAction} className="grid gap-3 px-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:px-5">
              <input type="hidden" name="id" value={o.id} />
              <Campo rotulo="Por onde respondeu">
                <select name="canal" className={input} defaultValue={c.whatsapp ? "whatsapp" : c.email ? "email" : "outro"}>
                  {CANAIS_MENSAGEM.map((k) => (
                    <option key={k} value={k}>
                      {CANAL_ROTULO[k]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="O que disse (opcional)">
                <textarea name="corpo" className={`${input} min-h-[70px]`} maxLength={4000} />
              </Campo>
              <div className="sm:col-span-2">
                <Enviar className={btnSecondary}>Registrar resposta recebida</Enviar>
              </div>
            </form>
          </Painel>

          <Painel className="order-6 lg:order-none">
            <Titulo nota={mensagens.length ? `${mensagens.length} ${mensagens.length === 1 ? "registro" : "registros"}` : undefined}>Conversa</Titulo>
            {mensagens.length ? (
              <ol className="grid gap-3 px-4 py-4 sm:px-5">
                {mensagens.map((m) => {
                  const quem =
                    m.direcao === "entrada"
                      ? c.nome
                      : m.automatica && m.via === "app"
                        ? "Resposta automática do aplicativo (saudação ou ausência)"
                        : m.automatica
                          ? "Mensagem automática do CRM"
                          : m.via === "app"
                          ? "Pelo aplicativo do WhatsApp"
                          : (m.usuarioNome ?? "Spolaor");
                  const alerta = m.status === "falhou" || m.status === "incerta";
                  return (
                    <li
                      key={m.id}
                      data-mensagem={m.id}
                      data-status={m.status}
                      className={`max-w-[92%] rounded-[12px] border px-3.5 py-2.5 ${m.direcao === "saida" ? "ml-auto border-[#cfdcf7] bg-[#f1f5fe]" : "border-line bg-ink-850"}`}
                    >
                      <p className="text-[0.76rem] font-semibold text-dim">
                        {quem} · {CANAL_ROTULO[m.canal]} · {fmtDataHora(m.em)}
                        {m.oportunidadeId === null ? " · sem associação" : m.oportunidadeId !== o.id ? " · em outra oportunidade desta pessoa" : ""}
                      </p>
                      {m.assunto && <p className="mt-1 text-[0.9rem] font-semibold">{m.assunto}</p>}
                      <p className="mt-1 whitespace-pre-wrap break-words text-[0.92rem] leading-relaxed">{m.corpo}</p>
                      <p className={`mt-1.5 text-[0.76rem] ${alerta ? "font-semibold text-ember" : "text-dim"}`}>
                        {rotuloStatus(m)}
                        {m.status === "lida" && m.lidaEm ? ` às ${fmtDataHora(m.lidaEm)}` : m.status === "entregue" && m.entregueEm ? ` às ${fmtDataHora(m.entregueEm)}` : ""}
                        {m.modo === "sistema" && m.canal === "email" && m.tentativas > 1 ? ` · ${m.tentativas} tentativas` : ""}
                        {m.erro && m.status !== "incerta" ? ` · ${m.erro}` : ""}
                      </p>
                      {m.status === "falhou" && m.canal === "email" && (
                        <form action={reenviarMensagemAction} className="mt-1">
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="mensagem" value={m.id} />
                          <Enviar className={btnQuiet}>Tentar enviar de novo</Enviar>
                        </form>
                      )}
                      {/* Quem enviou pelo aplicativo é decidido por evidência; o tempo de resposta não prova nada. Se a
                          classificação estiver errada, quem atende corrige aqui. */}
                      {m.via === "app" && m.direcao === "saida" && (
                        <form action={reclassificarEcoAction} className="mt-1">
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="mensagem" value={m.id} />
                          <input type="hidden" name="automatica" value={m.automatica ? "0" : "1"} />
                          <Enviar className={btnQuiet}>{m.automatica ? "Fui eu que escrevi esta mensagem" : "Não fui eu: é mensagem automática do aplicativo"}</Enviar>
                        </form>
                      )}
                      {m.status === "incerta" && m.oportunidadeId === o.id && (
                        <form action={resolverIncertaAction} className="mt-1 flex flex-wrap gap-x-2">
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="mensagem" value={m.id} />
                          <Enviar name="decisao" value="saiu" className={btnQuiet}>
                            Conferi no aplicativo: saiu
                          </Enviar>
                          <Enviar name="decisao" value="nao_saiu" className={btnQuiet}>
                            Conferi: não saiu
                          </Enviar>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="px-4 py-5 text-[0.92rem] text-dim sm:px-5">Nenhuma mensagem registrada ainda.</p>
            )}
          </Painel>

          <Painel className="order-7 lg:order-none">
            <Titulo>Anotações e histórico</Titulo>
            <form action={notaAction} className="grid gap-3 border-b border-line px-4 py-4 sm:px-5">
              <input type="hidden" name="id" value={o.id} />
              <textarea name="nota" required aria-label="Nova anotação" placeholder="Anotação interna (o interessado não vê)" className={`${input} min-h-[70px]`} maxLength={4000} />
              <div>
                <Enviar className={btnSecondary}>Salvar anotação</Enviar>
              </div>
            </form>
            <ol className="px-4 py-2 sm:px-5">
              {eventos.map((e) => (
                <li key={e.id} className="border-b border-line py-3 last:border-b-0">
                  <p className="text-[0.76rem] font-semibold text-dim">
                    {fmtDataHora(e.criadoEm)}
                    {e.usuarioNome ? ` · ${e.usuarioNome}` : ""}
                    {e.tipo === "nota" ? " · anotação" : ""}
                  </p>
                  <p className={`mt-0.5 whitespace-pre-wrap text-[0.92rem] leading-relaxed ${e.tipo.endsWith("_falhou") ? "text-ember" : ""}`}>
                    {e.tipo === "novo_envio" ? `Novo envio do formulário pelo mesmo contato${e.texto ? `: ${e.texto}` : "."}` : e.texto}
                  </p>
                </li>
              ))}
            </ol>
          </Painel>
        </div>

        <aside className="contents min-w-0 lg:grid lg:gap-5">
          {aberta && (
            <Painel className="order-3 lg:order-none">
              <Titulo nota={o.proximaAcaoEm ? <span className={atrasado ? "font-semibold text-ember" : ""}>{atrasado ? "Atrasada" : "Marcada"} {fmtRelativo(o.proximaAcaoEm, agora)}</span> : undefined}>Próxima ação</Titulo>
              <form action={proximaAcaoAction} className="grid gap-3 px-4 py-4 sm:px-5">
                <input type="hidden" name="id" value={o.id} />
                <Campo rotulo="O que fazer">
                  <input name="texto" defaultValue={o.proximaAcao ?? ""} placeholder="Ex.: ligar para confirmar o escopo" className={input} maxLength={300} />
                </Campo>
                <Campo rotulo="Quando (horário de Brasília)">
                  <input type="datetime-local" name="quando" defaultValue={paraInputLocal(o.proximaAcaoEm)} className={input} />
                </Campo>
                <div className="flex flex-wrap gap-2.5">
                  <Enviar className={btnPrimary}>Salvar retorno</Enviar>
                  {o.proximaAcaoEm && (
                    <Enviar name="concluir" value="1" className={btnSecondary}>
                      Concluir
                    </Enviar>
                  )}
                </div>
              </form>
            </Painel>
          )}

          <Painel className="order-4 lg:order-none">
            <Titulo>Etapa e valores</Titulo>
            <form action={negocioAction} className="grid gap-3 px-4 py-4 sm:px-5">
              <input type="hidden" name="id" value={o.id} />
              <Campo rotulo="Etapa">
                <select name="etapa" defaultValue={o.etapa} className={input}>
                  {ETAPAS.map((e) => (
                    <option key={e} value={e}>
                      {ETAPA_ROTULO[e]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Valor da proposta (R$)" dica={o.propostaEm ? `Proposta marcada em ${fmtDataHora(o.propostaEm)}` : "Preencha quando enviar a proposta."}>
                <input name="valorProposta" inputMode="decimal" defaultValue={o.valorProposta !== null ? o.valorProposta.toFixed(2).replace(".", ",") : ""} placeholder="0,00" className={input} />
              </Campo>
              <Campo rotulo="Valor fechado (R$)" dica={o.fechadoEm ? `Fechado em ${fmtDataHora(o.fechadoEm)}` : "Só conta como venda na etapa Ganho."}>
                <input name="valorFechado" inputMode="decimal" defaultValue={o.valorFechado !== null ? o.valorFechado.toFixed(2).replace(".", ",") : ""} placeholder="0,00" className={input} />
              </Campo>
              <Campo rotulo="Motivo da perda" dica="Usado só na etapa Perdido.">
                <input name="motivoPerda" defaultValue={o.motivoPerda ?? ""} className={input} maxLength={300} />
              </Campo>
              <div>
                <Enviar className={btnPrimary}>Salvar etapa e valores</Enviar>
              </div>
            </form>
          </Painel>

          <Painel className="order-8 lg:order-none">
            <Titulo>Contato</Titulo>
            <dl className="grid gap-1.5 px-4 pt-4 text-[0.92rem] sm:px-5">
              {c.whatsapp && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-dim">WhatsApp</dt>
                  <dd className="min-w-0 break-words">{fmtWhatsapp(c.whatsapp)}</dd>
                </div>
              )}
              {c.email && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-dim">E-mail</dt>
                  <dd className="min-w-0 break-all">{c.email}</dd>
                </div>
              )}
              {c.instagram && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-dim">Instagram</dt>
                  <dd className="min-w-0 break-all">@{c.instagram}</dd>
                </div>
              )}
              {c.site && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-dim">Site</dt>
                  <dd className="min-w-0 break-all">
                    <a href={/^https?:\/\//i.test(c.site) ? c.site : `https://${c.site}`} target="_blank" rel="noopener noreferrer nofollow" className="text-sky underline-offset-4 hover:underline">
                      {c.site}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            <details className="px-4 pb-4 pt-3 sm:px-5">
              <summary className="cursor-pointer text-[0.86rem] font-semibold text-sky">Editar contato e serviço</summary>
              <form action={contatoAction} className="mt-3 grid gap-3">
                <input type="hidden" name="id" value={o.id} />
                <Campo rotulo="Nome">
                  <input name="nome" required defaultValue={c.nome} className={input} maxLength={200} />
                </Campo>
                <Campo rotulo="Empresa">
                  <input name="empresa" defaultValue={c.empresa ?? ""} className={input} maxLength={200} />
                </Campo>
                <Campo rotulo="WhatsApp (com DDD)">
                  <input name="whatsapp" inputMode="tel" defaultValue={fmtWhatsapp(c.whatsapp)} className={input} />
                </Campo>
                <Campo rotulo="E-mail">
                  <input name="email" type="email" defaultValue={c.email ?? ""} className={input} />
                </Campo>
                <Campo rotulo="Instagram">
                  <input name="instagram" defaultValue={c.instagram ?? ""} placeholder="usuario" className={input} />
                </Campo>
                <Campo rotulo="Site">
                  <input name="site" defaultValue={c.site ?? ""} className={input} />
                </Campo>
                <Campo rotulo="Serviço (usado nos filtros)">
                  <select name="categoria" defaultValue={o.categoria} className={input}>
                    {CATEGORIAS.map((k) => (
                      <option key={k} value={k}>
                        {CATEGORIA_ROTULO[k]}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Detalhe do pedido (opcional)">
                  <input name="servico" defaultValue={o.servico ?? ""} className={input} maxLength={200} />
                </Campo>
                <div>
                  <Enviar className={btnSecondary}>Salvar contato</Enviar>
                </div>
              </form>
            </details>
          </Painel>

          <Painel className="order-9 lg:order-none">
            <Titulo>Origem e atribuição</Titulo>
            <dl className="grid gap-2 px-4 py-4 text-[0.9rem] sm:px-5">
              <div>
                <dt className="text-[0.78rem] font-semibold text-dim">Fonte</dt>
                <dd>{atr.fonte}</dd>
                <dd className="text-[0.82rem] leading-snug text-dim">{atr.base}</dd>
              </div>
              <div>
                <dt className="text-[0.78rem] font-semibold text-dim">Canal de entrada</dt>
                <dd>
                  {CANAL_ROTULO[o.canal]}
                  {o.origem ? ` · ${o.origem}` : ""}
                  {o.registro === "manual" ? " · cadastrado à mão" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[0.78rem] font-semibold text-dim">Pedido de retorno pelo WhatsApp</dt>
                <dd className="text-[0.86rem] leading-snug">
                  {o.avisoVersao
                    ? `Registrado: o formulário enviado trazia o texto de retorno pelo WhatsApp (versão ${o.avisoVersao}).`
                    : "Sem registro (cadastro manual ou formulário anterior ao texto de retorno). O CRM não inicia conversa automática por WhatsApp com este contato."}
                </dd>
              </div>
              {o.pagina && (
                <div>
                  <dt className="text-[0.78rem] font-semibold text-dim">Página do envio</dt>
                  <dd className="break-all">{o.pagina}</dd>
                </div>
              )}
              {o.entrada && (
                <div>
                  <dt className="text-[0.78rem] font-semibold text-dim">Primeira página da visita</dt>
                  <dd className="break-all">{o.entrada}</dd>
                </div>
              )}
              {o.referrer && (
                <div>
                  <dt className="text-[0.78rem] font-semibold text-dim">Veio de</dt>
                  <dd className="break-all">{o.referrer}</dd>
                </div>
              )}
              {utm.length > 0 && (
                <div>
                  <dt className="text-[0.78rem] font-semibold text-dim">Parâmetros da URL</dt>
                  {utm.map(([k, v]) => (
                    <dd key={k} className="break-all font-mono text-[0.78rem]">
                      {k}={k === "fbclid" || k === "gclid" ? `${v.slice(0, 14)}…` : v}
                    </dd>
                  ))}
                </div>
              )}
              {(o.metaCampaignId || o.metaAdsetId || o.metaAdId) && (
                <div>
                  <dt className="text-[0.78rem] font-semibold text-dim">Identificadores do anúncio (vieram na URL)</dt>
                  <dd className="break-all font-mono text-[0.78rem]">
                    {[o.metaCampaignId && `campanha ${o.metaCampaignId}`, o.metaAdsetId && `conjunto ${o.metaAdsetId}`, o.metaAdId && `anúncio ${o.metaAdId}`].filter(Boolean).join(" · ")}
                  </dd>
                </div>
              )}
            </dl>
          </Painel>

          {envios.length > 0 && (
            <Painel className="order-10 lg:order-none">
              <Titulo nota="Como chegou pelo site">Envios do formulário</Titulo>
              <ul className="px-4 py-2 sm:px-5">
                {envios.map((e) => (
                  <li key={e.id} className="border-b border-line py-3 text-[0.88rem] last:border-b-0">
                    <p>
                      {fmtDataHora(e.recebidoEm)}
                      {typeof e.payload.pagina === "string" ? <span className="text-dim"> · {e.payload.pagina}</span> : null}
                    </p>
                    {/* Envios anexados depois do primeiro: o que a pessoa escreveu em cada um, sem resumo. */}
                    {envios.length > 1 &&
                      (() => {
                        const r = respostas({ ...o, dados: {}, mensagem: null }, e.payload);
                        return (
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.84rem] leading-snug">
                            <span className="text-dim">{r.objetivo.rotulo}: </span>
                            {r.objetivo.valor}
                          </p>
                        );
                      })()}
                    <p className={`mt-0.5 text-[0.82rem] ${e.avisoStatus === "falhou" ? "font-semibold text-ember" : "text-dim"}`}>
                      Aviso por e-mail:{" "}
                      {e.avisoStatus === "enviado"
                        ? `aceito pelo provedor em ${fmtDataHora(e.avisoEnviadoEm)}`
                        : e.avisoStatus === "falhou"
                          ? `falhou (${e.avisoTentativas} ${e.avisoTentativas === 1 ? "tentativa" : "tentativas"})${e.avisoErro ? `: ${e.avisoErro}` : ""}`
                          : e.avisoStatus === "desligado"
                            ? "não configurado quando o contato chegou"
                            : "na fila"}
                    </p>
                    {e.avisoStatus === "falhou" && (
                      <form action={reenviarAvisoAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="envio" value={e.id} />
                        <Enviar className={btnQuiet}>Tentar enviar o aviso de novo</Enviar>
                      </form>
                    )}
                    <p className="mt-0.5 break-all font-mono text-[0.72rem] text-dim">id {e.id}</p>
                  </li>
                ))}
              </ul>
            </Painel>
          )}

          <Painel className="order-11 lg:order-none">
            <Titulo>Responsável</Titulo>
            <form action={responsavelAction} className="flex flex-wrap items-end gap-2.5 px-4 py-4 sm:px-5">
              <input type="hidden" name="id" value={o.id} />
              <select name="responsavel" defaultValue={o.responsavelId ?? ""} aria-label="Responsável" className={`${input} min-w-0 flex-1`}>
                <option value="">Sem responsável</option>
                {equipe.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
              <Enviar className={btnSecondary}>Salvar</Enviar>
            </form>
            <form action={testeAction} className="border-t border-line px-4 py-3 sm:px-5">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="teste" value={o.teste ? "0" : "1"} />
              <Enviar className={btnQuiet}>{o.teste ? "Não é teste: incluir nos indicadores" : "Marcar como teste (fora dos indicadores)"}</Enviar>
            </form>
          </Painel>

          {outras.length > 0 && (
            <Painel className="order-12 lg:order-none">
              <Titulo>Outras oportunidades deste contato</Titulo>
              <ul className="px-4 py-2 sm:px-5">
                {outras.map((x) => (
                  <li key={x.id} className="border-b border-line py-3 text-[0.9rem] last:border-b-0">
                    <Link href={`/leads/o/${x.id}`} className="font-semibold text-sky underline-offset-4 hover:underline">
                      {CATEGORIA_ROTULO[x.categoria]}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[0.82rem] text-dim">
                      <EtapaMarca etapa={x.etapa} />
                      <span>{fmtDataHora(x.recebidoEm)}</span>
                      {x.valorFechado !== null && <span>{fmtMoeda(x.valorFechado)}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </Painel>
          )}
        </aside>
      </div>
    </>
  );
}
