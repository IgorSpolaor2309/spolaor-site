import Image from "next/image";
import mark from "../../../public/brand/spolaor-mark.png";

// Símbolo oficial (S + T em azul, ciano e laranja), recortado da logo da Spolaor Tecnologia.
export function LogoMark({ className = "" }: { className?: string }) {
  return <Image src={mark} alt="" aria-hidden className={className} sizes="64px" priority />;
}

/** compact: um pouco menor no celular (cabeçalho de 60 px), igual a partir de sm */
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center ${compact ? "gap-2.5 sm:gap-3" : "gap-3"} ${className}`}>
      <LogoMark className={compact ? "h-8 w-8 sm:h-9 sm:w-9" : "h-9 w-9"} />
      <span className="flex flex-col leading-none">
        <span className="font-[family-name:var(--font-display)] text-[1.08rem] font-semibold tracking-[0.1em] text-fg">
          SPOLAOR
        </span>
        <span className="mt-[5px] text-[0.56rem] font-medium tracking-[0.5em] text-sky">TECNOLOGIA</span>
      </span>
    </span>
  );
}
