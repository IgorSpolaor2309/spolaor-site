import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/crm/auth";
import { exportacao } from "@/lib/crm/consultas";
import { atribuicao, CANAL_ROTULO, ETAPA_ROTULO } from "@/lib/crm/tipos";

// Exportação das oportunidades em CSV. Rota privada: sem sessão válida responde 401 e não lê nada.
// Protege contra fórmulas em planilha (valores iniciados por = + - @ ganham apóstrofo).
const cel = (v: string | number | null) => {
  let s = v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET() {
  const usuario = await usuarioAtual().catch(() => null);
  if (!usuario) return NextResponse.json({ ok: false, error: "nao_autorizado" }, { status: 401, headers: { "cache-control": "no-store" } });
  const ops = await exportacao();
  const cab = ["Recebido em", "Nome", "Empresa", "WhatsApp", "E-mail", "Serviço", "Etapa", "Canal", "Origem", "Fonte", "Base da fonte", "utm_campaign", "Página", "Primeiro contato em", "Próxima ação em", "Valor da proposta", "Valor fechado", "Motivo da perda", "Responsável", "Mensagem", "Id"];
  const linhas = ops.map((o) => {
    const a = atribuicao(o);
    return [
      o.recebidoEm,
      o.contato.nome,
      o.contato.empresa,
      o.contato.whatsapp,
      o.contato.email,
      o.servico,
      ETAPA_ROTULO[o.etapa],
      CANAL_ROTULO[o.canal],
      o.origem,
      a.fonte,
      a.base,
      o.utm.utm_campaign ?? null,
      o.pagina,
      o.primeiroContatoEm,
      o.proximaAcaoEm,
      o.valorProposta,
      o.valorFechado,
      o.motivoPerda,
      o.responsavelNome,
      o.mensagem,
      o.id,
    ]
      .map(cel)
      .join(";");
  });
  const csv = `﻿${cab.map(cel).join(";")}\r\n${linhas.join("\r\n")}\r\n`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-spolaor-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
