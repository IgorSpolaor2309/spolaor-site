import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EntrarForm } from "@/components/crm/entrar-form";
import { Aviso } from "@/components/crm/ui";
import { LogoMark } from "@/components/ui/logo";
import { acessoPronto, usuarioAtual } from "@/lib/crm/auth";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage() {
  const acesso = acessoPronto();
  if (acesso.pronto && (await usuarioAtual().catch(() => null))) redirect("/leads");
  return (
    <div className="flex min-h-dvh items-start justify-center px-5 pb-16 pt-[12vh]">
      <div className="w-full max-w-sm">
        <LogoMark className="h-10 w-10" />
        <h1 className="mt-6 text-[1.7rem] font-semibold leading-tight tracking-[-0.03em]">Leads da Spolaor</h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">Área interna. O acesso é por um código enviado ao seu e-mail; não há cadastro.</p>
        <div className="mt-7">
          {acesso.pronto ? (
            <EntrarForm />
          ) : (
            <Aviso tom="alerta">O acesso ainda não funciona neste ambiente. Falta configurar: {acesso.falta.join("; ")}.</Aviso>
          )}
        </div>
      </div>
    </div>
  );
}
