import { HeroFlow } from "@/components/home/hero-flow";
import { ButtonLink } from "@/components/ui/button";

// Headline em duas vozes: a pergunta (branco, "perde" em laranja) e o complemento em azul.
const lineA = ["Quantos", "clientes", "sua", "empresa", "perde"];
const lineB = ["antes", "mesmo", "de", "falar", "com", "eles?"];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-[72px]" aria-labelledby="hero-title">
      <div className="container-x relative">
        <div className="relative grid min-h-[min(880px,calc(100svh-72px))] grid-cols-1 lg:grid-cols-12">
          {/* Assinatura: o fluxo de contatos desenhado com as fitas do símbolo */}
          <HeroFlow className="h-[340px] sm:h-[440px] lg:absolute lg:inset-y-[7%] lg:right-[-1%] lg:h-auto lg:w-[47%]" />

          <div className="relative z-10 flex flex-col justify-center pb-16 pt-6 lg:col-span-7 lg:py-20 xl:col-span-6">
            <h1 id="hero-title" className="max-w-[13ch] text-[clamp(2.3rem,1rem+3.4vw,4.25rem)] font-semibold leading-[1.03] tracking-[-0.045em] lg:max-w-none">
              <span className="sr-only">Quantos clientes sua empresa perde antes mesmo de falar com eles?</span>
              <span aria-hidden>
                {lineA.map((w, i) => (
                  <span key={w} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
                    <span className={`rise ${w === "perde" ? "text-ember" : "text-fg"}`} style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                      {w}
                    </span>
                    &nbsp;
                  </span>
                ))}
                <br className="hidden lg:block" />
                {lineB.map((w, i) => (
                  <span key={w} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
                    <span className="rise text-sky" style={{ animationDelay: `${0.38 + i * 0.04}s` }}>
                      {w}
                    </span>
                    &nbsp;
                  </span>
                ))}
              </span>
            </h1>

            <div className="fade-up mt-9 grid max-w-[40rem] gap-4 text-[1.06rem] leading-relaxed text-muted md:text-lg" style={{ animationDelay: "0.6s" }}>
              <p>
                <span className="text-fg">Seu site não precisa ser ruim para perder vendas.</span> Basta não deixar claro, em
                poucos segundos, por que alguém deveria falar com você.
              </p>
              <p>
                E quando o contato chega, ainda depende de alguém lembrar de responder, copiar para a planilha e cobrar o
                retorno. A Spolaor resolve as duas pontas: o site que convence e a automação que não deixa ninguém sem resposta.
              </p>
            </div>

            <div className="fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "0.72s" }}>
              <ButtonLink href="/analise" size="lg" arrow>
                Solicitar análise do meu site
              </ButtonLink>
              <ButtonLink href={{ pathname: "/contato", query: { interesse: "Automação" } }} variant="secondary" size="lg">
                Quero automatizar minha empresa
              </ButtonLink>
            </div>
            <p className="fade-up mt-5 text-sm text-dim" style={{ animationDelay: "0.8s" }}>
              Você recebe os pontos que mais afastam clientes, em ordem de prioridade.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
