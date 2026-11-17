"use client";

import { useEffect } from "react";

// Faz a cor do topo do navegador acompanhar o degradê da página enquanto a pessoa rola.
// - iPhone (Safari 26): pinta a área da Dynamic Island com o fundo do cabeçalho fixo / do html.
// - Android (Chrome, Samsung Internet): pinta a barra com a meta theme-color.
// A cor é a do degradê na altura do topo da tela, então topo e página nunca destoam.
const STOPS: [number, [number, number, number]][] = [
  [0, [0xd9, 0xe6, 0xfc]],
  [800, [0xe3, 0xeb, 0xfb]],
  [1700, [0xed, 0xf0, 0xf6]],
  [2600, [0xf5, 0xf4, 0xf0]],
];

function colorAt(y: number) {
  if (y <= 0) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [y1, c1] = STOPS[i];
    if (y <= y1) {
      const [y0, c0] = STOPS[i - 1];
      const t = (y - y0) / (y1 - y0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * t)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

const hex = (c: [number, number, number]) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

export function TopoAzul() {
  useEffect(() => {
    const root = document.documentElement;
    const metas = () => Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    // Valor original da meta, para devolver ao sair da home pela navegação interna
    const original = metas().map((m) => m.getAttribute("content"));
    let frame = 0;
    let last = "";
    const paint = () => {
      frame = 0;
      const c = hex(colorAt(window.scrollY));
      if (c === last) return;
      last = c;
      root.style.setProperty("--topo", c);
      metas().forEach((m) => m.setAttribute("content", c));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.style.removeProperty("--topo");
      metas().forEach((m, i) => original[i] != null && m.setAttribute("content", original[i]!));
    };
  }, []);
  // Marcador: liga as regras de "Topo azul" do globals.css (fundo, cabeçalho e barra de baixo)
  return <span data-topo-azul hidden />;
}
