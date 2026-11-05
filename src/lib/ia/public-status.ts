import { podeArrepender, prazoArrependimento } from "./reembolso";
import type { Contratacao, Reembolso } from "./store";

// Andamento mostrado ao comprador (autoatendimento). Só aparece como concluído o que foi
// confirmado: pagamento aprovado e conferido pelo servidor; acesso criado no ZappMillion (convite
// por e-mail enviado por eles); WhatsApp conectado (messagingAccount.status = CONNECTED).
// A configuração do agente é feita pelo comprador no painel e a API não informa esse estado, então
// ela aparece como tarefa no painel, nunca como "concluída" por nós.

export type PassoStatus = "feito" | "em_andamento" | "pendente" | "problema" | "no_painel";
export type Passo = { id: string; titulo: string; status: PassoStatus; detalhe: string };
export type StatusPublico = {
  empresa: string;
  valor: number;
  resumo: string;
  pagamentoConfirmado: boolean;
  acessoLiberado: boolean;
  /** fim do período pago (o acesso não é retirado antes) */
  acessoAte: string | null;
  cancelada: boolean;
  podeCancelar: boolean;
  /** compra de validação interna (link com token): não conta como conversão */
  interna: boolean;
  /** pagamento ainda não confirmado: a página confere no Mercado Pago (no máx. a cada 30 s) */
  confirmando: boolean;
  /** pago, com o acesso sendo criado */
  liberando: boolean;
  /** última conferência direta no Mercado Pago */
  conferidoEm: string | null;
  /** direito de arrependimento: prazo disponível e situação do pedido */
  arrependimento: { disponivel: boolean; prazo: string | null; protocolo: string | null; status: Reembolso["status"] | null; solicitadoEm: string | null; concluidoEm: string | null };
  passos: Passo[];
};

function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return d ? `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}` : "seu e-mail";
}

export function publicStatus(c: Contratacao, reembolso: Reembolso | null = null): StatusPublico {
  const pago = !!c.primeiroPagamentoEm;
  const suspensa = c.etapa === "suspensa";
  // Acesso só conta como liberado com o cliente ACTIVE no ZappMillion (não basta a etapa local).
  const acesso = !suspensa && c.zmStatus === "ACTIVE";
  const fornecedorSuspendeu = !suspensa && c.zmStatus === "SUSPENDED";
  const whatsapp = acesso && c.whatsappStatus === "CONNECTED";

  let pagamento: Passo;
  if (pago) pagamento = { id: "pagamento", titulo: "Pagamento confirmado", status: "feito", detalhe: "Confirmado pelo Mercado Pago." };
  else if (c.etapa === "assinatura_autorizada")
    pagamento = { id: "pagamento", titulo: "Pagamento em processamento", status: "em_andamento", detalhe: "A assinatura foi autorizada. Aguardando a aprovação da primeira cobrança." };
  else if (c.etapa === "cancelada") pagamento = { id: "pagamento", titulo: "Assinatura cancelada", status: "problema", detalhe: "Nenhuma cobrança foi aprovada." };
  else pagamento = { id: "pagamento", titulo: "Aguardando pagamento", status: "em_andamento", detalhe: "Assim que o Mercado Pago confirmar a primeira cobrança, esta página atualiza sozinha." };

  let acessoPasso: Passo;
  if (!pago) acessoPasso = { id: "acesso", titulo: "Acesso à plataforma", status: "pendente", detalhe: "É liberado automaticamente depois do pagamento confirmado." };
  else if (suspensa) acessoPasso = { id: "acesso", titulo: "Acesso suspenso", status: "problema", detalhe: "Fale com a Spolaor para regularizar a assinatura." };
  else if (fornecedorSuspendeu)
    acessoPasso = { id: "acesso", titulo: "Acesso interrompido", status: "problema", detalhe: "O acesso foi interrompido na plataforma. A Spolaor já foi avisada e vai restabelecer; o seu período pago não muda." };
  else if (acesso)
    acessoPasso = {
      id: "acesso",
      titulo: "Acesso liberado",
      status: "feito",
      detalhe: `O convite para criar a senha foi enviado para ${maskEmail(c.email)}. Confira também a caixa de spam.`,
    };
  else if (c.etapa === "ativacao_pendente")
    acessoPasso = {
      id: "acesso",
      titulo: "Ativação pendente",
      status: "problema",
      detalhe: "O pagamento foi confirmado, mas a liberação do acesso ainda não foi concluída. A Spolaor já foi avisada e vai concluir a ativação.",
    };
  else acessoPasso = { id: "acesso", titulo: "Liberando o acesso", status: "em_andamento", detalhe: "Estamos criando a sua conta na plataforma." };

  const agente: Passo = acesso
    ? { id: "agente", titulo: "Configure o agente no painel", status: "no_painel", detalhe: "Informe serviços, horários e respostas e use o teste do agente antes de conectar o número." }
    : { id: "agente", titulo: "Configuração do agente", status: "pendente", detalhe: "Você faz no painel, depois que o acesso for liberado." };

  const wpp: Passo = whatsapp
    ? { id: "whatsapp", titulo: "WhatsApp conectado", status: "feito", detalhe: "O número foi conectado e autorizado na Meta." }
    : acesso
      ? { id: "whatsapp", titulo: "Conecte o seu WhatsApp", status: "no_painel", detalhe: "No painel, em Conectar, entre com a conta da Meta e autorize o número da empresa." }
      : { id: "whatsapp", titulo: "Conexão do WhatsApp", status: "pendente", detalhe: "Você conecta pelo painel, depois que o acesso for liberado." };

  const resumo = suspensa
    ? "O acesso está suspenso. Fale com a Spolaor para regularizar."
    : !pago
      ? "Aguardando a confirmação do pagamento."
      : whatsapp
        ? "Acesso liberado e WhatsApp conectado."
        : acesso
          ? "Pagamento confirmado e acesso liberado. Agora é com você no painel."
          : c.etapa === "ativacao_pendente"
            ? "Pagamento confirmado. A liberação do acesso está pendente."
            : "Pagamento confirmado. Estamos liberando o seu acesso.";

  const cancelada = c.etapa === "cancelada";
  return {
    empresa: c.empresa,
    valor: c.precoMensal,
    resumo: reembolso
      ? reembolso.status === "concluido"
        ? "Reembolso concluído. O Mercado Pago confirmou o estorno e o acesso foi encerrado."
        : "Pedido de arrependimento recebido. A assinatura não terá novas cobranças."
      : cancelada && acesso && c.pagoAte ? `Assinatura cancelada. O acesso continua até ${new Date(c.pagoAte).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.` : resumo,
    pagamentoConfirmado: pago,
    acessoLiberado: acesso,
    acessoAte: c.pagoAte,
    cancelada,
    podeCancelar: !cancelada && !suspensa && !!c.mpPreapprovalId && !reembolso,
    interna: c.utm?.validacao === "interna",
    confirmando: !pago && (c.etapa === "aguardando_pagamento" || c.etapa === "assinatura_autorizada"),
    liberando: pago && !acesso && c.etapa === "pagamento_confirmado",
    conferidoEm: c.mpConferidoEm ?? null,
    arrependimento: {
      disponivel: !reembolso && pago && podeArrepender(c),
      prazo: prazoArrependimento(c),
      protocolo: reembolso?.id ?? null,
      status: reembolso?.status ?? null,
      solicitadoEm: reembolso?.solicitadoEm ?? null,
      concluidoEm: reembolso?.confirmadoEm ?? null,
    },
    passos: [pagamento, acessoPasso, agente, wpp],
  };
}
