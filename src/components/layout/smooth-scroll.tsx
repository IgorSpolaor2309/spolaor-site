"use client";

import { useEffect } from "react";

// Rolagem suave só em desktop com mouse e sem preferência por menos movimento.
export function SmoothScroll() {
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    let raf = 0;
    let destroy: (() => void) | undefined;
    import("lenis").then(({ default: Lenis }) => {
      // Sem `anchors`: o clique em link de âncora (#formulario, #analise…) fica com o Next/navegador, que
      // respeitam o scroll-padding-top do html (recuo do cabeçalho fixo, em globals.css). Com `anchors`
      // ligado, o Lenis e o Next rolavam ao mesmo tempo e o formulário parava em posições diferentes.
      const lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4) });
      const loop = (time: number) => {
        lenis.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      destroy = () => lenis.destroy();
    });
    return () => {
      cancelAnimationFrame(raf);
      destroy?.();
    };
  }, []);
  return null;
}
