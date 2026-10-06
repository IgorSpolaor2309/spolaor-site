"use client";

import Link from "next/link";
import { useRef } from "react";

// Card com luz que segue o cursor e leve inclinação 3D (só com mouse).
export function SpotlightCard({ href, className = "", children }: { href: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    ref.current.style.setProperty("--mx", `${x}px`);
    ref.current.style.setProperty("--my", `${y}px`);
    ref.current.style.setProperty("--rx", `${((y / r.height) - 0.5) * -4}deg`);
    ref.current.style.setProperty("--ry", `${((x / r.width) - 0.5) * 5}deg`);
  };
  const onLeave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <Link
      ref={ref}
      href={href}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`group relative isolate block overflow-hidden rounded-[28px] border border-line bg-ink-900 transition-[transform,border-color] duration-500 ease-out-expo [transform:perspective(1200px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] hover:border-line-strong motion-reduce:transform-none ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(520px circle at var(--mx,50%) var(--my,50%), rgb(255 255 255 / 0.07), transparent 45%)" }}
      />
      {children}
    </Link>
  );
}
