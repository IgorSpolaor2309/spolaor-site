import type { Metadata } from "next";
import Link from "next/link";
import { custoAction, removerCustoAction } from "@/app/leads/actions";
import { Enviar } from "@/components/crm/enviar";
import { Aviso, btnQuiet, btnSecondary, Campo, input, Painel, Titulo, Vazio } from "@/components/crm/ui";
import { exigirUsuario } from "@/lib/crm/auth";
import { custos, indicadores, type Contagem } from "@/lib/crm/consultas";
import { CANAL_ROTULO, CUSTO_ROTULO, CUSTO_TIPOS, fmtData, fmtDataHora, fmtDuracao, fmtMoeda, isCanal } from "@/lib/crm/tipos";

export const metadata: Metadata = { title: "Indicadores" };

// Datas no fuso de Brasília (UTC−3).
const hojeBr = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const menosDias = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
const dataOk = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const br = (d: string) => fmtData(`${d}T12:00:00-03:00`);

const MSG: Record<string, { tom: "ok" | "alerta"; texto: string }> = {
  "custo-salvo": { tom: "ok", texto: "Custo registrado." },
  "custo-removido": { tom: "ok", texto: "Custo removido." },
  "custo-invalido": { tom: "alerta", texto: "Confira o tipo, as datas (fim igual ou depois do início) e o valor." },
};

function Numero({ rotulo, valor, base }: { rotulo: string; valor: string; base: string }) {
  return (
    <div className="border-b border-line px-4 py-4 sm:px-5">
      <dt className="text-[0.84rem] font-semibold text-muted">{rotulo}</dt>
      <dd className="mt-1 font-[family-name:var(--font-display)] text-[1.6rem] font-semibold leading-none tracking-[-0.02em]">{valor}</dd>
      <dd className="mt-1.5 text-[0.78rem] leading-snug text-dim">{base}</dd>
    </div>
  );
}

function Tabela({ titulo, linhas, coluna }: { titulo: string; linhas: Contagem[]; coluna: string }) {
  return (
    <Painel>
      <Titulo>{titulo}</Titulo>
      {linhas.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.9rem]">
            <thead>
              <tr className="text-[0.76rem] text-dim">
                <th scope="col" className="px-4 py-2 font-semibold sm:px-5">{coluna}</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Contatos</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Propostas</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold sm:px-5">Ganhos</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.rotulo} className="border-t border-line">
                  <th scope="row" className="px-4 py-2.5 font-normal sm:px-5">{l.rotulo}</th>
                  <td className="px-2 py-2.5 text-right tabular-nums">{l.total}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{l.comProposta}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums sm:px-5">{l.ganhos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Vazio>Nenhum contato no período.</Vazio>
      )}
    </Painel>
  );
}

