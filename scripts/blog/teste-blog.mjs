#!/usr/bin/env node
// Testes do blog sem rede: regras de validação, lista de rotas do proxy e o fluxo de publicação
// (conferir/integrar) contra um repositório git local que faz o papel do GitHub.
// Uso: node scripts/blog/teste-blog.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validarTudo, segmentosDoSite } from "./regras.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let falhas = 0;
let total = 0;
const ok = (cond, nome, extra = "") => {
  total++;
  if (cond) console.log(`ok   ${nome}`);
  else {
    falhas++;
    console.log(`FALHA ${nome}${extra ? `\n      ${extra}` : ""}`);
  }
};

// ---------- fixtures ----------
const PALAVRAS = Array.from({ length: 320 }, (_, i) => `palavra${i}`).join(" ");
function artigo(meta, corpo = `Resposta direta.\n\n## Seção\n\n${PALAVRAS}\n\nVeja [sites](https://www.spolaortecnologia.com.br/sites).\n`) {
  return `---\n${JSON.stringify(meta, null, 2)}\n---\n${corpo}`;
}
const metaBase = (turno = "2026-11-17-manha", extra = {}) => ({
  titulo: "Como escolher entre plataforma pronta e loja própria",
  descricao: "O que comparar antes de decidir onde montar a loja virtual: custos, controle, integrações e o esforço de operar.",
  status: "publicado",
  publicadoEm: "2026-11-17T08:40:00-03:00",
  atualizadoEm: "2026-11-17T08:40:00-03:00",
  turno,
  servicos: ["lojas"],
  fontes: [{ titulo: "Fonte oficial", url: "https://exemplo.com/doc", consultadoEm: "2026-11-17" }],
  historico: [{ em: "2026-11-17T08:40:00-03:00", turno, tipo: "publicacao", resumo: "Publicação inicial." }],
  ...extra,
});
const execucao = (turno, extra = {}) => ({
  turno,
  situacao: "enviado",
  acao: "novo",
  artigo: "loja-plataforma-ou-propria",
  inicio: "2026-11-17T08:01:00-03:00",
  fim: "2026-11-17T08:42:00-03:00",
  motivo: "Dúvida frequente de quem vende pelo Instagram.",
  verificacao: { situacao: "pendente" },
  ...extra,
});

function montar(dir, { artigos = {}, execucoes = {} } = {}) {
  fs.rmSync(dir, { recursive: true, force: true });
  for (const seg of ["sites", "contato", "lojas-virtuais", "leads", "api", "blog"]) {
    fs.mkdirSync(path.join(dir, "src/app", seg), { recursive: true });
    fs.writeFileSync(path.join(dir, "src/app", seg, "page.tsx"), "export default 1;\n");
  }
  fs.mkdirSync(path.join(dir, "content/blog/artigos"), { recursive: true });
  fs.mkdirSync(path.join(dir, "content/blog/execucoes"), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, "content/blog/servicos.json"), path.join(dir, "content/blog/servicos.json"));
  for (const [slug, txt] of Object.entries(artigos)) fs.writeFileSync(path.join(dir, "content/blog/artigos", `${slug}.md`), txt);
  for (const [turno, e] of Object.entries(execucoes)) fs.writeFileSync(path.join(dir, "content/blog/execucoes", `${turno}.json`), JSON.stringify(e, null, 2));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-teste-"));
const caso = (nome, conteudo, espera) => {
  const dir = path.join(tmp, "regras");
  montar(dir, conteudo);
  const { erros } = validarTudo(dir);
  if (espera === null) ok(erros.length === 0, nome, erros.join(" | "));
  else ok(erros.some((e) => e.includes(espera)), nome, `esperava erro contendo "${espera}", veio: ${erros.join(" | ") || "nenhum"}`);
};

