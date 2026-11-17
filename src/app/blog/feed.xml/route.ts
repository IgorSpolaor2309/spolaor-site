import { site } from "@/lib/site";
import { blogArticleUrl, blogOrigin } from "@/lib/blog/config";
import { artigosPublicados } from "@/lib/blog/conteudo";

// Feed RSS do blog (blog.<domínio>/feed.xml).
export const dynamic = "force-static";

const xmlEsc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export function GET() {
  const itens = artigosPublicados()
    .slice(0, 30)
    .map(
      (a) => `    <item>
      <title>${xmlEsc(a.titulo)}</title>
      <link>${xmlEsc(blogArticleUrl(a.slug))}</link>
      <guid isPermaLink="true">${xmlEsc(blogArticleUrl(a.slug))}</guid>
      <pubDate>${new Date(a.publicadoEm).toUTCString()}</pubDate>
      <description>${xmlEsc(a.descricao)}</description>
    </item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEsc(`Blog da ${site.name}`)}</title>
    <link>${xmlEsc(`${blogOrigin}/`)}</link>
    <atom:link href="${xmlEsc(`${blogOrigin}/feed.xml`)}" rel="self" type="application/rss+xml" />
    <description>${xmlEsc("Sites, lojas virtuais, agendamento, automação, atendimento e sistemas para empresas.")}</description>
    <language>pt-BR</language>
${itens}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
