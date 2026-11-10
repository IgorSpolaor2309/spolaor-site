#!/usr/bin/env bash
# Teste REAL no ambiente de teste (sandbox) do Mercado Pago, rodando só nesta máquina (localhost).
# Nada de produção é usado: nem banco, nem e-mail, nem Pixel, nem credenciais de produção.
#
# 1. Crie, na raiz do projeto, o arquivo .env.sandbox.local (fica fora do git por causa de .env*.local) com as
#    credenciais de TESTE da aplicação no painel do Mercado Pago (Suas integrações > aplicação > Credenciais de teste).
#    Hoje elas começam com APP_USR- e pertencem a um usuário de teste (TESTUSER…):
#        MP_ACCESS_TOKEN=APP_USR-...
#        NEXT_PUBLIC_MP_PUBLIC_KEY=APP_USR-...
# 2. Rode:  bash scripts/sandbox-local.sh          (sobe em http://localhost:3230 com o build de teste atual)
#           bash scripts/sandbox-local.sh --build  (refaz o build antes, com o Pixel falso)
# 3. Abra http://localhost:3230/sites/pacote/checkout e pague com os cartões de teste do Mercado Pago
#    (titular APRO = aprovado, OTHE = recusado, CONT = pendente; CPF 12345678909).
#
# O script só sobe se o Access Token for de um usuário de teste (GET /users/me com a marca "test_user") e se a
# Public Key não for a de produção guardada em .env.parcelas.local.
set -euo pipefail
cd "$(dirname "$0")/.."

ARQ=.env.sandbox.local
PORTA=${SANDBOX_PORTA:-3230}
[ -f "$ARQ" ] || { echo "Falta $ARQ (veja o cabeçalho deste script)."; exit 1; }

valor() { grep -E "^$1=" "$ARQ" | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
TOKEN=$(valor MP_ACCESS_TOKEN)
PUBLICA=$(valor NEXT_PUBLIC_MP_PUBLIC_KEY)
[ -n "$TOKEN" ] && [ -n "$PUBLICA" ] || { echo "Faltam MP_ACCESS_TOKEN e/ou NEXT_PUBLIC_MP_PUBLIC_KEY em $ARQ."; exit 1; }
# Conta de teste? (TEST- é sempre teste; APP_USR- só se o dono do token for um usuário de teste)
case "$TOKEN" in
  TEST-*) ;;
  *) MP_TOKEN_CHECK="$TOKEN" node -e '
       fetch("https://api.mercadopago.com/users/me", { headers: { authorization: "Bearer " + process.env.MP_TOKEN_CHECK } })
         .then((r) => r.json()).then((j) => process.exit((j.tags || []).includes("test_user") ? 0 : 1)).catch(() => process.exit(1));'        || { echo "O Access Token não é de um usuário de teste do Mercado Pago. Nada foi iniciado."; exit 1; } ;;
esac
if [ -f .env.parcelas.local ] && grep -qF "NEXT_PUBLIC_MP_PUBLIC_KEY=$PUBLICA" .env.parcelas.local; then
  echo "A Public Key é a de produção. Use a das credenciais de teste. Nada foi iniciado."; exit 1
fi

# Ambiente isolado: nenhuma variável de produção que possa estar no shell passa adiante.
LIMPO=(env -u DATABASE_URL -u POSTGRES_URL -u RESEND_API_KEY -u MP_WEBHOOK_SECRET -u IA_MP_RELAY_URL -u VERCEL_ENV)
COMUM=(
  NEXT_PUBLIC_META_PIXEL_ID=000000000000001
  NEXT_PUBLIC_SITE_URL="http://localhost:$PORTA"
  NEXT_PUBLIC_ALLOW_INDEXING=false
)

if [ "${1:-}" = "--build" ] || [ ! -f .next/BUILD_ID ]; then
  echo "Build de teste (Pixel falso 000000000000001)…"
  "${LIMPO[@]}" "${COMUM[@]}" npx next build > .sandbox-build.log 2>&1 || { echo "Build falhou: veja .sandbox-build.log"; exit 1; }
fi
# O ID do Pixel é gravado no build: só sobe se for o falso, para nenhum evento de teste chegar ao Pixel real.
grep -rqs 000000000000001 .next/static || { echo "O build atual não usa o Pixel falso. Rode com --build."; exit 1; }

echo "Sandbox do Mercado Pago em http://localhost:$PORTA/sites/pacote/checkout (Ctrl+C para parar)"
exec "${LIMPO[@]}" "${COMUM[@]}" \
  SITES_STORE=memory IA_STORE=memory \
  SITES_CONTRATACAO_ATIVA=true \
  SITES_CONDICOES=pix,cartao-1x,cartao-2x,cartao-3x,cartao-6x,cartao-12x \
  SITES_MP_NOTIFICATION_URL=off \
  MP_WEBHOOK_SECRET=sandbox-local-sem-notificacao \
  MP_API_URL=https://api.mercadopago.com \
  MP_ACCESS_TOKEN="$TOKEN" \
  NEXT_PUBLIC_MP_PUBLIC_KEY="$PUBLICA" \
  npx next start --port "$PORTA"
