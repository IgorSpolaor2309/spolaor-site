import { timingSafeEqual } from "node:crypto";
import { hashToken, store, type Contratacao } from "./store";

/** Confere o link de acompanhamento (id + token secreto, guardado só como hash). */
export async function contratacaoAutorizada(id: string | null | undefined, token: string | null | undefined): Promise<Contratacao | null> {
  if (!id || !token || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const c = await store().get(id).catch(() => null);
  if (!c) return null;
  const a = Buffer.from(c.tokenHash);
  const b = Buffer.from(hashToken(token));
  return a.length === b.length && timingSafeEqual(a, b) ? c : null;
}

/** Bearer token das rotas internas (operação e cron), em tempo constante. */
export function bearerOk(req: Request, secret: string) {
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
