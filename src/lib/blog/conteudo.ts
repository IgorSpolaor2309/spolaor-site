import fs from "node:fs";
import path from "node:path";
import { Marked, type Tokens } from "marked";
import { blogOrigin, siteOrigin } from "./config";

// Leitura do conteúdo do blog (content/blog), só no build: as páginas do blog são estáticas.
// A validação completa fica em scripts/blog/regras.mjs, que roda antes do build (prebuild) e na Action
// de publicação; aqui só se lê o que já passou por ela.

export type Fonte = { titulo: string; url: string; consultadoEm: string };
export type EntradaHistorico = { em: string; tipo: string; resumo: string; turno?: string | null };
export type Artigo = {
  slug: string;
  titulo: string;
  descricao: string;
  status: "publicado" | "despublicado" | "rascunho";
  publicadoEm: string;
  atualizadoEm: string;
  turno: string;
  servicos: string[];
  fontes: Fonte[];
  historico: EntradaHistorico[];
  corpo: string;
  palavras: number;
};
export type Servico = { id: string; nome: string; caminho: string; resumo: string; chamada: string };

const BASE = path.join(process.cwd(), "content", "blog");

function separar(texto: string) {
  const t = texto.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
  if (!m) throw new Error("artigo sem metadados");
  return { meta: JSON.parse(m[1]), corpo: m[2] };
}

let cache: Artigo[] | null = null;

function todos(): Artigo[] {
  if (cache) return cache;
  const dir = path.join(BASE, "artigos");
  const arquivos = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")) : [];
  cache = arquivos.map((arq) => {
    const { meta, corpo } = separar(fs.readFileSync(path.join(dir, arq), "utf8"));
    return { ...meta, slug: arq.slice(0, -3), corpo, palavras: (corpo.match(/[\p{L}\p{N}]+/gu) || []).length } as Artigo;
  });
  return cache;
}

/** Artigos publicados, do mais recente para o mais antigo. */
export function artigosPublicados(): Artigo[] {
  return todos()
    .filter((a) => a.status === "publicado")
    .sort((a, b) => Date.parse(b.publicadoEm) - Date.parse(a.publicadoEm));
}

export function artigoPublicado(slug: string): Artigo | null {
  return artigosPublicados().find((a) => a.slug === slug) ?? null;
}

let servicosCache: { servicos: Servico[]; contato: { nome: string; caminho: string; chamada: string } } | null = null;
export function catalogo() {
  servicosCache ??= JSON.parse(fs.readFileSync(path.join(BASE, "servicos.json"), "utf8"));
  return servicosCache!;
}

export function servicosDoArtigo(a: Artigo): Servico[] {
  const { servicos } = catalogo();
  return a.servicos.map((id) => servicos.find((s) => s.id === id)).filter((s): s is Servico => !!s);
}

/** Artigos relacionados: mesmos serviços primeiro, depois os mais recentes. */
export function relacionados(a: Artigo, n = 3): Artigo[] {
  const outros = artigosPublicados().filter((x) => x.slug !== a.slug);
  const pontos = (x: Artigo) => x.servicos.filter((s) => a.servicos.includes(s)).length;
  return outros.sort((x, y) => pontos(y) - pontos(x)).slice(0, n);
}

// ---------- Markdown ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const ancora = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const marked = new Marked({
  gfm: true,
  renderer: {
    // HTML no Markdown vira texto (o validador já recusa; aqui é a segunda barreira).
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return esc(text);
    },
    image({ text }: Tokens.Image) {
      return esc(text);
    },
    heading({ tokens, depth }: Tokens.Heading) {
      const inner = this.parser.parseInline(tokens);
      const nivel = Math.min(Math.max(depth, 2), 4); // H1 é só o título da página
      return `<h${nivel} id="${ancora(inner)}">${inner}</h${nivel}>\n`;
    },
    link({ href, title, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens);
      const t = title ? ` title="${esc(title)}"` : "";
      const interno = href.startsWith("/") || href.startsWith("#") || href.startsWith(blogOrigin) || href.startsWith(siteOrigin);
      const extra = interno ? "" : ' target="_blank" rel="noopener"';
      return `<a href="${esc(href)}"${t}${extra}>${inner}</a>`;
    },
  },
});

export function markdownParaHtml(corpo: string): string {
  return marked.parse(corpo, { async: false }) as string;
}

/** Seções H2 para o sumário do artigo. */
export function secoes(corpo: string): { id: string; texto: string }[] {
  return [...corpo.matchAll(/^##\s+(.+)$/gm)].map((m) => {
    const texto = m[1].replace(/[*_`]/g, "").trim();
    return { id: ancora(esc(texto)), texto };
  });
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
export const dataPorExtenso = (iso: string) => fmtData.format(new Date(iso));
export const minutosDeLeitura = (a: Artigo) => Math.max(1, Math.round(a.palavras / 200));
