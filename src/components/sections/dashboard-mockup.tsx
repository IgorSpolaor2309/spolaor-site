// Interface demonstrativa da plataforma de gestão e atendimento (dados fictícios).
const modules = ["Visão geral", "CRM", "Clientes", "Financeiro", "Contratos", "Automações", "WhatsApp", "Assistente IA", "Relatórios"];

const kpis = [
  { label: "Receita recorrente", value: "R$ 184,2 mil", delta: "+12,4%" },
  { label: "Cobranças automáticas", value: "1.284", delta: "98% em dia" },
  { label: "Atendimentos via IA", value: "3.917", delta: "71% resolvidos" },
  { label: "Contratos ativos", value: "412", delta: "+23 no mês" },
];

const pipeline = [
  { stage: "Novos", items: ["Construtora Alfa", "Clínica Vita"] },
  { stage: "Proposta", items: ["Rede Sabor", "Grupo Orion"] },
  { stage: "Fechado", items: ["Studio Lume"] },
];

const feed = [
  { t: "agora", text: "Pagamento confirmado · Fatura #8821", tone: "signal" },
  { t: "2 min", text: "Contrato assinado digitalmente", tone: "fg" },
  { t: "4 min", text: "IA respondeu dúvida sobre 2ª via", tone: "fg" },
  { t: "9 min", text: "Lembrete de vencimento enviado", tone: "fg" },
];

export function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line-strong bg-ink-900 text-left shadow-[0_60px_120px_-40px_rgb(0_0_0/0.9)]" aria-hidden>
      <div className="flex items-center gap-1.5 border-b border-line bg-ink-950/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="mx-auto rounded-md bg-white/[0.05] px-10 py-1 font-mono text-[0.62rem] text-dim">app.plataforma.com.br</span>
      </div>
      <div className="grid grid-cols-12">
        <aside className="col-span-3 hidden border-r border-line p-4 md:block lg:col-span-2">
          <div className="mb-5 flex items-center gap-2 text-[0.75rem] font-semibold">
            <span className="h-4 w-4 rounded-md bg-signal" /> Plataforma
          </div>
          <ul className="space-y-1">
            {modules.map((m, i) => (
              <li key={m} className={`rounded-lg px-2.5 py-1.5 text-[0.7rem] ${i === 0 ? "bg-white/[0.07] text-fg" : "text-muted"}`}>
                {m}
              </li>
            ))}
          </ul>
        </aside>
        <div className="col-span-12 p-4 md:col-span-9 md:p-5 lg:col-span-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.7rem] text-dim">Outubro</p>
              <p className="text-sm font-medium">Visão geral da operação</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-line px-3 py-1 text-[0.65rem] text-muted sm:inline">Últimos 30 dias</span>
              <span className="h-7 w-7 rounded-full bg-gradient-to-br from-ice/60 to-signal/50" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-line bg-white/[0.02] p-3">
                <p className="text-[0.62rem] text-dim">{k.label}</p>
                <p className="mt-1.5 text-[0.95rem] font-medium tracking-tight md:text-base">{k.value}</p>
                <p className="mt-0.5 font-mono text-[0.6rem] text-signal">{k.delta}</p>
              </div>
            ))}
          </div>

          <div className="mt-2.5 grid gap-2.5 lg:grid-cols-5">
            <div className="rounded-xl border border-line bg-white/[0.02] p-3 lg:col-span-3">
              <div className="flex items-center justify-between">
                <p className="text-[0.68rem] text-muted">Receita x inadimplência</p>
                <span className="flex gap-3 text-[0.58rem] text-dim">
                  <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-signal" />Receita</span>
                  <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-ember" />Atraso</span>
                </span>
              </div>
              <svg viewBox="0 0 300 110" className="mt-2 h-28 w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="rgb(215 255 58 / 0.35)" />
                    <stop offset="1" stopColor="rgb(215 255 58 / 0)" />
                  </linearGradient>
                </defs>
                {[25, 55, 85].map((y) => (
                  <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="rgb(255 255 255 / 0.06)" />
                ))}
                <path d="M0 80 C 30 76, 50 70, 75 64 S 120 58, 150 50 S 200 40, 225 32 S 270 20, 300 14 L300 110 L0 110Z" fill="url(#area)" />
                <path d="M0 80 C 30 76, 50 70, 75 64 S 120 58, 150 50 S 200 40, 225 32 S 270 20, 300 14" fill="none" stroke="#d7ff3a" strokeWidth="1.8" />
                <path d="M0 96 C 40 94, 70 97, 110 92 S 170 95, 210 98 S 260 100, 300 101" fill="none" stroke="#ff6b3d" strokeWidth="1.4" strokeDasharray="3 4" />
              </svg>
            </div>
            <div className="rounded-xl border border-line bg-white/[0.02] p-3 lg:col-span-2">
              <p className="text-[0.68rem] text-muted">Atividade em tempo real</p>
              <ul className="mt-2 space-y-2">
                {feed.map((f) => (
                  <li key={f.text} className="flex items-start gap-2 text-[0.66rem]">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${f.tone === "signal" ? "bg-signal" : "bg-white/30"}`} />
                    <span className="flex-1 text-fg/80">{f.text}</span>
                    <span className="font-mono text-dim">{f.t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-2.5 hidden grid-cols-3 gap-2.5 sm:grid">
            {pipeline.map((col) => (
              <div key={col.stage} className="rounded-xl border border-line bg-white/[0.02] p-3">
                <p className="text-[0.62rem] text-dim">
                  {col.stage} · {col.items.length}
                </p>
                <div className="mt-2 space-y-1.5">
                  {col.items.map((it) => (
                    <div key={it} className="rounded-lg border border-line bg-ink-850 px-2.5 py-2 text-[0.66rem]">
                      {it}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
