"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { ButtonLink } from "@/components/ui/button";

type Zone = "hero" | "offer" | "proof" | "cta" | "mobile" | "speed";

const criteria: { zone: Zone; title: string; a: string; b: string }[] = [
  {
    zone: "hero",
    title: "Os primeiros 5 segundos",
    a: "Logo grande e slogan vago. O visitante não entende o que a empresa faz.",
    b: "Diz o que faz, para quem e qual resultado entrega, logo na primeira dobra.",
  },
  {
    zone: "offer",
    title: "Clareza da oferta",
    a: "Texto institucional sobre a história da empresa, sem falar do problema do cliente.",
    b: "Benefícios concretos, organizados na ordem em que o cliente toma a decisão.",
  },
  {
    zone: "proof",
    title: "Prova e credibilidade",
    a: "Nenhum depoimento, número ou sinal de que outras pessoas confiaram.",
    b: "Avaliações, clientes atendidos e garantias visíveis antes da pergunta surgir.",
  },
  {
    zone: "cta",
    title: "Próximo passo",
    a: "Um “Fale conosco” perdido no rodapé.",
    b: "Uma ação clara e repetida nos pontos certos, com WhatsApp e formulário.",
  },
  {
    zone: "mobile",
    title: "Experiência no celular",
    a: "Texto pequeno, botões apertados e imagens cortadas.",
    b: "Pensado primeiro para o celular, onde a maioria das visitas acontece.",
  },
  {
    zone: "speed",
    title: "Velocidade",
    a: "Demora para abrir. Parte dos visitantes desiste antes de ver a página.",
    b: "Carrega rápido, inclusive no 4G.",
  },
];

function zoneClass(active: Zone, zone: Zone, good: boolean) {
  if (active !== zone) return "ring-0";
  return good
    ? "ring-2 ring-signal/80 ring-offset-2 ring-offset-ink-850"
    : "ring-2 ring-ember/80 ring-offset-2 ring-offset-ink-850";
}

function SiteA({ active }: { active: Zone }) {
  const z = (k: Zone) => `rounded transition-all duration-500 ${zoneClass(active, k, false)}`;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-ink-850" aria-hidden>
      <Chrome url="empresa-a.com.br" />
      <div className="p-4">
        <div className={`${z("hero")} p-1`}>
          <div className="text-center font-serif text-[0.85rem] tracking-[0.3em] text-fg/50">EMPRESA A</div>
          <div className="mt-1 text-center text-[0.55rem] italic text-fg/30">Qualidade e compromisso desde 1998</div>
          <div className="mt-2 h-14 rounded bg-gradient-to-r from-fg/[0.05] to-fg/[0.09]" />
        </div>
        <div className={`${z("offer")} mt-3 space-y-1 p-1`}>
          {[100, 97, 99, 94, 98].map((w, i) => (
            <span key={i} className="block h-1 rounded bg-fg/10" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className={`${z("proof")} mt-3 grid h-7 place-items-center p-1`}>
          <span className="text-[0.5rem] text-fg/20">—</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div className={`${z("mobile")} flex h-12 w-7 items-start justify-center rounded-md border border-fg/15 p-0.5`}>
            <span className="h-1 w-full rounded-sm bg-fg/15" />
          </div>
          <div className={`${z("speed")} px-1.5 py-0.5 font-mono text-[0.55rem] text-ember`}>7,8s</div>
          <span className={`${z("cta")} px-1.5 py-0.5 text-[0.5rem] text-fg/30 underline`}>Fale conosco</span>
        </div>
      </div>
    </div>
  );
}

function SiteB({ active }: { active: Zone }) {
  const z = (k: Zone) => `rounded-lg transition-all duration-500 ${zoneClass(active, k, true)}`;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-ink-850" aria-hidden>
      <Chrome url="empresa-b.com.br" />
      <div className="p-4">
        <div className={`${z("hero")} p-1.5`}>
          <div className="flex items-center gap-1 text-[0.55rem] font-semibold">
            <span className="h-2 w-2 rounded-sm bg-signal" />
            Empresa B
          </div>
          <p className="mt-1.5 text-[0.8rem] font-semibold leading-tight tracking-tight">Resolva X em 48h, com garantia.</p>
          <span className="mt-1 block h-1 w-[80%] rounded bg-fg/15" />
        </div>
        <div className={`${z("offer")} mt-2 grid grid-cols-3 gap-1.5 p-1`}>
          {["Rápido", "Garantido", "Sem custo extra"].map((t) => (
            <span key={t} className="rounded border border-line bg-fg/[0.04] px-1 py-1 text-center text-[0.45rem] text-muted">
              {t}
            </span>
          ))}
        </div>
        <div className={`${z("proof")} mt-2 flex items-center justify-between p-1`}>
          <span className="text-[0.5rem] text-signal">★★★★★</span>
          <span className="text-[0.5rem] text-muted">4,9 · 312 avaliações</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div className={`${z("mobile")} flex h-12 w-7 flex-col gap-0.5 rounded-md border border-fg/25 p-0.5`}>
            <span className="h-1 w-full rounded-sm bg-fg/40" />
            <span className="h-0.5 w-3/4 rounded-sm bg-fg/20" />
            <span className="mt-auto h-1.5 w-full rounded-sm bg-signal" />
          </div>
          <div className={`${z("speed")} px-1.5 py-0.5 font-mono text-[0.55rem] text-signal`}>1,1s</div>
          <span className={`${z("cta")} rounded-full bg-signal px-2.5 py-1 text-[0.5rem] font-semibold text-ink-950`}>Pedir proposta</span>
        </div>
      </div>
    </div>
  );
}

function Chrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-1 border-b border-line px-3 py-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-fg/15" />
      <span className="h-1.5 w-1.5 rounded-full bg-fg/15" />
      <span className="h-1.5 w-1.5 rounded-full bg-fg/15" />
      <span className="ml-2 font-mono text-[0.55rem] text-dim">{url}</span>
    </div>
  );
}

