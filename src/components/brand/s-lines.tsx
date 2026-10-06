"use client";

import { motion, useReducedMotion } from "motion/react";
import { LEAK, SPINE, at, sample } from "@/lib/brand-geometry";

// O "S" da Spolaor em traço fino: as mesmas três fitas do hero, desenhadas como linhas
// que se traçam uma vez quando entram na tela. Usado só em momentos de fechamento.
const W = 400;
const H = 420;
const spine = sample(SPINE, W, H, 140);
const leak = sample(LEAK, W, H, 70);

function d(track: typeof spine, off: number) {
  return track.pts.map((_, i) => at(track, i / (track.pts.length - 1), off)).map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
}

const lines = [
  { path: d(spine, -14), stroke: "#1e5be6", width: 1.4 },
  { path: d(spine, 0), stroke: "#2f8cff", width: 1.4 },
  { path: d(spine, 14), stroke: "#0ea5d8", width: 1 },
  { path: d(leak, 0), stroke: "#f07a12", width: 1.4 },
];

export function SLines({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} fill="none" aria-hidden>
      {lines.map((l, i) => (
        <motion.path
          key={i}
          d={l.path}
          stroke={l.stroke}
          strokeWidth={l.width}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 2.2, delay: i * 0.18, ease: [0.65, 0, 0.35, 1] }}
        />
      ))}
    </svg>
  );
}
