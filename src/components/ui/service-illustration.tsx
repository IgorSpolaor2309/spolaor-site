import Image from "next/image";

// Ilustrações dos serviços (PNG original em assets/ilustracoes, WebP com alpha em public/ilustracoes,
// gerado por scripts/ilustracoes.mjs). São demonstrativas: as telas não são produtos reais e a pessoa
// não é da equipe. Título, explicação e botões continuam no HTML da página, nunca na imagem.

const illustrations = {
  "sites-responsivos": {
    src: "/ilustracoes/sites-responsivos.webp",
    width: 1524,
    height: 991,
    alt: "Ilustração: o mesmo site aberto no monitor e no celular, com o botão de contato à vista nos dois.",
  },
  "loja-virtual": {
    src: "/ilustracoes/loja-virtual.webp",
    width: 1502,
    height: 1024,
    alt: "Ilustração: catálogo de produtos no notebook, pedido confirmado no celular e caixas prontas para envio.",
  },
  "agendamento-online": {
    src: "/ilustracoes/agendamento-online.webp",
    width: 1409,
    height: 1022,
    alt: "Ilustração: no celular, o cliente escolhe o dia e o horário e recebe a confirmação; ao lado, calendário e relógio.",
  },
  "crm-automacao": {
    src: "/ilustracoes/crm-automacao.webp",
    width: 1536,
    height: 1024,
    alt: "Ilustração: pessoa acompanhando no computador os atendimentos organizados em etapas, com mensagens e tarefas concluídas.",
  },
  "diagnostico-site": {
    src: "/ilustracoes/diagnostico-site.webp",
    width: 1519,
    height: 1006,
    alt: "Ilustração: um site examinado com lupa no notebook e no celular, ao lado de uma lista de pontos a corrigir.",
  },
} as const;

export type IllustrationName = keyof typeof illustrations;

export function ServiceIllustration({
  name,
  sizes = "(min-width: 1024px) 40vw, 100vw",
  preload = false,
  decorative = false,
  caption,
  fadeBottom = false,
  className = "",
}: {
  name: IllustrationName;
  /** Largura ocupada em cada breakpoint, para o navegador baixar só o tamanho necessário */
  sizes?: string;
  /** Só para a imagem principal da primeira tela */
  preload?: boolean;
  /** alt="" quando o texto ao lado já diz tudo e a imagem só acompanha */
  decorative?: boolean;
  caption?: string;
  /** Suaviza a borda inferior quando o desenho termina cortado (pessoa e mesa no CRM) */
  fadeBottom?: boolean;
  className?: string;
}) {
  const img = illustrations[name];
  return (
    <figure className={className}>
      <Image
        src={img.src}
        width={img.width}
        height={img.height}
        alt={decorative ? "" : img.alt}
        sizes={sizes}
        preload={preload}
        loading={preload ? undefined : "lazy"}
        className={`h-auto w-full object-contain ${fadeBottom ? "mask-fade-b" : ""}`}
      />
      {caption && <figcaption className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-dim">{caption}</figcaption>}
    </figure>
  );
}
