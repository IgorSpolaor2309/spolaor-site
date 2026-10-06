import { mailtoLink, whatsappLink } from "@/lib/site";

// Mensagem de falha no envio. Só oferece canais alternativos que estejam configurados.
export function SubmitError({ message }: { message?: string }) {
  const wa = whatsappLink(message);
  const mail = mailtoLink("Contato pelo site");
  return (
    <p role="alert" className="rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember-soft">
      Não conseguimos enviar agora. Tente de novo em instantes
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
