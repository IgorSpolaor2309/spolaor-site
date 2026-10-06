"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring } from "motion/react";

const steps = [
  ["Análise gratuita ou contato", "Você manda o site ou conta o que precisa."],
  ["Diagnóstico", "Avaliamos o cenário e os pontos que mais custam caro."],
  ["Reunião, quando necessário", "Para entender detalhes do negócio e alinhar expectativas."],
  ["Proposta", "Escopo, prazo e investimento definidos para o seu caso."],
  ["Contrato", "Tudo formalizado, sem letras miúdas."],
  ["Desenvolvimento", "Você acompanha a evolução do projeto."],
  ["Validação", "Revisamos juntos antes de qualquer coisa ir ao ar."],
  ["Publicação", "No ar, com o domínio no seu nome."],
];

export function Process() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <ol ref={ref} className="relative">
      <span aria-hidden className="absolute bottom-3 left-[15px] top-3 w-px bg-line" />
      <motion.span aria-hidden style={{ scaleY }} className="absolute bottom-3 left-[15px] top-3 w-px origin-top bg-gradient-to-b from-signal via-signal to-signal/30" />
      {steps.map(([t, d], i) => (
        <li key={t} className="relative flex gap-6 pb-10 last:pb-0">
          <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong bg-ink-950 font-mono text-[0.7rem] text-muted">
            {i + 1}
          </span>
          <div className="pt-0.5">
            <p className="text-lg font-medium">{t}</p>
            <p className="mt-1 text-muted">{d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
