import { mailtoLink, whatsappLink } from "@/lib/site";

// Mensagem de falha no envio. Só oferece canais alternativos que estejam configurados.
// unavailable: o envio pelo site está desligado (sem destino de leads), então não adianta tentar de novo.
export function SubmitError({ message, unavailable }: { message?: string; unavailable?: boolean }) {
  const wa = whatsappLink(message);
  const mail = mailtoLink("Contato pelo site");
  return (
    <p role="alert" className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember-soft">
      {unavailable
        ? "O envio pelo site está temporariamente indisponível e seus dados não foram enviados. Tente mais tarde"
        : "Não conseguimos enviar agora. Tente de novo em instantes"}
      {wa ? (
        <>
          {" "}ou{" "}
          <a className="underline" href={wa} target="_blank" rel="noopener">
            fale pelo WhatsApp
          </a>
        </>
      ) : mail ? (
        <>
          {" "}ou{" "}
          <a className="underline" href={mail}>
            envie um e-mail
          </a>
        </>
      ) : null}
      .
    </p>
  );
}
