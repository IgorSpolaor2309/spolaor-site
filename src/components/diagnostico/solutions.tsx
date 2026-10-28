import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-label";

// "A Spolaor faz muito mais": os serviços como etapas de um mesmo caminho digital, cada um com um
// fragmento de interface. Fica depois do formulário e não tem botão, para não disputar com o
// diagnóstico. Interfaces ilustrativas, sem dados de clientes.

const ui = "rounded-[10px] border border-line bg-ink-900 p-3 shadow-[0_1px_2px_rgb(20_37_61/0.05)]";
const tag = "font-mono text-[0.58rem] uppercase tracking-[0.12em] text-dim";

function SiteUi() {
  return (
    <div className={ui}>
      <p className="font-display text-[0.86rem] font-semibold leading-tight tracking-[-0.02em]">Instalação de ar-condicionado</p>
      <p className="mt-1 text-[0.7rem] text-muted">Casas e empresas da região, com visita agendada.</p>
      <span className="mt-2.5 inline-block rounded-[6px] bg-fg px-2.5 py-1.5 text-[0.68rem] font-semibold text-white">Pedir orçamento</span>
    </div>
  );
}

function StoreUi() {
  return (
    <div className={ui}>
      <p className="flex justify-between text-[0.74rem]">
        <span>1 × Produto A (M)</span>
        <span className="font-mono text-dim">R$ ••,••</span>
      </p>
      <p className={`${tag} mt-2.5`}>Pagamento</p>
      <p className="mt-1 flex gap-1.5">
        {["Pix", "Cartão", "Boleto"].map((t, i) => (
          <span key={t} className={`rounded-[5px] border px-2 py-0.5 text-[0.68rem] ${i === 0 ? "border-signal bg-signal/10" : "border-line-strong text-muted"}`}>
            {t}
          </span>
        ))}
      </p>
    </div>
  );
}

function BookingUi() {
  return (
    <div className={ui}>
      <p className={tag}>qui · 15</p>
      <p className="mt-1.5 grid grid-cols-3 gap-1.5 font-mono text-[0.7rem]">
        {["09:00", "11:00", "14:30"].map((t) => (
          <span key={t} className={`rounded-[5px] border py-1 text-center ${t === "11:00" ? "border-signal bg-signal/10 text-fg" : "border-line-strong text-muted"}`}>
            {t}
          </span>
        ))}
      </p>
      <p className="mt-2 text-[0.7rem] text-muted">Confirmado. Lembrete na véspera.</p>
    </div>
  );
}

function AutomationUi() {
  return (
    <div className={ui}>
      <p className="flex items-center gap-2 text-[0.74rem] font-semibold">
        <span aria-hidden className="h-2 w-2 rounded-full bg-[#f07a12]" />
        Orçamento sem resposta há 2 dias
      </p>
      <p className="mt-1.5 text-[0.7rem] leading-snug text-muted">Lembrete enviado ao responsável, com o histórico do contato.</p>
    </div>
  );
}

function SystemUi() {
  return (
    <div className={ui}>
      <p className={`${tag} grid grid-cols-[1fr_auto]`}>
        <span>Pedido</span>
        <span>Etapa</span>
      </p>
      <ul className="mt-1.5 divide-y divide-line text-[0.72rem]">
        {[
          ["#0142", "Em produção", "text-signal"],
          ["#0143", "Aguardando pagamento", "text-ember"],
          ["#0144", "Entregue", "text-muted"],
        ].map(([n, s, c]) => (
          <li key={n} className="grid grid-cols-[1fr_auto] py-1">
            <span className="font-mono text-dim">{n}</span>
            <span className={c}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const solutions = [
  {
    stage: "Apresentar",
    name: "Sites e landing pages",
    href: "/sites",
    text: "Páginas que explicam a oferta em segundos e levam o visitante ao contato.",
    ui: <SiteUi />,
  },
  {
    stage: "Vender",
    name: "Lojas virtuais",
    href: "/lojas-virtuais",
    text: "Catálogo, carrinho, pagamento e pedidos organizados num lugar só.",
    ui: <StoreUi />,
  },
  {
    stage: "Agendar",
    name: "Agendamento online",
    href: "/agendamento-online",
    text: "O cliente escolhe o horário e recebe a confirmação e os lembretes.",
    ui: <BookingUi />,
  },
  {
    stage: "Acompanhar",
    name: "Automação de processos",
    href: "/automacao",
    text: "Contatos registrados, retornos lembrados e dados preenchidos uma vez só.",
    ui: <AutomationUi />,
  },
  {
    stage: "Gerenciar",
    name: "Sistemas sob medida",
    href: "/sistemas",
    text: "Painéis, áreas de cliente e integrações feitos para o jeito da sua empresa trabalhar.",
    ui: <SystemUi />,
  },
];

export function Solutions({ index }: { index: string }) {
  return (
    <section id="solucoes" className="relative border-t border-line py-20 md:py-28" aria-labelledby="solutions-title">
      <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-x-10">
        <Reveal className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <SectionLabel index={index}>Além do diagnóstico</SectionLabel>
            <h2 id="solutions-title" className="mt-6 text-h3 font-semibold md:text-[2.5rem] md:leading-[1.08]">
              Além de apontar o que melhorar, a Spolaor desenvolve a solução.
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-muted">
              Do primeiro clique no site ao pedido acompanhado no painel. Cada negócio usa as etapas de que precisa, e elas conversam
              entre si.
            </p>
            <Link
              href="/#servicos"
              className="mt-6 inline-flex items-center gap-1.5 text-[0.95rem] font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
            >
              Conhecer todos os serviços <span aria-hidden>→</span>
            </Link>
          </div>
        </Reveal>

        <div className="lg:col-span-7 lg:col-start-6">
          <ol className="relative">
            <span aria-hidden className="absolute bottom-6 left-[5px] top-6 w-px bg-line-strong" />
            {solutions.map((s, i) => (
              <Reveal as="li" key={s.href} delay={Math.min(i * 0.05, 0.2)} className="relative grid gap-4 pb-9 pl-8 last:pb-0 md:grid-cols-[1fr_15rem] md:gap-8 md:pb-12">
                <span aria-hidden className="absolute left-0 top-[0.4rem] h-[11px] w-[11px] rounded-full border-2 border-royal bg-ink-950" />
                <div>
                  <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-dim">
                    {String(i + 1).padStart(2, "0")} · {s.stage}
                  </p>
                  <h3 className="mt-2 text-[1.3rem] font-semibold leading-tight tracking-[-0.03em] md:text-[1.45rem]">
                    <Link href={s.href} className="group inline-flex items-baseline gap-2 hover:text-sky">
                      {s.name}
                      <span aria-hidden className="text-[1rem] text-sky transition-transform duration-300 group-hover:translate-x-1">
                        →
                      </span>
                    </Link>
                  </h3>
                  <p className="mt-2 max-w-md leading-relaxed text-muted">{s.text}</p>
                </div>
                <div aria-hidden className="max-w-[17rem] md:max-w-none md:pt-1">
                  {s.ui}
                </div>
              </Reveal>
            ))}
          </ol>
          <p className="mt-8 pl-8 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-dim">Interfaces ilustrativas · sem dados de clientes</p>
        </div>
      </div>
    </section>
  );
}
