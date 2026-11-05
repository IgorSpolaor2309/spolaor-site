# Repasse do webhook do Mercado Pago (testes na prévia)

Projeto Vercel separado (`spolaor-mp-webhook-relay`) com uma única função pública:
`POST https://<projeto>.vercel.app/api/mercadopago` → repassa para a rota de webhook da prévia protegida do site.

- Sem segredo de bypass na URL: autentica com o token OIDC do próprio projeto. Na prévia do site, em
  Settings → Deployment Protection → Trusted Sources → Vercel Projects, adicionar este projeto com a regra
  Production → Preview.
- O restante da prévia continua protegido; o repasse só chega ao endereço fixo `DESTINO_WEBHOOK`.
- A assinatura `x-signature` é validada no destino (o repasse não altera corpo, query nem cabeçalhos dela).
- Só para testes. Em produção o Mercado Pago chama direto `https://www.spolaortecnologia.com.br/api/atendimento-ia/webhook`.
  Apagar o projeto quando os testes acabarem.
