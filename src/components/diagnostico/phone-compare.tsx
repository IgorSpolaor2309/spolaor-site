"use client";

import { useState } from "react";

// Demonstração da landing de diagnóstico: a mesma página no celular, organizada de dois jeitos.
// Os números marcados na tela correspondem à lista ao lado, que muda com a versão escolhida.
// Negócio fictício, sem dados de clientes.

type Mode = "confuso" | "claro";

const aspects: { aspect: string; confuso: [string, string]; claro: [string, string] }[] = [
  {
    aspect: "Primeira tela",
    confuso: ["Não diz o que a empresa faz", "Um banner e uma frase de boas-vindas ocupam o espaço. O visitante precisa adivinhar."],
    claro: ["A oferta em uma frase", "Quem chega entende em segundos o que a empresa faz, para quem e onde."],
  },
  {
    aspect: "Próximo passo",
    confuso: ["Nenhum botão de contato à vista", "Para pedir um orçamento, é preciso abrir o menu ou rolar até o fim."],
    claro: ["Um botão principal, sem rolar", "O próximo passo aparece logo na primeira tela, fácil de tocar."],
  },
  {
    aspect: "Leitura",
    confuso: ["Letra pequena e texto genérico", "Ninguém lê um parágrafo miúdo no celular para descobrir o básico."],
    claro: ["Informação útil, em tamanho confortável", "Região, horário e forma de atendimento à vista, sem precisar perguntar."],
  },
  {
    aspect: "Formulário",
    confuso: ["Campos demais para um primeiro contato", "Oito campos, incluindo dados que só seriam necessários depois."],
    claro: ["Só o necessário para começar", "Três campos. O restante se combina na conversa."],
  },
];

const pinTone: Record<Mode, string> = { confuso: "bg-ember", claro: "bg-signal" };

function Pin({ n, mode, active, className = "" }: { n: number; mode: Mode; active: boolean; className?: string }) {
  return (
    <span
      className={`absolute z-10 grid h-[22px] w-[22px] place-items-center rounded-full font-mono text-[0.68rem] font-semibold text-white transition-shadow duration-200 ${pinTone[mode]} ${
        active ? (mode === "confuso" ? "ring-4 ring-ember/25" : "ring-4 ring-signal/25") : ""
      } ${className}`}
    >
      {n}
    </span>
  );
}

/** Tela confusa: banner, boas-vindas genérica, contato escondido e formulário longo. */
function ScreenConfuso({ active }: { active: number }) {
  return (
    <div className="flex h-full flex-col bg-white text-[#3b4252]">
      <div className="flex items-center justify-between bg-[#2b2f36] px-3 py-1 text-[0.5rem] text-white/80">
        <span>(00) 0000-0000</span>
        <span>seg a sex · 8h às 18h</span>
      </div>
      <div className="flex items-center justify-between border-b border-[#e5e5e5] px-3 py-2">
        <span className="font-mono text-[0.62rem] tracking-[0.2em] text-[#9aa1ab]">LOGO</span>
        <span className="flex flex-col gap-[3px]" aria-hidden>
          <span className="h-px w-3.5 bg-[#555]" />
          <span className="h-px w-3.5 bg-[#555]" />
          <span className="h-px w-3.5 bg-[#555]" />
        </span>
      </div>
      <div className="relative">
        <div className="flex h-[168px] items-end justify-center bg-[linear-gradient(135deg,#d9dde3,#c3c9d2)] pb-2.5">
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-white" : "bg-white/50"}`} />
            ))}
          </span>
        </div>
        <Pin n={1} mode="confuso" active={active === 0} className="right-2 top-2" />
      </div>
      <div className="relative flex items-baseline justify-between px-3 pt-3">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">Bem-vindo!</p>
        <span className="mr-7 text-[0.56rem] text-[#6b7280] underline">Saiba mais</span>
        <Pin n={2} mode="confuso" active={active === 1} className="right-2 top-2" />
      </div>
      <div className="relative px-3 pt-1.5">
        <p className="pr-5 text-[0.56rem] leading-[1.45] text-[#6b7280]">
          Somos uma empresa com tradição, qualidade e compromisso com nossos clientes, sempre buscando a excelência em tudo o que fazemos
          e a sua total satisfação.
        </p>
        <Pin n={3} mode="confuso" active={active === 2} className="right-2 top-3" />
      </div>
      <div className="relative mt-3 flex-1 border-t border-[#eee] px-3 pt-2.5">
        <p className="text-[0.6rem] font-semibold text-[#4b5563]">Fale conosco</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {["Nome", "Sobrenome", "CPF", "Telefone", "E-mail", "Cidade", "Como nos conheceu?", "Mensagem"].map((f) => (
            <span key={f} className={`rounded-[3px] border border-[#ddd] px-1.5 py-1 text-[0.48rem] text-[#9aa1ab] ${f === "Mensagem" || f === "Como nos conheceu?" ? "col-span-2" : ""}`}>
              {f}
            </span>
          ))}
        </div>
        <Pin n={4} mode="confuso" active={active === 3} className="right-2 top-1.5" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" aria-hidden />
      </div>
    </div>
  );
}

