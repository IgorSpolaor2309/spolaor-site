import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/corretores", "/clinicas", "/orcamentos", "/analise", "/sites", "/automacao", "/sistemas", "/projetos", "/consultoria", "/contato"];
  const high = new Set(["/analise", "/corretores", "/clinicas", "/orcamentos"]);
  return routes.map((r) => ({ url: `${siteBaseUrl}${r}`, changeFrequency: "monthly", priority: r === "" ? 1 : high.has(r) ? 0.9 : 0.7 }));
}
