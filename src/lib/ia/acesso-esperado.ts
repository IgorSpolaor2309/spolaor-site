import type { Contratacao } from "./store";

/**
 * Se a contratação deveria estar ativa no ZappMillion, para a conciliação. Cancelada só conta com pagamento
 * aprovado e período pago em aberto: assinatura cancelada sem pagamento nunca teve acesso. Pago sem `pagoAte`
 * é ativação que não terminou, e precisa continuar aparecendo como divergência.
 */
export function deveTerAcesso(c: Pick<Contratacao, "etapa" | "primeiroPagamentoEm" | "pagoAte">, agora = new Date()) {
  if (c.etapa === "acesso_criado") return true;
  if (c.etapa !== "cancelada" || !c.primeiroPagamentoEm) return false;
  return !c.pagoAte || new Date(c.pagoAte).getTime() > agora.getTime();
}