export default async function IndicadoresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirUsuario();
  const sp = await searchParams;
  const hoje = hojeBr();
  const fim = dataOk(sp.ate) && sp.ate <= hoje ? sp.ate : hoje;
  const inicio = dataOk(sp.de) && sp.de <= fim ? sp.de : menosDias(fim, 29);
  const [i, lancamentos] = await Promise.all([indicadores(inicio, fim), custos()]);
  const msg = typeof sp.msg === "string" ? MSG[sp.msg] : undefined;
  const atalhos = [
    { rotulo: "7 dias", de: menosDias(hoje, 6) },
    { rotulo: "30 dias", de: menosDias(hoje, 29) },
    { rotulo: "90 dias", de: menosDias(hoje, 89) },
    { rotulo: "Este mês", de: `${hoje.slice(0, 8)}01` },
  ];
  const pct = (n: number) => (i.recebidos ? ` (${Math.round((n / i.recebidos) * 100)}%)` : "");
  const custo = (t: string) => i.custos.find((c) => c.tipo === t);
  const verba = custo("meta_verba");
  const totalCustos = i.custos.length ? Math.round(i.custos.reduce((a, c) => a + c.valor, 0) * 100) / 100 : null;
  const algumEstimado = i.custos.some((c) => c.estimado);
  const por = (valor: number | null | undefined, n: number) => (valor === null || valor === undefined ? "Sem dado" : n > 0 ? fmtMoeda(valor / n) : "Sem dado");

  return (
    <>
      <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">Indicadores</h1>
      <p className="mt-2 max-w-3xl text-[0.9rem] leading-relaxed text-muted">
        Contatos que chegaram de {br(inicio)} a {br(fim)}, acompanhados até hoje. Envios de teste ficam de fora{i.testesFora ? ` (${i.testesFora} no período)` : ""}. Os números
        saem do que está registrado neste CRM; o que não foi registrado aparece como “sem dado”, não como zero.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-3">
        {atalhos.map((a) => (
          <Link
            key={a.rotulo}
            href={`/leads/indicadores?de=${a.de}&ate=${hoje}`}
            className={`min-h-10 rounded-lg px-3.5 py-2 text-[0.88rem] font-semibold ${a.de === inicio && fim === hoje ? "bg-fg text-white" : "border border-line-strong text-muted hover:text-fg"}`}
          >
            {a.rotulo}
          </Link>
        ))}
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-[0.78rem] font-semibold text-muted">
            De
            <input type="date" name="de" defaultValue={inicio} max={hoje} className={`${input} mt-1 block w-auto py-2`} />
          </label>
          <label className="text-[0.78rem] font-semibold text-muted">
            Até
            <input type="date" name="ate" defaultValue={fim} max={hoje} className={`${input} mt-1 block w-auto py-2`} />
          </label>
          <button type="submit" className={btnSecondary}>
            Ver período
          </button>
        </form>
      </div>
      {msg && (
        <div className="mt-4">
          <Aviso tom={msg.tom}>{msg.texto}</Aviso>
        </div>
      )}

      <Painel className="mt-5">
        <Titulo nota="Fonte: registros deste CRM, lidos agora">Do contato à venda</Titulo>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
          <Numero rotulo="Contatos recebidos" valor={String(i.recebidos)} base="Oportunidades criadas no período (formulários do site e cadastros manuais)." />
          <Numero
            rotulo="Tiveram primeiro contato"
            valor={`${i.comPrimeiroContato}${pct(i.comPrimeiroContato)}`}
            base={`${i.semPrimeiroContato} ainda sem contato registrado. Conta contato registrado à mão ou e-mail aceito pelo provedor.`}
          />
          <Numero
            rotulo="Tempo até o primeiro contato"
            valor={i.medianaPrimeiroContatoMin === null ? "Sem dado" : fmtDuracao(i.medianaPrimeiroContatoMin)}
            base="Mediana entre a chegada e o primeiro contato registrado. Depende de registrar o contato na hora em que ele é feito."
          />
          <Numero rotulo="Responderam" valor={`${i.responderam}${pct(i.responderam)}`} base="Com resposta registrada na ficha ou já em conversa, proposta ou ganho." />
          <Numero
            rotulo="Receberam proposta"
            valor={`${i.propostas}${pct(i.propostas)}`}
            base={
              i.propostas
                ? `Valor em propostas: ${i.valorPropostas === null ? "sem dado" : fmtMoeda(i.valorPropostas)}${i.propostasSemValor ? ` (${i.propostasSemValor} sem valor informado)` : ""}. Proposta não é venda.`
                : "Nenhuma proposta marcada."
            }
          />
          <Numero
            rotulo="Ganhos"
            valor={`${i.ganhos}${pct(i.ganhos)}`}
            base={i.ganhos ? `Vendas fechadas: ${i.valorGanhos === null ? "sem dado" : fmtMoeda(i.valorGanhos)}${i.ganhosSemValor ? ` (${i.ganhosSemValor} sem valor informado)` : ""}. É valor vendido, não lucro.` : "Nenhuma venda marcada entre os contatos do período."}
          />
          <Numero rotulo="Perdidos" valor={`${i.perdidos}${pct(i.perdidos)}`} base={i.motivosPerda.length ? i.motivosPerda.map((m) => `${m.rotulo}: ${m.total}`).join(" · ") : "Nenhuma perda marcada."} />
          <Numero
            rotulo="Vendas fechadas no período"
            valor={`${i.fechamentosNoPeriodo.total}`}
            base={`Pela data do fechamento, de qualquer contato: ${i.fechamentosNoPeriodo.total ? (i.fechamentosNoPeriodo.valor === null ? "valor sem dado" : fmtMoeda(i.fechamentosNoPeriodo.valor)) : "nenhuma"}.`}
          />
        </dl>
        <p className="px-4 py-3 text-[0.84rem] text-muted sm:px-5">
          Agora: <strong>{i.novosSemContatoAgora}</strong> {i.novosSemContatoAgora === 1 ? "contato novo" : "contatos novos"} sem atendimento e <strong>{i.retornosAtrasadosAgora}</strong>{" "}
          {i.retornosAtrasadosAgora === 1 ? "retorno atrasado" : "retornos atrasados"} (qualquer período).
        </p>
      </Painel>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Tabela titulo="Por fonte de tráfego" coluna="Fonte" linhas={i.porFonte} />
        <Tabela titulo="Por serviço" coluna="Serviço" linhas={i.porServico} />
        <Tabela titulo="Por origem (página ou cadastro)" coluna="Origem" linhas={i.porOrigem} />
        <Tabela titulo="Por canal de entrada" coluna="Canal" linhas={i.porCanal.map((l) => ({ ...l, rotulo: isCanal(l.rotulo) ? CANAL_ROTULO[l.rotulo] : l.rotulo }))} />
      </div>
      <p className="mt-3 max-w-3xl text-[0.8rem] leading-snug text-dim">
        A fonte vem do que a URL declarou (UTM) e da página anterior. Um fbclid sozinho mostra que o clique veio de um link no Facebook ou Instagram, sem dizer qual campanha
        nem se era anúncio. Identificadores de campanha, conjunto e anúncio só aparecem quando vierem na URL do anúncio.
      </p>

      <Painel id="custos" className="mt-5 scroll-mt-20">
        <Titulo nota={i.ultimoCustoEm ? `Informado à mão · último lançamento em ${fmtDataHora(i.ultimoCustoEm)}` : "Informado à mão · sem integração com a Meta ou a Crush"}>
          Investimento e custo por resultado
        </Titulo>
        {i.custos.length ? (
          <>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
              {CUSTO_TIPOS.filter((t) => custo(t)).map((t) => (
                <Numero
                  key={t}
                  rotulo={CUSTO_ROTULO[t]}
                  valor={fmtMoeda(custo(t)!.valor)}
                  base={`${custo(t)!.lancamentos} ${custo(t)!.lancamentos === 1 ? "lançamento" : "lançamentos"}, rateado pelos dias dentro do período${custo(t)!.estimado ? ". Inclui valor ESTIMADO." : "."}`}
                />
              ))}
            </dl>
            <dl className="grid sm:grid-cols-3">
              <Numero
                rotulo="Verba da Meta por contato de anúncio"
                valor={por(verba?.valor, i.contatosMetaDeclarados)}
                base={`Verba da Meta ÷ ${i.contatosMetaDeclarados} ${i.contatosMetaDeclarados === 1 ? "contato cuja URL declarou" : "contatos cuja URL declarou"} anúncio na Meta (UTM). Contatos sem UTM não entram, então o custo real por contato pode ser menor.`}
              />
              <Numero rotulo="Custo total por proposta" valor={por(totalCustos, i.propostas)} base={`Soma dos custos informados ÷ ${i.propostas} ${i.propostas === 1 ? "proposta" : "propostas"} dos contatos do período.`} />
              <Numero rotulo="Custo total por cliente" valor={por(totalCustos, i.ganhos)} base={`Soma dos custos informados ÷ ${i.ganhos} ${i.ganhos === 1 ? "venda" : "vendas"} dos contatos do período.`} />
            </dl>
            {algumEstimado && <p className="px-4 pb-3 text-[0.82rem] font-semibold text-ember sm:px-5">Há valores estimados neste período: os custos por resultado também são estimativas.</p>}
          </>
        ) : (
          <Vazio>
            Sem custos informados para este período: investimento e custo por contato, proposta e cliente ficam sem dado. Registre abaixo a verba gasta na Meta e, se quiser, as
            cobranças da Crush.
          </Vazio>
        )}
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <h3 className="text-[0.92rem] font-semibold">Registrar custo</h3>
          <p className="mt-1 max-w-3xl text-[0.8rem] leading-snug text-dim">
            A taxa do Autopilot é 5% só do gasto que a Crush gerenciou. Como o CRM não identifica esse gasto, a taxa não é calculada: informe o valor cobrado (ou marque como
            estimado). A assinatura da Crush e a verba da Meta ficam em linhas separadas.
          </p>
          <form action={custoAction} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr_auto] lg:items-end">
            <Campo rotulo="Tipo">
              <select name="tipo" className={input} defaultValue="meta_verba">
                {CUSTO_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {CUSTO_ROTULO[t]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="De">
              <input type="date" name="inicio" required defaultValue={inicio} className={input} />
            </Campo>
            <Campo rotulo="Até">
              <input type="date" name="fim" required defaultValue={fim} className={input} />
            </Campo>
            <Campo rotulo="Valor (R$)">
              <input name="valor" required inputMode="decimal" placeholder="0,00" className={input} />
            </Campo>
            <Campo rotulo="Observação (de onde veio o número)">
              <input name="nota" maxLength={300} placeholder="Ex.: fatura da Meta de novembro" className={input} />
            </Campo>
            <Enviar className={btnSecondary}>Registrar</Enviar>
            <label className="flex items-center gap-2 text-[0.84rem] text-muted sm:col-span-2 lg:col-span-6">
              <input type="checkbox" name="estimado" value="1" className="h-4 w-4 accent-royal" />
              Valor estimado (ainda não conferido em fatura)
            </label>
          </form>
        </div>
        {lancamentos.length > 0 && (
          <ul className="border-t border-line px-4 py-1 sm:px-5">
            {lancamentos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2.5 text-[0.88rem] last:border-b-0">
                <span>
                  <strong>{fmtMoeda(c.valor)}</strong> · {CUSTO_ROTULO[c.tipo]} · {br(c.inicio)} a {br(c.fim)}
                  {c.estimado ? " · estimado" : ""}
                  {c.nota ? <span className="text-dim"> · {c.nota}</span> : null}
                </span>
                <form action={removerCustoAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <Enviar className={btnQuiet}>Remover</Enviar>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </>
  );
}
