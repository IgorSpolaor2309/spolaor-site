import type { Metadata } from "next";
import Link from "next/link";
import { btnSecondary, input, OpLinha, Painel, Vazio } from "@/components/crm/ui";
import { exigirUsuario } from "@/lib/crm/auth";
import { lista, opcoesFiltro, POR_PAGINA } from "@/lib/crm/consultas";
import { CANAIS, CANAL_ROTULO, CATEGORIA_ROTULO, CATEGORIAS, ETAPAS, ETAPA_ROTULO, isCanal, isCategoria, isEtapa } from "@/lib/crm/tipos";

export const metadata: Metadata = { title: "Lista" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function ListaPage({ searchParams }: { searchParams: SP }) {
  await exigirUsuario();
  const sp = await searchParams;
  const q = um(sp.q).slice(0, 100);
  const etapa = um(sp.etapa);
  const canal = um(sp.canal);
  const servico = um(sp.servico);
  const origem = um(sp.origem).slice(0, 200);
  const testes = um(sp.testes) === "1";
  const pagina = Math.max(1, Number(um(sp.p)) || 1);
  const [{ itens, total }, opcoes] = await Promise.all([
    lista({ q, etapa: isEtapa(etapa) ? etapa : undefined, canal: isCanal(canal) ? canal : undefined, categoria: isCategoria(servico) ? servico : undefined, origem: origem || undefined, testes, pagina }),
    opcoesFiltro(),
  ]);
  const agora = Date.now();
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const link = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, etapa, canal, servico, origem, testes: testes ? "1" : "" })) if (v) u.set(k, v);
    if (p > 1) u.set("p", String(p));
    const s = u.toString();
    return `/leads/lista${s ? `?${s}` : ""}`;
  };
  const filtrando = !!(q || etapa || canal || servico || origem || testes);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">Lista</h1>
        {/* Download: link comum, fora do roteador do Next. */}
        <a href="/api/leads/exportar" className={btnSecondary}>
          Exportar CSV
        </a>
      </div>
      <form method="get" className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
        <input name="q" defaultValue={q} placeholder="Nome, empresa, WhatsApp, e-mail ou mensagem" aria-label="Buscar" className={`${input} col-span-2 lg:col-span-1`} />
        <select name="etapa" defaultValue={etapa} aria-label="Etapa" className={input}>
          <option value="">Todas as etapas</option>
          {ETAPAS.map((e) => (
            <option key={e} value={e}>
              {ETAPA_ROTULO[e]}
            </option>
          ))}
        </select>
        <select name="servico" defaultValue={servico} aria-label="Serviço" className={input}>
          <option value="">Todos os serviços</option>
          {CATEGORIAS.map((s) => (
            <option key={s} value={s}>
              {CATEGORIA_ROTULO[s]}
            </option>
          ))}
        </select>
        <select name="origem" defaultValue={origem} aria-label="Origem" className={input}>
          <option value="">Todas as origens</option>
          {opcoes.origens.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="canal" defaultValue={canal} aria-label="Canal" className={input}>
          <option value="">Todos os canais</option>
          {CANAIS.map((c) => (
            <option key={c} value={c}>
              {CANAL_ROTULO[c]}
            </option>
          ))}
        </select>
        <button type="submit" className={`${btnSecondary} col-span-2 lg:col-span-1`}>
          Filtrar
        </button>
        <label className="col-span-2 flex items-center gap-2 text-[0.86rem] text-muted lg:col-span-6">
          <input type="checkbox" name="testes" value="1" defaultChecked={testes} className="h-4 w-4 accent-royal" />
          Mostrar também os envios de teste
        </label>
      </form>
      <p className="mt-4 text-[0.86rem] text-dim" aria-live="polite">
        {total} {total === 1 ? "oportunidade" : "oportunidades"}
        {filtrando ? " com esses filtros" : ""}
        {filtrando && (
          <>
            {" · "}
            <Link href="/leads/lista" className="font-semibold text-sky underline-offset-4 hover:underline">
              limpar filtros
            </Link>
          </>
        )}
      </p>
      <Painel className="mt-3">
        {itens.length ? (
          <ul>
            {itens.map((o) => (
              <OpLinha key={o.id} o={o} agora={agora} />
            ))}
          </ul>
        ) : (
          <Vazio>{filtrando ? "Nada encontrado com esses filtros." : "Nenhum contato registrado ainda. Os envios dos formulários do site aparecem aqui assim que chegam."}</Vazio>
        )}
      </Painel>
      {paginas > 1 && (
        <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-[0.9rem]">
          {pagina > 1 ? (
            <Link href={link(pagina - 1)} className={btnSecondary}>
              Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-dim">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={link(pagina + 1)} className={btnSecondary}>
              Próximas
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
