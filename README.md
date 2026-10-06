# Spolaor Tecnologia · site institucional e comercial

Next.js (App Router) + TypeScript + Tailwind CSS 4 + Motion + Three.js.

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Configuração pendente (nada definitivo ainda)

Domínio, e-mail e WhatsApp comerciais **ainda não foram definidos**. Eles ficam só em variáveis de
ambiente lidas por `src/lib/site.ts` (modelo em `.env.example`), sem valores padrão:

| Variável | Efeito enquanto estiver vazia |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | site fica com `noindex` e `robots.txt` bloqueia tudo |
| `NEXT_PUBLIC_CONTACT_EMAIL` | e-mail não aparece em lugar nenhum |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | botões de WhatsApp não aparecem |

**Leads:** os formulários enviam para `/api/lead`, que entrega o lead aos conectores de
`src/lib/leads/server/connectors/`. Nenhum destino externo está ativo. Em desenvolvimento o lead
aparece no terminal; em produção a API responde 503 e o formulário mostra erro, para nenhum lead
ser aceito sem ser guardado. Como ligar Supabase, CRM, n8n, Make ou e-mail está no README dessa pasta.

## Estrutura

- `src/app` — rotas: `/`, `/sites`, `/automacao`, `/sistemas`, `/projetos`, `/consultoria`, `/contato`, `/analise`, `api/lead`
- `src/lib/site.ts` — único lugar com domínio, e-mail e WhatsApp
- `src/lib/leads` — validação, envio dos formulários e conectores de destino dos leads
- `src/components/home` — seções da homepage
- `src/components/sections` — blocos reutilizados entre páginas (fluxo de automação, case, análise, FAQ, CTA final)
- `src/components/three` — núcleo de partículas do hero (WebGL, carregado sob demanda)
- `docs/ARQUITETURA.md` — decisões de arquitetura, conteúdo e direção visual

## Performance e degradação

- O WebGL só existe no hero, carrega depois da página e pausa fora da tela.
- No celular inicia após a primeira interação (ou 3,5 s) e roda a 30 fps com menos partículas.
- `prefers-reduced-motion`, aparelhos fracos ou sem WebGL recebem uma versão estática.
- Lighthouse (local): desktop 99 de performance; mobile 89; acessibilidade 97; SEO e boas práticas 100.

## Scripts de prévia

`scripts/tour.mjs`, `scripts/sections.mjs` e `scripts/video.mjs` geram capturas e vídeo com Playwright
(precisam do servidor rodando em `localhost:3100`).
