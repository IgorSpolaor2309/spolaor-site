import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { SegmentHero } from "@/components/segment/segment-hero";
import { StorefrontScene } from "@/components/offers/scenes";
import { RequestSection } from "@/components/offers/request-section";
import { SituationsDay, type Situation } from "@/components/segment/situations-day";
import { Chat, Ledger, Reminders } from "@/components/segment/artifacts";
import { Division, JourneySection, Statement } from "@/components/segment/sections";
import type { JourneyStep } from "@/components/segment/journey";
import type { Flow } from "@/components/sections/automation-flow";
import { ContactForm } from "@/components/forms/contact-form";
import { Faq, type QA } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import { leadsAvailable } from "@/lib/leads/server/pipeline";

export const metadata: Metadata = {
  title: "Lojas virtuais para quem vende pelo Instagram, WhatsApp ou loja física",
  description:
    "Criação de lojas virtuais com catálogo, informações dos produtos, compra, pagamento e pedidos organizados, conforme o escopo de cada projeto. Para quem hoje vende pelo Instagram, pelo WhatsApp ou em loja física. Peça um orçamento.",
  alternates: { canonical: "/lojas-virtuais" },
  openGraph: { title: "Sua loja virtual, no lugar de vender pelo direct", url: "/lojas-virtuais" },
};

const situations: Situation[] = [
  {
    time: "Manhã",
    where: "abrindo as mensagens",
    text: "“Tem no M?”, “Qual o valor?”, “Como eu pago?”. As mesmas perguntas, uma conversa de cada vez.",
    outcome: "Quem não recebe resposta rápida compra de outra loja.",
    artifact: (
      <Chat
        lines={[
          { from: "them", text: "Oi! Esse modelo tem no M? Quanto fica?", meta: "09:12" },
          { from: "me", text: "Tem sim! É R$ ••,••. Quer o Pix?", meta: "11:40" },
          { from: "them", text: "Fechei com outra loja, obrigado.", meta: "11:52" },
        ]}
        footer="2h28 para responder"
      />
    ),
  },
  {
    time: "Tarde",
    where: "separando pedidos",
    text: "O pedido está num print, o comprovante em outra conversa e o endereço numa terceira.",
    outcome: "Cada pedido vira uma caça às informações.",
    artifact: (
      <Ledger
        head={["Cliente", "Produto", "Pago", "Envio"]}
        rows={[
          ["Cliente 1", "Prod. A (M)", "Pix", null],
          ["Cliente 2", null, null, "end.?"],
          ["Cliente 3", "Prod. B", "?", null],
        ]}
        note="pedidos montados à mão"
      />
    ),
  },
  {
    time: "Fim do dia",
    where: "conferindo o estoque",
    text: "O estoque está na cabeça ou numa planilha desatualizada. Um produto que acabou continua sendo oferecido.",
    outcome: "Venda feita de um item que não existe mais.",
    artifact: (
      <Reminders
        items={[
          { text: "Atualizar estoque da planilha", lost: true },
          { text: "Avisar cliente que o M acabou", lost: true },
          { text: "Conferir Pix do pedido de ontem", lost: true },
          { text: "Postar novidades", done: true },
        ]}
        note="depende de lembrar"
      />
    ),
  },
  {
    time: "Noite",
    where: "no celular, em casa",
    text: "Alguém vê o produto no Instagram às 22h e quer comprar. Não há onde clicar, só mandar mensagem para amanhã.",
    outcome: "A vontade de comprar esfria até de manhã.",
    artifact: (
      <Chat
        lines={[
          { from: "them", text: "Amei! Como faço para comprar?", meta: "22:07" },
          { from: "me", text: "Bom dia! Me passa seu CEP?", meta: "08:30" },
        ]}
        footer="10h sem resposta"
      />
    ),
  },
];

const steps: JourneyStep[] = [
  { title: "O cliente vê o catálogo", detail: "Produtos, fotos e preços num endereço que é da sua loja, aberto o dia todo.", owner: "auto" },
  { title: "Escolhe com as informações à mão", detail: "Descrição, medidas, variações e disponibilidade, sem perguntar no direct.", owner: "auto" },
  { title: "Faz o pedido", detail: "Carrinho e dados de entrega em um só fluxo, pensado para o celular.", owner: "auto" },
  { title: "Paga", detail: "Pix, cartão ou o que o projeto definir, com a confirmação chegando ao pedido.", owner: "auto" },
  { title: "O pedido fica registrado", detail: "Produto, valor, pagamento e endereço num painel, com status de cada etapa.", owner: "auto" },
  { title: "Você separa e envia", detail: "Sai da conversa solta e vai para a lista de pedidos, com tudo na tela.", owner: "human" },
];

