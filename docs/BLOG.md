# Blog (blog.spolaortecnologia.com.br)

Blog próprio da Spolaor Tecnologia, servido por este mesmo projeto Next.js na Vercel e alimentado por uma rotina editorial do Claude que roda na nuvem, de segunda a sexta, às 08:00 e às 18:00 (America/Sao_Paulo). Substitui a produção de artigos da Crush.

## Como funciona

```
Rotina do Claude (nuvem)            GitHub                                 Vercel / produção
pesquisa, escolhe, escreve,  ──►  branch blog-publicacao/<turno>  ──►  Action "Blog - publicar":
revisa, valida                     (só content/blog)                      confere, valida, commit na main
                                                                          ──► deploy ──► confere o artigo no ar
                                                                          ──► grava o resultado em execucoes/<turno>.json
```

- **Conteúdo e histórico** ficam no git, em `content/blog/`:
  - `artigos/<slug>.md`: metadados em JSON (título, descrição, datas, turno, serviços, fontes com data de consulta, histórico de alterações) e o texto em Markdown.
  - `execucoes/<AAAA-MM-DD>-<manha|tarde>.json`: registro de cada execução (decisão, temas avaliados, pesquisas, revisão, situação, verificação em produção).
  - `pauta.json`: assuntos planejados e usados.
  - `posicionamento.md` e `servicos.json`: regras editoriais e serviços que podem ser recomendados (editados só por pessoas, via PR).
  - `ROTINA.md`: o passo a passo que a rotina segue em cada execução.
- **Páginas** em `src/app/blog` (índice, artigo, `sitemap.xml`, `robots.txt`, `feed.xml`), todas estáticas, geradas no build. Leitura em `src/lib/blog/conteudo.ts`.
- **Subdomínio**: `src/proxy.ts` reescreve `blog.<domínio>/...` para `/blog/...`; caminhos do site principal pedidos no subdomínio voltam para o site (308); `/blog` no site principal redireciona para o subdomínio. Os endereços derivam de `NEXT_PUBLIC_SITE_URL` (`src/lib/blog/config.ts`).
- **Cabeçalho e rodapé** do blog são próprios (`src/app/blog/layout.tsx`), com links absolutos para o site. Os do site (`SiteOnly`) não aparecem nas rotas do blog; a detecção usa o segmento da rota, que não muda com a reescrita.
- **Indexação**: segue a mesma chave do site (`NEXT_PUBLIC_ALLOW_INDEXING`). Artigo publicado = `index, follow`, canonical no subdomínio, no sitemap do blog.

## Regras e travas

- `scripts/blog/regras.mjs` é a validação única: roda no `prebuild` (um conteúdo inválido derruba o build, e a produção continua na versão anterior), na Action e nos testes. Exige, entre outros: slug legível e que não coincida com página do site; título e descrição com tamanho adequado; ao menos uma fonte https com data de consulta; histórico; nada de H1, HTML ou imagem no corpo; links internos para páginas e artigos existentes; serviço do catálogo; **um artigo novo por turno**; registro de execução para todo artigo.
- A rotina só envia a branch `blog-publicacao/<turno>`. A Action (`.github/workflows/blog-publicar.yml` + `scripts/blog/publicar.mjs`) recusa envio que crie/altere qualquer arquivo fora de `content/blog/artigos`, `content/blog/execucoes` e `content/blog/pauta.json`, ou que apague arquivo. Quem escreve na `main` é a Action, num commit próprio com o autor do repositório (exigência de deploy da Vercel no plano Hobby).
- **Reexecução é segura**: se o envio já está na `main`, a Action não publica de novo, só refaz a conferência. Um segundo envio do mesmo turno com outro artigo é recusado pela regra de um artigo por turno. A rotina confere o registro do turno antes de começar e não cria segundo envio.
- **Conferência em produção** (feita pela Action, que tem internet completa; a rede da rotina na nuvem não acessa o site): HTTP 200, título, canonical, ausência de noindex, presença no sitemap com a data da versão nova, `robots.txt` liberando. O resultado vai para `verificacao` no registro do turno. Falha = workflow vermelho e `situacao: falha`.
- **Despublicar**: mudar `status` para `despublicado` e acrescentar entrada `despublicacao` no histórico (a página passa a 404 e sai do sitemap). **Reverter** uma alteração: `git revert` do commit da Action (por PR ou direto, com deploy normal).
- O que a rotina não pode escrever (preços, clientes, resultados, serviços fora do catálogo, promessas de posição no Google ou citação por IA) está em `content/blog/posicionamento.md`.

## Rotina na nuvem

- Duas rotinas do Claude Code (claude.ai/code/routines), no ambiente de nuvem padrão, com o repositório `IgorSpolaor2309/spolaor-site`: "Blog Spolaor 08h" (`0 11 * * 1-5` UTC) e "Blog Spolaor 18h" (`0 21 * * 1-5` UTC). O Brasil não tem horário de verão desde 2019; se voltar a ter, os horários UTC precisam ser revistos.
- O prompt de cada uma só define o turno e manda seguir `content/blog/ROTINA.md`. Para mudar o comportamento, edite esse arquivo por PR.
- Ferramentas da rotina: Bash, leitura/escrita de arquivos, WebSearch, WebFetch e Agent (revisão independente por subagente). Ambiente de nuvem dedicado "Blog Spolaor (rede para fontes)" (`env_01XDt8bFavxSWzTi7Cpb8pMD`): rede **Completa** (qualquer domínio por HTTPS), sem segredos, sem variáveis de ambiente, sem script de configuração e sem conectores. A rede aberta serve para ler as fontes e conferir a página publicada; as credenciais e as travas de publicação são as mesmas (push só de `blog-publicacao/*`, Action como única via para a `main`). O ambiente "Default" das outras rotinas não foi alterado.
- Fontes: busca só localiza; cada fonte citada é aberta e lida, e o artigo guarda em `fontes[].trecho` o trecho do original que sustenta o uso (o validador exige).
- Para acompanhar: execuções em claude.ai/code/routines; publicações nos workflows "Blog - publicar" do GitHub; registro de cada turno em `content/blog/execucoes`.

## Testes

- `node scripts/blog/teste-blog.mjs`: regras (casos válidos e inválidos), lista de rotas do proxy contra `src/app`, e o fluxo de publicação (conferir/integrar, autor do commit, reexecução sem duplicar, envio que mexe em código, apaga artigo ou duplica turno) contra um repositório git local.
- `node scripts/blog/validar.mjs`: valida o conteúdo atual.
- Local: build com `NEXT_PUBLIC_SITE_URL=http://localhost:3100` e `next start --port 3100`; o blog fica em `http://blog.localhost:3100` (o Chrome resolve `*.localhost`; no `curl`, use `-H "Host: blog.localhost:3100"`).
