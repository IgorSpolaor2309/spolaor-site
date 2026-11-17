#!/usr/bin/env node
// Valida content/blog. Sai com código 1 se houver erro (o build e a Action de publicação param aqui).
// Uso: node scripts/blog/validar.mjs [--json]
import { validarTudo } from "./regras.mjs";

const { erros, avisos, artigos, execucoes } = validarTudo(process.cwd());
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ok: erros.length === 0, erros, avisos, artigos: artigos.length, execucoes: execucoes.length }, null, 2));
} else {
  for (const a of avisos) console.log(`aviso: ${a}`);
  for (const e of erros) console.error(`ERRO: ${e}`);
  const publicados = artigos.filter((a) => a.meta.status === "publicado").length;
  console.log(`blog: ${artigos.length} artigo(s), ${publicados} publicado(s), ${execucoes.length} execução(ões) — ${erros.length ? `${erros.length} erro(s)` : "ok"}`);
}
process.exit(erros.length ? 1 : 0);
