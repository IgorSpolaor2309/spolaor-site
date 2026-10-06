import { HeroCore } from "@/components/three/hero-core";
import { ButtonLink } from "@/components/ui/button";

// Headline em duas vozes: a pergunta (branco, com "perde" em laranja) e o complemento (azul da marca).
const lineA = ["Quantos", "clientes", "sua", "empresa", "perde"];
const lineB = ["antes", "mesmo", "de", "falar", "com", "eles?"];

const points = [
  {
    n: "01",
    tone: "ember",
    title: "Presença digital que afasta",
    text: "Site lento, confuso ou pouco confiável faz o cliente desistir antes de pedir orçamento, e você nem fica sabendo.",
  },
  {
    n: "02",
    tone: "ember",
    title: "Operação que consome margem",
    text: "Planilhas, retrabalho e respostas atrasadas ocupam horas da equipe que deveriam virar atendimento e venda.",
  },
  {
    n: "03",
    tone: "signal",
    title: "Tecnologia que resolve os dois",
    text: "Sites que convertem e automações que conectam leads, processos e equipe, sem aumentar a estrutura.",
  },
] as const;

// Cada card mostra uma perda e, quando a estrutura se organiza (--p passa de `at`), vira a solução.
const flows = [
  {
    at: 0.18,
    lost: { label: "Visitante saiu sem pedir orçamento", meta: "8s no site · nenhum contato" },
    won: { label: "Pedido de orçamento recebido", meta: "pelo site · CTA claro" },
    className: "left-[2%] top-[17%]",
    delay: 1.1,
  },
  {
    at: 0.42,
    lost: { label: "Lead sem resposta há 2 dias", meta: "WhatsApp · esfriando" },
    won: { label: "Resposta automática enviada", meta: "em 3s · 24h por dia" },
    className: "right-[9%] top-[33%]",
    delay: 1.3,
  },
  {
    at: 0.62,
    lost: { label: "Planilha atualizada à mão", meta: "4ª vez hoje · 2h40 no mês" },
    won: { label: "Lead registrado no CRM", meta: "automático · sem digitação" },
    className: "left-[8%] top-[63%]",
    delay: 1.5,
  },
  {
    at: 0.8,
    lost: { label: "Oportunidade esquecida", meta: "sem follow-up · perdida" },
    won: { label: "Oportunidade acompanhada", meta: "etapa 3 de 5 · lembrete ativo" },
    className: "bottom-[8%] right-[12%]",
    delay: 1.7,
  },
];

// Opacidade dirigida pelo progresso da cena: 0 antes de `at`, 1 logo depois.
const won = (at: number) => `clamp(0, calc((var(--p, 0) - ${at}) * 25), 1)`;
const lost = (at: number) => `clamp(0, calc(1 - (var(--p, 0) - ${at}) * 25), 1)`;

function Badge({ tone }: { tone: "ember" | "signal" }) {
  return tone === "ember" ? (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ember/30 bg-ember/10">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ember" aria-hidden>
        <path d="M8 3.2v5.3M8 11.3v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  ) : (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-signal/35 bg-signal/10">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-signal" aria-hidden>
        <path d="M3.5 8.4l2.8 2.8 6.2-6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </span>
  );
}

