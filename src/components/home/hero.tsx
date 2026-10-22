import { HeroFlow } from "@/components/home/hero-flow";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

// Headline em duas linhas: a pergunta ("perde" em laranja) e o complemento.
const lineA = ["Quantos", "clientes", "sua", "empresa", "perde"];
const lineB = ["sem", "perceber?"];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-[72px]" aria-labelledby="hero-title">
      <div className="container-x relative">
        <div className="relative grid min-h-[min(880px,calc(100svh-72px))] grid-cols-1 lg:grid-cols-12">
          {/* Assinatura: o fluxo de contatos desenhado com as fitas do símbolo */}
          <HeroFlow className="order-last -mx-2 mb-44 h-[230px] sm:mb-40 sm:h-[320px] lg:absolute lg:bottom-[19%] lg:top-[4%] lg:right-0 lg:order-none lg:mx-0 lg:mb-0 lg:h-auto lg:w-[40%]" />

          <div className="relative z-10 flex flex-col justify-center pb-6 pt-10 lg:col-span-7 lg:py-20">
            <h1 id="hero-title" className="max-w-[13ch] text-[clamp(2.3rem,1rem+3.4vw,4.25rem)] font-semibold leading-[1.03] tracking-[-0.045em] lg:max-w-none">
              <span className="sr-only">Quantos clientes sua empresa perde sem perceber?</span>
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
                    <span className="rise text-fg" style={{ animationDelay: `${0.38 + i * 0.04}s` }}>
                      {w}
                    </span>
                    &nbsp;
                  </span>
                ))}
              </span>
            </h1>

            <div className="fade-up mt-9 grid max-w-[40rem] gap-4 text-[1.06rem] leading-relaxed text-muted md:text-lg" style={{ animationDelay: "0.6s" }}>
              <p className="text-fg">Seu site recebe visitas. Seu WhatsApp recebe mensagens. Sua equipe recebe contatos.</p>
              <p>
                Mas quando a resposta demora, o contato fica esquecido ou tudo depende de alguém lembrar, a venda vai para outra
                empresa. E isso não aparece em nenhum relatório.
              </p>
            </div>

            <div className="fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "0.72s" }}>
              <ButtonLink href="#analise" size="lg" arrow>
                Descobrir onde estou perdendo clientes
              </ButtonLink>
              <ButtonLink href="#segmentos" variant="secondary" size="lg">
                Ver soluções por segmento
              </ButtonLink>
            </div>
            <p className="fade-up mt-5 text-sm text-dim" style={{ animationDelay: "0.8s" }}>
              Diagnóstico sem custo: você conta como os contatos chegam, nós mostramos onde eles se perdem.
            </p>
            <div className="fade-up mt-8 border-t border-line pt-5" style={{ animationDelay: "0.88s" }}>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-dim">Nossas duas ofertas principais</p>
              <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
                <Link href="/sites" className="font-semibold text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                  Sites e landing pages
                </Link>
                <Link href="/automacao" className="font-semibold text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                  Automação de processos
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
