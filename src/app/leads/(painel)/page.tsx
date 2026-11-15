import type { Metadata } from "next";
import Link from "next/link";
import { btnPrimary, OpLinha, Painel, Titulo, Vazio } from "@/components/crm/ui";
import { exigirUsuario } from "@/lib/crm/auth";
import { fila } from "@/lib/crm/consultas";
import type { Oportunidade } from "@/lib/crm/tipos";

export const metadata: Metadata = { title: "Atendimento" };

type Grupo = { id: string; titulo: string; nota: string; vazio: string; itens: Oportunidade[]; destaque?: "retorno" | "falha" };

// Tela inicial: quem precisa de atendimento agora, na ordem em que a demora custa mais.
export default async function AtendimentoPage() {
  await exigirUsuario();
  const f = await fila();
  const atrasados = f.retornos.filter((o) => new Date(o.proximaAcaoEm!).getTime() < f.agora).length;
  const grupos: Grupo[] = [
    { id: "novos", titulo: "Novos contatos", nota: "Chegaram e ainda não tiveram atendimento.", vazio: "Nenhum contato novo esperando.", itens: f.novos },
    {
      id: "retorno",
      titulo: "Responderam e aguardam seu retorno",
      nota: "A resposta é registrada à mão na ficha (ou quando a pessoa envia o formulário de novo).",
      vazio: "Ninguém esperando sua resposta.",
      itens: f.aguardandoRetorno,
    },
    {
      id: "agendados",
      titulo: "Retornos agendados",
      nota: atrasados ? `${atrasados} atrasado${atrasados > 1 ? "s" : ""}` : "Próximas ações com data, as atrasadas primeiro.",
      vazio: "Nenhum retorno agendado.",
      itens: f.retornos,
      destaque: "retorno",
    },
    {
      id: "interessado",
      titulo: "Aguardando resposta do interessado",
      nota: "Você já falou e não há retorno agendado.",
      vazio: "Nenhuma conversa parada do lado do interessado.",
      itens: f.aguardandoInteressado,
    },
    {
      id: "falhas",
      titulo: "Falhas de comunicação",
      nota: "Avisos de lead ou e-mails que o provedor não aceitou.",
      vazio: "Nenhuma falha de envio pendente.",
      itens: f.falhas,
      destaque: "falha",
    },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">Atendimento</h1>
        <Link href="/leads/novo" className={btnPrimary}>
          Cadastrar contato
        </Link>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-4 sm:grid-cols-3 lg:grid-cols-5">
        {grupos.map((g) => (
          <li key={g.id}>
            <a href={`#${g.id}`} className="group block">
              <span className={`block font-[family-name:var(--font-display)] text-[1.7rem] font-semibold leading-none ${g.id === "falhas" && g.itens.length ? "text-ember" : "text-fg"}`}>
                {g.itens.length}
              </span>
              <span className="mt-1 block text-[0.82rem] leading-snug text-muted underline-offset-4 group-hover:underline">{g.titulo}</span>
            </a>
          </li>
        ))}
      </ul>
      {f.testesOcultos > 0 && (
        <p className="mt-3 text-[0.84rem] text-dim">
          {f.testesOcultos} {f.testesOcultos === 1 ? "envio de teste aberto fica" : "envios de teste abertos ficam"} fora desta fila.{" "}
          <Link href="/leads/lista?testes=1" className="font-semibold text-sky underline-offset-4 hover:underline">
            Ver na lista
          </Link>
        </p>
      )}
      <div className="mt-6 grid gap-5">
        {grupos.map((g) => (
          <Painel key={g.id} id={g.id} className="scroll-mt-20">
            <Titulo nota={g.nota}>
              {g.titulo} <span className="font-normal text-dim">({g.itens.length})</span>
            </Titulo>
            {g.itens.length ? (
              <ul>
                {g.itens.map((o) => (
                  <OpLinha key={o.id} o={o} agora={f.agora} destaque={g.destaque} />
                ))}
              </ul>
            ) : (
              <Vazio>{g.vazio}</Vazio>
            )}
          </Painel>
        ))}
      </div>
    </>
  );
}
