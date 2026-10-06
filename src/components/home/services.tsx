import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";
import { SpotlightCard } from "@/components/ui/spotlight-card";

function CardHead({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="relative z-10">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-dim">{n}</span>
        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full border border-line-strong text-muted transition-all duration-500 group-hover:rotate-[-45deg] group-hover:border-signal group-hover:bg-signal group-hover:text-ink-950">
          <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <h3 className="mt-6 text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem]">{title}</h3>
      <p className="mt-3 max-w-md text-muted">{text}</p>
    </div>
  );
}

function SitesVisual() {
  return (
    <div aria-hidden className="relative mt-10 h-56 md:h-64">
      <div className="absolute inset-x-0 bottom-[-30px] mx-auto w-[92%] rounded-t-2xl border border-line-strong bg-ink-850 p-4 transition-transform duration-700 ease-out-expo group-hover:-translate-y-3">
        <div className="flex items-center justify-between">
          <span className="h-2 w-14 rounded bg-white/25" />
          <span className="flex gap-2"><span className="h-1.5 w-8 rounded bg-white/15" /><span className="h-1.5 w-8 rounded bg-white/15" /><span className="h-4 w-16 rounded-full bg-signal" /></span>
        </div>
        <div className="mt-6 grid grid-cols-5 gap-4">
          <div className="col-span-3 space-y-2">
            <span className="block h-3.5 w-[92%] rounded bg-white/70" />
            <span className="block h-3.5 w-[70%] rounded bg-white/70" />
            <span className="block h-1.5 w-[85%] rounded bg-white/15" />
            <span className="block h-1.5 w-[60%] rounded bg-white/15" />
            <span className="mt-3 inline-block h-6 w-28 rounded-full bg-signal" />
          </div>
          <div className="col-span-2 rounded-xl bg-gradient-to-br from-ice/25 to-signal/15" />
        </div>
      </div>
      {[
        ["Oferta clara", "left-[4%] top-[6%]"],
        ["Prova social", "right-[6%] top-[18%]"],
        ["CTA visível", "left-[38%] top-[0%]"],
      ].map(([t, pos], i) => (
        <span key={t} className={`absolute ${pos} rounded-full border border-line-strong bg-ink-950/90 px-3 py-1 text-xs text-fg/80 backdrop-blur transition-transform duration-700 ease-out-expo group-hover:-translate-y-1`} style={{ transitionDelay: `${i * 60}ms` }}>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" />{t}
        </span>
      ))}
    </div>
  );
}

function AutomationVisual() {
  return (
    <div aria-hidden className="relative mt-10 h-56 md:h-64">
      <svg viewBox="0 0 400 220" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="ln" x1="0" x2="1">
            <stop offset="0" stopColor="rgb(255 255 255 / 0.05)" />
            <stop offset="0.5" stopColor="rgb(215 255 58 / 0.7)" />
            <stop offset="1" stopColor="rgb(255 255 255 / 0.05)" />
          </linearGradient>
        </defs>
        <path d="M60 60 C 140 60, 140 160, 200 160 S 280 60, 340 60" fill="none" stroke="url(#ln)" strokeWidth="1.5" strokeDasharray="4 6" className="[animation:dash_3s_linear_infinite]" />
        <path d="M60 160 C 140 160, 160 60, 200 60" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="1.2" />
        <path d="M200 60 C 260 60, 280 160, 340 160" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="1.2" />
      </svg>
      {[
        ["Lead", "left-[6%] top-[18%]"],
        ["Planilha", "left-[6%] top-[62%]"],
        ["CRM", "left-[43%] top-[18%]"],
        ["IA", "left-[45%] top-[62%]"],
        ["WhatsApp", "right-[3%] top-[18%]"],
        ["Equipe", "right-[5%] top-[62%]"],
      ].map(([t, pos]) => (
        <span key={t} className={`absolute ${pos} rounded-xl border border-line-strong bg-ink-850 px-3 py-2 text-xs font-medium transition-colors duration-500 group-hover:border-signal/40`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function SystemsVisual() {
  const bars = [38, 52, 44, 66, 58, 74, 69, 88];
  return (
    <div aria-hidden className="mt-10 rounded-2xl border border-line bg-ink-850 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">Receita recorrente</span>
        <span className="font-mono text-xs text-signal">+18%</span>
      </div>
      <div className="mt-4 flex h-28 items-end gap-2">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 origin-bottom rounded-t bg-gradient-to-t from-white/10 to-white/35 transition-transform duration-700 ease-out-expo group-hover:scale-y-110" style={{ height: `${b}%`, transitionDelay: `${i * 40}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function Services() {
  return (
    <section className="relative border-t border-line py-24 md:py-32" aria-labelledby="services-title">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel index="04" tone="signal">O que fazemos</SectionLabel>
            <h2 id="services-title" className="mt-6 text-h2 font-medium">
              Tecnologia aplicada onde <span className="serif-accent">o dinheiro está.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5">
            <p className="text-lg leading-relaxed text-muted">
              Cada entrega existe para resolver um dos dois prejuízos: ser escolhido por mais clientes ou operar com menos esforço.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-12">
          <Reveal className="md:col-span-7">
            <SpotlightCard href="/sites" className="h-full p-7 md:p-9">
              <CardHead n="Sites" title="Sites e páginas que convertem" text="Sites institucionais, landing pages, redesign e estrutura de captação de leads. Apresentação, confiança e conversão no mesmo projeto." />
              <SitesVisual />
            </SpotlightCard>
          </Reveal>
          <Reveal delay={0.08} className="md:col-span-5">
            <SpotlightCard href="/automacao" className="h-full p-7 md:p-9">
              <CardHead n="Automação" title="Automação de processos" text="Integrações, WhatsApp, follow-up, notificações, fluxos administrativos e IA aplicada à rotina da empresa." />
              <AutomationVisual />
            </SpotlightCard>
          </Reveal>
          <Reveal className="md:col-span-5">
            <SpotlightCard href="/sistemas" className="h-full p-7 md:p-9">
              <CardHead n="Sistemas" title="Sistemas sob medida" text="CRM, portais, áreas de clientes, dashboards e painéis administrativos que se encaixam no seu processo." />
              <SystemsVisual />
            </SpotlightCard>
          </Reveal>
          <Reveal delay={0.08} className="md:col-span-7">
            <SpotlightCard href="/consultoria" className="flex h-full flex-col justify-between p-7 md:p-9">
              <CardHead n="Consultoria" title="Consultoria em tecnologia" text="Você sabe que algo não funciona, mas não sabe qual tecnologia resolve. Começamos pelo diagnóstico e indicamos o que vale fazer primeiro." />
              <p className="relative z-10 mt-10 text-2xl leading-snug tracking-tight md:text-3xl">
                <span className="serif-accent text-fg">“Você entende seu negócio.</span>{" "}
                <span className="serif-accent text-muted">Nós entendemos como a tecnologia pode trabalhar nele.”</span>
              </p>
            </SpotlightCard>
          </Reveal>
          <Reveal className="md:col-span-6">
            <SpotlightCard href="/sites#ecommerce" className="h-full p-7 md:p-9">
              <CardHead n="E-commerce" title="Lojas virtuais" text="Para empresas físicas que querem começar a vender online ou organizar uma operação que já existe." />
            </SpotlightCard>
          </Reveal>
          <Reveal delay={0.08} className="md:col-span-6">
            <SpotlightCard href="/sites#identidade" className="h-full p-7 md:p-9">
              <CardHead n="Marca" title="Identidade visual" text="Logotipo, identidade e posicionamento visual para a empresa parecer tão sólida quanto é." />
            </SpotlightCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
