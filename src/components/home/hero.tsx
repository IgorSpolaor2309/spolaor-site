import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { ServiceIllustration } from "@/components/ui/service-illustration";
import { LEAK, SPINE, at, sample } from "@/lib/brand-geometry";

const ORANGE = "#f07a12"; // só em formas e traços; em texto usar ember (#b65205) ou #c95a06

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

/* Abertura da home: rótulo laranja, título com marca-texto laranja, fitas do "S" da logo atrás da
   ilustração (traço fino) e as soluções numeradas em laranja. O azul-claro do fundo vem do body
   (ver "Topo azul" em globals.css). No celular, a lista de soluções fica para #servicos. */
export function Hero() {
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
            <span className="marca whitespace-nowrap text-sky">facilitar o dia a dia</span>{" "}
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