// ---------- 1. regras ----------
const T = "2026-11-17-manha";
caso("artigo válido com registro", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase()) }, execucoes: { [T]: execucao(T) } }, null);
caso("sem fonte", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase(T, { fontes: [] })) }, execucoes: { [T]: execucao(T) } }, "ao menos uma fonte");
caso("slug igual a página do site", { artigos: { sites: artigo(metaBase()) }, execucoes: { [T]: execucao(T, { artigo: "sites" }) } }, "coincide com uma página do site");
caso("H1 no corpo", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase(), `# Título\n\n## A\n\n${PALAVRAS}`) }, execucoes: { [T]: execucao(T) } }, "H1");
caso("HTML no corpo", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase(), `## A\n\n<script>x</script> ${PALAVRAS}`) }, execucoes: { [T]: execucao(T) } }, "HTML");
caso("link para página inexistente do site", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase(), `## A\n\n${PALAVRAS} [x](https://www.spolaortecnologia.com.br/precos)`) }, execucoes: { [T]: execucao(T) } }, "página inexistente");
caso("link para artigo inexistente", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase(), `## A\n\n${PALAVRAS} [x](/nao-existe)`) }, execucoes: { [T]: execucao(T) } }, "artigo inexistente");
caso("link http", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase(), `## A\n\n${PALAVRAS} [x](http://exemplo.com)`) }, execucoes: { [T]: execucao(T) } }, "sem https");
caso("corpo curto", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase(), "## A\n\nCurto demais.") }, execucoes: { [T]: execucao(T) } }, "curto demais");
caso(
  "dois artigos novos no mesmo turno",
  {
    artigos: {
      "loja-plataforma-ou-propria": artigo(metaBase()),
      "outro-artigo-do-mesmo-turno": artigo(metaBase(T, { titulo: "Outro título diferente para o mesmo turno" })),
    },
    execucoes: { [T]: execucao(T) },
  },
  "um artigo novo por turno",
);
caso(
  "título repetido",
  {
    artigos: { "loja-plataforma-ou-propria": artigo(metaBase()), "segundo-artigo": artigo(metaBase("2026-11-17-tarde")) },
    execucoes: { [T]: execucao(T), "2026-11-17-tarde": execucao("2026-11-17-tarde", { artigo: "segundo-artigo" }) },
  },
  "título repetido",
);
caso("artigo sem registro de execução", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase()) } }, "falta execucoes");
caso("registro aponta artigo de outro turno", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase()) }, execucoes: { [T]: execucao(T), "2026-11-18-manha": execucao("2026-11-18-manha") } }, "não foi criado neste turno");
caso(
  "atualização sem entrada no histórico",
  { artigos: { "loja-plataforma-ou-propria": artigo(metaBase()) }, execucoes: { [T]: execucao(T), "2026-11-17-tarde": execucao("2026-11-17-tarde", { acao: "atualizacao" }) } },
  "não tem entrada deste turno",
);
caso(
  "sem publicação registrada",
  { artigos: {}, execucoes: { [T]: execucao(T, { situacao: "sem-publicacao", acao: "nenhuma", artigo: null, verificacao: { situacao: "nao-se-aplica" } }) } },
  null,
);
caso("serviço fora do catálogo", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase(T, { servicos: ["trafego-pago"] })) }, execucoes: { [T]: execucao(T) } }, "servicos");
caso("data sem fuso", { artigos: { "loja-plataforma-ou-propria": artigo(metaBase(T, { publicadoEm: "2026-11-17 08:40" })) }, execucoes: { [T]: execucao(T) } }, "publicadoEm");

