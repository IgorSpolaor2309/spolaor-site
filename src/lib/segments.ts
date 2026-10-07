import type { LeadOrigem } from "@/lib/leads/schema";

// Opções do formulário de diagnóstico. Cada página pergunta pelo problema na língua do segmento.

export const SEGMENTOS = [
  "Corretor de imóveis",
  "Clínica ou consultório",
  "Empresa que vende por orçamento",
  "Comércio ou loja",
  "Prestação de serviços",
  "Outro",
] as const;

export const PROBLEMAS: Record<"geral" | "corretores" | "clinicas" | "orcamentos", string[]> = {
  geral: [
    "Demoramos para responder quem chega",
    "O site recebe visitas, mas gera poucos contatos",
    "Contatos espalhados entre WhatsApp, planilha e e-mail",
    "Ninguém faz o segundo contato",
    "Equipe presa em tarefas manuais repetitivas",
    "Ainda não sei onde está o problema",
  ],
  corretores: [
    "O lead chega quando estou em visita ou dirigindo",
    "Pago por leads e perco parte deles",
    "Interessados esquecidos no WhatsApp",
    "Não volto em quem disse “vou pensar”",
    "Não sei de onde vêm meus melhores leads",
    "Outro",
  ],
  clinicas: [
    "Mensagens esperando enquanto a recepção atende",
    "Perguntam o preço e somem",
    "A recepção responde as mesmas perguntas o dia todo",
    "Faltas e cancelamentos em cima da hora",
    "Contatos antigos que ninguém chamou de novo",
    "Outro",
  ],
  orcamentos: [
    "Demoramos para responder pedidos de orçamento",
    "Enviamos o orçamento e não acompanhamos",
    "Ninguém volta em quem disse “vou analisar”",
    "Os pedidos chegam incompletos",
    "Não sei quantos orçamentos viram venda",
    "Outro",
  ],
};

export type SegmentKey = "corretores" | "clinicas" | "orcamentos";

/** Segmento já conhecido em cada landing (o formulário não pergunta de novo). */
export const SEGMENTO_DA_ORIGEM: Partial<Record<LeadOrigem, string>> = {
  corretores: "Corretor de imóveis",
  clinicas: "Clínica ou consultório",
  orcamentos: "Empresa que vende por orçamento",
};

/** Páginas que têm o formulário de diagnóstico (#analise) na própria página. */
export const PAGES_WITH_FORM = ["/", "/corretores", "/clinicas", "/orcamentos", "/analise", "/sites"];

export const segmentPages = [
  {
    href: "/corretores",
    label: "Corretores de imóveis",
    short: "Corretores",
    line: "Para quem está em visita quando o próximo interessado chama.",
  },
  {
    href: "/clinicas",
    label: "Clínicas e consultórios",
    short: "Clínicas",
    line: "Para recepções que atendem o balcão, o telefone e o WhatsApp ao mesmo tempo.",
  },
  {
    href: "/orcamentos",
    label: "Empresas que vendem por orçamento",
    short: "Orçamentos",
    line: "Para quem envia proposta e depois perde o fio da negociação.",
  },
];