const flows: Record<string, Flow> = {
  pedido: {
    label: "Pedido na loja",
    contact: { name: "Cliente exemplo", meta: "pedido pelo catálogo · celular", initials: "CE" },
    chat: [
      { at: 0, from: "auto", text: "Pedido recebido! 1 × Produto A (M). Assim que o pagamento for confirmado, avisamos por aqui.", time: "22:07" },
      { at: 2, from: "auto", text: "Pagamento confirmado. Seu pedido está em separação.", time: "22:09" },
      { at: 5, from: "human", text: "Seu pedido foi enviado! Código de rastreio: ••••••••••.", time: "dia seguinte · 10:30" },
    ],
    record: {
      kind: "Pedido",
      title: "Pedido #0001 · cliente exemplo",
      fields: [
        { at: 0, label: "Itens", value: "1 × Produto A (M)" },
        { at: 1, label: "Pagamento", value: "Pix" },
        { at: 2, label: "Status do pagamento", value: "confirmado" },
        { at: 3, label: "Entrega", value: "endereço informado" },
        { at: 4, label: "Responsável", value: "quem separa" },
      ],
      stages: ["Recebido", "Pago", "Enviado"],
      stageAt: [0, 2, 5],
    },
    log: [
      "Pedido criado no site",
      "Pagamento por Pix iniciado",
      "Pagamento confirmado",
      "Dados de entrega registrados",
      "Responsável avisado para separar",
      "Pedido enviado ao cliente",
    ],
  },
};

const faq: QA[] = [
  {
    q: "Quanto custa uma loja virtual?",
    a: "Cada projeto tem orçamento próprio, definido pelo número de produtos, pelas formas de pagamento e entrega e pelo que precisa ser integrado. Por isso não publicamos tabela. O formulário desta página é o caminho para chegar a um valor realista.",
  },
  {
    q: "Precisa ter CNPJ ou muitos produtos para começar?",
    a: "Não existe um mínimo fixo. Contamos o que você vende hoje e propomos o formato que cabe na sua operação. Alguns pontos, como meios de pagamento, podem ter exigências próprias de cada provedor.",
  },
  {
    q: "Quais formas de pagamento a loja aceita?",
    a: "Depende do projeto e do provedor de pagamento escolhido. Pix e cartão são comuns, e o que entra em cada loja é definido no escopo, junto com as taxas cobradas pelo provedor, que são separadas do nosso trabalho.",
  },
  {
    q: "Como fico sabendo dos pedidos?",
    a: "Cada pedido fica registrado num painel com produto, pagamento e dados de entrega, e a equipe pode ser avisada quando ele chega. O formato exato (painel, e-mail, WhatsApp) é combinado no projeto.",
  },
  {
    q: "Vou perder meus clientes do Instagram e do WhatsApp?",
    a: "Não. Instagram e WhatsApp continuam sendo canais de atendimento e divulgação. A loja dá um lugar para o cliente ver o catálogo, comprar e acompanhar o pedido, e você leva o link para os dois.",
  },
  {
    q: "O domínio e a loja ficam no meu nome?",
    a: "O domínio fica sempre no nome da sua empresa. Hospedagem e manutenção são tratadas à parte do desenvolvimento, e você escolhe se cuida da infraestrutura ou deixa com a Spolaor por uma mensalidade.",
  },
];

