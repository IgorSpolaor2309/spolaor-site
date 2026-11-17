import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/lib/site";
import { blogArticleUrl, blogOrigin, siteHref } from "@/lib/blog/config";
import {
  artigoPublicado,
  artigosPublicados,
  catalogo,
  dataPorExtenso,
  markdownParaHtml,
  minutosDeLeitura,
  relacionados,
  secoes,
  servicosDoArtigo,
} from "@/lib/blog/conteudo";

// Artigos estáticos: gerados no build a partir de content/blog/artigos. Slug desconhecido, rascunho ou
// artigo despublicado = 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return artigosPublicados().map((a) => ({ slug: a.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = artigoPublicado((await params).slug);
  if (!a) return {};
  const url = blogArticleUrl(a.slug);
  return {
    title: { absolute: `${a.titulo} · Blog ${site.name}` },
    description: a.descricao,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: a.titulo,
      description: a.descricao,
      siteName: site.name,
      locale: "pt_BR",
      publishedTime: a.publicadoEm,
      modifiedTime: a.atualizadoEm,
    },
  };
}

export default async function ArtigoPage({ params }: Props) {
  const a = artigoPublicado((await params).slug);
  if (!a) notFound();

  const html = markdownParaHtml(a.corpo);
  const indice = secoes(a.corpo);
  const servicos = servicosDoArtigo(a);
  const { contato } = catalogo();
  const outros = relacionados(a);
  const alteracoes = a.historico.filter((h) => h.tipo !== "publicacao");
  const atualizado = a.atualizadoEm !== a.publicadoEm && alteracoes.length > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: a.titulo,
        description: a.descricao,
        url: blogArticleUrl(a.slug),
        mainEntityOfPage: blogArticleUrl(a.slug),
        datePublished: a.publicadoEm,
        dateModified: a.atualizadoEm,
        inLanguage: "pt-BR",
        wordCount: a.palavras,
        author: { "@type": "Organization", name: site.name, url: siteHref("/") },
        publisher: { "@type": "Organization", name: site.name, url: siteHref("/") },
        citation: a.fontes.map((f) => f.url),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.name, item: siteHref("/") },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${blogOrigin}/` },
          { "@type": "ListItem", position: 3, name: a.titulo, item: blogArticleUrl(a.slug) },
        ],
      },
    ],
  };

  return (
    <article className="container-x py-10 sm:py-16">
      <nav aria-label="Você está em" className="text-sm text-dim">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <a href={siteHref("/")} className="hover:text-fg">
              {site.name}
            </a>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/" className="hover:text-fg">
              Blog
            </Link>
          </li>
        </ol>
      </nav>

      <header className="mt-6 max-w-3xl">
        {servicos[0] && <p className="eyebrow">{servicos[0].nome}</p>}
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-[1.1] tracking-[-0.035em] text-fg sm:text-[2.75rem]">
          {a.titulo}
        </h1>
        <p className="mt-5 text-lg text-muted">{a.descricao}</p>
        <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-dim">
          <span>
            Publicado em <time dateTime={a.publicadoEm}>{dataPorExtenso(a.publicadoEm)}</time>
          </span>
          {atualizado && (
            <span>
              Atualizado em <time dateTime={a.atualizadoEm}>{dataPorExtenso(a.atualizadoEm)}</time>
            </span>
          )}
          <span>{minutosDeLeitura(a)} min de leitura</span>
          <span>Por {site.name}</span>
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-8">
          {indice.length >= 3 && (
            <nav aria-labelledby="sumario" className="mb-10 rounded-2xl border border-line bg-ink-900 p-5 lg:hidden">
              <h2 id="sumario" className="eyebrow">
                Neste artigo
              </h2>
              <ol className="mt-3 space-y-2 text-[0.95rem]">
                {indice.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-fg/80 hover:text-sky">
                      {s.texto}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="artigo-corpo" dangerouslySetInnerHTML={{ __html: html }} />

          {servicos.length > 0 && (
            <aside aria-labelledby="como-ajudamos" className="mt-12 rounded-2xl border border-line bg-ink-900 p-6 sm:p-8">
              <h2 id="como-ajudamos" className="font-[family-name:var(--font-display)] text-[1.35rem] font-semibold tracking-[-0.02em] text-fg">
                Como a {site.shortName} pode ajudar
              </h2>
              <ul className="mt-4 space-y-4">
                {servicos.map((s) => (
                  <li key={s.id}>
                    <p className="font-semibold text-fg">{s.nome}</p>
                    <p className="mt-1 text-muted">{s.resumo}</p>
                    <a href={siteHref(s.caminho)} className="mt-2 inline-block font-semibold text-sky underline-offset-4 hover:underline">
                      {s.chamada}
                    </a>
                  </li>
                ))}
              </ul>
              <a
                href={siteHref(`${contato.caminho}#formulario`)}
                className="mt-6 inline-flex min-h-11 items-center rounded-[10px] bg-royal px-5 py-2 font-semibold text-white transition-colors hover:bg-[#1a4fcc]"
              >
                {contato.chamada}
              </a>
            </aside>
          )}

          <section aria-labelledby="fontes" className="mt-12 border-t border-line pt-8">
            <h2 id="fontes" className="font-[family-name:var(--font-display)] text-[1.2rem] font-semibold text-fg">
              Fontes consultadas
            </h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[0.95rem] text-muted">
              {a.fontes.map((f) => (
                <li key={f.url}>
                  <a href={f.url} target="_blank" rel="noopener" className="text-fg/80 underline underline-offset-4 hover:text-sky">
                    {f.titulo}
                  </a>{" "}
                  <span className="text-dim">(consultada em {dataPorExtenso(`${f.consultadoEm}T12:00:00-03:00`)})</span>
                </li>
              ))}
            </ol>
          </section>

          {alteracoes.length > 0 && (
            <section aria-labelledby="alteracoes" className="mt-10">
              <h2 id="alteracoes" className="font-[family-name:var(--font-display)] text-[1.2rem] font-semibold text-fg">
                Histórico de alterações
              </h2>
              <ul className="mt-4 space-y-2 text-[0.95rem] text-muted">
                {alteracoes.map((h) => (
                  <li key={h.em + h.tipo}>
                    <time dateTime={h.em} className="text-dim">
                      {dataPorExtenso(h.em)}
                    </time>
                    : {h.resumo}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-8 space-y-8">
            {indice.length >= 3 && (
              <nav aria-labelledby="sumario-lateral">
                <h2 id="sumario-lateral" className="eyebrow">
                  Neste artigo
                </h2>
                <ol className="mt-3 space-y-2 border-l border-line pl-4 text-[0.93rem]">
                  {indice.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="text-muted hover:text-fg">
                        {s.texto}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <div className="rounded-2xl border border-line bg-ink-900 p-5">
              <p className="font-semibold text-fg">Quer ajuda com isso?</p>
              <p className="mt-2 text-sm text-muted">Conte o que sua empresa precisa. A gente responde com o próximo passo.</p>
              <a href={siteHref(`${contato.caminho}#formulario`)} className="mt-4 inline-block font-semibold text-sky underline-offset-4 hover:underline">
                {contato.chamada}
              </a>
            </div>
          </div>
        </aside>
      </div>

      {outros.length > 0 && (
        <section aria-labelledby="leia-tambem" className="mt-16 border-t border-line pt-10">
          <h2 id="leia-tambem" className="font-[family-name:var(--font-display)] text-h3 font-semibold text-fg">
            Leia também
          </h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-3">
            {outros.map((o) => (
              <li key={o.slug}>
                <Link href={`/${o.slug}`} className="font-semibold text-fg hover:text-sky">
                  {o.titulo}
                </Link>
                <p className="mt-2 text-sm text-muted">{o.descricao}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </article>
  );
}
