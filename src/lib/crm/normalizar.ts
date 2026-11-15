// Normalização dos dados de contato. É o que decide se dois registros são a mesma pessoa:
// só WhatsApp ou e-mail idênticos depois de normalizados. Nome parecido nunca une registros.

/** Só dígitos, com DDI. Número brasileiro sem DDI (10 ou 11 dígitos) ganha 55. null se não parece telefone. */
export function normWhatsapp(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

const emailRe = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/;
export function normEmail(v: string | null | undefined): string | null {
  const e = (v ?? "").trim().toLowerCase();
  return emailRe.test(e) ? e : null;
}

/** Usuário do Instagram sem @ e sem URL. */
export function normInstagram(v: string | null | undefined): string | null {
  const s = (v ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  return /^[a-z0-9._]{1,30}$/i.test(s) ? s.toLowerCase() : null;
}

export const texto = (v: unknown, max = 500): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t ? t : null;
};

/** "1.234,56" ou "1234.56" → número com 2 casas; null se vazio ou inválido. */
export function valorMonetario(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  let s = v.replace(/[^\d.,]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return s && Number.isFinite(n) && n >= 0 && n < 1e10 ? Math.round(n * 100) / 100 : null;
}

/** Links para abrir a conversa no canal (envio manual; o CRM não envia por aqui). */
export const linkWhatsapp = (digits: string, text?: string) => `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const linkInstagram = (user: string) => `https://ig.me/m/${user}`;
export const linkEmail = (email: string, assunto?: string, corpo?: string) => {
  const q = [assunto ? `subject=${encodeURIComponent(assunto)}` : "", corpo ? `body=${encodeURIComponent(corpo)}` : ""].filter(Boolean).join("&");
  return `mailto:${email}${q ? `?${q}` : ""}`;
};
