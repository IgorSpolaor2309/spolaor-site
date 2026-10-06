import Image from "next/image";
import mark from "../../../public/brand/spolaor-mark.png";

// Símbolo oficial (S + T em azul, ciano e laranja), recortado da logo da Spolaor Tecnologia.
export function LogoMark({ className = "" }: { className?: string }) {
  return <Image src={mark} alt="" aria-hidden className={className} sizes="64px" priority />;
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark className="h-9 w-9" />
      <span className="flex flex-col leading-none">
        <span className="font-[family-name:var(--font-display)] text-[1.08rem] font-semibold tracking-[0.1em] text-fg">
          SPOLAOR
        </span>
        <span className="mt-[5px] text-[0.56rem] font-medium tracking-[0.5em] text-sky">TECNOLOGIA</span>
      </span>
    </span>
  );
}
