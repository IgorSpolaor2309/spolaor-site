import type { Metadata } from "next";
import Link from "next/link";
import { CadastroForm } from "@/components/crm/cadastro-form";
import { Painel } from "@/components/crm/ui";
import { exigirUsuario } from "@/lib/crm/auth";
import { paraInputLocal } from "@/lib/crm/tipos";

export const metadata: Metadata = { title: "Cadastrar contato" };

export default async function NovoPage() {
  await exigirUsuario();
  return (
    <>
      <p className="text-[0.85rem]">
        <Link href="/leads" className="font-semibold text-sky underline-offset-4 hover:underline">
          ← Depende de mim
        </Link>
      </p>
      <h1 className="mt-3 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">Cadastrar contato</h1>
      <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-muted">
        Para quem chegou por WhatsApp, Instagram, e-mail, telefone ou indicação, e para registrar contatos antigos. Os formulários do site entram sozinhos. O cadastro
        manual fica marcado como manual, não gera conversão em nenhuma ferramenta de anúncios e não dispara mensagem automática.
      </p>
      <Painel className="mt-5 max-w-3xl">
        <CadastroForm agoraLocal={paraInputLocal(new Date().toISOString())} />
      </Painel>
    </>
  );
}
