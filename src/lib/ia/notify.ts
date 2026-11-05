// Aviso à operação da Spolaor (ativação pendente, estorno, divergência de valor...). Usa o mesmo
// provedor de e-mail dos leads (RESEND_*), destino IA_OPERACAO_EMAIL ou LEAD_EMAIL_TO. Nunca
// inclui credenciais, dados de cartão ou o corpo das respostas dos fornecedores.

const env = (k: string) => (process.env[k] ?? "").trim();

export async function notifyOps(subject: string, text: string) {
  const to = (env("IA_OPERACAO_EMAIL") || env("LEAD_EMAIL_TO")).split(",").map((s) => s.trim()).filter(Boolean);
  const line = `[atendimento-ia] ${subject}`;
  if (!env("RESEND_API_KEY") || !env("LEAD_EMAIL_FROM") || !to.length) {
    console.warn(`${line} (aviso por e-mail não configurado)`);
    return;
  }
  try {
    const res = await fetch(env("RESEND_API_URL") || "https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env("LEAD_EMAIL_FROM"), to, subject: `Atendimento IA · ${subject}`.slice(0, 200), text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn(`${line} (e-mail recusado: HTTP ${res.status})`);
  } catch (e) {
    console.warn(`${line} (e-mail falhou: ${(e as Error).message})`);
  }
}
