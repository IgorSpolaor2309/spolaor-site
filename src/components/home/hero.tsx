import { HeroDemo } from "@/components/home/hero-demo";
import { ButtonLink } from "@/components/ui/button";

// Headline em duas linhas: a pergunta ("perde" em laranja) e o complemento.
const lineA = ["Quantos", "clientes", "sua", "empresa", "perde"];
const lineB = ["sem", "perceber?"];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-[72px]" aria-labelledby="hero-title">
      <div className="container-x relative">
        <div className="relative grid min-h-[min(880px,calc(100svh-72px))] grid-cols-1 gap-x-12 lg:grid-cols-12 lg:items-center">
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
              <p className="text-fg">Seu site recebe visitas. Seu WhatsApp recebe mensagens. Sua equipe recebe pedidos.</p>
              <p>
                Quando a resposta demora ou o retorno depende de alguém lembrar, a venda vai para outra empresa. A Spolaor
                resolve isso com <strong className="font-semibold text-fg">sites e landing pages</strong> que facilitam o
                contato e com <strong className="font-semibold text-fg">automação dos processos</strong> de atendimento e
                acompanhamento.
              </p>
            </div>

            <div className="fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "0.72s" }}>
              <ButtonLink href="/sites#orcamento" size="lg" arrow>
                Pedir orçamento de site
              </ButtonLink>
              <ButtonLink href="/automacao#analise" variant="secondary" size="lg">
                Diagnóstico de automação
              </ButtonLink>
            </div>
            <p className="fade-up mt-5 text-sm text-dim" style={{ animationDelay: "0.8s" }}>
              Não sabe por onde começar?{" "}
              <a href="#analise" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                Conte como os contatos chegam
              </a>{" "}
              e mostramos onde eles se perdem, sem custo.
            </p>
          </div>

          <HeroDemo className="fade-up relative pb-14 lg:col-span-5 lg:pb-0" />
        </div>
      </div>
    </section>
  );
}
