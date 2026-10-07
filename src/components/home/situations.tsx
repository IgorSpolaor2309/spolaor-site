import { SituationsDay, type Situation } from "@/components/segment/situations-day";
import { BlindFunnel, Channels, Ledger, Notice, Reminders } from "@/components/segment/artifacts";

const items: Situation[] = [
  {
    time: "09:12",
    where: "no meio de uma reunião",
    text: "Um cliente pediu orçamento pelo site. Ninguém respondeu na hora.",
    outcome: "Ele fechou com quem respondeu primeiro.",
    artifact: <Notice app="Formulário do site" from="Novo pedido de orçamento" text="Preciso para esta semana. Vocês conseguem?" meta="sem resposta" />,
  },
  {
    time: "10:40",
    where: "olhando o site",
    text: "Você investiu num site bonito. Mas não sabe quantos clientes ele trouxe este mês.",
    outcome: "Sem saber o que funciona, não dá para melhorar.",
    artifact: (
      <BlindFunnel
        rows={[
          { label: "Visitas", width: 100 },
          { label: "Leram a oferta", width: 62 },
          { label: "Pediram contato", width: 30, unknown: true },
          { label: "Viraram clientes", width: 14, unknown: true },
        ]}
        note="daqui para baixo, ninguém mede"
      />
    ),
  },
  {
    time: "13:45",
    where: "na volta do almoço",
    text: "Os contatos chegam pelo WhatsApp, pelo site e pelo Instagram. Ninguém sabe ao certo quem ainda espera retorno.",
    outcome: "Quem fica sem resposta procura outra opção.",
    artifact: (
      <Channels
        items={[
          { name: "WhatsApp", count: 7, owner: "no celular de alguém" },
          { name: "Site", count: 4, owner: "numa caixa de e-mail" },
          { name: "Instagram", count: 5 },
        ]}
      />
    ),
  },
  {
    time: "16:20",
    where: "no fim da tarde",
    text: "Alguém da equipe passa a tarde copiando dados de um lugar para outro e atualizando planilha.",
    outcome: "Horas de trabalho que poderiam acontecer sozinhas.",
    artifact: (
      <Ledger
        head={["Nome", "Telefone", "Origem", "Status"]}
        rows={[
          ["Ana P.", "(11) 9…", "WhatsApp", null],
          ["Roberto", null, "Site", "Orçamento"],
          ["Lúcia M.", "(19) 9…", null, null],
        ]}
        note="atualizada à mão"
      />
    ),
  },
  {
    time: "18:50",
    where: "fechando o dia",
    text: "Ficou para amanhã: cobrar o retorno, responder aquele cliente, chamar de novo quem pediu proposta.",
    outcome: "Amanhã chegam novos contatos. Esses ficam para depois.",
    artifact: (
      <Reminders
        items={[
          { text: "Enviar contrato", done: true },
          { text: "Cobrar retorno da proposta", lost: true },
          { text: "Responder a Fernanda", lost: true },
          { text: "Chamar quem pediu orçamento na segunda", lost: true },
        ]}
        note="depende de alguém lembrar"
      />
    ),
  },
];

export function HomeSituations() {
  return (
    <SituationsDay
      index="01"
      label="Onde se perde"
      title="Situações que parecem normais. E custam clientes todos os dias."
      intro="Não é falta de esforço da equipe. É o contato que chega na hora errada, pelo canal errado, e depende de alguém lembrar. Nada disso aparece no relatório."
      items={items}
      closing={
        <>
          O problema raramente é o produto. <span className="text-muted">É o caminho entre o primeiro contato e a venda.</span>
        </>
      }
    />
  );
}
