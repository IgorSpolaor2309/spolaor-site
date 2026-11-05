"use client";

import { useEffect } from "react";

// Marca a hidratação: a partir daqui o motion controla as entradas ([data-reveal]) e a
// animação de segurança de globals.css deixa de valer.
export function RevealReady() {
  useEffect(() => {
    document.documentElement.classList.add("reveal-ready");
  }, []);
  return null;
}