export function SameProduct({ index = "02", label = "Sites", showLink = true }: { index?: string; label?: string; showLink?: boolean }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const zone = criteria[active].zone;

  return (
    <section className="relative border-t border-line py-24 md:py-32" aria-labelledby="same-title">
      <div className="container-x">
        <Reveal className="max-w-4xl">
          <SectionLabel index={index} tone="ember">{label}</SectionLabel>
          <h2 id="same-title" className="mt-8 max-w-[16ch] text-h2 font-semibold">
            Mesmo produto. Mesmo preço. <span className="text-sky">O cliente escolheu a outra.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Seu produto pode não ser o problema. Duas empresas com ofertas parecidas raramente perdem pelo que vendem. Perdem
            pela forma como se apresentam no momento em que o cliente compara.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-10 lg:grid-cols-12 lg:gap-16">
          {/* Mockups fixos no desktop, no topo no mobile */}
          <div className="sticky top-[84px] z-10 -mx-5 bg-ink-950/85 px-5 py-3 backdrop-blur-md lg:top-[18vh] lg:col-span-7 lg:mx-0 lg:self-start lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="grid grid-cols-2 gap-3 md:gap-5">
              <div>
                <p className="mb-2 flex items-center gap-2 text-[0.75rem] text-dim md:text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-ember" /> Empresa A
                </p>
                <SiteA active={zone} />
              </div>
              <div>
                <p className="mb-2 flex items-center gap-2 text-[0.75rem] text-dim md:text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Empresa B
                </p>
                <SiteB active={zone} />
              </div>
            </div>
            <div className="mt-4 hidden items-center gap-1.5 lg:flex" aria-hidden>
              {criteria.map((c, i) => (
                <span key={c.zone} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= active ? "bg-fg/70" : "bg-fg/10"}`} />
              ))}
            </div>
          </div>

          <ol className="lg:col-span-5">
            {criteria.map((c, i) => (
              <li
                key={c.zone}
                data-index={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={`flex min-h-[46vh] flex-col justify-center border-l py-10 pl-6 transition-colors duration-500 md:pl-8 lg:min-h-[58vh] ${
                  active === i ? "border-fg/60" : "border-line"
                }`}
              >
                <span className="font-mono text-xs text-dim">0{i + 1} / 0{criteria.length}</span>
                <h3 className={`mt-3 text-h3 font-medium transition-opacity duration-500 ${active === i ? "opacity-100" : "opacity-55"}`}>{c.title}</h3>
                <div className={`mt-6 grid gap-4 transition-opacity duration-500 ${active === i ? "opacity-100" : "opacity-45"}`}>
                  <p className="flex gap-3 text-[0.98rem] leading-relaxed text-muted">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" aria-hidden />
                    <span>
                      <span className="sr-only">Empresa A: </span>
                      {c.a}
                    </span>
                  </p>
                  <p className="flex gap-3 text-[0.98rem] leading-relaxed text-fg">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" aria-hidden />
                    <span>
                      <span className="sr-only">Empresa B: </span>
                      {c.b}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-16 grid gap-5 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <p className="text-h3 font-medium">
              O cliente não comparou os produtos.{" "}
              <span className="text-muted">Comparou as empresas pela forma como apareceram.</span>
            </p>
            {showLink && (
              <div className="mt-8">
                <ButtonLink href="/sites" variant="secondary" arrow>
                  Como construímos sites que convertem
                </ButtonLink>
              </div>
            )}
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5">
            <aside className="border-l-2 border-ember pl-6">
              <p className="eyebrow">E o Instagram?</p>
              <p className="mt-4 text-lg leading-relaxed">
                Ótimo para ser lembrado. Mas o algoritmo decide quem vê, o perfil não é seu, e uma decisão de compra pede mais que
                um feed: oferta clara, prova, contato direto e um endereço que transmite seriedade.
              </p>
              <p className="mt-4 text-muted">Instagram atrai. O site convence.</p>
            </aside>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
