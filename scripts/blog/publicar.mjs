#!/usr/bin/env node
// Publicação do blog, executada pela Action .github/workflows/blog-publicar.yml (não pela rotina).
//
//   node scripts/blog/publicar.mjs conferir  <ref>   confere que o envio só cria/altera arquivos permitidos
//   node scripts/blog/publicar.mjs integrar  <ref>   aplica esses arquivos sobre a main, valida e faz push
//   node scripts/blog/publicar.mjs verificar <ref>   espera o deploy, confere o blog em produção e grava o
//                                                    resultado no registro da execução (content/blog/execucoes)
//
// A rotina editorial só envia uma branch blog-publicacao/<turno>. Quem escreve na main é este script, com
// as regras de scripts/blog/regras.mjs. Nada aqui apaga artigo: despublicar é mudar o status.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CAMINHOS_DA_ROTINA, separar, validarTudo } from "./regras.mjs";

const [cmd, ref = "HEAD"] = process.argv.slice(2);
const RAIZ = process.cwd();
const BLOG = (process.env.BLOG_ORIGEM || "https://blog.spolaortecnologia.com.br").replace(/\/$/, "");
const AUTOR_NOME = process.env.BLOG_AUTOR_NOME || "IgorSpolaor2309";
const AUTOR_EMAIL = process.env.BLOG_AUTOR_EMAIL || "123797800+IgorSpolaor2309@users.noreply.github.com";
const MINUTOS = Number(process.env.BLOG_VERIFICAR_MINUTOS || 12);
const ESTADO = path.join(process.env.RUNNER_TEMP || RAIZ, "blog-publicacao.json");

