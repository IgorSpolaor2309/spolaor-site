import type { MetadataRoute } from "next";
import { isIndexable, siteBaseUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Sem domínio definitivo, nada é indexado (evita publicar algo provisório como definitivo).
  if (!isIndexable) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }], sitemap: `${siteBaseUrl}/sitemap.xml` };
}
