// Pacote "Site de uma página" — preços e condições APROVADOS pelo Igor em 09/11/2026.
// Fonte única dos valores: a página, o checkout, a API e os avisos leem daqui. O servidor nunca aceita valor vindo
// do navegador: a condição escolhida é só um id, e o total cobrado sai desta tabela.
//
// São preços comerciais (cada parcelamento tem o seu total), não uma simulação de taxas do provedor. O comprador
// paga exatamente o total da condição escolhida; o checkout recusa a condição se o Mercado Pago indicar acréscimo.

export type CondicaoId = "pix" | "cartao-1x" | "cartao-2x" | "cartao-3x" | "cartao-6x" | "cartao-12x";

export type Condicao = {
  id: CondicaoId;
  meio: "pix" | "cartao";
  parcelas: number;
  /** valor de cada parcela, em reais */
  parcela: number;
  /** total pago pelo comprador nesta condição, em reais */
  total: number;
};

export const CONDICOES: Condicao[] = [
  { id: "pix", meio: "pix", parcelas: 1, parcela: 449.9, total: 449.9 },
  { id: "cartao-1x", meio: "cartao", parcelas: 1, parcela: 449.9, total: 449.9 },
  { id: "cartao-2x", meio: "cartao", parcelas: 2, parcela: 234.9, total: 469.8 },
  { id: "cartao-3x", meio: "cartao", parcelas: 3, parcela: 159.9, total: 479.7 },
  { id: "cartao-6x", meio: "cartao", parcelas: 6, parcela: 84.9, total: 509.4 },
  { id: "cartao-12x", meio: "cartao", parcelas: 12, parcela: 47.9, total: 574.8 },
];

export const PACOTE = {
  nome: "Site de uma página",
  /** descrição curta usada no checkout, no Mercado Pago e nos avisos internos */
  descricao: "Criação de site de uma página (Spolaor Tecnologia)",
  /** condição de destaque no anúncio e na primeira tela */
  destaque: "cartao-12x" as CondicaoId,
  avista: "pix" as CondicaoId,
};

export const condicao = (id: unknown): Condicao | null => CONDICOES.find((c) => c.id === id) ?? null;

export const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "12× de R$ 47,90" · "R$ 449,90 no Pix" · "Cartão em 1× de R$ 449,90" */
export function rotuloCondicao(c: Condicao) {
  if (c.meio === "pix") return `Pix: R$ ${brl(c.total)}`;
  if (c.parcelas === 1) return `Cartão em 1×: R$ ${brl(c.total)}`;
  return `Cartão em ${c.parcelas}× de R$ ${brl(c.parcela)}`;
}

/** Totais conferidos na carga do módulo: parcela × parcelas tem de bater com o total aprovado. */
for (const c of CONDICOES) {
  if (Math.round(c.parcela * c.parcelas * 100) !== Math.round(c.total * 100)) throw new Error(`Condição ${c.id}: parcela × parcelas ≠ total`);
}
