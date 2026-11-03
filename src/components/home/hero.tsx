import { ButtonLink } from "@/components/ui/button";
import { ServiceIllustration } from "@/components/ui/service-illustration";

// Abertura da home: o que a Spolaor faz, em uma frase, e o caminho para as soluções. No celular,
// título, descrição e botão vêm primeiro e a ilustração fica logo abaixo, compacta, na mesma tela.
// Os detalhes (sites, lojas, agenda, automação, diagnóstico) ficam em #servicos.
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-[60px] sm:pt-[72px]" aria-labelledby="hero-title">
      <div className="container-x grid items-center gap-x-12 gap-y-6 pb-8 pt-6 sm:pb-14 sm:pt-12 lg:min-h-[min(760px,calc(100svh-72px))] lg:grid-cols-12 lg:py-16">
        <div className="lg:col-span-7">
          <h1
            id="hero-title"
            className="fade-up max-w-[16ch] text-[clamp(2.1rem,1.2rem+3.4vw,4.1rem)] font-semibold leading-[1.05] tracking-[-0.045em] lg:max-w-[15ch]"
          >
            Sites e automações para <span className="text-sky">facilitar o dia a dia</span> da sua empresa.
          </h1>
          <p className="fade-up mt-4 max-w-[34rem] text-[1.06rem] leading-relaxed text-muted md:mt-6 md:text-lg" style={{ animationDelay: "0.1s" }}>
            Venda pela internet, receba agendamentos e organize seu atendimento.
          </p>
          <div className="fade-up mt-6 md:mt-9" style={{ animationDelay: "0.18s" }}>
            <ButtonLink href="#servicos" size="lg" arrow data-hero-cta className="w-full sm:w-auto">
              Conhecer as soluções
            </ButtonLink>
          </div>
        </div>
        <div className="fade-up lg:col-span-5" style={{ animationDelay: "0.26s" }}>
          <ServiceIllustration
            name="sites-responsivos"
            preload
            sizes="(min-width: 1024px) 38vw, 18rem"
            className="mx-auto w-full max-w-[17rem] sm:max-w-[22rem] lg:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}