/** Tela clara: oferta, botão principal, informações úteis e formulário curto. */
function ScreenClaro({ active }: { active: number }) {
  return (
    <div className="flex h-full flex-col bg-white text-fg">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <span className="font-mono text-[0.62rem] tracking-[0.2em] text-dim">LOGO</span>
        <span className="rounded-[5px] border border-line-strong px-1.5 py-0.5 text-[0.52rem] font-semibold">WhatsApp</span>
      </div>
      <div className="relative pl-3.5 pr-8 pt-4">
        <p className="font-display text-[1.02rem] font-semibold leading-[1.12] tracking-[-0.03em]">Instalação e conserto de ar&#8209;condicionado</p>
        <p className="mt-1.5 text-[0.62rem] leading-snug text-muted">Para casas e empresas da região, com visita agendada.</p>
        <Pin n={1} mode="claro" active={active === 0} className="-right-0.5 top-3" />
      </div>
      <div className="relative pl-3.5 pr-8 pt-3">
        <span className="block rounded-[7px] bg-royal py-2 text-center text-[0.66rem] font-semibold text-white">Pedir orçamento pelo WhatsApp</span>
        <Pin n={2} mode="claro" active={active === 1} className="-right-0.5 top-4" />
      </div>
      <div className="relative pl-3.5 pr-8 pt-3">
        <ul className="grid gap-1 text-[0.6rem] leading-snug">
          {["Atendemos o centro e bairros vizinhos", "Seg a sáb, das 8h às 18h", "Orçamento sem compromisso"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-signal" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <Pin n={3} mode="claro" active={active === 2} className="-right-0.5 top-2.5" />
      </div>
      <div className="relative ml-3.5 mr-8 mt-4 rounded-[8px] border border-line bg-ink-850 p-2.5">
        <p className="text-[0.6rem] font-semibold">Prefere que a gente chame?</p>
        <div className="mt-1.5 grid gap-1">
          {["Nome", "WhatsApp", "Bairro"].map((f) => (
            <span key={f} className="rounded-[4px] border border-line-strong bg-white px-1.5 py-1 text-[0.52rem] text-dim">
              {f}
            </span>
          ))}
        </div>
        <span className="mt-1.5 block rounded-[5px] border border-fg/80 py-1 text-center text-[0.56rem] font-semibold">Quero ser chamado</span>
        <Pin n={4} mode="claro" active={active === 3} className="-right-[1.85rem] top-1" />
      </div>
    </div>
  );
}

/** children: título e texto da seção, à esquerda do celular no desktop e acima dele no mobile. */
export function PhoneCompare({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("confuso");
  const [active, setActive] = useState(-1);
  const label =
    mode === "confuso"
      ? "Página de exemplo, versão confusa: banner no topo, texto genérico, contato escondido e formulário com oito campos."
      : "Página de exemplo, versão mais clara: oferta em uma frase, botão de WhatsApp na primeira tela, informações úteis e formulário com três campos.";

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-12">
      <div className="lg:col-span-6 lg:row-start-1">{children}</div>
      <div className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
        <div role="group" aria-label="Escolha a versão da página" className="mx-auto grid max-w-[300px] grid-cols-2 rounded-[12px] border border-line-strong bg-ink-900 p-1">
          {(
            [
              ["confuso", "Confusa"],
              ["claro", "Mais clara"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 rounded-[9px] text-[0.95rem] font-semibold transition-colors duration-200 ${
                mode === m ? "bg-fg text-white" : "text-muted hover:text-fg"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <figure className="mt-5">
          <div className="mx-auto w-[min(100%,272px)] rounded-[2.1rem] border border-line-strong bg-ink-900 p-[9px] shadow-[0_1px_2px_rgb(20_37_61/0.06),0_40px_80px_-40px_rgb(20_37_61/0.35)] lg:w-[300px]">
            <div role="img" aria-label={label} className="relative h-[460px] overflow-hidden rounded-[1.6rem] border border-line lg:h-[500px]">
              <div aria-hidden className={`absolute inset-0 transition-opacity duration-300 ${mode === "confuso" ? "opacity-100" : "opacity-0"}`}>
                <ScreenConfuso active={active} />
              </div>
              <div aria-hidden className={`absolute inset-0 transition-opacity duration-300 ${mode === "claro" ? "opacity-100" : "opacity-0"}`}>
                <ScreenClaro active={active} />
              </div>
            </div>
          </div>
          <figcaption className="mt-4 text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-dim">
            Exemplo ilustrativo · negócio fictício
          </figcaption>
        </figure>
      </div>

      <ol className="border-t border-line-strong lg:col-span-6 lg:row-start-2">
        {aspects.map((a, i) => {
          const [title, text] = a[mode];
          return (
            <li
              key={a.aspect}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(-1)}
              className="grid grid-cols-[2rem_1fr] gap-x-3 border-b border-line py-4 md:py-5"
            >
              <span
                aria-hidden
                className={`mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full font-mono text-[0.68rem] font-semibold text-white transition-colors duration-300 ${pinTone[mode]}`}
              >
                {i + 1}
              </span>
              <div>
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-dim">{a.aspect}</p>
                <p className="mt-1 font-semibold leading-snug">{title}</p>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
