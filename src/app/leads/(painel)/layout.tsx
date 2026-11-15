import Link from "next/link";
import { sairAction } from "@/app/leads/actions";
import { CrmNav } from "@/components/crm/nav";
import { LogoMark } from "@/components/ui/logo";
import { exigirUsuario } from "@/lib/crm/auth";

// Moldura das páginas do CRM. A sessão é conferida aqui E em cada página e ação: o layout sozinho não protege
// uma página (ele não é reexecutado a cada navegação).
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  return (
    <div className="min-h-dvh pb-[calc(70px+env(safe-area-inset-bottom))] lg:pb-12">
      <header className="sticky top-0 z-30 border-b border-line bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-4 px-4 sm:px-6">
          <Link href="/leads" className="flex items-center gap-2.5" aria-label="Leads: atendimento">
            <LogoMark className="h-7 w-7" />
            <span className="font-[family-name:var(--font-display)] text-[1.02rem] font-semibold tracking-[-0.01em]">Leads</span>
          </Link>
          <CrmNav variante="topo" />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-[160px] truncate text-[0.85rem] text-muted sm:inline">{usuario.nome}</span>
            <form action={sairAction}>
              <button type="submit" className="min-h-9 rounded-md px-2 text-[0.85rem] font-semibold text-muted hover:text-fg">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1240px] px-4 pt-6 sm:px-6 sm:pt-8">{children}</div>
      <CrmNav variante="rodape" />
    </div>
  );
}