function FlowCard({ f }: { f: (typeof flows)[number] }) {
  return (
    <div className={`fade-up absolute hidden lg:block ${f.className}`} style={{ animationDelay: `${f.delay}s` }}>
      <div className="float-y grid" style={{ animationDelay: `${f.delay}s` }}>
        {(["lost", "won"] as const).map((k) => {
          const item = f[k];
          const isWon = k === "won";
          return (
            <div
              key={k}
              className={`col-start-1 row-start-1 flex w-[288px] items-center gap-3 rounded-2xl border py-2.5 pl-2.5 pr-4 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.7)] backdrop-blur-xl transition-opacity duration-500 ${
                isWon
                  ? "border-signal/30 bg-[linear-gradient(180deg,rgb(14_40_80/0.86),rgb(8_18_40/0.86))]"
                  : "border-ember/25 bg-[linear-gradient(180deg,rgb(30_22_24/0.86),rgb(12_14_26/0.86))]"
              }`}
              style={{ opacity: isWon ? won(f.at) : lost(f.at) }}
            >
              <Badge tone={isWon ? "signal" : "ember"} />
              <span className="leading-tight">
                <span className="block text-[0.86rem] font-semibold text-fg">{item.label}</span>
                <span className={`mt-1 block font-mono text-[0.7rem] ${isWon ? "text-signal/80" : "text-ember-soft/80"}`}>
                  {item.meta}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Leitura do estado da cena, abaixo da esfera: "dispersa" vira "conectada" junto com o 3D.
function SceneStatus() {
  return (
    <div className="fade-up absolute bottom-[1%] left-1/2 hidden -translate-x-1/2 lg:block" style={{ animationDelay: "1.9s" }}>
      <div className="flex items-center gap-3 rounded-full border border-line-strong bg-ink-900/70 py-2 pl-3 pr-4 backdrop-blur-xl">
        <span className="grid font-mono text-[0.68rem] uppercase tracking-[0.14em]">
          <span className="col-start-1 row-start-1 flex items-center gap-2 text-ember-soft" style={{ opacity: lost(0.85) }}>
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-ember" />
            Operação dispersa
          </span>
          <span className="col-start-1 row-start-1 flex items-center gap-2 text-signal" style={{ opacity: won(0.85) }}>
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            Operação conectada
          </span>
        </span>
        <span className="relative h-1 w-24 overflow-hidden rounded-full bg-white/10">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#ff8a1f,#2f8cff_55%,#22d3ff)]"
            style={{ width: "calc(var(--p, 0) * 100%)" }}
          />
        </span>
        <span className="font-mono text-[0.68rem] text-dim" style={{ opacity: lost(0.5) }}>
          role ↓
        </span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="noise relative isolate overflow-hidden pt-[72px]" aria-labelledby="hero-title">
      {/* Fundo: grid técnico + luzes nas cores da marca */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid mask-radial absolute inset-0 opacity-70" />
        <div className="absolute -top-48 right-[-12%] h-[820px] w-[820px] rounded-full bg-[radial-gradient(circle,rgb(30_91_230/0.28),transparent_62%)]" />
        <div className="absolute right-[8%] top-[30%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgb(34_211_255/0.10),transparent_65%)]" />
        <div className="absolute bottom-[-25%] left-[-12%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgb(255_138_31/0.08),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-950" />
      </div>

      <div className="container-x relative">
        <div className="relative grid min-h-[min(900px,calc(100svh-72px))] grid-cols-1 items-center lg:grid-cols-12">
          {/* Núcleo 3D: a operação da empresa, de dispersa a conectada */}
          <div className="pointer-events-none absolute inset-x-[-25%] top-[-2%] h-[300px] opacity-70 sm:h-[480px] lg:inset-x-auto lg:right-[-9%] lg:top-1/2 lg:h-[800px] lg:w-[60%] lg:-translate-y-1/2 lg:opacity-100">
            <HeroCore className="h-full w-full" />
            {flows.map((f) => (
              <FlowCard key={f.lost.label} f={f} />
            ))}
            <SceneStatus />
          </div>

          <div className="relative z-10 pb-10 pt-[285px] sm:pt-[340px] lg:col-span-7 lg:pb-0 lg:pt-0">
            <p className="fade-up flex items-center gap-3 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-sky" style={{ animationDelay: "0.05s" }}>
              <span className="h-px w-8 bg-gradient-to-r from-transparent to-sky" />
              Sites de alta conversão · Automação de processos
            </p>

            <h1 id="hero-title" className="mt-7 text-[clamp(2.3rem,1rem+3.9vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
              <span className="sr-only">Quantos clientes sua empresa perde antes mesmo de falar com eles?</span>
              <span aria-hidden>
                {lineA.map((w, i) => (
                  <span key={w} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
                    <span
                      className={`rise ${w === "perde" ? "text-ember drop-shadow-[0_0_28px_rgb(255_138_31/0.35)]" : "text-gradient"}`}
                      style={{ animationDelay: `${0.12 + i * 0.06}s` }}
                    >
                      {w}
                    </span>
                    &nbsp;
                  </span>
                ))}
                <br className="hidden sm:block" />
                {lineB.map((w, i) => (
                  <span key={w} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
                    <span className="rise text-brand" style={{ animationDelay: `${0.45 + i * 0.05}s` }}>
                      {w}
                    </span>
                    &nbsp;
                  </span>
                ))}
              </span>
            </h1>

            <p className="fade-up mt-8 max-w-[38rem] text-lg leading-relaxed text-muted md:text-[1.2rem]" style={{ animationDelay: "0.7s" }}>
              Um site fraco afasta o cliente antes do primeiro contato. Processos manuais consomem horas da equipe e
              travam o crescimento. A <span className="font-semibold text-fg">Spolaor</span> resolve os dois lados:{" "}
              <span className="text-fg">presença digital que converte</span> e{" "}
              <span className="text-fg">automação que reduz custo operacional</span>.
            </p>

            <div className="fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "0.82s" }}>
              <ButtonLink href="/analise" size="lg" arrow>
                Solicitar análise do meu site
              </ButtonLink>
              <ButtonLink href={{ pathname: "/contato", query: { interesse: "Automação" } }} variant="secondary" size="lg">
                <span className="flex items-center gap-2.5">
                  <svg viewBox="0 0 16 16" className="h-4 w-4 text-signal" aria-hidden>
                    <path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8l1-5.5Z" fill="currentColor" />
                  </svg>
                  Quero automatizar minha empresa
                </span>
              </ButtonLink>
            </div>
            <p className="fade-up mt-5 max-w-[36rem] text-sm leading-relaxed text-dim" style={{ animationDelay: "0.9s" }}>
              Você recebe um diagnóstico objetivo: o que está afastando clientes no seu site e quais rotinas podem ser
              automatizadas.
            </p>
          </div>
        </div>

        <ol className="relative z-10 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-3">
          {points.map((p, i) => (
            <li key={p.n} className="fade-up bg-ink-950/85 p-6 backdrop-blur md:p-7" style={{ animationDelay: `${1 + i * 0.1}s` }}>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-xs ${p.tone === "signal" ? "text-signal" : "text-ember-soft"}`}>{p.n}</span>
                <span className={`h-px flex-1 ${p.tone === "ember" ? "bg-gradient-to-r from-ember/50 to-transparent" : "bg-gradient-to-r from-signal/70 to-transparent"}`} />
              </div>
              <h2 className={`mt-4 text-[1.05rem] font-semibold tracking-[-0.02em] ${p.tone === "signal" ? "text-brand" : "text-fg"}`}>{p.title}</h2>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{p.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
