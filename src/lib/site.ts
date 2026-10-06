// Configuração pública central da Spolaor Tecnologia.
//
// Domínio, e-mail e WhatsApp AINDA NÃO ESTÃO DEFINIDOS. Eles vêm só de variáveis de ambiente
// (veja .env.example) e não têm valor padrão de propósito: enquanto estiverem vazios,
// o site esconde esses contatos e não se deixa indexar. Nenhum outro arquivo deve conter
// domínio, e-mail ou número fixos; use sempre este módulo.

const clean = (v?: string) => (v ?? "").trim();
const whatsappDigits = clean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER).replace(/\D/g, "");
const siteUrl = clean(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");

export const site = {
  name: "Spolaor Tecnologia",
  shortName: "Spolaor",
  /** URL pública definitiva. null = ainda não definida (site fica com noindex). */
  url: siteUrl || null,
  /** E-mail comercial. null = ainda não definido (não aparece no site). */
  email: clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL) || null,
  /** WhatsApp comercial, só dígitos com DDI (ex.: 55DDNNNNNNNNN). null = ainda não definido. */
  whatsapp: whatsappDigits.length >= 12 ? whatsappDigits : null,
  whatsappMessage: "Olá! Quero falar sobre um projeto com a Spolaor Tecnologia.",
  description:
    "Sites que convertem, automações e sistemas sob medida para empresas que não querem perder clientes nem desperdiçar horas com trabalho manual.",
  locale: "pt_BR",
};

/** Base para URLs absolutas (metadata, sitemap). Usa localhost enquanto não houver domínio. */
export const siteBaseUrl = site.url ?? "http://localhost:3000";

/** O site só deve ser indexado quando a URL definitiva estiver configurada. */
export const isIndexable = site.url !== null;

export const nav = [
  { href: "/sites", label: "Sites" },
  { href: "/automacao", label: "Automação" },
  { href: "/sistemas", label: "Sistemas" },
  { href: "/projetos", label: "Projetos" },
  { href: "/consultoria", label: "Consultoria" },
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
