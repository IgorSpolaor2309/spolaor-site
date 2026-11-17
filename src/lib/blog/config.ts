import { siteBaseUrl } from "@/lib/site";

// Endereços do blog. O blog é servido em blog.<domínio do site> pelo mesmo projeto: o proxy (src/proxy.ts)
// reescreve as requisições desse subdomínio para as rotas em src/app/blog. Nada de domínio fixo aqui:
// tudo deriva de NEXT_PUBLIC_SITE_URL (via siteBaseUrl), como no resto do site.

/** blog.<domínio> a partir da URL do site (www.exemplo.com → blog.exemplo.com; localhost:3000 → blog.localhost:3000). */
export function blogOriginFrom(siteUrl: string): string {
  const u = new URL(siteUrl);
  u.hostname = `blog.${u.hostname.replace(/^www\./, "")}`;
  return u.origin;
}

export const siteOrigin = new URL(siteBaseUrl).origin;
export const blogOrigin = blogOriginFrom(siteBaseUrl);

/** A requisição chegou pelo subdomínio do blog? */
export const isBlogHost = (host: string | null | undefined) => !!host && host.split(":")[0].toLowerCase().startsWith("blog.");

/** URL absoluta de um caminho do site principal (para links que saem do blog). */
export const siteHref = (path: string) => `${siteOrigin}${path.startsWith("/") ? path : `/${path}`}`;

/** URL pública de um artigo (canonical, sitemap, feed). */
export const blogArticleUrl = (slug: string) => `${blogOrigin}/${slug}`;

/**
 * Primeiro segmento das rotas do site principal (pastas de src/app, exceto blog). No subdomínio do blog
 * esses caminhos voltam para o site; o validador (scripts/blog/regras.mjs) proíbe artigos com esses
 * slugs, e scripts/blog/teste-blog.mjs confere que esta lista acompanha as pastas.
 */
export const SITE_SEGMENTS = [
  "agendamento-online",
  "analise",
  "api",
  "atendimento-ia",
  "automacao",
  "clinicas",
  "consultoria",
  "contato",
  "corretores",
  "diagnostico-site",
  "leads",
  "lojas-virtuais",
  "orcamentos",
  "projetos",
  "sistemas",
  "sites",
];

const BLOG_FILES = new Set(["/sitemap.xml", "/robots.txt", "/feed.xml"]);
const SLUG_PATH = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

/**
 * Para uma requisição no subdomínio do blog: caminho interno (em /blog) a servir, ou null quando o caminho
 * pertence ao site principal (o proxy redireciona para lá).
 */
export function blogInternalPath(pathname: string): string | null {
  if (pathname === "/" || pathname === "") return "/blog";
  if (BLOG_FILES.has(pathname)) return `/blog${pathname}`;
  const m = SLUG_PATH.exec(pathname);
  if (m && !SITE_SEGMENTS.includes(m[1]) && m[1] !== "blog") return `/blog/${m[1]}`;
  return null;
}
