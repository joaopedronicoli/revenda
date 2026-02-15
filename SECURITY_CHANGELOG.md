# Changelog de Seguranca — Revenda Patricia Elias

**Data:** 2026-02-14
**Responsavel:** Auditoria de seguranca automatizada

---

## Resumo

Auditoria completa de seguranca realizada no projeto revenda-pelg. Foram identificadas e corrigidas 13 vulnerabilidades (5 criticas, 3 altas, 5 medias).

---

## Correcoes Aplicadas

### CRITICAS

#### 1. Escalacao de privilegio via `/users/sync`
- **Arquivo:** `server/index.js` (endpoint `/users/sync`)
- **Problema:** Usuarios comuns podiam enviar `role: "administrator"` e `approval_status` no body da requisicao e alterar seu proprio papel no sistema.
- **Correcao:** Campos `role` e `approval_status` removidos do endpoint. Apenas endpoints `/admin/*` protegidos por `requireAdmin` podem alterar roles.

#### 2. Webhooks de pagamento sem verificacao
- **Arquivos:** `server/index.js` (endpoints `/webhooks/gateway/ipag` e `/webhooks/gateway/mercadopago`)
- **Problema:** Webhooks confiavam cegamente no body recebido para marcar pedidos como pagos. Um atacante podia forjar um POST e aprovar pedidos sem pagamento real.
- **Correcao:** Implementada verificacao back-channel — antes de marcar qualquer pedido como pago, o sistema agora consulta a API real do gateway (iPag/Mercado Pago) para confirmar o status do pagamento.

#### 3. Webhook Bling sem autenticacao
- **Arquivo:** `server/index.js` (endpoint `/webhooks/bling/:billingCompanyId`)
- **Problema:** Endpoint publico sem nenhuma validacao. Qualquer pessoa podia enviar dados forjados.
- **Correcao:** Adicionada validacao de secret via query parameter (`?secret=...`) e validacao que `billingCompanyId` e numerico. Variavel `BLING_WEBHOOK_SECRET` adicionada ao `.env`.

#### 4. TLS desabilitado (`rejectUnauthorized: false`)
- **Arquivos:** `server/emailService.js`, `server/index.js` (teste SMTP)
- **Problema:** Verificacao de certificados TLS desabilitada, permitindo ataques man-in-the-middle em conexoes SMTP.
- **Correcao:** Alterado para `rejectUnauthorized: true`.

#### 5. Geracao de tokens com `Math.random()`
- **Arquivo:** `server/index.js` (3 locais)
- **Problema:** Codigos de verificacao, OTP e IDs gerados com `Math.random()`, que nao e criptograficamente seguro e pode ser previsto.
- **Correcao:** Substituido por `crypto.randomInt()` em todos os locais.

---

### ALTAS

#### 6. JWT sem validacao de algoritmo
- **Arquivo:** `server/index.js` (3 chamadas de `jwt.verify`)
- **Problema:** `jwt.verify()` sem especificar algoritmo permitido, vulneravel a ataques de confusao de algoritmo (`alg: "none"`).
- **Correcao:** Adicionado `{ algorithms: ['HS256'] }` em todas as chamadas.

#### 7. Endpoint `/meta-capi/event` sem protecao
- **Arquivo:** `server/index.js`
- **Problema:** Endpoint completamente publico, podia ser abusado para enviar eventos falsos ao Meta/Facebook.
- **Correcao:** Rate limiting (30 req/min), validacao de origin e whitelist de event_names permitidos.

#### 8. Ausencia de rate limiting em endpoints de autenticacao
- **Arquivo:** `server/index.js`
- **Problema:** Endpoints de login, OTP, reset de senha sem limite de tentativas, permitindo brute force.
- **Correcao:** Rate limiter implementado (10 req/15min) nos endpoints: `/auth/send-verification`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/request-otp`, `/auth/verify-otp`.

---

### MEDIAS

#### 9. CORS aberto para qualquer origem
- **Arquivo:** `server/index.js`
- **Problema:** `cors()` sem restricao, qualquer site podia fazer requisicoes a API.
- **Correcao:** Whitelist de dominios autorizados (`revenda.pelg.com.br`, `central.pelg.com.br`, `patriciaelias.com.br`).

#### 10. Headers de seguranca ausentes
- **Arquivo:** `server/index.js`
- **Problema:** Sem headers de protecao HTTP.
- **Correcao:** Adicionados `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Strict-Transport-Security`, `Referrer-Policy`. Header `X-Powered-By` removido.

#### 11. XSS via `dangerouslySetInnerHTML`
- **Arquivo:** `src/admin/pages/Documentation.jsx`
- **Problema:** Uso de `dangerouslySetInnerHTML` para renderizar conteudo com formatacao, vulneravel a injecao de HTML/JavaScript.
- **Correcao:** Substituido por renderizacao segura via componentes React (sem innerHTML).

#### 12. Path traversal em operacoes de arquivo
- **Arquivo:** `server/blingService.js`
- **Problema:** `orderId` usado diretamente na construcao de caminhos de arquivo sem sanitizacao.
- **Correcao:** Sanitizacao de `orderId` com regex `[^a-zA-Z0-9_-]` e verificacao de que o caminho final esta dentro do diretorio esperado.

#### 13. Scripts com credenciais hardcoded
- **Arquivos:** `reset-password.js`, `reset-joao-password.js`
- **Problema:** Scripts com credenciais Supabase (service_role key) e senhas de usuarios em texto plano.
- **Correcao:** Conteudo removido e substituido por aviso de seguranca.

---

## Melhorias Adicionais

#### Cron jobs internos
- **Arquivo:** `server/index.js`
- Os endpoints `/cron/check-levels` e `/cron/check-referral-activity` agora sao executados automaticamente dentro do servidor:
  - `check-levels`: todo dia as 02:00 (rebaixa inativos, suspende bronzes, verifica promocoes)
  - `check-referral-activity`: todo dia as 02:30 (inativa indicacoes de usuarios inativos)
- Os endpoints HTTP continuam disponiveis para execucao manual (protegidos por `CRON_SECRET`).

#### Arquivo `.env.example`
- Criado arquivo `.env.example` com todas as variaveis de ambiente necessarias sem valores reais.

---

## Variaveis de Ambiente Adicionadas

| Variavel | Finalidade |
|---|---|
| `CRON_SECRET` | Autenticacao para endpoints cron manuais |
| `BLING_WEBHOOK_SECRET` | Validacao de webhooks do Bling |

---

## Acoes Pendentes (manuais)

1. **Rotacionar credenciais do `.env`** — todas as credenciais ja estiveram expostas no codigo-fonte
2. **Atualizar URL do webhook no Bling** — adicionar `?secret=BLING_WEBHOOK_SECRET` na URL
3. **Trocar `VITE_STORAGE_SECRET_KEY`** — a chave atual `patriciaelias2025` e fraca
4. **Monitorar envio de emails** — a ativacao do TLS pode causar falha se o SMTP usar certificado auto-assinado
