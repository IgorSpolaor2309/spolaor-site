import { Reveal } from "@/components/ui/reveal";

const hire = [
  ["Salário", "todo mês, faça chuva ou faça sol"],
  ["Encargos e benefícios", "que podem passar do valor do próprio salário"],
  ["Treinamento", "semanas até render como o esperado"],
  ["Equipamento e licenças", "computador, sistemas, espaço"],
  ["Gestão", "alguém precisa acompanhar e revisar"],
  ["Capacidade limitada", "horário, férias, faltas e rotatividade"],
];

const automate = [
  ["Construída uma vez", "manutenção previsível e separada"],
  ["Funciona 24 horas", "inclusive fim de semana e madrugada"],
  ["Escala com o volume", "100 ou 1.000 pedidos, o mesmo esforço"],
  ["Sem erro de digitação", "dados copiados por máquina não erram"],
  ["Tudo registrado", "você sabe o que aconteceu e quando"],
  ["Sua equipe livre", "para atender, negociar e decidir"],
];

export function HiringVsAutomation() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Reveal className="rounded-[28px] border border-line bg-ink-900 p-7 md:p-10">
        <p className="eyebrow text-ember">Contratar para tarefas repetitivas</p>
        <ul className="mt-8 divide-y divide-line">
          {hire.map(([t, d]) => (
            <li key={t} className="flex items-baseline justify-between gap-6 py-4">
              <span className="font-medium">{t}</span>
              <span className="text-right text-sm text-muted">{d}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={0.1} className="relative overflow-hidden rounded-[28px] border border-signal/25 bg-gradient-to-b from-signal/[0.07] to-ink-900 p-7 md:p-10">
        <p className="eyebrow !text-signal">Automatizar as tarefas repetitivas</p>
        <ul className="mt-8 divide-y divide-line">
          {automate.map(([t, d]) => (
            <li key={t} className="flex items-baseline justify-between gap-6 py-4">
              <span className="font-medium">{t}</span>
              <span className="text-right text-sm text-muted">{d}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
