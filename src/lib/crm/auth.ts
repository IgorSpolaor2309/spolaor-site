import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { crmConfigured, db } from "./db";
import { normEmail } from "./normalizar";
import type { Usuario } from "./tipos";

// Acesso ao CRM. Não existe cadastro: só entra quem está na lista de e-mails autorizados (CRM_ACESSO_EMAILS;
// se vazia, os destinatários dos avisos de lead, LEAD_EMAIL_TO, que já recebem todos os contatos). O login é um
// código de uso único enviado para esse e-mail; a sessão fica em cookie httpOnly e no banco (só o hash).
// Toda página, ação e rota do CRM chama exigirUsuario()/usuarioAtual(): esconder o endereço não protege nada.

const env = (k: string) => (process.env[k] ?? "").trim();
const COOKIE = "spolaor_crm";
const SESSAO_DIAS = 30;
const CODIGO_MINUTOS = 10;
const CODIGO_TENTATIVAS = 5;
const CODIGOS_POR_JANELA = 4; // pedidos de código por e-mail a cada 15 minutos
const CODIGOS_POR_DIA = 15; // pedidos de código por e-mail em 24 horas
const ERROS_POR_DIA = 25; // códigos errados por e-mail em 24 horas: depois disso, só no dia seguinte

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export function emailsAutorizados(): string[] {
  const raw = env("CRM_ACESSO_EMAILS") || env("LEAD_EMAIL_TO");
  return [...new Set(raw.split(",").map((e) => normEmail(e)).filter((e): e is string => !!e))];
}

/** O que falta para o login funcionar (para a tela de entrada dizer a verdade). */
export function acessoPronto(): { pronto: boolean; falta: string[] } {
  const falta: string[] = [];
  if (!crmConfigured()) falta.push("banco de dados (DATABASE_URL)");
  if (!emailsAutorizados().length) falta.push("e-mails autorizados (CRM_ACESSO_EMAILS)");
  if (process.env.NODE_ENV === "production" && !(env("RESEND_API_KEY") && env("LEAD_EMAIL_FROM"))) falta.push("envio de e-mail (RESEND_API_KEY e LEAD_EMAIL_FROM)");
  return { pronto: falta.length === 0, falta };
}

