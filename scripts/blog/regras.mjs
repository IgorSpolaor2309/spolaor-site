// Regras do conteúdo do blog (content/blog). Fonte única de validação: usada pelo build (prebuild),
// pela Action de publicação e pelos testes. Só lê arquivos; não acessa rede.
//
// Formato de um artigo (content/blog/artigos/<slug>.md):
//   ---
//   { ...metadados em JSON... }
//   ---
//   corpo em Markdown (sem H1: o título vem dos metadados)

import fs from "node:fs";
import path from "node:path";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TURNO_RE = /^\d{4}-\d{2}-\d{2}-(manha|tarde)$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

export const STATUS_ARTIGO = ["publicado", "despublicado", "rascunho"];
export const TIPOS_HISTORICO = ["publicacao", "atualizacao", "correcao", "despublicacao", "republicacao"];
export const SITUACOES_EXECUCAO = ["em-andamento", "enviado", "publicado", "atualizado", "sem-publicacao", "falha"];
export const ACOES_EXECUCAO = ["novo", "atualizacao", "nenhuma"];
export const VERIFICACOES = ["pendente", "ok", "falha", "nao-se-aplica"];

/** Arquivos que a rotina de publicação pode criar ou alterar (o resto de content/blog é editado só por PR). */
export const CAMINHOS_DA_ROTINA = [/^content\/blog\/artigos\/[a-z0-9-]+\.md$/, /^content\/blog\/execucoes\/\d{4}-\d{2}-\d{2}-(manha|tarde)\.json$/, /^content\/blog\/pauta\.json$/];

export const SITE_ORIGEM = "https://www.spolaortecnologia.com.br";
export const BLOG_ORIGEM = "https://blog.spolaortecnologia.com.br";

/** Separa os metadados (JSON entre linhas ---) do corpo Markdown. Lança erro com mensagem clara. */
export function separar(texto) {
  const t = texto.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
  if (!m) throw new Error("o arquivo precisa começar com --- , metadados em JSON e outra linha ---");
  let meta;
  try {
    meta = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`metadados não são JSON válido: ${e.message}`);
  }
  return { meta, corpo: m[2] };
}

