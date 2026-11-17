import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { ServiceIllustration } from "@/components/ui/service-illustration";
import { LEAK, SPINE, at, sample } from "@/lib/brand-geometry";

// PRÉVIA TEMPORÁRIA: variações da primeira dobra da home, só para comparação (rota /previa-hero/[v]).
// Mesmo título, descrição e botão do hero atual; muda só o visual. Laranja da marca em detalhes.

const ORANGE = "#f07a12"; // só em formas e traços; em texto usar ember (#b65205) ou #c95a06

function Title({ accent = "text-sky", underline = true, className = "" }: { accent?: string; underline?: boolean; className?: string }) {
  return (
    <h1
      id="hero-title"
      className={`fade-up text-[clamp(2.1rem,1.2rem+3.4vw,4.1rem)] font-semibold tracking-[-0.045em] ${underline ? "leading-[1.12]" : "leading-[1.05]"} ${className}`}
    >
      Sites e automações para{" "}
      <span className={`relative whitespace-nowrap ${accent}`}>
        facilitar o dia a dia
        {underline && <Swoosh className="absolute -bottom-[0.12em] left-0 h-[0.22em] w-full" />}
      </span>{" "}
      da sua empresa.
    </h1>
  );
}

// Traço laranja à mão, como a fita laranja do símbolo
function Swoosh({ className = "", color = ORANGE }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 300 20" preserveAspectRatio="none" className={className} aria-hidden>
      <path d="M3 14 C 70 4, 170 3, 297 9" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function Lead({ className = "" }: { className?: string }) {
  return (
    <p className={`fade-up mt-4 max-w-[34rem] text-[1.06rem] leading-relaxed text-muted md:mt-6 md:text-lg ${className}`} style={{ animationDelay: "0.1s" }}>
      Venda pela internet, receba agendamentos e organize seu atendimento.
    </p>
  );
}

function Cta({ className = "" }: { className?: string }) {
  return (
    <div className={`fade-up mt-6 md:mt-9 ${className}`} style={{ animationDelay: "0.18s" }}>
      <ButtonLink href="#servicos" size="lg" arrow data-hero-cta className="w-full sm:w-auto">
        Conhecer as soluções
      </ButtonLink>
    </div>
  );
}

const services = [
  { href: "/sites", label: "Sites" },
  { href: "/lojas-virtuais", label: "Lojas virtuais" },
  { href: "/agendamento-online", label: "Agendamento online" },
  { href: "/automacao", label: "Automação do atendimento" },
];

// As fitas do "S" da logo, em faixas grossas (azul-marinho, royal, ciano e a laranja).
function Ribbons({
  className = "",
  w = 400,
  h = 420,
  width = 30,
  colors = ["#0b2a6b", "#1e5be6", "#22c3f0"],
  leak = ORANGE,
  opacity = 1,
  blueOpacity = 1,
}: {
  className?: string;
  w?: number;
  h?: number;
  width?: number;
  colors?: [string, string, string];
  leak?: string;
  opacity?: number;
  blueOpacity?: number;
}) {
  const spine = sample(SPINE, w, h, 160);
  const lk = sample(LEAK, w, h, 80);
  const d = (tr: typeof spine, off: number) =>
    tr.pts.map((_, i) => at(tr, i / (tr.pts.length - 1), off)).map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  const id = `rb-${colors.join("").replace(/#/g, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} fill="none" aria-hidden style={{ opacity, overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors[1]} />
          <stop offset="1" stopColor={colors[2]} />
        </linearGradient>
      </defs>
      <g opacity={blueOpacity}>
      <path d={d(spine, -width * 1.15)} stroke={colors[0]} strokeWidth={width} strokeLinecap="round" />
      <path d={d(spine, 0)} stroke={`url(#${id})`} strokeWidth={width} strokeLinecap="round" />
      <path d={d(spine, width * 1.15)} stroke={colors[2]} strokeWidth={width * 0.7} strokeLinecap="round" />
      </g>
      <path d={d(lk, 0)} stroke={leak} strokeWidth={width * 0.75} strokeLinecap="round" />
    </svg>
  );
}

const shell = "relative isolate overflow-hidden pt-[60px] sm:pt-[72px]";
const grid =
  "container-x grid items-center gap-x-12 gap-y-6 pb-8 pt-6 sm:pb-14 sm:pt-12 lg:min-h-[min(760px,calc(100svh-72px))] lg:grid-cols-12 lg:py-16";

/* A · Fitas da marca: o "S" da logo em faixas grandes saindo pela direita, atrás da ilustração. */
export function HeroA() {
  return (
    <section className={shell} aria-labelledby="hero-title">
      <Ribbons className="pointer-events-none absolute -right-[30%] top-[64%] -z-10 h-[42%] sm:top-[50%] lg:-right-[9%] lg:top-[10%] lg:h-[96%]" width={34} />
      <div className={grid}>
        <div className="lg:col-span-7">
          <p className="fade-up mb-5 flex items-center gap-3 text-[0.82rem] font-semibold uppercase tracking-[0.12em] text-ember">
            <span aria-hidden className="h-[3px] w-8 rounded-full" style={{ background: ORANGE }} />
            Spolaor Tecnologia
          </p>
          <Title className="max-w-[16ch] lg:max-w-[15ch]" />
          <Lead />
          <Cta />
        </div>
        <div className="fade-up lg:col-span-5" style={{ animationDelay: "0.26s" }}>
          <ServiceIllustration name="sites-responsivos" preload sizes="(min-width: 1024px) 38vw, 18rem" className="mx-auto w-full max-w-[17rem] drop-shadow-[0_30px_40px_rgb(11_42_107/0.18)] sm:max-w-[22rem] lg:max-w-none" />
        </div>
      </div>
    </section>
  );
}

/* B · Painel azul: a ilustração apoiada num bloco royal, com as fitas em traço branco e um canto laranja. */
export function HeroB() {
  return (
    <section className={shell} aria-labelledby="hero-title">
      <div className={grid}>
        <div className="lg:col-span-6">
          <Title className="max-w-[16ch]" underline={false} accent="text-sky" />
          <Lead />
          <Cta />
          <ul className="fade-up mt-8 hidden flex-wrap gap-x-6 gap-y-2 text-[0.95rem] text-muted sm:flex" style={{ animationDelay: "0.22s" }}>
            {services.map((s) => (
              <li key={s.href} className="flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: ORANGE }} />
                <Link href={s.href} className="hover:text-fg">{s.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="fade-up relative lg:col-span-6" style={{ animationDelay: "0.26s" }}>
          <div className="relative overflow-hidden rounded-[22px] bg-royal px-6 pb-6 pt-8 sm:rounded-[28px] sm:px-10 sm:pt-12 lg:px-12 lg:pb-10 lg:pt-16">
            <Ribbons className="absolute -right-[10%] -top-[12%] h-[130%]" width={22} colors={["#3f78f0", "#5b8ef5", "#2f6fe8"]} leak="#ff9a3c" blueOpacity={0.6} />
            <span aria-hidden className="absolute left-0 top-0 h-2 w-24 rounded-br-[10px]" style={{ background: ORANGE }} />
            <ServiceIllustration name="sites-responsivos" preload sizes="(min-width: 1024px) 40vw, 18rem" className="relative mx-auto w-full max-w-[16rem] sm:max-w-[22rem] lg:max-w-none" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* C · Céu claro: fundo azul-claro que desce para o gesso, palavra em destaque marcada em laranja. */
export function HeroC() {
  return (
    <section className={`${shell} bg-linear-to-b from-[#dce8fc] via-[#eaf0fb] to-ink-950`} aria-labelledby="hero-title">
      <Ribbons className="pointer-events-none absolute -right-[14%] top-[8%] -z-10 hidden h-[95%] lg:block" width={30} colors={["#c6d7f7", "#d3e1fa", "#c9e3f6"]} leak="#f9c999" />
      <div className={grid}>
        <div className="lg:col-span-7">
          <h1 id="hero-title" className="fade-up max-w-[16ch] text-[clamp(2.1rem,1.2rem+3.4vw,4.1rem)] font-semibold leading-[1.05] tracking-[-0.045em] lg:max-w-[15ch]">
            Sites e automações para{" "}
            <span className="whitespace-nowrap bg-[linear-gradient(transparent_62%,rgb(240_122_18/0.35)_62%,rgb(240_122_18/0.35)_92%,transparent_92%)] text-navy">facilitar o dia a dia</span>{" "}
            da sua empresa.
          </h1>
          <Lead />
          <Cta />
        </div>
        <div className="fade-up lg:col-span-5" style={{ animationDelay: "0.26s" }}>
          <div className="relative mx-auto max-w-[17rem] sm:max-w-[22rem] lg:max-w-none">
            <span aria-hidden className="absolute inset-x-[8%] bottom-[2%] h-[14%] rounded-[50%] bg-navy/10 blur-md" />
            <ServiceIllustration name="sites-responsivos" preload sizes="(min-width: 1024px) 38vw, 18rem" className="relative w-full" />
          </div>
          <ol className="mt-4 hidden grid-cols-2 gap-x-6 gap-y-2 border-t border-[#c9d6ee] pt-4 text-[0.92rem] text-fg lg:grid">
            {services.map((s, i) => (
              <li key={s.href} className="flex items-baseline gap-2">
                <span className="font-mono text-[0.75rem] text-ember">0{i + 1}</span>
                <Link href={s.href} className="hover:text-sky">{s.label}</Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* D · Editorial: sem ilustração; título grande e a lista numerada das soluções, números em laranja. */
export function HeroD() {
  return (
    <section className={shell} aria-labelledby="hero-title">
      <Ribbons className="pointer-events-none absolute right-[3%] top-[11%] -z-10 hidden h-[24%] xl:block" width={22} />
      <div className="container-x grid gap-x-16 gap-y-8 pb-10 pt-8 sm:pb-14 sm:pt-14 lg:min-h-[min(760px,calc(100svh-72px))] lg:grid-cols-12 lg:items-center lg:py-16">
        <div className="lg:col-span-7">
          <p className="fade-up mb-6 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-ember">● Spolaor Tecnologia</p>
          <Title className="max-w-[15ch] lg:text-[clamp(3rem,1rem+4vw,4.8rem)]" />
          <Lead />
          <Cta />
        </div>
        <nav aria-label="Soluções" className="fade-up lg:col-span-5" style={{ animationDelay: "0.26s" }}>
          <ol className="border-t border-line-strong">
            {[...services, { href: "/diagnostico-site", label: "Diagnóstico do seu site" }].map((s, i) => (
              <li key={s.href} className="border-b border-line-strong">
                <Link href={s.href} className="group flex items-center gap-4 py-3 sm:py-4">
                  <span className="w-7 font-mono text-[0.8rem] text-ember">0{i + 1}</span>
                  <span className="flex-1 font-display text-[1.05rem] font-medium tracking-[-0.02em] text-fg sm:text-[1.3rem]">{s.label}</span>
                  <span aria-hidden className="text-royal transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  );
}

/* E · Palco central: tudo centralizado e a ilustração sobre um palco azul com arcos laranja. */
export function HeroE() {
  return (
    <section className={shell} aria-labelledby="hero-title">
      <div className="container-x flex flex-col items-center pb-0 pt-8 text-center sm:pt-14 lg:pt-16">
        <p className="fade-up mb-5 inline-flex items-center gap-2 text-[0.85rem] font-medium text-muted">
          {services.map((s, i) => (
            <span key={s.href} className={`items-center gap-2 ${i > 1 ? "hidden sm:inline-flex" : "inline-flex"}`}>
              {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full" style={{ background: ORANGE }} />}
              {s.label}
            </span>
          ))}
        </p>
        <Title className="max-w-[18ch] lg:max-w-[22ch]" />
        <Lead className="mx-auto" />
        <Cta />
        <div className="fade-up relative mt-8 w-full max-w-[60rem] sm:mt-12" style={{ animationDelay: "0.26s" }}>
          <div aria-hidden className="absolute inset-x-0 bottom-0 top-[30%] rounded-t-[28px] bg-royal sm:rounded-t-[40px]">
            <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <path d="M-20 170 C 160 40, 300 30, 420 120" stroke={ORANGE} strokeWidth="10" fill="none" strokeLinecap="round" />
              <path d="M520 190 C 620 60, 720 40, 830 70" stroke="#22c3f0" strokeWidth="10" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <ServiceIllustration name="sites-responsivos" preload sizes="(min-width: 1024px) 44rem, 20rem" className="relative mx-auto w-full max-w-[19rem] pb-4 sm:max-w-[34rem] lg:max-w-[40rem]" />
        </div>
      </div>
    </section>
  );
}

/* F · Gesso quente: base pêssego clara, laranja como cor de ambiente e azul só na ação. */
export function HeroF() {
  return (
    <section className={`${shell} bg-[#fbefe2]`} aria-labelledby="hero-title">
      <Ribbons className="pointer-events-none absolute -right-[30%] top-[66%] -z-10 h-[40%] sm:top-[50%] lg:-right-[8%] lg:top-[12%] lg:h-[94%]" width={34} colors={["#f07a12", "#ff9a3c", "#ffc078"]} leak="#1e5be6" />
      <div className={grid}>
        <div className="lg:col-span-7">
          <Title className="max-w-[16ch] lg:max-w-[15ch]" accent="text-sky" underline={false} />
          <Lead className="text-[#5b4a3c]" />
          <Cta />
          <p className="fade-up mt-6 hidden text-[0.95rem] text-[#5b4a3c] sm:block" style={{ animationDelay: "0.22s" }}>
            {services.map((s) => s.label).join("  ·  ")}
          </p>
        </div>
        <div className="fade-up lg:col-span-5" style={{ animationDelay: "0.26s" }}>
          <div className="relative mx-auto max-w-[17rem] sm:max-w-[22rem] lg:max-w-none">
            <span aria-hidden className="absolute left-1/2 top-1/2 -z-10 aspect-square w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
            <ServiceIllustration name="sites-responsivos" preload sizes="(min-width: 1024px) 38vw, 18rem" className="w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* G · Mistura: céu claro (C), rótulo laranja (A), marca-texto laranja (C), fitas grandes da marca (A)
   com círculo claro atrás da ilustração (F) e soluções numeradas em laranja com link (C/D). */
export function HeroG() {
  return (
    <section className={shell} aria-labelledby="hero-title">
      <Ribbons className="pointer-events-none absolute right-[4%] top-[63%] -z-10 h-[35%] sm:right-[8%] sm:top-[50%] lg:right-[3%] lg:top-[14%] lg:h-[78%]" width={14} blueOpacity={0.5} />
      <div className={grid}>
        <div className="lg:col-span-7">
          <p className="fade-up mb-5 flex items-center gap-3 text-[0.82rem] font-semibold uppercase tracking-[0.12em] text-ember">
            <span aria-hidden className="h-[3px] w-8 rounded-full" style={{ background: ORANGE }} />
            Spolaor Tecnologia
          </p>
          <h1 id="hero-title" className="fade-up max-w-[16ch] text-[clamp(2.1rem,1.2rem+3.4vw,4.1rem)] font-semibold leading-[1.05] tracking-[-0.045em] lg:max-w-[15ch]">
            Sites e automações para{" "}
            <span className="whitespace-nowrap bg-[linear-gradient(transparent_62%,rgb(240_122_18/0.35)_62%,rgb(240_122_18/0.35)_92%,transparent_92%)] text-sky">facilitar o dia a dia</span>{" "}
            da sua empresa.
          </h1>
          <Lead />
          <Cta />
          <ol className="fade-up mt-8 hidden max-w-[34rem] grid-cols-2 gap-x-6 gap-y-2 border-t border-[#c9d6ee] pt-4 text-[0.95rem] text-fg sm:grid" style={{ animationDelay: "0.22s" }}>
            {services.map((s, i) => (
              <li key={s.href} className="flex items-baseline gap-2">
                <span className="font-mono text-[0.75rem] text-ember">0{i + 1}</span>
                <Link href={s.href} className="hover:text-sky">{s.label}</Link>
              </li>
            ))}
          </ol>
        </div>
        <div className="fade-up lg:col-span-5" style={{ animationDelay: "0.26s" }}>
          <div className="relative mx-auto max-w-[17rem] sm:max-w-[22rem] lg:max-w-none">
            <span aria-hidden className="absolute left-1/2 top-1/2 -z-10 aspect-square w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85" />
            <ServiceIllustration name="sites-responsivos" preload sizes="(min-width: 1024px) 38vw, 18rem" className="w-full drop-shadow-[0_30px_40px_rgb(11_42_107/0.18)]" />
          </div>
        </div>
      </div>
    </section>
  );
}

export const heroVariants = { a: HeroA, b: HeroB, c: HeroC, d: HeroD, e: HeroE, f: HeroF, g: HeroG } as const;