const git = (...args) => execFileSync("git", args, { cwd: RAIZ, encoding: "utf8" }).trim();
const falhar = (msg) => {
  console.error(`ERRO: ${msg}`);
  process.exit(1);
};
const resumo = (linha) => {
  console.log(linha);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${linha}\n`);
};

function mudancas(alvo) {
  git("fetch", "--quiet", "origin", "main");
  const base = git("merge-base", "origin/main", alvo);
  const linhas = git("diff", "--name-status", "--no-renames", base, alvo).split("\n").filter(Boolean);
  return {
    base,
    itens: linhas.map((l) => {
      const [status, arquivo] = l.split("\t");
      return { status, arquivo };
    }),
  };
}

function conferir(alvo) {
  const { base, itens } = mudancas(alvo);
  if (itens.length === 0) falhar("o envio não altera nada em relação à main");
  const recusados = itens.filter(({ status, arquivo }) => !["A", "M"].includes(status) || !CAMINHOS_DA_ROTINA.some((re) => re.test(arquivo)));
  if (recusados.length) {
    falhar(
      `o envio mexe em arquivos que a rotina não pode alterar (só cria/altera artigos, registros de execução e a pauta; nunca apaga):\n` +
        recusados.map((r) => `  ${r.status} ${r.arquivo}`).join("\n"),
    );
  }
  const arquivos = itens.map((i) => i.arquivo);
  fs.writeFileSync(ESTADO, JSON.stringify({ base, alvo: git("rev-parse", alvo), arquivos }, null, 2));
  resumo(`Envio conferido: ${arquivos.length} arquivo(s) em content/blog.`);
  for (const a of arquivos) resumo(`- ${a}`);
  return { base, arquivos };
}

function integrar(alvo) {
  const { base, arquivos } = conferir(alvo);
  const sha = git("rev-parse", alvo);
  const mostrar = (rev, arq) => {
    try {
      return execFileSync("git", ["show", `${rev}:${arq}`], { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return null;
    }
  };
  // Reexecução: o envio já está na main (artigos e pauta iguais, registros já criados). Não publica de novo.
  const jaAplicado = arquivos.every((a) =>
    /\/execucoes\//.test(a) ? mostrar("origin/main", a) !== null : mostrar("origin/main", a) === mostrar(sha, a),
  );
  if (jaAplicado) {
    const atual = git("rev-parse", "origin/main");
    resumo(`O envio já está na main (${atual.slice(0, 7)}); nada a publicar de novo, só a verificação.`);
    const estado = JSON.parse(fs.readFileSync(ESTADO, "utf8"));
    fs.writeFileSync(ESTADO, JSON.stringify({ ...estado, commitMain: atual }, null, 2));
    return;
  }
  // Arquivo alterado na main depois que a rotina começou = conflito: a rotina refaz a partir da main atual.
  const naMain = new Set(git("diff", "--name-only", base, "origin/main").split("\n").filter(Boolean));
  const conflitos = arquivos.filter((a) => naMain.has(a) && mostrar("origin/main", a) !== mostrar(sha, a));
  if (conflitos.length) falhar(`a main mudou estes arquivos depois do início da execução: ${conflitos.join(", ")}`);

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    git("fetch", "--quiet", "origin", "main");
    git("checkout", "--quiet", "-B", "blog-publicar", "origin/main");
    git("checkout", sha, "--", ...arquivos);
    const { erros, avisos } = validarTudo(RAIZ);
    for (const a of avisos) console.log(`aviso: ${a}`);
    if (erros.length) falhar(`conteúdo inválido depois de aplicar sobre a main:\n${erros.map((e) => `  ${e}`).join("\n")}`);
    git("add", "--", ...arquivos);
    const turnos = [...new Set(arquivos.map((a) => /execucoes\/(.+)\.json$/.exec(a)?.[1]).filter(Boolean))];
    const artigos = arquivos.map((a) => /artigos\/(.+)\.md$/.exec(a)?.[1]).filter(Boolean);
    const titulo = `Blog: ${turnos.join(", ") || "conteúdo"}${artigos.length ? ` (${artigos.join(", ")})` : ""}`;
    const corpo = `Publicação automática do blog a partir de ${process.env.GITHUB_REF_NAME || alvo} (${sha.slice(0, 7)}).\n\n${arquivos.join("\n")}`;
    execFileSync("git", ["-c", `user.name=${AUTOR_NOME}`, "-c", `user.email=${AUTOR_EMAIL}`, "commit", "--quiet", "-m", titulo, "-m", corpo], { cwd: RAIZ });
    try {
      git("push", "--quiet", "origin", "HEAD:main");
      const novo = git("rev-parse", "HEAD");
      resumo(`Publicado na main: ${novo.slice(0, 7)} — ${titulo}`);
      const estado = JSON.parse(fs.readFileSync(ESTADO, "utf8"));
      fs.writeFileSync(ESTADO, JSON.stringify({ ...estado, commitMain: novo }, null, 2));
      return;
    } catch (e) {
      console.log(`push recusado (tentativa ${tentativa}): ${String(e.message).split("\n")[0]}`);
    }
  }
  falhar("não consegui atualizar a main depois de 3 tentativas");
}

// ---------- verificação em produção ----------

const decodificar = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

async function obter(url) {
  try {
    const r = await fetch(url, { redirect: "manual", headers: { "user-agent": "spolaor-blog-verificacao", "cache-control": "no-cache" } });
    return { status: r.status, headers: r.headers, texto: await r.text() };
  } catch (e) {
    return { status: 0, headers: new Headers(), texto: String(e.message) };
  }
}

async function conferirArtigo(slug, meta, sitemap) {
  const url = `${BLOG}/${slug}`;
  const r = await obter(url);
  const problemas = [];
  const noSitemap = sitemap.includes(`<loc>${url}</loc>`);
  if (meta.status === "publicado") {
    if (r.status !== 200) problemas.push(`HTTP ${r.status}`);
    else {
      const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(r.texto);
      if (!h1 || decodificar(h1[1]) !== meta.titulo.trim()) problemas.push("título (h1) diferente do publicado");
      const canonical = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/.exec(r.texto)?.[1];
      if (canonical !== url) problemas.push(`canonical ${canonical ?? "ausente"}`);
      const robots = /<meta[^>]+name="robots"[^>]+content="([^"]+)"/.exec(r.texto)?.[1] ?? "";
      if (/noindex/i.test(robots) || /noindex/i.test(r.headers.get("x-robots-tag") ?? "")) problemas.push("página com noindex");
    }
    if (!noSitemap) problemas.push("fora do sitemap");
    else {
      const lastmod = new RegExp(`<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc><lastmod>([^<]+)</lastmod>`).exec(sitemap)?.[1];
      if (lastmod !== new Date(meta.atualizadoEm).toISOString()) problemas.push(`sitemap ainda com a versão anterior (${lastmod})`);
    }
  } else {
    if (r.status !== 404) problemas.push(`esperava 404 para ${meta.status}, veio HTTP ${r.status}`);
    if (noSitemap) problemas.push("ainda está no sitemap");
  }
  return { slug, url, status: r.status, problemas };
}

async function verificar() {
  const estado = JSON.parse(fs.readFileSync(ESTADO, "utf8"));
  const artigos = estado.arquivos
    .map((a) => /^content\/blog\/artigos\/(.+)\.md$/.exec(a)?.[1])
    .filter(Boolean)
    .map((slug) => ({ slug, meta: separar(fs.readFileSync(path.join(RAIZ, "content/blog/artigos", `${slug}.md`), "utf8")).meta }));

  let resultado = [];
  let gerais = [];
  const limite = Date.now() + MINUTOS * 60_000;
  do {
    const sitemap = (await obter(`${BLOG}/sitemap.xml`)).texto;
    const robots = await obter(`${BLOG}/robots.txt`);
    const indice = await obter(`${BLOG}/`);
    gerais = [];
    if (robots.status !== 200 || !/Allow: \//.test(robots.texto) || /Disallow: \/\s*$/m.test(robots.texto)) gerais.push(`robots.txt HTTP ${robots.status} ou bloqueando`);
    if (indice.status !== 200) gerais.push(`índice do blog HTTP ${indice.status}`);
    resultado = await Promise.all(artigos.map((a) => conferirArtigo(a.slug, a.meta, sitemap)));
    if (!gerais.length && resultado.every((r) => r.problemas.length === 0)) break;
    await new Promise((r) => setTimeout(r, 20_000));
  } while (Date.now() < limite);

  const ok = !gerais.length && resultado.every((r) => r.problemas.length === 0);
  const agora = new Date().toISOString();
  for (const r of resultado) resumo(`- ${r.url}: ${r.problemas.length ? `FALHA (${r.problemas.join("; ")})` : "ok"}`);
  for (const g of gerais) resumo(`- geral: ${g}`);

  // Registro da execução: resultado da verificação e situação final.
  git("fetch", "--quiet", "origin", "main");
  git("checkout", "--quiet", "-B", "blog-verificar", "origin/main");
  const registros = estado.arquivos.filter((a) => /^content\/blog\/execucoes\/.+\.json$/.test(a));
  let alterou = false;
  for (const arq of registros) {
    const p = path.join(RAIZ, arq);
    const e = JSON.parse(fs.readFileSync(p, "utf8"));
    const alvo = resultado.find((r) => r.slug === e.artigo);
    if (e.acao === "nenhuma" || !alvo) {
      if (e.verificacao?.situacao === "pendente") {
        e.verificacao = { situacao: "nao-se-aplica", em: agora, detalhes: "Execução sem artigo novo ou alterado." };
        alterou = true;
        fs.writeFileSync(p, `${JSON.stringify(e, null, 2)}\n`);
      }
      continue;
    }
    e.verificacao = {
      situacao: ok ? "ok" : "falha",
      em: agora,
      url: alvo.url,
      commit: estado.commitMain ?? null,
      detalhes: ok ? "Página no ar com título, canonical, sem noindex e no sitemap." : [...gerais, ...alvo.problemas].join("; "),
    };
    if (ok && e.situacao === "enviado") e.situacao = e.acao === "novo" ? "publicado" : "atualizado";
    if (!ok) e.situacao = "falha";
    e.fim = e.fim ?? agora;
    fs.writeFileSync(p, `${JSON.stringify(e, null, 2)}\n`);
    alterou = true;
  }
  if (alterou) {
    const { erros } = validarTudo(RAIZ);
    if (erros.length) falhar(`registro inválido: ${erros.join("; ")}`);
    git("add", "--", ...registros);
    execFileSync("git", ["-c", `user.name=${AUTOR_NOME}`, "-c", `user.email=${AUTOR_EMAIL}`, "commit", "--quiet", "-m", `Blog: verificação ${ok ? "ok" : "com falha"} (${registros.map((r) => path.basename(r, ".json")).join(", ")})`], { cwd: RAIZ });
    for (let t = 1; t <= 3; t++) {
      try {
        git("push", "--quiet", "origin", "HEAD:main");
        break;
      } catch {
        git("pull", "--quiet", "--rebase", "origin", "main");
      }
    }
  }
  resumo(ok ? "Verificação em produção: ok." : "Verificação em produção: FALHOU (veja acima).");
  if (!ok) process.exit(1);
}

if (cmd === "conferir") conferir(ref);
else if (cmd === "integrar") integrar(ref);
else if (cmd === "verificar") await verificar();
else falhar("uso: publicar.mjs conferir|integrar|verificar <ref>");
