import { blogArticleUrl, blogOrigin } from "@/lib/blog/config";
import { artigosPublicados } from "@/lib/blog/conteudo";

// Sitemap do blog, servido em blog.<domínio>/sitemap.xml (o do site principal continua em www).
export const dynamic = "force-static";

const xmlEsc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export function GET() {
  const artigos = artigosPublicados();
  const ultima = artigos.reduce((m, a) => (Date.parse(a.atualizadoEm) > m ? Date.parse(a.atualizadoEm) : m), 0);
  const urls = [
    `  <url><loc>${xmlEsc(`${blogOrigin}/`)}</loc>${ultima ? `<lastmod>${new Date(ultima).toISOString()}</lastmod>` : ""}</url>`,
    ...artigos.map(
      (a) => `  <url><loc>${xmlEsc(blogArticleUrl(a.slug))}</loc><lastmod>${new Date(a.atualizadoEm).toISOString()}</lastmod></url>`,
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
