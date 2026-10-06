"use client";

import { useEffect, useRef, useState } from "react";
import { BRANCH_T, LANES, LEAK, SPINE, at, sample, type Track, type V } from "@/lib/brand-geometry";

// Assinatura do hero: as três fitas do "S" da Spolaor viram o caminho dos contatos de uma empresa.
// Contatos chegam dispersos no topo, percorrem o S e saem organizados na fita ciano (CRM).
// Parte escapa pela fita laranja, no mesmo lugar onde o laranja aparece no símbolo: são os
// clientes perdidos. Com o scroll (e um pouco sozinho, ao carregar), o fluxo é "automatizado":
// menos contatos escapam e o contador de conversão sobe.

// Fita afinando nas pontas, preenchida com gradiente: o mesmo desenho das lâminas do símbolo.
function ribbon(ctx: CanvasRenderingContext2D, tr: Track, off: number, width: number, fill: CanvasGradient | string) {
  const n = tr.pts.length;
  const L: V[] = [];
  const R: V[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const hw = (width / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.55);
    L.push(at(tr, t, off - hw));
    R.push(at(tr, t, off + hw));
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (const p of L) ctx.lineTo(p[0], p[1]);
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

type Dot = { lane: number; t: number; v: number; leak: boolean; s: number; sx: number; sy: number; off: number };

export function HeroFlow({ className = "" }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rate, setRate] = useState(61);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    const section = box?.closest("section");
    if (!el || !box || !section) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let spine: Track;
    let leak: Track;
    let gap = 0;
    let bg: HTMLCanvasElement | null = null;

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.clientWidth;
      h = box.clientHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spine = sample(SPINE, w, h, 360);
      leak = sample(LEAK, w, h, 160);
      gap = Math.min(w, h) * 0.04;

      // As fitas são estáticas: desenhadas uma vez numa camada própria.
      bg = document.createElement("canvas");
      bg.width = el.width;
      bg.height = el.height;
      const b = bg.getContext("2d")!;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g0 = b.createLinearGradient(w, 0, 0, h);
      g0.addColorStop(0, "rgba(11,42,107,0.95)");
      g0.addColorStop(1, "rgba(30,91,230,0.7)");
      const g1 = b.createLinearGradient(0, 0, w, h);
      g1.addColorStop(0, "rgba(30,91,230,0.85)");
      g1.addColorStop(0.6, "rgba(47,140,255,0.8)");
      g1.addColorStop(1, "rgba(34,211,255,0.85)");
      const g2 = b.createLinearGradient(0, h * 0.4, w * 0.4, h);
      g2.addColorStop(0, "rgba(255,138,31,0.95)");
      g2.addColorStop(1, "rgba(255,177,92,0.75)");
      ribbon(b, spine, -gap, gap * 0.9, g0);
      ribbon(b, spine, 0, gap * 0.95, g1);
      ribbon(b, spine, gap, gap * 0.55, "rgba(47,140,255,0.55)");
      ribbon(b, leak, 0, gap * 0.75, g2);
      draw();
    };

    // progresso: 0 = processo manual, 1 = automatizado
    let auto = 0;
    let fromScroll = 0;
    const progress = () => Math.max(auto, fromScroll);
    const onScroll = () => {
      fromScroll = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.6)));
    };

    const dots: Dot[] = [];
    const outcomes: boolean[] = [];
    const spawn = () => {
      const lane = LANES[Math.floor(Math.random() * 3)];
      const leakRate = 0.4 - progress() * 0.36;
      dots.push({
        lane,
        t: -0.12 - Math.random() * 0.1,
        v: 0.12 + Math.random() * 0.05,
        leak: Math.random() < leakRate,
        s: 0,
        // origem dispersa, acima e à direita da entrada do S
        sx: w * (0.62 + Math.random() * 0.4),
        sy: -h * (0.02 + Math.random() * 0.14),
        off: (Math.random() - 0.5) * gap * 0.35,
      });
    };

    function pos(d: Dot): V | null {
      if (d.t < 0) {
        const k = 1 + d.t / 0.22; // 0 → 1 enquanto se aproxima da entrada
        const e = at(spine, 0, d.lane * gap);
        const kk = Math.max(0, k);
        return [d.sx + (e[0] - d.sx) * kk * kk, d.sy + (e[1] - d.sy) * kk];
      }
      if (d.leak && d.t >= BRANCH_T) return d.s <= 1 ? at(leak, d.s, d.off) : null;
      return d.t <= 1 ? at(spine, d.t, d.lane * gap + d.off) : null;
    }

    function draw() {
      if (!bg) return;
      ctx!.clearRect(0, 0, w, h);
      ctx!.drawImage(bg, 0, 0, w, h);
      for (const d of dots) {
        const p = pos(d);
        if (!p) continue;
        const leaking = d.leak && d.t >= BRANCH_T;
        const fade = leaking ? 1 - d.s : d.t < 0 ? Math.max(0, 1 + d.t / 0.22) : 1;
        ctx!.globalAlpha = Math.max(0, Math.min(1, fade));
        ctx!.fillStyle = leaking ? "#ffd2a6" : d.t > 0.85 ? "#c9f4ff" : "#ffffff";
        ctx!.beginPath();
        ctx!.arc(p[0], p[1], leaking ? 1.8 : 2.1, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let shown = 61;
    let running = false;
    const t0 = performance.now() + 1200;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = Math.min(1, Math.max(0, (now - t0) / 3500));
      auto = 0.28 * (1 - Math.pow(1 - k, 3));

      acc += dt;
      while (acc > 0.07) {
        acc -= 0.07;
        spawn();
      }
      step(dt);
      draw();

      if (outcomes.length >= 20) {
        const target = Math.round((outcomes.filter(Boolean).length / outcomes.length) * 100);
        if (target !== shown) {
          shown += Math.sign(target - shown);
          setRate(shown);
        }
      }
    };

    function step(dt: number) {
      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i];
        if (d.leak && d.t >= BRANCH_T) d.s += dt * 0.45;
        else d.t += d.v * dt;
        const done = d.leak ? d.s > 1 : d.t > 1;
        if (done) {
          outcomes.push(!d.leak);
          if (outcomes.length > 100) outcomes.shift();
          dots.splice(i, 1);
        }
      }
    }

    const start = () => {
      if (running || reduce) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    layout();
    onScroll();
    // pré-aquece: o desenho já abre com contatos em todo o percurso
    for (let i = 0; i < 180; i++) {
      spawn();
      step(0.07);
    }
    draw();
    setLive(!reduce);
    const ro = new ResizeObserver(layout);
    ro.observe(box);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop()));
    io.observe(box);
    const onVis = () => (document.hidden ? stop() : start());
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />

      {/* Anotações do desenho, no estilo de diagrama técnico */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden font-mono text-[0.68rem] uppercase tracking-[0.14em] sm:block">
        <span className="absolute right-[3%] top-[0%] text-muted">entrada ↓ site · WhatsApp · formulário</span>
        <span className="absolute left-[38%] top-[84%] text-ember-soft">sem resposta</span>
        <span className="absolute bottom-[-1%] left-[10%] text-signal">→ CRM · em atendimento</span>
      </div>

      <p className="absolute right-[2%] top-[34%] hidden w-[11.5rem] border-l border-line-strong pl-4 xl:block" aria-live="off">
        <span className="block font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">De cada 100 contatos</span>
        <span className="mt-1 block font-[family-name:var(--font-display)] text-[2.4rem] font-semibold leading-none tracking-[-0.04em] text-fg tabular-nums">
          {rate}
        </span>
        <span className="mt-1.5 block text-sm leading-snug text-muted">viram conversa com a sua equipe.</span>
        <span className="mt-2 block font-mono text-[0.62rem] text-dim">{live ? "simulação · role a página" : "simulação"}</span>
      </p>
    </div>
  );
}
