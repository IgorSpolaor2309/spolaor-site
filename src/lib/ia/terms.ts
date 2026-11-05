// Textos de renovação por meio de pagamento (página, aceite e checkout). Só aparecem os meios
// marcados como validados (IA_MEIOS_PAGAMENTO). Pix em assinatura: segundo o Mercado Pago, o
// comprador paga a cada vencimento; confirmar no ambiente de teste antes de liberar.

export type Meio = "cartao" | "pix";

export const meioLabel: Record<Meio, string> = { cartao: "cartão", pix: "Pix" };

export function renewalTerms(methods: Meio[], cycle: string): string[] {
  const out: string[] = [];
  if (methods.includes("cartao")) out.push(`No cartão, a renovação é cobrada automaticamente ${cycle}.`);
  if (methods.includes("pix")) out.push(`No Pix, a cada vencimento você paga um novo Pix pelo Mercado Pago; sem esse pagamento, o acesso termina no fim do período já pago.`);
  return out;
}

export function methodsSentence(methods: Meio[]) {
  if (!methods.length) return "";
  return `Pagamento por ${methods.map((m) => meioLabel[m]).join(" ou ")}, pelo Mercado Pago.`;
}
