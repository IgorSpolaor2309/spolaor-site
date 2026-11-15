"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Botão de envio que se desativa enquanto a ação roda (evita clique duplo). */
export function Enviar({ children, className, name, value }: { children: ReactNode; className: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={className}>
      {children}
    </button>
  );
}