async function enviarCodigo(email: string, codigo: string): Promise<boolean> {
  if (!(env("RESEND_API_KEY") && env("LEAD_EMAIL_FROM"))) {
    // Só em desenvolvimento local: sem provedor, o código aparece no terminal.
    if (process.env.NODE_ENV !== "production") {
      console.info(`[crm] código de acesso para ${email}: ${codigo}`);
      return true;
    }
    return false;
  }
  try {
    const res = await fetch(env("RESEND_API_URL") || "https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env("LEAD_EMAIL_FROM"),
        to: [email],
        subject: `${codigo} é o seu código de acesso ao CRM da Spolaor`,
        text: `Código de acesso ao CRM da Spolaor Tecnologia: ${codigo}\n\nVale por ${CODIGO_MINUTOS} minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail: ninguém entra sem o código.\n`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Pede um código. A resposta é a mesma para e-mail autorizado ou não (não revela quem tem acesso);
 * `falha_envio` só aparece quando o provedor de e-mail recusou um pedido legítimo.
 */
export async function solicitarCodigo(emailRaw: string): Promise<"ok" | "falha_envio"> {
  const email = normEmail(emailRaw);
  if (!email || !emailsAutorizados().includes(email)) return "ok";
  const sql = await db();
  const [{ n, dia, erros }] = await sql<{ n: number; dia: number; erros: number }[]>`
    select count(*) filter (where criado_em > now() - interval '15 minutes')::int as n, count(*)::int as dia, coalesce(sum(tentativas), 0)::int as erros
    from crm_login_codigos where email = ${email} and criado_em > now() - interval '24 hours'`;
  if (n >= CODIGOS_POR_JANELA || dia >= CODIGOS_POR_DIA || erros >= ERROS_POR_DIA) return "ok";
  const id = randomUUID();
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await sql`
    insert into crm_login_codigos (id, email, codigo_hash, expira_em)
    values (${id}, ${email}, ${hash(`${id}:${codigo}`)}, now() + ${`${CODIGO_MINUTOS} minutes`}::interval)`;
  // Limpeza oportunista: o que venceu há mais de dois dias não conta mais para nenhum limite.
  await sql`delete from crm_login_codigos where expira_em < now() - interval '2 days'`.catch(() => {});
  return (await enviarCodigo(email, codigo)) ? "ok" : "falha_envio";
}

/** Confere o código mais recente do e-mail. Cria a sessão e o cookie se estiver certo. */
export async function entrarComCodigo(emailRaw: string, codigoRaw: string): Promise<boolean> {
  const email = normEmail(emailRaw);
  const codigo = codigoRaw.replace(/\D/g, "");
  if (!email || codigo.length !== 6 || !emailsAutorizados().includes(email)) return false;
  const sql = await db();
  const ok = await sql.begin(async (tx) => {
    const [c] = await tx<{ id: string; codigo_hash: string; tentativas: number }[]>`
      select id, codigo_hash, tentativas from crm_login_codigos
      where email = ${email} and usado_em is null and expira_em > now()
      order by criado_em desc limit 1 for update`;
    if (!c || c.tentativas >= CODIGO_TENTATIVAS) return false;
    // Teto diário de erros por e-mail: adivinhar 6 dígitos pedindo códigos novos deixa de ser viável.
    const [{ erros }] = await tx<{ erros: number }[]>`
      select coalesce(sum(tentativas), 0)::int as erros from crm_login_codigos where email = ${email} and criado_em > now() - interval '24 hours'`;
    if (erros >= ERROS_POR_DIA) return false;
    const a = Buffer.from(c.codigo_hash);
    const b = Buffer.from(hash(`${c.id}:${codigo}`));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await tx`update crm_login_codigos set tentativas = tentativas + 1 where id = ${c.id}`;
      return false;
    }
    await tx`update crm_login_codigos set usado_em = now() where id = ${c.id}`;
    return true;
  });
  if (!ok) return false;

  const nomePadrao = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\p{L}/gu, (l) => l.toUpperCase()).slice(0, 60);
  const [u] = await sql<{ id: string }[]>`
    insert into crm_usuarios (id, email, nome, ultimo_acesso_em) values (${randomUUID()}, ${email}, ${nomePadrao}, now())
    on conflict (email) do update set ultimo_acesso_em = now()
    returning id`;
  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into crm_sessoes (token_hash, usuario_id, expira_em) values (${hash(token)}, ${u.id}, now() + ${`${SESSAO_DIAS} days`}::interval)`;
  await sql`delete from crm_sessoes where expira_em < now()`.catch(() => {});
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSAO_DIAS * 86400,
  });
  return true;
}

/** Usuário da sessão, ou null. Uma consulta por requisição (cache do React). */
export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  // cookies() primeiro: marca a rota como dinâmica mesmo quando não há banco no build.
  const token = (await cookies()).get(COOKIE)?.value;
  if (!crmConfigured()) return null;
  if (!token || token.length < 20 || token.length > 100) return null;
  const sql = await db();
  const th = hash(token);
  const [u] = await sql<Usuario[]>`
    select u.id, u.email, u.nome from crm_sessoes s join crm_usuarios u on u.id = s.usuario_id
    where s.token_hash = ${th} and s.expira_em > now()`;
  if (!u) return null;
  // Tirar o e-mail da lista de autorizados encerra o acesso na hora, mesmo com sessão válida.
  if (!emailsAutorizados().includes(u.email)) {
    await sql`delete from crm_sessoes where usuario_id = ${u.id}`;
    return null;
  }
  await sql`update crm_sessoes set visto_em = now() where token_hash = ${th} and visto_em < now() - interval '1 hour'`.catch(() => {});
  return u;
});

/** Para páginas e ações: sem sessão válida, vai para a tela de entrada. */
export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioAtual();
  if (!u) redirect("/leads/entrar");
  return u;
}

export async function sair() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && crmConfigured()) {
    const sql = await db();
    await sql`delete from crm_sessoes where token_hash = ${hash(token)}`.catch(() => {});
  }
  jar.delete(COOKIE);
}

export async function renomearUsuario(id: string, nome: string) {
  const sql = await db();
  await sql`update crm_usuarios set nome = ${nome.trim().slice(0, 60)} where id = ${id}`;
}
