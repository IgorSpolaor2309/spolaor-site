import type { Metadata } from "next";
import Link from "next/link";
import { associarAction, conferirConversaAction, criarDaConversaAction } from "@/app/leads/actions";
import { Atualizador } from "@/components/crm/atualizador";
import { Enviar } from "@/components/crm/enviar";
import { btnPrimary, btnQuiet, FiltroServico, ItemFilaLinha, OpLinha, Painel, Titulo, Vazio } from "@/components/crm/ui";
import { exigirUsuario } from "@/lib/crm/auth";
import { fila, pulso, type ItemFila } from "@/lib/crm/consultas";
import { CATEGORIA_ROTULO, ETAPA_ROTULO, fmtRelativo, fmtWhatsapp, isCategoria, type Oportunidade } from "@/lib/crm/tipos";

export const metadata: Metadata = { title: "Depende de mim" };

type Grupo = { id: string; titulo: string; nota: string; vazio: string; itens: ItemFila[] };

// Tela inicial. "Depende de mim" é a situação do ATENDIMENTO, separada da etapa comercial: um contato pode estar
// em "Proposta enviada" e, ao mesmo tempo, esperando uma resposta nossa. Quem recebeu a primeira mensagem e ainda
// não respondeu fica em "Aguardando o interessado", fora da fila principal.
export default async function AtendimentoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirUsuario();
  const sp = await searchParams;
  const categoria = isCategoria(sp.servico) ? sp.servico : undefined;
  const [f, carimbo] = await Promise.all([fila(categoria), pulso()]);
  const grupos: Grupo[] = [
    {
      id: "respostas",
      titulo: "Respostas aguardando seu retorno",
      nota: "Quem escreveu por último foi o interessado.",
      vazio: "Ninguém esperando sua resposta.",
      itens: f.respostas,
    },
    { id: "vencidos", titulo: "Retornos vencidos", nota: "Próximas ações com data que já passou.", vazio: "Nenhum retorno vencido.", itens: f.retornosVencidos },
    {
      id: "manual",
      titulo: "Falhas e contatos que pedem ação manual",
      nota: "Envio que falhou ou ficou incerto, e contatos novos sem primeiro atendimento.",
      vazio: "Nenhuma falha de envio e nenhum contato novo parado.",
      itens: f.acaoManual,
    },
    { id: "sem-dono", titulo: "Sem responsável definido", nota: "Em conversa ou com proposta, sem ninguém responsável.", vazio: "Toda conversa em andamento tem responsável.", itens: f.semResponsavel },
  ];
  const total = grupos.reduce((n, g) => n + g.itens.length, 0) + f.conversasSoltas.length;
  const fora: { id: string; titulo: string; nota: string; itens: Oportunidade[]; destaque?: "retorno" }[] = [
    { id: "interessado", titulo: "Aguardando o interessado", nota: "Você (ou a mensagem automática) falou por último. Nada a fazer até a pessoa responder.", itens: f.aguardandoInteressado },
    { id: "agendados", titulo: "Retornos agendados", nota: "Com data futura.", itens: f.retornosFuturos, destaque: "retorno" },
    { id: "automatico", titulo: "Primeiro contato automático saindo", nota: "Acabaram de chegar; a primeira mensagem está na fila de envio.", itens: f.automacaoNaFila },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">
            Depende de mim <span className={`font-normal ${total ? "text-ember" : "text-dim"}`}>({total})</span>
          </h1>
          <Atualizador inicial={carimbo} />
        </div>
        <Link href="/leads/novo" className={btnPrimary}>
          Cadastrar contato
        </Link>
      </div>
      <div className="mt-4">
        <FiltroServico base="/leads" atual={categoria} />
      </div>
      {categoria && <p className="mt-2 text-[0.84rem] text-dim">Mostrando só {CATEGORIA_ROTULO[categoria]}. Conversas sem associação aparecem com todos os serviços.</p>}
      {f.testesOcultos > 0 && (
        <p className="mt-3 text-[0.84rem] text-dim">
          {f.testesOcultos} {f.testesOcultos === 1 ? "envio de teste aberto fica" : "envios de teste abertos ficam"} fora desta fila.{" "}
          <Link href="/leads/lista?testes=1" className="font-semibold text-sky underline-offset-4 hover:underline">
            Ver na lista
          </Link>
        </p>
      )}

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5">
        {grupos.map((g) => (
          <Painel key={g.id} id={g.id} className="scroll-mt-20">
            <Titulo nota={g.nota}>
              {g.titulo} <span className="font-normal text-dim">({g.itens.length})</span>
            </Titulo>
            {g.itens.length ? (
              <ul>
                {g.itens.map((i) => (
                  <ItemFilaLinha key={i.o.id} {...i} agora={f.agora} />
                ))}
              </ul>
            ) : (
              <Vazio>{g.vazio}</Vazio>
            )}
          </Painel>
        ))}

        {!categoria && (
          <Painel id="sem-associacao" className="scroll-mt-20">
            <Titulo nota="Mensagens de WhatsApp que o CRM não ligou a uma oportunidade. Ele não adivinha: você escolhe.">
              Conversas sem associação <span className="font-normal text-dim">({f.conversasSoltas.length})</span>
            </Titulo>
            {f.conversasSoltas.length ? (
              <ul>
                {f.conversasSoltas.map((c) => {
                  const abertas = c.oportunidades.filter((o) => o.etapa !== "ganho" && o.etapa !== "perdido");
                  return (
                    <li key={c.contatoId} className="border-b border-line px-4 py-3.5 [overflow-wrap:anywhere] last:border-b-0 sm:px-5" data-conversa={c.contatoId}>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[1rem] font-semibold">{c.nome}</span>
                        <span className="text-[0.86rem] text-muted">{fmtWhatsapp(c.whatsapp)}</span>
                      </p>
                      <p className="mt-1 text-[0.88rem] font-semibold leading-snug">
                        {c.oportunidades.length === 0
                          ? "Número que ainda não tem oportunidade no CRM"
                          : abertas.length > 1
                            ? `A pessoa tem ${abertas.length} oportunidades abertas: escolha a qual a conversa pertence`
                            : abertas.length === 1
                              ? "Associe à oportunidade aberta desta pessoa"
                              : "A pessoa só tem oportunidades encerradas"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[0.88rem] leading-snug text-muted">
                        <span className="text-dim">Disse: </span>
                        {c.ultima}
                      </p>
                      <p className="mt-1 text-[0.8rem] text-dim">
                        {c.mensagens} {c.mensagens === 1 ? "mensagem" : "mensagens"} · esperando {fmtRelativo(c.desde, f.agora)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {abertas.map((o) => (
                          <form key={o.id} action={associarAction}>
                            <input type="hidden" name="id" value={o.id} />
                            <Enviar className={btnQuiet}>
                              Associar a “{isCategoria(o.categoria) ? CATEGORIA_ROTULO[o.categoria] : (o.servico ?? "oportunidade")}” ({ETAPA_ROTULO[o.etapa]})
                            </Enviar>
                          </form>
                        ))}
                        <form action={criarDaConversaAction}>
                          <input type="hidden" name="contato" value={c.contatoId} />
                          <Enviar className={btnQuiet}>Criar oportunidade nova</Enviar>
                        </form>
                        <form action={conferirConversaAction}>
                          <input type="hidden" name="contato" value={c.contatoId} />
                          <Enviar className="inline-flex min-h-9 items-center rounded-md px-2 text-[0.85rem] font-semibold text-muted underline-offset-4 hover:underline">Não é um pedido: tirar da fila</Enviar>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Vazio>Nenhuma conversa sem associação.</Vazio>
            )}
          </Painel>
        )}
      </div>

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-[1.15rem] font-semibold">Não depende de você agora</h2>
      <div className="mt-3 grid gap-3">
        {fora.map((g) => (
          <details key={g.id} id={g.id} className="group scroll-mt-20 rounded-[14px] border border-line bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="font-[family-name:var(--font-display)] text-[1.02rem] font-semibold">
                {g.titulo} <span className="font-normal text-dim">({g.itens.length})</span>
              </span>
              <span className="text-[0.8rem] text-dim">
                {g.nota} <span aria-hidden className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
              </span>
            </summary>
            {g.itens.length ? (
              <ul className="border-t border-line">
                {g.itens.map((o) => (
                  <OpLinha key={o.id} o={o} agora={f.agora} destaque={g.destaque} />
                ))}
              </ul>
            ) : (
              <p className="border-t border-line px-4 py-4 text-[0.9rem] text-dim sm:px-5">Ninguém aqui.</p>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
