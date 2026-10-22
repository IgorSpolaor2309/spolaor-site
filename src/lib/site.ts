// Configuração pública central da Spolaor Tecnologia.
//
// URL pública, e-mail e WhatsApp vêm só de variáveis de ambiente (veja .env.example). Nenhum
// outro arquivo deve conter domínio, e-mail ou número fixos; use sempre este módulo.
//
// URL e indexação são controles SEPARADOS:
//  - NEXT_PUBLIC_SITE_URL define o endereço público (canonical, Open Graph, sitemap). Deve estar
//    definida em produção, mesmo com domínio provisório.
//  - NEXT_PUBLIC_ALLOW_INDEXING=true libera a indexação por buscadores. Sem ela o site fica com
//    noindex e o robots.txt bloqueia tudo, qualquer que seja a URL. Só ligue quando o domínio
//    definitivo estiver escolhido.

const clean = (v?: string) => (v ?? "").trim();
const whatsappDigits = clean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER).replace(/\D/g, "");
const siteUrl = clean(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");

export const site = {
  name: "Spolaor Tecnologia",
  shortName: "Spolaor",
  /** URL pública atual (pode ser provisória). null = não definida; só aceitável em desenvolvimento. */
  url: siteUrl || null,
  /** E-mail comercial. null = ainda não definido (não aparece no site). */
  email: clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL) || null,
  /** WhatsApp comercial, só dígitos com DDI (ex.: 55DDNNNNNNNNN). null = ainda não definido. */
  whatsapp: whatsappDigits.length >= 12 ? whatsappDigits : null,
  whatsappMessage: "Olá! Quero falar sobre um projeto com a Spolaor Tecnologia.",
  description:
    "A Spolaor Tecnologia faz sites e landing pages, lojas virtuais e agendamento online que facilitam vendas, contatos e pedidos de orçamento, avalia sites existentes e automatiza processos para reduzir tarefas manuais e acompanhar atendimentos e oportunidades comerciais.",
  locale: "pt_BR",
};

/** Base para URLs absolutas (metadata, sitemap). Usa localhost só quando a URL não foi definida (desenvolvimento). */
export const siteBaseUrl = site.url ?? "http://localhost:3000";

/** Indexação liberada de propósito, e só com URL definida. Independe de a URL ser provisória. */
export const isIndexable = site.url !== null && clean(process.env.NEXT_PUBLIC_ALLOW_INDEXING).toLowerCase() === "true";

// Navegação: ofertas (o que contratar), setores (para quem) e institucional.
export type NavItem = { href: string; label: string; short?: string };
export const navOffers: NavItem[] = [
  { href: "/sites", label: "Sites e landing pages", short: "Sites" },
  { href: "/lojas-virtuais", label: "Lojas virtuais", short: "Lojas virtuais" },
  { href: "/agendamento-online", label: "Agendamento online", short: "Agendamento" },
  { href: "/automacao", label: "Automação de processos", short: "Automação" },
  { href: "/diagnostico-site", label: "Diagnóstico de site", short: "Diagnóstico" },
];
export const navSectors: NavItem[] = [
  { href: "/corretores", label: "Corretores de imóveis", short: "Corretores" },
  { href: "/clinicas", label: "Clínicas e consultórios", short: "Clínicas" },
  { href: "/orcamentos", label: "Empresas que vendem por orçamento", short: "Orçamentos" },
];
export const navMore: NavItem[] = [
  { href: "/projetos", label: "Projetos" },
  { href: "/contato", label: "Contato" },
];

/** Link do WhatsApp comercial, ou null enquanto o número não estiver configurado. */
export function whatsappLink(message = site.whatsappMessage) {
  return site.whatsapp ? `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}` : null;
}

/** Link mailto do e-mail comercial, ou null enquanto o e-mail não estiver configurado. */
export function mailtoLink(subject?: string) {
  if (!site.email) return null;
  return `mailto:${site.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}
