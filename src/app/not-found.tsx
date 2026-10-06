import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="relative grid min-h-[80vh] place-items-center pt-[72px]">
      <div className="container-x text-center">
        <p className="eyebrow">Erro 404</p>
        <h1 className="mt-6 text-h2 font-medium">
          Esta página não existe. <span className="serif-accent text-muted">Seus clientes também desistem assim.</span>
        </h1>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/" variant="secondary">Voltar ao início</ButtonLink>
          <ButtonLink href="/analise" arrow>Analisar meu site</ButtonLink>
        </div>
      </div>
    </section>
  );
}
