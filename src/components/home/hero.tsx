import { HeroCore } from "@/components/three/hero-core";
import { ButtonLink } from "@/components/ui/button";

const words = ["Quanto", "sua", "empresa", "perde"];

const points = [
  {
    n: "01",
    tone: "ember",
    title: "Na apresentação",
    text: "Um site que não transmite confiança custa clientes que você nunca vai saber que perdeu.",
  },
  {
    n: "02",
    tone: "ember",
    title: "Na operação",
    text: "Cada tarefa repetida à mão é salário, tempo e atenção que poderiam estar gerando receita.",
  },
  {
    n: "03",
    tone: "signal",
    title: "Na tecnologia certa",
    text: "Ela corrige os dois lados e permite crescer sem aumentar a estrutura na mesma proporção.",
  },
] as const;

function Signal({ tone, label, meta, className, delay }: { tone: "ember" | "signal"; label: string; meta: string; className: string; delay: number }) {
  return (
    <div className={`fade-up absolute hidden lg:block ${className}`} style={{ animationDelay: `${delay}s` }}>
      <div className="float-y glass flex items-center gap-3 rounded-2xl bg-ink-900/60 py-2.5 pl-3 pr-4 shadow-2xl shadow-black/50" style={{ animationDelay: `${delay}s` }}>
        <span className={`relative grid h-7 w-7 place-items-center rounded-lg ${tone === "ember" ? "bg-ember/15" : "bg-signal/15"}`}>
          <span className={`h-1.5 w-1.5 animate-pulse-dot rounded-full ${tone === "ember" ? "bg-ember" : "bg-signal"}`} />
        </span>
        <span className="leading-tight">
          <span className="block text-[0.82rem] text-fg">{label}</span>
          <span className="block font-mono text-[0.68rem] text-dim">{meta}</span>
        </span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="noise relative isolate overflow-hidden pt-[72px]" aria-labelledby="hero-title">
      {/* Fundo: grid técnico + luz */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid mask-radial absolute inset-0 opacity-70" />
        <div className="absolute -top-40 right-[-10%] h-[720px] w-[720px] rounded-full bg-[radial-gradient(circle,rgb(143_180_255/0.16),transparent_60%)]" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgb(255_107_61/0.08),transparent_60%)]" />
      </div>

      <div className="container-x relative">
        <div className="relative grid min-h-[min(860px,calc(100svh-72px))] grid-cols-1 items-center lg:grid-cols-12">
          {/* Núcleo 3D */}
          <div className="pointer-events-none absolute inset-x-[-25%] top-[-2%] h-[300px] opacity-70 sm:h-[480px] lg:inset-x-auto lg:right-[-8%] lg:top-1/2 lg:h-[820px] lg:w-[64%] lg:-translate-y-1/2 lg:opacity-100">
            <HeroCore className="h-full w-full" />
            <Signal tone="ember" label="Visitante saiu sem pedir orçamento" meta="8s no site · sem contato" className="left-[6%] top-[24%]" delay={1.2} />
            <Signal tone="ember" label="Planilha atualizada à mão" meta="4ª vez hoje · 2h40 no mês" className="right-[10%] top-[60%]" delay={1.5} />
            <Signal tone="signal" label="Lead registrado e respondido" meta="automático · 3s" className="bottom-[14%] left-[16%]" delay={1.8} />
          </div>

          <div className="relative z-10 pb-10 pt-[285px] sm:pt-[340px] lg:col-span-8 lg:pb-0 lg:pt-0">
            <p className="fade-up eyebrow flex items-center gap-3" style={{ animationDelay: "0.05s" }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ember" />
              </span>
              Diagnóstico de presença digital e operação
            </p>

            <h1 id="hero-title" className="mt-7 text-display font-medium">
              <span className="sr-only">Quanto sua empresa perde sem perceber?</span>
              <span aria-hidden>
                {words.map((w, i) => (
                  <span key={w} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                    <span className="rise text-gradient" style={{ animationDelay: `${0.12 + i * 0.07}s` }}>
                      {w}
                    </span>
                    &nbsp;
                  </span>
                ))}
                <br />
                <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
                  <span className="rise serif-accent pr-2 text-ember" style={{ animationDelay: "0.45s" }}>
                    sem perceber?
                  </span>
                </span>
              </span>
            </h1>

            <p className="fade-up mt-8 max-w-xl text-lg leading-relaxed text-muted md:text-xl" style={{ animationDelay: "0.6s" }}>
              Clientes desistem antes de conhecer seu produto. Equipes gastam horas no que poderia acontecer sozinho.
              A <span className="text-fg">Spolaor</span> encontra esses dois prejuízos e usa tecnologia para fechá-los.
            </p>

            <div className="fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "0.75s" }}>
              <ButtonLink href="/analise" size="lg" arrow>
                Analisar meu site grátis
              </ButtonLink>
              <ButtonLink href="/contato" variant="secondary" size="lg">
                Falar sobre meu projeto
              </ButtonLink>
            </div>
            <p className="fade-up mt-4 text-sm text-dim" style={{ animationDelay: "0.85s" }}>
              Análise sem custo e sem compromisso. Você recebe os pontos de melhoria do seu site.
            </p>
          </div>
        </div>

        <ol className="relative z-10 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-3">
          {points.map((p, i) => (
            <li key={p.n} className="fade-up bg-ink-950/80 p-6 backdrop-blur md:p-7" style={{ animationDelay: `${0.95 + i * 0.1}s` }}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-dim">{p.n}</span>
                <span className={`h-px flex-1 ${p.tone === "ember" ? "bg-gradient-to-r from-ember/60 to-transparent" : "bg-gradient-to-r from-signal/70 to-transparent"}`} />
              </div>
              <h2 className={`mt-4 text-[1.05rem] font-medium ${p.tone === "signal" ? "text-signal" : "text-fg"}`}>{p.title}</h2>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{p.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
