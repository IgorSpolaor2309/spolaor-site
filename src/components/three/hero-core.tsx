"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "pending" | "webgl" | "static";

function canUseWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function HeroCore({ className = "" }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("pending");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const weak = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || nav.connection?.saveData;
    setMode(reduce || weak || !canUseWebGL() ? "static" : "webgl");
  }, []);

  useEffect(() => {
    if (mode !== "webgl" || !canvas.current || !wrap.current) return;
    let disposed = false;
    let cleanup = () => {};

    const boot = async () => {
      const { createCoreScene } = await import("./core-scene");
      if (disposed || !canvas.current || !wrap.current) return;
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const scene = createCoreScene(canvas.current, {
        count: mobile ? 3200 : 7800,
        dpr: Math.min(window.devicePixelRatio, mobile ? 1.5 : 2),
        fps: mobile ? 30 : 60,
      });

      const onPointer = (e: PointerEvent) => {
        scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      };
      const onScroll = () => {
        const h = wrap.current?.closest("section")?.offsetHeight ?? window.innerHeight;
        scene.setProgress(Math.min(1, Math.max(0, window.scrollY / (h * 0.75))));
      };
      const ro = new ResizeObserver(() => scene.resize());
      ro.observe(canvas.current);
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !document.hidden) scene.start();
        else scene.stop();
      });
      io.observe(wrap.current);
      const onVis = () => (document.hidden ? scene.stop() : scene.start());

      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", onVis);
      onScroll();
      scene.start();
      requestAnimationFrame(() => setReady(true));

      cleanup = () => {
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("visibilitychange", onVis);
        ro.disconnect();
        io.disconnect();
        scene.dispose();
      };
    };

    // Desktop: inicia quando o navegador fica ocioso. Celular: espera a página carregar e o
    // primeiro toque/rolagem (ou alguns segundos), para não competir com o carregamento.
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      events.forEach((e) => window.removeEventListener(e, start));
      if (ric) ric(() => void boot(), { timeout: 900 });
      else setTimeout(() => void boot(), 200);
    };
    const events = ["touchstart", "scroll", "pointerdown"] as const;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const afterLoad = () => {
      if (!coarse) return start();
      events.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }));
      timer = setTimeout(start, 3500);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });

    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("load", afterLoad);
      events.forEach((e) => window.removeEventListener(e, start));
      cleanup();
    };
  }, [mode]);

  return (
    <div ref={wrap} className={`pointer-events-none relative ${className}`} aria-hidden>
      {/* Fallback e base de luz: sempre presente, some quando o WebGL entra */}
      <div
        className={`absolute inset-0 transition-opacity duration-[1600ms] ${ready ? "opacity-40" : "opacity-100"}`}
      >
        <div className="absolute left-1/2 top-1/2 aspect-square w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(190_205_235/0.35),rgb(120_140_190/0.08)_45%,transparent_70%)] blur-[2px]" />
        <div className={`absolute left-1/2 top-1/2 aspect-square w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 ${ready ? "opacity-0" : ""}`} />
        <div className={`absolute left-1/2 top-1/2 aspect-square w-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06] ${ready ? "opacity-0" : ""}`} />
        {mode === "static" &&
          Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-ember"
              style={{
                left: `${62 + (i % 5) * 5 + i}%`,
                top: `${58 + Math.floor(i / 3) * 6 + (i % 3) * 2}%`,
                opacity: 1 - i / 15,
              }}
            />
          ))}
      </div>
      {mode === "webgl" && (
        <canvas
          ref={canvas}
          className={`absolute inset-0 h-full w-full transition-opacity duration-[1600ms] ${ready ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
