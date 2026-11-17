import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { blogOrigin, siteHref } from "@/lib/blog/config";
import { artigosPublicados, catalogo, dataPorExtenso, minutosDeLeitura, servicosDoArtigo } from "@/lib/blog/conteudo";

export const dynamic = "force-static";

const titulo = `Blog da ${site.name}`;
const descricao =
  "Sites, lojas virtuais, agendamento online, automação, atendimento e sistemas explicados para donos de empresa: o que considerar antes de contratar e como organizar a operação.";

export const metadata: Metadata = {
  title: { absolute: titulo },
  description: descricao,
  alternates: {
    canonical: `${blogOrigin}/`,
    types: { "application/rss+xml": `${blogOrigin}/feed.xml` },
  },
  openGraph: { type: "website", url: `${blogOrigin}/`, title: titulo, description: descricao, siteName: site.name, locale: "pt_BR" },
};

export default function BlogIndex() {
  const artigos = artigosPublicados();
  const { servicos } = catalogo();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: titulo,
    url: `${blogOrigin}/`,
    inLanguage: "pt-BR",
    publisher: { "@type": "Organization", name: site.name, url: siteHref("/") },
    blogPost: artigos.slice(0, 20).map((a) => ({
      "@type": "BlogPosting",
      headline: a.titulo,
      url: `${blogOrigin}/${a.slug}`,
      datePublished: a.publicadoEm,
      dateModified: a.atualizadoEm,
    })),
  };

  return (
    <div className="container-x py-14 sm:py-20">
      <header className="max-w-3xl">
        <p className="eyebrow">Blog</p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-h2 font-semibold text-fg">
          Tecnologia para vender, atender e organizar a empresa
        </h1>
        <p className="mt-5 text-lg text-muted">
          Artigos da {site.name} sobre sites, lojas virtuais, agendamento online, automação de processos, atendimento e sistemas:
          o que considerar antes de contratar e como colocar para funcionar.
        </p>
      </header>

      <section aria-labelledby="artigos" className="mt-12 sm:mt-16">
        <h2 id="artigos" className="sr-only">
          Artigos publicados
        </h2>
        {artigos.length === 0 ? (
          <p className="rounded-2xl border border-line bg-ink-900 p-6 text-muted">
            Os primeiros artigos estão sendo preparados. Enquanto isso, conheça os{" "}
            <a href={siteHref("/#servicos")} className="font-semibold text-sky underline-offset-4 hover:underline">
              serviços da {site.shortName}
            </a>
            .
          </p>
        ) : (
          <ol className="divide-y divide-line border-y border-line">
            {artigos.map((a) => {
              const principal = servicosDoArtigo(a)[0];
              return (
                <li key={a.slug} className="py-7 sm:py-9">
                  <article className="grid gap-3 md:grid-cols-12 md:gap-8">
                    <div className="text-sm text-dim md:col-span-3">
                      <time dateTime={a.publicadoEm}>{dataPorExtenso(a.publicadoEm)}</time>
                      {principal && <p className="mt-1 text-sky">{principal.nome}</p>}
                    </div>
                    <div className="md:col-span-9">
                      <h3 className="font-[family-name:var(--font-display)] text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-fg sm:text-[1.6rem]">
                        <Link href={`/${a.slug}`} className="hover:text-sky">
                          {a.titulo}
                        </Link>
                      </h3>
                      <p className="mt-3 max-w-3xl text-muted">{a.descricao}</p>
                      <p className="mt-3 text-sm text-dim">{minutosDeLeitura(a)} min de leitura</p>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="servicos" className="mt-16 rounded-2xl border border-line bg-ink-900 p-6 sm:p-10">
        <h2 id="servicos" className="font-[family-name:var(--font-display)] text-h3 font-semibold text-fg">
          Precisa resolver isso na sua empresa?
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          A {site.shortName} faz o projeto e acompanha a implantação. Veja o serviço mais perto do seu caso ou fale com a gente.
        </p>
        <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {servicos.map((s) => (
            <li key={s.id}>
              <a href={siteHref(s.caminho)} className="font-semibold text-fg underline-offset-4 hover:text-sky hover:underline">
                {s.nome}
              </a>
              <span className="text-muted"> — {s.resumo}</span>
            </li>
          ))}
        </ul>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
