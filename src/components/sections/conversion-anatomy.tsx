import { Reveal } from "@/components/ui/reveal";

const parts = [
  ["Promessa clara", "Em uma frase: o que você faz, para quem e qual resultado entrega."],
  ["Ação visível", "O próximo passo aparece cedo e se repete nos pontos certos."],
  ["Prova imediata", "Avaliações, números e clientes antes de a dúvida surgir."],
  ["Benefícios na ordem da decisão", "O conteúdo segue as perguntas que o cliente faz na cabeça."],
  ["Objeções respondidas", "Preço, prazo, garantia e confiança tratados sem rodeio."],
  ["Captação integrada", "Formulário e WhatsApp que já entregam o contato organizado para a equipe."],
];

function Dot({ n, className }: { n: number; className: string }) {
  return (
    <span className={`absolute z-10 grid h-7 w-7 place-items-center rounded-full bg-signal font-mono text-[0.7rem] font-semibold text-ink-950 shadow-[0_0_0_6px_rgb(215_255_58/0.15)] ${className}`}>
      {n}
    </span>
  );
}

export function ConversionAnatomy() {
  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
      <Reveal className="relative lg:col-span-7">
        <div className="relative rounded-[24px] border border-line-strong bg-ink-900 p-5 md:p-8" aria-hidden>
          <div className="relative flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold"><span className="h-4 w-4 rounded-md bg-signal" />Sua empresa</span>
            <span className="flex items-center gap-4">
              <span className="hidden h-2 w-12 rounded bg-white/15 sm:block" />
              <span className="hidden h-2 w-12 rounded bg-white/15 sm:block" />
              <span className="relative rounded-full bg-signal px-4 py-2 text-xs font-semibold text-ink-950">
                Pedir orçamento
                <Dot n={2} className="-right-3 -top-4" />
              </span>
            </span>
          </div>
          <div className="relative mt-10 grid gap-6 md:grid-cols-5">
            <div className="relative md:col-span-3">
              <Dot n={1} className="-left-3 -top-4" />
              <p className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">O resultado que seu cliente quer, dito sem rodeios.</p>
              <span className="mt-4 block h-2 w-[85%] rounded bg-white/15" />
              <span className="mt-2 block h-2 w-[60%] rounded bg-white/15" />
              <div className="relative mt-6 flex flex-wrap items-center gap-3">
                <Dot n={3} className="-left-3 -top-4" />
                <span className="text-sm text-signal">★★★★★</span>
                <span className="text-sm text-muted">4,9 · 300+ clientes atendidos</span>
              </div>
            </div>
            <div className="h-40 rounded-2xl bg-gradient-to-br from-ice/25 via-white/5 to-signal/15 md:col-span-2 md:h-auto" />
          </div>
          <div className="relative mt-8 grid grid-cols-3 gap-3">
            <Dot n={4} className="-left-3 -top-4" />
            {["Benefício", "Benefício", "Benefício"].map((b, i) => (
              <div key={i} className="rounded-xl border border-line bg-white/[0.02] p-3">
                <span className="block h-2 w-10 rounded bg-white/40" />
                <span className="mt-2 block h-1.5 w-full rounded bg-white/10" />
                <span className="mt-1 block h-1.5 w-3/4 rounded bg-white/10" />
              </div>
            ))}
          </div>
          <div className="relative mt-3 grid gap-3 sm:grid-cols-2">
            <div className="relative rounded-xl border border-line bg-white/[0.02] p-3">
              <Dot n={5} className="-left-3 -top-4" />
              {["Quanto custa?", "Quanto tempo leva?"].map((q) => (
                <div key={q} className="flex items-center justify-between border-b border-line py-1.5 text-xs text-muted last:border-0">
                  {q}<span>+</span>
                </div>
              ))}
            </div>
            <div className="relative rounded-xl border border-signal/30 bg-signal/[0.05] p-3">
              <Dot n={6} className="-right-3 -top-4" />
              <span className="block h-6 rounded-md border border-line bg-ink-950" />
              <span className="mt-2 block h-6 rounded-md border border-line bg-ink-950" />
              <span className="mt-2 block h-6 rounded-md bg-signal" />
            </div>
          </div>
        </div>
      </Reveal>
      <ol className="lg:col-span-5">
        {parts.map(([t, d], i) => (
          <Reveal as="li" key={t} delay={i * 0.05} className="flex gap-5 border-t border-line py-5 last:border-b">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-signal/50 font-mono text-[0.7rem] text-signal">{i + 1}</span>
            <div>
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
