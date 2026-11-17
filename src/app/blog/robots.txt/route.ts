import { isIndexable } from "@/lib/site";
import { blogOrigin } from "@/lib/blog/config";

// robots.txt do subdomínio do blog. Segue a mesma chave de indexação do site (NEXT_PUBLIC_ALLOW_INDEXING).
export const dynamic = "force-static";

export function GET() {
  const corpo = isIndexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${blogOrigin}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(corpo, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
