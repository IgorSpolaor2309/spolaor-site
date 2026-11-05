// Preço comercial da oferta: o valor em destaque e "/mês" menor, como complemento. O ciclo real da
// cobrança fica na observação ao lado (PriceNote) e, por extenso, no aceite e nas condições do plano.

export function formatPrice(price: number) {
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: Number.isInteger(price) ? 0 : 2 });
}

export function Price({ price, className = "", unitClassName = "" }: { price: number; className?: string; unitClassName?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <strong className={`font-semibold leading-none tracking-[-0.04em] ${className}`}>{formatPrice(price)}</strong>
      <span className={`font-medium leading-none tracking-normal ${unitClassName}`}>/mês</span>
    </span>
  );
}

export function PriceNote({ cycle, className = "" }: { cycle: string; className?: string }) {
  return <span className={className}>Cobrança recorrente {cycle}.</span>;
}
