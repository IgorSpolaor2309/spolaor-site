"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { DashboardMockup } from "./dashboard-mockup";

// Mockup que se "endireita" de leve conforme entra na tela.
export function CaseShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.94, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 40, 0]);

  return (
    <div ref={ref} className="relative [perspective:1600px]">
      <motion.div style={{ rotateX, scale, y, transformOrigin: "50% 100%" }} className="will-change-transform">
        <DashboardMockup />
      </motion.div>
    </div>
  );
}
