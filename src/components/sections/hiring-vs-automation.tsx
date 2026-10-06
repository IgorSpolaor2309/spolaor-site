import { Reveal } from "@/components/ui/reveal";

// Comparação em formato de tabela: mesma linha, duas respostas. Lê como um orçamento, não como dois cards.
const rows = [
  ["Custo", "Salário, encargos e benefícios todo mês", "Construída uma vez, manutenção previsível"],
  ["Horário", "Expediente, férias e faltas", "24 horas, inclusive fim de semana"],
  ["Volume", "Mais pedidos pedem mais gente", "100 ou 1.000 pedidos, o mesmo esforço"],
  ["Erros", "Digitação, esquecimento, retrabalho", "Dado copiado por sistema não erra"],
  ["Começo", "Semanas de treinamento", "Funciona no dia em que entra no ar"],
  ["Controle", "Alguém precisa acompanhar e revisar", "Tudo registrado: o que aconteceu e quando"],
];

export function HiringVsAutomation() {
  return (
    <Reveal>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Contratar alguém para tarefas repetitivas ou automatizar essas tarefas</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="w-[18%] py-4 pr-4 align-bottom font-mono text-[0.68rem] font-normal uppercase tracking-[0.14em] text-dim">
              Para tarefas repetitivas
            </th>
            <th scope="col" className="py-4 pr-6 align-bottom text-sm font-semibold text-ember-soft md:text-base">Contratar mais uma pessoa</th>
            <th scope="col" className="py-4 align-bottom text-sm font-semibold text-signal md:text-base">Automatizar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, a, b]) => (
            <tr key={k} className="border-b border-line align-top">
              <th scope="row" className="py-4 pr-4 text-[0.82rem] font-normal text-dim md:text-sm">{k}</th>
              <td className="py-4 pr-6 text-[0.9rem] text-muted md:text-base">{a}</td>
              <td className="py-4 text-[0.9rem] text-fg md:text-base">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Reveal>
  );
}