export default function LojasVirtuaisPage() {
  return (
    <>
      <SegmentHero
        eyebrow="Lojas virtuais"
        title={
          <>
            Quem vê o produto no Instagram precisa de <span className="text-ember">um lugar para comprar.</span>
          </>
        }
        text={
          <>
            <p className="text-fg">
              Se hoje você vende pelo Instagram, pelo WhatsApp ou numa loja física, cada venda começa com uma conversa: preço,
              tamanho, pagamento, endereço.
            </p>
            <p>
              Uma loja virtual reúne catálogo, informações dos produtos, compra, pagamento e pedidos num endereço seu, aberto a
              qualquer hora, conforme o escopo de cada projeto.
            </p>
          </>
        }
        cta="Pedir orçamento de loja virtual"
        ctaHref="#formulario"
        secondary={{ href: "#como-funciona", label: "Ver como funciona" }}
        note="Orçamento personalizado, sem tabela de preços. Você conta o que vende e respondemos com escopo, prazo e investimento."
        scene={<StorefrontScene />}
      />

      <SituationsDay
        index="01"
        label="Vender só pelas conversas"
        title="O que acontece quando cada venda é uma conversa."
        intro="Não é falta de produto nem de cliente. É o caminho entre ver e comprar, que depende de alguém responder, anotar e lembrar."
        dayLabel="Um dia de loja"
        scale={["manhã", "noite"]}
        items={situations}
        closing={
          <>
            Seu cliente quer comprar. <span className="text-muted">O que ele encontra quando decide?</span>
          </>
        }
      />

      <Statement kicker="A ideia">
        A loja não substitui o seu atendimento. <span className="text-sky">Ela tira dele o que é repetitivo e deixa a conversa para quando importa.</span>
      </Statement>

      <JourneySection
        index="02"
        title="Do produto no feed ao pedido na sua mão."
        intro={
          <>
            <p>O cliente vê, escolhe, faz o pedido e paga sem esperar resposta. O pedido chega organizado.</p>
            <p className="text-fg">Você entra para separar, embalar e enviar.</p>
          </>
        }
        steps={steps}
        humanLabel="Você"
        flows={flows}
        flowHumanLabel="você"
        aside={
          <p className="text-[1.05rem] leading-relaxed text-muted">
            Um pedido feito às 22h chega registrado, com pagamento e endereço, e o cliente é avisado de cada etapa. De manhã, você
            só separa.
          </p>
        }
      />

      <Division
        index="03"
        title={
          <>
            O que a loja pode ter. <span className="text-muted">Conforme o escopo de cada projeto.</span>
          </>
        }
        autoTitle="Pode entrar na loja"
        humanTitle="Continua com você"
        auto={[
          { title: "Catálogo", text: "Produtos com fotos, descrição, medidas e variações, organizados por categoria." },
          { title: "Informações do produto", text: "As respostas das perguntas mais comuns já na página, no lugar do direct." },
          { title: "Compra", text: "Carrinho e fechamento do pedido no celular, com dados de entrega." },
          { title: "Pagamento", text: "Meios de pagamento definidos no projeto, com a confirmação ligada ao pedido." },
          { title: "Pedidos", text: "Lista com produto, pagamento, endereço e status, em vez de prints e anotações." },
          { title: "Avisos", text: "Mensagens de pedido recebido, pago e enviado, quando o projeto prevê." },
        ]}
        human={[
          { title: "Os produtos", text: "O que vender, a que preço, com quais fotos." },
          { title: "O atendimento", text: "Dúvidas de verdade, trocas e o cliente que precisa de atenção." },
          { title: "A logística", text: "Separar, embalar e enviar, com ou sem integração a transportadoras." },
          { title: "A relação", text: "O cliente que volta porque foi bem atendido." },
        ]}
        footnote="Nem toda loja precisa de tudo isso. Integrações com meios de pagamento, frete e estoque dependem do provedor escolhido e entram no orçamento. Os custos cobrados pelos provedores são separados do desenvolvimento."
      />

      <RequestSection
        index="04"
        label="Orçamento"
        title={
          <>
            Quer vender pela internet? <span className="text-sky">Conte o que você vende.</span>
          </>
        }
        text="Diga como você vende hoje e o que a loja precisa ter. Respondemos com perguntas, se faltar algo, e depois com escopo, prazo e investimento para o seu caso."
        steps={["Você conta o que vende e como vende hoje", "Tiramos dúvidas pelo WhatsApp, se for preciso", "Você recebe o orçamento com escopo e prazo"]}
        note={
          <>
            Ainda não sabe se precisa de loja?{" "}
            <Link href="/diagnostico-site" className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
              Veja o diagnóstico do seu site
            </Link>
            .
          </>
        }
      >
        <Suspense fallback={<div className="h-[720px] rounded-[16px] border border-line bg-ink-900" />}>
          <ContactForm
            origem="lojas-virtuais"
            interests={["Vendo pelo Instagram", "Vendo pelo WhatsApp", "Tenho loja física", "Quero organizar pedidos e pagamentos", "Ainda não sei"]}
            interestsLabel="Como você vende hoje?"
            messageLabel="O que você vende e o que a loja precisa ter"
            submitLabel="Pedir orçamento de loja"
            formLabel="Pedir orçamento de loja virtual"
            available={leadsAvailable()}
          />
        </Suspense>
      </RequestSection>

      <Faq items={faq} index="05" title="O que costumam perguntar sobre lojas virtuais." />

      <FinalCta
        title={
          <>
            Seu produto já vende na conversa. <span className="text-ember">Dê a ele um lugar para vender o dia todo.</span>
          </>
        }
        text="Conte o que você vende e receba o orçamento da sua loja."
        primary={{ href: "#formulario", label: "Pedir orçamento de loja virtual" }}
        secondary={{ href: "/sites", label: "Prefiro um site ou landing page" }}
      />
    </>
  );
}
