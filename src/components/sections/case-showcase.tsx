"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { DashboardMockup } from "./dashboard-mockup";

// Mockup que se "endireita" conforme entra na tela: profundidade sem modelo 3D pesado.
export function CaseShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 28, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.86, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 80, 0]);
  const glow = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className="relative [perspective:1600px]">
      <motion.div
        aria-hidden
        style={{ opacity: glow }}
        className="absolute inset-x-[10%] -bottom-10 top-1/3 -z-10 rounded-full bg-[radial-gradient(ellipse,rgb(215_255_58/0.18),transparent_65%)] blur-2xl"
      />
      <motion.div style={{ rotateX, scale, y, transformOrigin: "50% 100%" }} className="will-change-transform">
        <DashboardMockup />
      </motion.div>
    </div>
  );
}