/** Segmentos de rota do site principal (pastas de src/app). Nenhum artigo pode usar um deles como slug. */
export function segmentosDoSite(raiz) {
  const app = path.join(raiz, "src", "app");
  return fs
    .readdirSync(app, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !/^[([_@]/.test(d.name))
    .map((d) => d.name);
}

const contarPalavras = (s) => (s.match(/[\p{L}\p{N}]+/gu) || []).length;
const lerJson = (arq) => JSON.parse(fs.readFileSync(arq, "utf8"));

/**
 * Valida todo o conteúdo do blog. Retorna { erros, avisos, artigos, execucoes }.
 * `erros` vazio = conteúdo publicável.
 */
export function validarTudo(raiz = process.cwd()) {
  const base = path.join(raiz, "content", "blog");
  const erros = [];
  const avisos = [];
  const erro = (onde, msg) => erros.push(`${onde}: ${msg}`);

  // Serviços e segmentos do site
  let servicos = [];
  try {
    servicos = lerJson(path.join(base, "servicos.json")).servicos;
  } catch (e) {
    erro("servicos.json", e.message);
  }
  const idsServico = new Set(servicos.map((s) => s.id));
  const segmentos = new Set(segmentosDoSite(raiz));
  const segmentosPublicos = new Set([...segmentos].filter((s) => !["leads", "api", "blog"].includes(s)));

  // Artigos
  const dirArtigos = path.join(base, "artigos");
  const arquivos = fs.existsSync(dirArtigos) ? fs.readdirSync(dirArtigos).filter((f) => !f.startsWith(".")) : [];
  const artigos = [];
  for (const arq of arquivos) {
    const onde = `artigos/${arq}`;
    if (!arq.endsWith(".md")) {
      erro(onde, "só arquivos .md são aceitos nesta pasta");
      continue;
    }
    const slug = arq.slice(0, -3);
    if (!SLUG_RE.test(slug) || slug.length > 90) erro(onde, "nome do arquivo (slug) deve ter só letras minúsculas sem acento, números e hífens, até 90 caracteres");
    if (segmentos.has(slug)) erro(onde, `o slug "${slug}" coincide com uma página do site`);
    let meta, corpo;
    try {
      ({ meta, corpo } = separar(fs.readFileSync(path.join(dirArtigos, arq), "utf8")));
    } catch (e) {
      erro(onde, e.message);
      continue;
    }
    artigos.push({ slug, meta, corpo, onde });
  }

  const slugsPublicados = new Set(artigos.filter((a) => a.meta.status === "publicado").map((a) => a.slug));
  const titulos = new Map();
  const turnosNovos = new Map();

  for (const { slug, meta, corpo, onde } of artigos) {
    const req = (cond, msg) => cond || erro(onde, msg);
    req(typeof meta.titulo === "string" && meta.titulo.trim().length >= 20 && meta.titulo.length <= 110, "titulo com 20 a 110 caracteres");
    req(typeof meta.descricao === "string" && meta.descricao.length >= 70 && meta.descricao.length <= 170, "descricao com 70 a 170 caracteres");
    req(STATUS_ARTIGO.includes(meta.status), `status deve ser ${STATUS_ARTIGO.join(", ")}`);
    req(typeof meta.publicadoEm === "string" && DATA_RE.test(meta.publicadoEm), "publicadoEm em ISO 8601 com fuso (ex.: 2026-11-17T08:20:00-03:00)");
    req(typeof meta.atualizadoEm === "string" && DATA_RE.test(meta.atualizadoEm), "atualizadoEm em ISO 8601 com fuso");
    if (DATA_RE.test(meta.publicadoEm ?? "") && DATA_RE.test(meta.atualizadoEm ?? "")) {
      req(Date.parse(meta.atualizadoEm) >= Date.parse(meta.publicadoEm), "atualizadoEm não pode ser anterior a publicadoEm");
    }
    req(typeof meta.turno === "string" && TURNO_RE.test(meta.turno), "turno no formato AAAA-MM-DD-manha ou AAAA-MM-DD-tarde");
    if (TURNO_RE.test(meta.turno ?? "")) {
      if (turnosNovos.has(meta.turno)) erro(onde, `o turno ${meta.turno} já criou o artigo ${turnosNovos.get(meta.turno)} (um artigo novo por turno)`);
      else turnosNovos.set(meta.turno, slug);
    }
    req(Array.isArray(meta.servicos) && meta.servicos.length >= 1 && meta.servicos.every((s) => idsServico.has(s)), `servicos: lista com ao menos um id de servicos.json (${[...idsServico].join(", ")})`);

    // Fontes
    if (!Array.isArray(meta.fontes)) erro(onde, "fontes deve ser uma lista");
    else {
      if (meta.status === "publicado" && meta.fontes.length < 1) erro(onde, "artigo publicado precisa de ao menos uma fonte");
      const urls = new Set();
      meta.fontes.forEach((f, i) => {
        const o = `${onde} fontes[${i}]`;
        if (!f || typeof f.titulo !== "string" || f.titulo.trim().length < 3) erro(o, "titulo da fonte obrigatório");
        if (!f || typeof f.url !== "string" || !/^https:\/\/[^\s]+$/.test(f.url)) erro(o, "url https obrigatória");
        else if (urls.has(f.url)) erro(o, "fonte repetida");
        else urls.add(f.url);
        if (!f || typeof f.consultadoEm !== "string" || !DIA_RE.test(f.consultadoEm)) erro(o, "consultadoEm no formato AAAA-MM-DD");
        // A fonte precisa ter sido aberta e lida: o trecho é o que sustenta o uso dela no texto
        // (resultado de busca não conta como leitura). Curto, para não reproduzir a fonte.
        if (meta.status === "publicado" && (!f || typeof f.trecho !== "string" || f.trecho.trim().length < 20 || f.trecho.length > 400)) {
          erro(o, "trecho obrigatório (20 a 400 caracteres): o que foi lido na fonte original e sustenta o texto");
        }
      });
    }

    // Histórico
    if (!Array.isArray(meta.historico) || meta.historico.length < 1) erro(onde, "historico precisa de ao menos a entrada de publicação");
    else {
      meta.historico.forEach((h, i) => {
        const o = `${onde} historico[${i}]`;
        if (!h || !DATA_RE.test(h.em ?? "")) erro(o, "em: data ISO com fuso");
        if (!h || !TIPOS_HISTORICO.includes(h.tipo)) erro(o, `tipo: ${TIPOS_HISTORICO.join(", ")}`);
        if (!h || typeof h.resumo !== "string" || h.resumo.trim().length < 10) erro(o, "resumo da alteração obrigatório");
        if (h && h.turno != null && !TURNO_RE.test(h.turno)) erro(o, "turno inválido");
      });
      if (meta.historico[0]?.tipo !== "publicacao" && meta.status !== "rascunho") erro(onde, "a primeira entrada do historico deve ser a publicacao");
    }

    // Título único
    const chave = (meta.titulo ?? "").trim().toLowerCase();
    if (chave && titulos.has(chave)) erro(onde, `título repetido de ${titulos.get(chave)}`);
    else if (chave) titulos.set(chave, slug);

    // Corpo
    if (/^#\s/m.test(corpo)) erro(onde, "o corpo não pode ter H1 (# ); comece as seções com ##");
    if (/<\/?[a-zA-Z][^>]*>/.test(corpo)) erro(onde, "HTML não é aceito no corpo; use só Markdown");
    if (/!\[[^\]]*\]\(/.test(corpo)) erro(onde, "imagens não são aceitas no corpo por enquanto");
    const palavras = contarPalavras(corpo);
    if (meta.status === "publicado" && palavras < 300) erro(onde, `corpo curto demais (${palavras} palavras; mínimo 300)`);
    if (!/^##\s/m.test(corpo)) avisos.push(`${onde}: sem nenhuma seção ##`);

    for (const m of corpo.matchAll(/\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      const href = m[1];
      if (href.startsWith("#")) continue;
      if (href.startsWith("http://")) {
        erro(onde, `link sem https: ${href}`);
        continue;
      }
      let caminho = null;
      let alvo = null;
      if (href.startsWith(SITE_ORIGEM)) {
        caminho = href.slice(SITE_ORIGEM.length).split(/[?#]/)[0] || "/";
        alvo = "site";
      } else if (href.startsWith(BLOG_ORIGEM)) {
        caminho = href.slice(BLOG_ORIGEM.length).split(/[?#]/)[0] || "/";
        alvo = "blog";
      } else if (href.startsWith("/")) {
        caminho = href.split(/[?#]/)[0];
        alvo = "blog";
      } else if (/^https:\/\//.test(href) || href.startsWith("mailto:")) {
        continue;
      } else {
        erro(onde, `link relativo não aceito: ${href} (use /slug para o blog ou o endereço completo do site)`);
        continue;
      }
      if (alvo === "site") {
        const seg = caminho.split("/").filter(Boolean)[0];
        if (caminho !== "/" && !segmentosPublicos.has(seg)) erro(onde, `link para página inexistente do site: ${href}`);
      } else {
        const s = caminho.replace(/^\/|\/$/g, "");
        if (s && !slugsPublicados.has(s)) erro(onde, `link para artigo inexistente ou não publicado: ${href}`);
      }
    }
  }

  // Execuções
  const dirExec = path.join(base, "execucoes");
  const execucoes = [];
  const arquivosExec = fs.existsSync(dirExec) ? fs.readdirSync(dirExec).filter((f) => !f.startsWith(".")) : [];
  const porSlug = new Map(artigos.map((a) => [a.slug, a]));
  for (const arq of arquivosExec) {
    const onde = `execucoes/${arq}`;
    const turno = arq.replace(/\.json$/, "");
    if (!arq.endsWith(".json") || !TURNO_RE.test(turno)) {
      erro(onde, "nome deve ser AAAA-MM-DD-manha.json ou AAAA-MM-DD-tarde.json");
      continue;
    }
    let e;
    try {
      e = lerJson(path.join(dirExec, arq));
    } catch (err) {
      erro(onde, `JSON inválido: ${err.message}`);
      continue;
    }
    execucoes.push({ turno, ...e });
    const req = (cond, msg) => cond || erro(onde, msg);
    req(e.turno === turno, "campo turno deve ser igual ao nome do arquivo");
    req(SITUACOES_EXECUCAO.includes(e.situacao), `situacao: ${SITUACOES_EXECUCAO.join(", ")}`);
    req(ACOES_EXECUCAO.includes(e.acao), `acao: ${ACOES_EXECUCAO.join(", ")}`);
    req(DATA_RE.test(e.inicio ?? ""), "inicio: data ISO com fuso");
    req(e.fim == null || DATA_RE.test(e.fim), "fim: data ISO com fuso ou null");
    req(typeof e.motivo === "string" && e.motivo.trim().length >= 10, "motivo: explique a decisão da execução");
    req(e.verificacao && VERIFICACOES.includes(e.verificacao.situacao), `verificacao.situacao: ${VERIFICACOES.join(", ")}`);
    if (e.acao === "novo") {
      const a = porSlug.get(e.artigo);
      if (!a) erro(onde, `artigo ${e.artigo} não existe`);
      else if (a.meta.turno !== turno) erro(onde, `o artigo ${e.artigo} não foi criado neste turno`);
    }
    if (e.acao === "atualizacao") {
      const a = porSlug.get(e.artigo);
      if (!a) erro(onde, `artigo ${e.artigo} não existe`);
      else if (!(a.meta.historico ?? []).some((h) => h.turno === turno)) erro(onde, `o historico de ${e.artigo} não tem entrada deste turno`);
    }
    if (e.acao === "nenhuma" && e.artigo != null) erro(onde, "acao nenhuma não deve apontar artigo");
  }

  // Todo artigo criado precisa de um registro de execução do turno (rastreabilidade).
  for (const { meta, onde } of artigos) {
    if (TURNO_RE.test(meta.turno ?? "") && !arquivosExec.includes(`${meta.turno}.json`)) erro(onde, `falta execucoes/${meta.turno}.json`);
  }

  return { erros, avisos, artigos, execucoes };
}
