import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/corretores", "/clinicas", "/orcamentos", "/analise", "/sites", "/lojas-virtuais", "/agendamento-online", "/automacao", "/diagnostico-site", "/sistemas", "/projetos", "/consultoria", "/contato"];
  const high = new Set(["/analise", "/sites", "/lojas-virtuais", "/agendamento-online", "/diagnostico-site", "/automacao", "/corretores", "/clinicas", "/orcamentos"]);
  return routes.map((r) => ({ url: `${siteBaseUrl}${r}`, changeFrequency: "monthly", priority: r === "" ? 1 : high.has(r) ? 0.9 : 0.7 }));
}
