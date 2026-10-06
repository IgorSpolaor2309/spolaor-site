import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/sites", "/automacao", "/sistemas", "/projetos", "/consultoria", "/contato", "/analise"];
  return routes.map((r) => ({ url: `${siteBaseUrl}${r}`, changeFrequency: "monthly", priority: r === "" ? 1 : r === "/analise" ? 0.9 : 0.7 }));
}
