// Aviso à operação da Spolaor (ativação pendente, estorno, divergência de valor...). Usa o mesmo
// provedor de e-mail dos leads (RESEND_*), destino IA_OPERACAO_EMAIL ou LEAD_EMAIL_TO. Nunca
// inclui credenciais, dados de cartão ou o corpo das respostas dos fornecedores.

const env = (k: string) => (process.env[k] ?? "").trim();

/**
 * E-mail interno pelo Resend, para o destinatário da operação. Devolve se o provedor aceitou, sem lançar erro.
 * `idempotencyKey` evita duplicar a mensagem no provedor quando o mesmo envio é repetido.
 */
export async function sendInternalEmail(m: { subject: string; text: string; idempotencyKey?: string }): Promise<{ ok: true; id?: string } | { ok: false; erro: string }> {
  const to = (env("IA_OPERACAO_EMAIL") || env("LEAD_EMAIL_TO")).split(",").map((s) => s.trim()).filter(Boolean);
  if (!env("RESEND_API_KEY") || !env("LEAD_EMAIL_FROM") || !to.length) return { ok: false, erro: "e-mail não configurado" };
  try {
    const res = await fetch(env("RESEND_API_URL") || "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env("RESEND_API_KEY")}`,
        "content-type": "application/json",
        ...(m.idempotencyKey ? { "idempotency-key": m.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: env("LEAD_EMAIL_FROM"), to, subject: m.subject.slice(0, 200), text: m.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, erro: `recusado HTTP ${res.status}` };
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: body.id };
  } catch (e) {
    return { ok: false, erro: `falha (${(e as Error).name})` };
  }
}

export async function notifyOps(subject: string, text: string) {
  const line = `[atendimento-ia] ${subject}`;
  const r = await sendInternalEmail({ subject: `Atendimento IA · ${subject}`, text });
  if (!r.ok) console.warn(`${line} (${r.erro === "e-mail não configurado" ? "aviso por e-mail não configurado" : `e-mail ${r.erro}`})`);
}