// ---------- 2. rotas do proxy acompanham src/app ----------
const config = fs.readFileSync(path.join(RAIZ, "src/lib/blog/config.ts"), "utf8");
const lista = [...(/SITE_SEGMENTS = \[([\s\S]*?)\]/.exec(config)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
const pastas = segmentosDoSite(RAIZ).filter((s) => s !== "blog").sort();
ok(JSON.stringify(lista) === JSON.stringify(pastas), "SITE_SEGMENTS (config.ts) igual às pastas de src/app", `config: ${lista.join(",")} | pastas: ${pastas.join(",")}`);

// ---------- 3. conteúdo real do repositório ----------
const real = validarTudo(RAIZ);
ok(real.erros.length === 0, "content/blog do repositório é válido", real.erros.join(" | "));

// ---------- 4. fluxo de publicação contra um "GitHub" local ----------
const sh = (cwd, cmd, args, env = {}) => execFileSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
const tenta = (cwd, cmd, args, env) => {
  try {
    return { ok: true, saida: sh(cwd, cmd, args, env) };
  } catch (e) {
    return { ok: false, saida: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};
const origem = path.join(tmp, "origem.git");
const dev = path.join(tmp, "dev");
const acao = path.join(tmp, "acao");
sh(tmp, "git", ["init", "--quiet", "--bare", "-b", "main", origem]);
montar(dev);
fs.mkdirSync(path.join(dev, "scripts/blog"), { recursive: true });
for (const f of ["regras.mjs", "publicar.mjs", "validar.mjs"]) fs.copyFileSync(path.join(RAIZ, "scripts/blog", f), path.join(dev, "scripts/blog", f));
fs.writeFileSync(path.join(dev, "content/blog/pauta.json"), '{"itens":[]}\n');
fs.writeFileSync(path.join(dev, "src/app/page.tsx"), "export default 1;\n");
const G = ["-c", "user.name=teste", "-c", "user.email=teste@exemplo.com"];
sh(dev, "git", ["init", "--quiet", "-b", "main"]);
sh(dev, "git", ["add", "."]);
sh(dev, "git", [...G, "commit", "--quiet", "-m", "base"]);
sh(dev, "git", ["remote", "add", "origin", origem]);
sh(dev, "git", ["push", "--quiet", "origin", "main"]);
sh(tmp, "git", ["clone", "--quiet", origem, acao]);

const enviar = (branch, mexer) => {
  sh(dev, "git", ["fetch", "--quiet", "origin"]);
  sh(dev, "git", ["checkout", "--quiet", "-B", branch, "origin/main"]);
  mexer(dev);
  sh(dev, "git", ["add", "-A"]);
  sh(dev, "git", [...G, "commit", "--quiet", "-m", branch]);
  sh(dev, "git", ["push", "--quiet", "-f", "origin", `HEAD:refs/heads/${branch}`]);
};
const publicar = (sub, branch) => {
  sh(acao, "git", ["fetch", "--quiet", "origin", "+refs/heads/*:refs/remotes/origin/*"]);
  sh(acao, "git", ["checkout", "--quiet", "--detach", `origin/${branch}`]);
  return tenta(acao, "node", ["scripts/blog/publicar.mjs", sub, `origin/${branch}`], { RUNNER_TEMP: tmp });
};
const naMain = (arq) => tenta(acao, "git", ["show", `origin/main:${arq}`]);

enviar("blog-publicacao/2026-11-17-manha", (d) => {
  fs.writeFileSync(path.join(d, "content/blog/artigos/loja-plataforma-ou-propria.md"), artigo(metaBase()));
  fs.writeFileSync(path.join(d, "content/blog/execucoes", `${T}.json`), JSON.stringify(execucao(T), null, 2));
  fs.writeFileSync(path.join(d, "content/blog/pauta.json"), '{"itens":[{"id":"x","situacao":"usado"}]}\n');
});
let r = publicar("integrar", "blog-publicacao/2026-11-17-manha");
ok(r.ok, "envio válido é publicado na main", r.saida);
sh(acao, "git", ["fetch", "--quiet", "origin"]);
ok(naMain("content/blog/artigos/loja-plataforma-ou-propria.md").ok, "artigo está na main");
const autor = sh(acao, "git", ["log", "-1", "--format=%an <%ae>", "origin/main"]).trim();
ok(autor === "IgorSpolaor2309 <123797800+IgorSpolaor2309@users.noreply.github.com>", "commit da main com o autor configurado (deploy da Vercel)", autor);
const commitsAntes = sh(acao, "git", ["rev-list", "--count", "origin/main"]).trim();

r = publicar("integrar", "blog-publicacao/2026-11-17-manha");
sh(acao, "git", ["fetch", "--quiet", "origin"]);
const commitsDepois = sh(acao, "git", ["rev-list", "--count", "origin/main"]).trim();
ok(r.ok && /já está na main/.test(r.saida) && commitsAntes === commitsDepois, "reexecução do mesmo envio não publica de novo", r.saida);

enviar("blog-publicacao/2026-11-17-tarde", (d) => fs.writeFileSync(path.join(d, "src/app/page.tsx"), "export default 2;\n"));
r = publicar("conferir", "blog-publicacao/2026-11-17-tarde");
ok(!r.ok && /não pode alterar/.test(r.saida), "envio que mexe em código é recusado", r.saida);

enviar("blog-publicacao/2026-11-18-manha", (d) => fs.rmSync(path.join(d, "content/blog/artigos/loja-plataforma-ou-propria.md")));
r = publicar("conferir", "blog-publicacao/2026-11-18-manha");
ok(!r.ok && /D content\/blog\/artigos/.test(r.saida), "envio que apaga artigo é recusado", r.saida);

enviar("blog-publicacao/2026-11-18-tarde", (d) => {
  // mesmo turno da manhã de 17/11 com outro slug: duplicata
  fs.writeFileSync(path.join(d, "content/blog/artigos/outro-slug-mesmo-turno.md"), artigo(metaBase(T, { titulo: "Um título diferente para tentar duplicar" })));
});
r = publicar("integrar", "blog-publicacao/2026-11-18-tarde");
ok(!r.ok && /um artigo novo por turno/.test(r.saida), "segundo artigo novo para o mesmo turno é recusado", r.saida);

enviar("blog-publicacao/2026-11-19-manha", (d) => {
  fs.writeFileSync(path.join(d, "content/blog/artigos/sem-registro.md"), artigo(metaBase("2026-11-19-manha", { titulo: "Artigo sem registro de execução no envio" })));
});
r = publicar("integrar", "blog-publicacao/2026-11-19-manha");
ok(!r.ok && /falta execucoes/.test(r.saida), "artigo sem registro de execução é recusado", r.saida);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${total - falhas}/${total} ok`);
process.exit(falhas ? 1 : 0);
