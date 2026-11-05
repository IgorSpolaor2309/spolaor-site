"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
  blur?: boolean;
  as?: "div" | "li" | "section" | "article";
};

// Entrada ao aparecer na tela. Anima assim que qualquer parte do bloco entra na área visível
// (margem 0, amount "some"): uma margem inferior negativa deixava transparente o que estava na
// faixa de baixo da tela, que no Safari do iPhone, com as barras, cai bem no fim do hero.
//
// O servidor entrega o bloco com opacity 0 (estado inicial do motion). As regras de
// [data-reveal] em globals.css garantem que ele nunca fica invisível de vez: sem JavaScript,
// com movimento reduzido, ou se a hidratação não acontecer (RevealReady em layout.tsx).
export function Reveal({ delay = 0, y = 18, blur = false, as = "div", children, ...props }: RevealProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      data-reveal=""
      initial={reduce ? false : { opacity: 0, y, filter: blur ? "blur(10px)" : "blur(0px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: "some", margin: "0px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </Comp>
  );
}
