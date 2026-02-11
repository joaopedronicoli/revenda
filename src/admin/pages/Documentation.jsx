import { useState } from 'react'
import { Search, Book, ShoppingCart, Bell, Code, Settings, Database, MessageSquare, ExternalLink, ChevronRight, Users, Truck } from 'lucide-react'

const documentationSections = [
    {
        id: 'webhooks-recuperacao-vendas',
        title: 'Webhooks para Recuperação de Vendas',
        icon: Bell,
        category: 'Integrações',
        keywords: ['webhook', 'recuperação', 'pendente', 'falha', 'pagamento', 'n8n', 'vendas'],
        content: `
# 🔔 Webhooks Automáticos para Recuperação de Vendas

## Visão Geral

Sistema automático que dispara webhooks para n8n quando:
- ✅ Pedido criado como **PENDENTE** (aguardando pagamento)
- ✅ Pedido **APROVADO** (pago com sucesso)
- ❌ Pagamento **RECUSADO** (cartão negado, limite, etc.)
- ❌ Pagamento com **ERRO** (dados incorretos, timeout)
- ❌ Pedido **EXPIRADO** (não pago em 24h)
- ❌ Pedido **CANCELADO**
- 📦 Pedido **ENVIADO**
- 🎉 Pedido **ENTREGUE**

Com isso você pode:
- **Recuperar vendas** de pagamentos recusados
- **Lembrar clientes** com pedidos pendentes
- **Oferecer alternativas** quando o pagamento falha
- **Automatizar follow-up** pós-compra

---

## 1. Eventos Disponíveis

| Evento | Quando Dispara | Uso no n8n |
|--------|----------------|------------|
| \`order_pending\` | Pedido criado e aguardando pagamento | Enviar link de pagamento novamente |
| \`order_paid\` | Pagamento aprovado | Confirmar compra, gerar nota fiscal |
| \`order_payment_refused\` | Cartão recusado, limite excedido | Oferecer PIX, boleto, outro cartão |
| \`order_payment_error\` | Dados incorretos, timeout iPag | Solicitar correção de dados |
| \`order_failed\` | Falha genérica no pagamento | Entrar em contato com cliente |
| \`order_expired\` | Pedido não pago em 24h | Lembrete final + desconto |
| \`order_cancelled\` | Pedido cancelado | Pesquisa de motivo |
| \`order_shipped\` | Pedido enviado | Enviar código de rastreio |
| \`order_delivered\` | Pedido entregue | Solicitar avaliação |

---

## 2. Configuração Rápida

### Passo 1: Aplicar Migration

No **Supabase SQL Editor**, execute:

\`\`\`sql
-- Cole o arquivo:
-- supabase/migrations/20260203_006_order_status_webhooks.sql
\`\`\`

### Passo 2: Configurar Webhooks no Admin

1. Acesse **Admin → Webhooks**
2. Para cada evento que deseja usar:
   - Cole a URL do seu workflow n8n
   - Marque **"Ativo"**
   - Salve

### Passo 3: Criar Workflows no n8n

Veja exemplos abaixo para cada caso de uso.

---

## 3. Payload Enviado

Todos os webhooks enviam este formato:

\`\`\`json
{
  "event": "order_pending",
  "timestamp": "2026-02-03T15:30:00Z",
  "data": {
    "order": {
      "id": "uuid",
      "order_number": "REV-111145",
      "status": "pending",
      "total": 299.90,
      "payment_method": "credit_card",
      "ipag_transaction_id": "10492602030017034903",
      "ipag_status": "2",
      "items": [
        {
          "name": "Produto A",
          "quantity": 2,
          "price": 149.95
        }
      ],
      "created_at": "2026-02-03T15:25:00Z"
    },
    "user": {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@email.com",
      "whatsapp": "11999999999",
      "cpf": "12345678900"
    },
    "address": {
      "street": "Rua ABC",
      "number": "123",
      "city": "São Paulo",
      "state": "SP",
      "cep": "01234-567"
    },
    "metadata": {
      "payment": {
        "brand": "visa",
        "installments": 3
      },
      "ipag_response": {...}
    }
  }
}
\`\`\`

---

## 4. Workflows n8n por Caso de Uso

### 🟡 Pedido Pendente (Aguardando Pagamento)

**Evento:** \`order_pending\`

**Workflow:**
1. Webhook recebe pedido pendente
2. **Aguardar 1 hora**
3. Verificar se ainda está pendente
4. Enviar lembrete por email/WhatsApp

\`\`\`
[Webhook] → [Wait 1h] → [Supabase: Check Status] → [IF Still Pending]
                                                          ↓
                                                    [Send Reminder]
\`\`\`

**Mensagem exemplo:**
\`\`\`
Olá João! 👋

Seu pedido REV-111145 ainda está aguardando pagamento.

Total: R$ 299,90

Finalize agora: [LINK]

Precisa de ajuda? Responda esta mensagem!
\`\`\`

---

### ❌ Pagamento Recusado

**Evento:** \`order_payment_refused\`

**Workflow:**
1. Webhook recebe recusa
2. **Enviar imediatamente** mensagem com alternativas
3. Criar pedido novo com PIX

\`\`\`
[Webhook] → [Create PIX Order] → [Send WhatsApp]
                ↓
         [Link PIX + Boleto]
\`\`\`

**Mensagem exemplo:**
\`\`\`
❌ Ops! Seu pagamento não foi aprovado.

Não se preocupe! Temos outras opções:

1️⃣ PIX (aprovação instantânea)
   [GERAR PIX]

2️⃣ Boleto bancário
   [GERAR BOLETO]

3️⃣ Outro cartão de crédito
   [TENTAR NOVAMENTE]

Precisa de ajuda? Estamos aqui! 💚
\`\`\`

---

### 🔴 Erro de Pagamento (Dados Incorretos)

**Evento:** \`order_payment_error\`

**Workflow:**
1. Webhook recebe erro
2. Identificar tipo de erro
3. Enviar instruções específicas

\`\`\`
[Webhook] → [Parse Error] → [Send Instructions]
\`\`\`

**Mensagem exemplo:**
\`\`\`
⚠️ Detectamos um problema no seu pagamento:

• Dados do cartão incorretos
• Verifique: número, validade, CVV
• Tente novamente: [LINK]

Dúvidas? Fale conosco!
\`\`\`

---

### ⏰ Pedido Expirado (24h sem pagamento)

**Evento:** \`order_expired\`

**Workflow:**
1. Sistema marca pedido como expirado
2. Webhook dispara
3. Enviar último lembrete com desconto

\`\`\`
[Webhook] → [Generate Coupon 10%] → [Send Final Offer]
\`\`\`

**Mensagem exemplo:**
\`\`\`
🎁 ÚLTIMA CHANCE, João!

Seu pedido está prestes a expirar, mas temos uma SURPRESA:

🔥 10% DE DESCONTO
💰 De R$ 299,90 por R$ 269,91

Válido por 2 horas: [FINALIZAR COM DESCONTO]

Não perca! ⏰
\`\`\`

---

## 5. Status do iPag

O campo \`ipag_status\` indica o status no iPag:

| Código | Significado | Webhook Disparado |
|--------|-------------|-------------------|
| 1 | Iniciado | - |
| 2 | Aguardando Pagamento | \`order_pending\` |
| 3 | Cancelado | \`order_payment_refused\` |
| 4 | Em Análise | - |
| 5 | Aprovado | \`order_paid\` |
| 6 | Estornado | \`order_cancelled\` |
| 7 | Recusado | \`order_payment_refused\` |
| 8 | Capturado | \`order_paid\` |

---

## 6. Monitoramento de Webhooks

### Ver Logs no Admin

1. **Admin → Webhooks**
2. Cada webhook mostra:
   - Última execução
   - Status code (200 = sucesso)
   - Último erro (se houver)
   - Disparos nas últimas 24h

### Consultar Logs Detalhados

No Supabase SQL Editor:

\`\`\`sql
-- Ver últimos 50 webhooks
SELECT * FROM webhook_logs
ORDER BY created_at DESC
LIMIT 50;

-- Ver estatísticas
SELECT * FROM webhook_monitor;

-- Ver webhooks de um pedido específico
SELECT * FROM webhook_logs
WHERE order_id = 'uuid-do-pedido';
\`\`\`

---

## 7. Boas Práticas

### Timing Ideal

| Evento | Aguardar | Ação |
|--------|----------|------|
| Pendente | 1 hora | Primeiro lembrete |
| Pendente | 6 horas | Segundo lembrete |
| Pendente | 23 horas | Lembrete final + desconto |
| Recusado | Imediato | Oferecer alternativas |
| Erro | Imediato | Instruções de correção |

### Tom da Mensagem

✅ **Faça:**
- Seja empático e prestativo
- Ofereça soluções claras
- Facilite a ação (links diretos)
- Use emojis com moderação

❌ **Evite:**
- Tom agressivo ou apressado
- Mensagens genéricas
- Muitas opções (confunde)
- Spam (mais de 3 mensagens)

### Testes

Antes de ativar para todos:

1. Configure apenas \`order_pending\`
2. Faça pedido teste
3. Verifique se webhook disparou
4. Ajuste mensagens
5. Ative outros eventos

---

## 8. Exemplo Completo n8n

\`\`\`json
{
  "nodes": [
    {
      "name": "Webhook Pedido Pendente",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "order-pending",
        "method": "POST"
      }
    },
    {
      "name": "Aguardar 1 Hora",
      "type": "n8n-nodes-base.wait",
      "parameters": {
        "amount": 60,
        "unit": "minutes"
      }
    },
    {
      "name": "Verificar Status Atual",
      "type": "n8n-nodes-base.supabase",
      "parameters": {
        "operation": "get",
        "table": "orders",
        "id": "={{$json.data.order.id}}"
      }
    },
    {
      "name": "Ainda Pendente?",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json.status}}",
              "value2": "pending"
            }
          ]
        }
      }
    },
    {
      "name": "Enviar Lembrete WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://evolution-api.com/message/sendText/instance",
        "method": "POST",
        "body": {
          "number": "={{$node['Webhook Pedido Pendente'].json.data.user.whatsapp}}",
          "text": "Olá {{$node['Webhook Pedido Pendente'].json.data.user.name}}! Seu pedido {{$node['Webhook Pedido Pendente'].json.data.order.order_number}} ainda está aguardando. Finalize: [LINK]"
        }
      }
    }
  ]
}
\`\`\`

---

## 9. ROI Esperado

Com webhooks de recuperação:

- 📈 **+30-40%** recuperação de carrinhos abandonados
- 💳 **+20-25%** conversão de pagamentos recusados
- ⏰ **+15-20%** finalização de pedidos pendentes
- 📊 **ROI médio**: 3-5x o investimento em automação

---

## 10. Suporte

### Webhook não dispara
- Verifique se está **Ativo** no Admin
- Confirme URL do n8n correta
- Veja logs em \`webhook_logs\`

### Webhook dispara mas n8n não recebe
- Teste URL manualmente (Postman)
- Verifique firewall/IP
- Confirme método POST

### Muitos webhooks duplicados
- Problema de network/timeout
- Aumente \`timeout_ms\` no config
- Reduza \`retry_count\`

`,
    },
    {
        id: 'rastreamento-pedidos',
        title: 'Sistema de Rastreamento de Pedidos',
        icon: Truck,
        category: 'Funcionalidades',
        keywords: ['rastreamento', 'tracking', 'correios', 'entrega', 'transportadora', 'n8n', 'webhook'],
        content: `
# 📦 Sistema de Rastreamento de Pedidos

## Visão Geral

Sistema bidirecional de rastreamento que permite:
- Enviar dados de pedidos para n8n quando pagos
- Receber código de rastreamento e status do n8n
- Atualizar automaticamente o status do pedido

## Fluxo Completo

\`\`\`
[Cliente Paga] → [Sistema] → [Webhook n8n] → [Melhor Envio/Sistema Logística]
                                  ↓
                            [Gera Rastreio]
                                  ↓
              [n8n] → [Update Tracking API] → [Sistema Atualiza]
                                  ↓
                          [Cliente Vê Link de Rastreio]
\`\`\`

---

## 1. Configuração Inicial

### Aplicar Migration

No **Supabase Dashboard → SQL Editor**:

\`\`\`sql
-- Copie e cole o arquivo:
-- supabase/migrations/20260203_005_add_tracking_fields.sql
\`\`\`

Isso adiciona à tabela \`orders\`:
- \`tracking_url\` - URL completa de rastreamento
- \`carrier\` - Nome da transportadora
- \`shipped_at\` - Data/hora do envio
- \`delivered_at\` - Data/hora da entrega

### Configurar Webhook de Pedido Pago

1. **Admin → Webhooks**
2. Ative o evento \`order_paid\`
3. Cole a URL do seu workflow n8n
4. Teste o webhook

---

## 2. Workflow n8n (Enviar Rastreio)

### Node 1: Webhook (Recebe pedido pago)
\`\`\`
Method: POST
Path: /order-paid
\`\`\`

**Payload recebido:**
\`\`\`json
{
  "event": "order_paid",
  "data": {
    "order": {
      "id": "uuid",
      "order_number": "REV-111135",
      "total": 299.90,
      "items": [...]
    },
    "user": {
      "name": "João Silva",
      "email": "joao@email.com"
    },
    "address": {
      "street": "Rua ABC",
      "number": "123",
      "city": "São Paulo",
      "state": "SP",
      "cep": "01234-567"
    }
  }
}
\`\`\`

### Node 2: HTTP Request (Melhor Envio / API Logística)

Crie a etiqueta de envio com sua API de logística.

### Node 3: HTTP Request (Atualizar Sistema)

\`\`\`
Method: POST
URL: https://rrgrkbjmoezpesqnjilk.supabase.co/functions/v1/update-order-tracking

Headers:
  Authorization: Bearer [SUA_ANON_KEY]
  Content-Type: application/json

Body:
{
  "order_id": "{{$node["Webhook"].json["data"]["order"]["id"]}}",
  "tracking_code": "ABC123456BR",
  "tracking_url": "https://rastreamento.correios.com.br/app/index.php?objeto=ABC123456BR",
  "carrier": "Correios",
  "status": "shipped"
}
\`\`\`

---

## 3. API de Atualização de Rastreio

### Endpoint
\`\`\`
POST https://rrgrkbjmoezpesqnjilk.supabase.co/functions/v1/update-order-tracking
\`\`\`

### Headers
\`\`\`
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
\`\`\`

### Body (Parâmetros)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| \`order_id\` | string | Sim* | UUID do pedido |
| \`order_number\` | string | Sim* | Número do pedido (ex: REV-111135) |
| \`tracking_code\` | string | Não | Código de rastreio |
| \`tracking_url\` | string | Não | URL completa para rastreamento |
| \`carrier\` | string | Não | Nome da transportadora |
| \`status\` | string | Não | Novo status: \`shipped\`, \`delivered\` |

*Envie \`order_id\` OU \`order_number\` (um dos dois é obrigatório)

### Exemplo de Requisição

\`\`\`bash
curl -X POST \\
  https://rrgrkbjmoezpesqnjilk.supabase.co/functions/v1/update-order-tracking \\
  -H 'Authorization: Bearer SUA_ANON_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "order_number": "REV-111135",
    "tracking_code": "ABC123456BR",
    "tracking_url": "https://rastreamento.correios.com.br/app/index.php?objeto=ABC123456BR",
    "carrier": "Correios",
    "status": "shipped"
  }'
\`\`\`

### Resposta de Sucesso

\`\`\`json
{
  "success": true,
  "message": "Pedido atualizado com sucesso",
  "order": {
    "id": "uuid",
    "order_number": "REV-111135",
    "tracking_code": "ABC123456BR",
    "tracking_url": "https://...",
    "status": "shipped",
    "carrier": "Correios"
  }
}
\`\`\`

---

## 4. Exemplos de Uso

### Apenas Adicionar Rastreio (sem mudar status)
\`\`\`json
{
  "order_number": "REV-111135",
  "tracking_code": "ABC123456BR",
  "tracking_url": "https://rastreamento.correios.com.br/app/index.php?objeto=ABC123456BR",
  "carrier": "Correios"
}
\`\`\`

### Marcar como Enviado + Rastreio
\`\`\`json
{
  "order_number": "REV-111135",
  "tracking_code": "ABC123456BR",
  "tracking_url": "https://rastreamento.correios.com.br/app/index.php?objeto=ABC123456BR",
  "carrier": "Correios",
  "status": "shipped"
}
\`\`\`

### Marcar como Entregue
\`\`\`json
{
  "order_number": "REV-111135",
  "status": "delivered"
}
\`\`\`

---

## 5. Transportadoras Suportadas

Configure conforme sua transportadora:

### Correios
\`\`\`json
{
  "carrier": "Correios",
  "tracking_url": "https://rastreamento.correios.com.br/app/index.php?objeto=ABC123456BR"
}
\`\`\`

### Jadlog
\`\`\`json
{
  "carrier": "Jadlog",
  "tracking_url": "https://www.jadlog.com.br/tracking/ABC123456"
}
\`\`\`

### Total Express
\`\`\`json
{
  "carrier": "Total Express",
  "tracking_url": "https://sistema.totalexpress.com.br/tracking/ABC123456"
}
\`\`\`

---

## 6. Status Válidos

| Status | Descrição | Ação Automática |
|--------|-----------|-----------------|
| \`pending\` | Pendente pagamento | - |
| \`paid\` | Pago | - |
| \`shipped\` | Enviado | Define \`shipped_at\` |
| \`delivered\` | Entregue | Define \`delivered_at\` |
| \`cancelled\` | Cancelado | - |

---

## 7. Visualização para o Cliente

Quando o rastreio é adicionado, o cliente vê:

📦 **Pedido REV-111135**
- Status: Enviado
- **[Rastrear: ABC123456BR →]** (link clicável)
- via Correios

O link abre o rastreamento em nova aba.

---

## 8. Workflow n8n Completo (JSON)

\`\`\`json
{
  "nodes": [
    {
      "name": "Receber Pedido Pago",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "order-paid",
        "method": "POST"
      }
    },
    {
      "name": "Criar Etiqueta Melhor Envio",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.melhorenvio.com/v2/shipments",
        "method": "POST"
      }
    },
    {
      "name": "Atualizar Sistema com Rastreio",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://rrgrkbjmoezpesqnjilk.supabase.co/functions/v1/update-order-tracking",
        "method": "POST",
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer SUA_ANON_KEY"
            }
          ]
        },
        "bodyParameters": {
          "parameters": [
            {
              "name": "order_id",
              "value": "={{$node['Receber Pedido Pago'].json.data.order.id}}"
            },
            {
              "name": "tracking_code",
              "value": "={{$node['Criar Etiqueta Melhor Envio'].json.tracking}}"
            },
            {
              "name": "tracking_url",
              "value": "={{$node['Criar Etiqueta Melhor Envio'].json.tracking_url}}"
            },
            {
              "name": "carrier",
              "value": "Correios"
            },
            {
              "name": "status",
              "value": "shipped"
            }
          ]
        }
      }
    }
  ]
}
\`\`\`

---

## 9. Troubleshooting

### Erro: "Pedido não encontrado"
- Verifique se o \`order_id\` ou \`order_number\` está correto
- Confira se o pedido existe no banco

### Erro: 401 Unauthorized
- Verifique se o token \`Authorization\` está correto
- Use a \`ANON_KEY\` do Supabase

### Link não aparece para cliente
- Verifique se \`tracking_url\` foi enviado
- Confira se o cliente está vendo a página atualizada

### Status não mudou
- Apenas status válidos são aceitos
- Verifique logs da Edge Function no Supabase

---

## 10. Benefícios

✅ **Automático**: Cliente vê rastreio sem intervenção manual
✅ **Tempo Real**: Atualização instantânea via webhook
✅ **Rastreável**: Link direto para transportadora
✅ **Flexível**: Funciona com qualquer transportadora
✅ **Escalável**: Processa milhares de pedidos

`,
    },
    {
        id: 'chatwoot-crm',
        title: 'Integração Chatwoot + n8n (CRM)',
        icon: Users,
        category: 'Integrações',
        keywords: ['chatwoot', 'crm', 'clientes', 'n8n', 'sincronização', 'whatsapp', 'atendimento'],
        content: `
# 💬 Integração Chatwoot + n8n (CRM Completo)

## Visão Geral

Esta integração permite sincronizar automaticamente os dados dos seus clientes com o Chatwoot, criando um CRM completo para atendimento.

### O que será sincronizado:
- ✅ Cadastro de novos clientes
- ✅ Atualização de dados
- ✅ Histórico de compras
- ✅ Carrinho abandonado
- ✅ Status de aprovação

## 1. Configuração no Chatwoot

### Obter Credenciais
1. Acesse **Configurações → Perfil → Access Token**
2. Copie o token gerado
3. Anote: Account ID e Inbox ID

### Configurar no Admin
1. **Admin → Settings**
2. Preencha:
   - Chatwoot API URL
   - Chatwoot API Key
   - Account ID e Inbox ID
   - n8n Customer Sync Webhook URL

## 2. Migration Necessária

Execute no Supabase SQL Editor:
\`\`\`sql
-- Copie e cole o arquivo:
-- supabase/migrations/20260203_003_customer_sync_webhooks.sql
\`\`\`

## 3. Workflow n8n

### Nodes:
1. **Webhook** (Trigger)
2. **IF Node** (Verificar evento)
3. **HTTP Request** (Criar/Atualizar contato Chatwoot)
4. **Set** (Adicionar tags)

### Exemplo de Payload:
\`\`\`json
{
  "event": "customer_created",
  "data": {
    "user_id": "uuid",
    "email": "cliente@email.com",
    "full_name": "João Silva",
    "whatsapp": "11999999999",
    "cpf": "12345678900",
    "metadata": {
      "company_name": "Empresa XYZ"
    }
  }
}
\`\`\`

## 4. Benefícios

- ✅ Atendimento centralizado
- ✅ Histórico completo do cliente
- ✅ Automação de mensagens
- ✅ Equipe sincronizada
- ✅ WhatsApp Business integrado
        `
    },
    {
        id: 'carrinho-abandonado',
        title: 'Sistema de Carrinho Abandonado',
        icon: ShoppingCart,
        category: 'Funcionalidades',
        keywords: ['carrinho', 'abandono', 'recuperação', 'email', 'whatsapp', 'templates'],
        content: `
# 🛒 Sistema de Carrinho Abandonado

## Como Funciona

O sistema rastreia automaticamente quando um usuário adiciona produtos ao carrinho mas não finaliza a compra.

### Fluxo Automático

1. **Rastreamento**: Sistema salva carrinho automaticamente a cada mudança
2. **Detecção**: Após 30 minutos sem atividade, marca como abandonado
3. **Webhook**: Envia dados para n8n para processamento
4. **Recuperação**: Mensagens são enviadas conforme templates configurados

## Configuração

### Passo 1: Configurar Timeout
- Acesse: **Admin → Configurações**
- Ajuste o tempo de abandono (padrão: 30 minutos)

### Passo 2: Criar Templates
- Acesse: **Admin → Templates**
- Use os templates prontos ou crie personalizados
- Defina delay e canal (email/WhatsApp/ambos)

### Passo 3: Configurar Webhook
- Acesse: **Admin → Webhooks**
- Cole a URL do seu workflow n8n
- Teste o webhook

## Templates Prontos

### 1ª Mensagem (30 min)
Tom amigável lembrando gentilmente o cliente.

### 2ª Mensagem (4 horas)
Tom de urgência, criando senso de escassez.

### 3ª Mensagem (24 horas)
Oferta especial com incentivo final.

## Variáveis Disponíveis

- \`{{user_name}}\` - Nome do cliente
- \`{{user_email}}\` - Email
- \`{{cart_items}}\` - Lista de produtos
- \`{{cart_total}}\` - Valor total
- \`{{recovery_link}}\` - Link para finalizar compra

## Monitoramento

Acesse **Admin → Carrinhos Abandonados** para ver:
- Total de carrinhos abandonados
- Valor potencial perdido
- Taxa de recuperação
- Status de envio (email/WhatsApp)
        `
    },
    {
        id: 'webhook-n8n',
        title: 'Integração com n8n (Webhooks)',
        icon: Bell,
        category: 'Integrações',
        keywords: ['webhook', 'n8n', 'automação', 'integração', 'api'],
        content: `
# 🔗 Integração com n8n

## O que é n8n?

n8n é uma ferramenta de automação que conecta diferentes aplicações através de workflows.

## Workflow Recomendado

\`\`\`
[Webhook] → [Verificar Canal] → [Enviar Email/WhatsApp] → [Aguardar] → [2ª Mensagem]
\`\`\`

## Configuração

### 1. Criar Workflow no n8n

1. Acesse seu n8n
2. Crie novo workflow
3. Adicione node "Webhook"
4. Configure: Method=POST, Path=/carrinho-abandonado
5. Copie a URL gerada

### 2. Configurar no Admin

1. Acesse **Admin → Webhooks**
2. Selecione evento "Carrinho Abandonado"
3. Cole a URL do webhook
4. Ative o webhook
5. Teste clicando em "Testar Webhook"

### 3. Nodes Necessários

#### Webhook (Trigger)
Recebe os dados do carrinho abandonado.

#### IF Node
Verifica canal de envio (email, whatsapp, both).

#### Amazon SES Node
Envia email com template via Amazon SES.

#### HTTP Request (Evolution API)
Envia WhatsApp.

#### Wait Node
Aguarda tempo configurado (4h, 24h).

## Payload Enviado

\`\`\`json
{
  "event": "cart_abandoned",
  "timestamp": "2026-02-03T12:30:00Z",
  "data": {
    "cart_id": "uuid",
    "user": {
      "name": "João Silva",
      "email": "joao@email.com",
      "whatsapp": "11999999999"
    },
    "items": [...],
    "total": 199.80,
    "recovery_link": "https://..."
  }
}
\`\`\`

## Eventos Disponíveis

- \`cart_abandoned\` - Carrinho abandonado
- \`order_created\` - Pedido criado
- \`order_paid\` - Pedido pago
- \`order_shipped\` - Pedido enviado
- \`user_registered\` - Usuário cadastrado

## Troubleshooting

### Webhook não está sendo chamado
- Verifique se está ativo no painel
- Teste manualmente com o botão "Testar"
- Verifique logs no n8n

### Erro 404
- Confirme a URL está correta
- Verifique se o workflow está ativo

### Timeout
- Aumente o timeout nas configurações
- Simplifique o workflow para testar
        `
    },
    {
        id: 'tracking-analytics',
        title: 'Google Analytics & Facebook Pixel',
        icon: Code,
        category: 'Marketing',
        keywords: ['analytics', 'tracking', 'google', 'facebook', 'pixel', 'ads', 'conversão'],
        content: `
# 📊 Rastreamento de Eventos

## Configurar IDs de Tracking

Acesse **Admin → Configurações** e configure:

### Google Analytics 4
- ID formato: \`G-XXXXXXXXXX\`
- Rastreia: pageviews, eventos, conversões

### Google Ads
- ID formato: \`AW-XXXXXXXXXX\`
- Rastreia: conversões de compra

### Facebook Pixel
- ID numérico
- Rastreia: eventos, purchase

## Eventos Rastreados Automaticamente

### Funil de Checkout

1. **begin_checkout** - Usuário inicia checkout
2. **add_shipping_info** - Adiciona endereço
3. **add_payment_info** - Escolhe pagamento
4. **purchase** - Completa compra

### Catálogo

- **view_item** - Visualiza produto
- **add_to_cart** - Adiciona ao carrinho
- **remove_from_cart** - Remove do carrinho

### Usuário

- **sign_up** - Cadastro novo
- **login** - Login

## Como Ver os Dados

### Google Analytics
1. Acesse analytics.google.com
2. Vá em "Relatórios" → "Eventos"
3. Veja funil em "Monetização" → "Visão geral do e-commerce"

### Facebook Pixel
1. Acesse facebook.com/events_manager
2. Selecione seu pixel
3. Veja eventos em tempo real

## Otimização de Campanhas

Use os dados para:
- Criar públicos personalizados
- Otimizar anúncios
- Identificar gargalos no funil
- Melhorar taxa de conversão
        `
    },
    {
        id: 'gestao-pedidos',
        title: 'Gestão de Pedidos',
        icon: Database,
        category: 'Operacional',
        keywords: ['pedidos', 'orders', 'status', 'rastreio', 'tracking'],
        content: `
# 📦 Gestão de Pedidos

## Acessar Pedidos

Acesse **Admin → Pedidos** para ver todos os pedidos.

## Status de Pedidos

### Pending (Pendente)
Pedido criado mas pagamento não confirmado.

**Ações:**
- Aguardar pagamento
- Ou marcar manualmente como pago (se recebeu fora do sistema)

### Paid (Pago)
Pagamento confirmado pelo iPag.

**Ações:**
- Separar produtos
- Adicionar código de rastreio
- Marcar como "Enviado"

### Shipped (Enviado)
Pedido postado com código de rastreio.

**Ações:**
- Acompanhar entrega
- Quando recebido, marcar como "Entregue"

### Delivered (Entregue)
Pedido recebido pelo cliente.

**Ações:**
- Solicitar avaliação
- Arquivar pedido

### Canceled (Cancelado)
Pedido cancelado.

## Adicionar Código de Rastreio

1. Clique no ícone 👁️ para ver detalhes
2. Se status = "Paid", digite o código de rastreio
3. Clique em "Marcar como Enviado"
4. Sistema enviará notificação automática ao cliente

## Buscar Pedidos

Use a busca para encontrar por:
- Número do pedido (REV-111xxx)
- Nome do cliente
- Email
- Data

## Filtros

Filtre por status:
- Todos
- Pendente
- Pago
- Enviado
- Entregue

## Exportar Relatórios

_(Em desenvolvimento)_
Será possível exportar pedidos em CSV/Excel para análise.
        `
    },
    {
        id: 'gestao-usuarios',
        title: 'Gestão de Usuários e Roles',
        icon: Settings,
        category: 'Administração',
        keywords: ['usuários', 'aprovação', 'roles', 'permissões', 'admin', 'gerente'],
        content: `
# 👥 Gestão de Usuários

## Aprovação de Cadastros

### Fluxo de Aprovação

1. Usuário se cadastra no site
2. Status inicial: **Pendente**
3. Admin/Gerente aprova ou rejeita
4. Se aprovado: usuário pode fazer login

### Aprovar Usuário

1. Acesse **Admin → Usuários**
2. Filtro: "Pendentes"
3. Clique em "Gerenciar" no usuário
4. Clique em "Aprovar"

### Rejeitar Usuário

Útil para cadastros suspeitos ou duplicados.

## Sistema de Roles

### Administrator
**Permissões:**
- Acesso total ao painel
- Gerenciar usuários e roles
- Configurar webhooks
- Editar templates
- Ver todas as configurações

### Manager (Gerente)
**Permissões:**
- Ver pedidos
- Atualizar status de pedidos
- Aprovar usuários
- Ver carrinhos abandonados
- **NÃO** pode alterar configurações

### Client (Revendedor)
**Permissões:**
- Fazer pedidos
- Ver histórico próprio
- **NÃO** acessa painel admin

## Alterar Role

**(Apenas Administrator)**

1. Acesse **Admin → Usuários**
2. Clique em "Gerenciar"
3. Seção "Alterar Role"
4. Escolha: Administrator, Manager ou Client
5. Salve

## Criar Novo Admin

Para adicionar outro administrador:

1. Peça para pessoa se cadastrar normalmente
2. Aprove o cadastro
3. Mude role para "Administrator"

Ou via SQL:
\`\`\`sql
INSERT INTO user_roles (user_id, role)
VALUES ('uuid-do-usuario', 'administrator');
\`\`\`
        `
    },
    {
        id: 'email-amazon-ses',
        title: 'Email com Amazon SES no n8n',
        icon: Bell,
        category: 'Integrações',
        keywords: ['email', 'amazon', 'ses', 'smtp', 'n8n', 'envio'],
        content: `
# 📧 Enviar Emails com Amazon SES no n8n

## O que é Amazon SES?

Amazon Simple Email Service (SES) é um serviço de envio de emails em massa da AWS, altamente confiável e com baixo custo.

## Configuração no n8n

### Passo 1: Obter Credenciais AWS

1. Acesse AWS Console → IAM
2. Crie novo usuário com permissão \`AmazonSESFullAccess\`
3. Gere **Access Key ID** e **Secret Access Key**
4. Salve as credenciais (não serão mostradas novamente)

### Passo 2: Verificar Domínio/Email no SES

1. Acesse AWS Console → SES
2. Vá em "Verified identities"
3. Clique em "Create identity"
4. Escolha:
   - **Email address**: Verificar um email específico (ex: noreply@patriciaelias.com)
   - **Domain**: Verificar domínio inteiro (recomendado)
5. Siga instruções de verificação (DNS records)

### Passo 3: Sair do Sandbox (Produção)

⚠️ **IMPORTANTE**: Por padrão, SES está em "sandbox mode" e só envia para emails verificados.

Para produção:
1. AWS Console → SES → Account dashboard
2. Clique em "Request production access"
3. Preencha formulário explicando uso
4. Aguarde aprovação (geralmente 24h)

## Configurar Node no n8n

### Opção 1: AWS SES Node (Recomendado)

1. Adicione node **"AWS SES"**
2. Configure credenciais:
   - **Access Key ID**: Sua key da AWS
   - **Secret Access Key**: Sua secret
   - **Region**: us-east-1 (ou sua região)

3. Configure mensagem:
   - **From Email**: noreply@patriciaelias.com (verificado no SES)
   - **To Email**: \`{{ $json.data.user.email }}\`
   - **Subject**: \`{{ $json.template.subject }}\`
   - **Body/Html**: \`{{ $json.template.content }}\`
   - **Body Type**: HTML

### Opção 2: SMTP do SES

Se preferir usar SMTP genérico:

1. Gere credenciais SMTP no SES:
   - AWS Console → SES → SMTP settings
   - Clique em "Create SMTP credentials"
   - Salve username e password

2. No n8n, use node **"Send Email"**:
   - **Host**: email-smtp.us-east-1.amazonaws.com
   - **Port**: 587 (TLS) ou 465 (SSL)
   - **Username**: Seu SMTP username
   - **Password**: Seu SMTP password
   - **From**: noreply@patriciaelias.com
   - **To**: \`{{ $json.data.user.email }}\`

## Workflow Completo - Carrinho Abandonado

\`\`\`
[Webhook Trigger]
    ↓
[Buscar Template Ativo] (Supabase)
    ↓
[Substituir Variáveis] (Function)
    ↓
[AWS SES / Send Email]
    ↓
[Atualizar Abandoned Cart] (Supabase)
    recovery_email_sent = true
\`\`\`

### Node 1: Webhook
\`\`\`json
{
  "method": "POST",
  "path": "carrinho-abandonado"
}
\`\`\`

### Node 2: Supabase - Buscar Template
\`\`\`
Operation: Select Rows
Table: recovery_templates
Filters:
  - type = "email"
  - is_active = true
  - is_default = true
Return: All
\`\`\`

### Node 3: Function - Substituir Variáveis
\`\`\`javascript
const template = $input.item.json.recovery_templates[0];
const cart = $input.first().json.data;

let content = template.content;
let subject = template.subject;

// Substituir variáveis
content = content
  .replace(/{{user_name}}/g, cart.user.name)
  .replace(/{{user_email}}/g, cart.user.email)
  .replace(/{{cart_total}}/g, \`R$ \${cart.total.toFixed(2)}\`)
  .replace(/{{cart_items}}/g, cart.items.map(i => \`\${i.quantity}x \${i.name}\`).join(', '))
  .replace(/{{recovery_link}}/g, cart.recovery_link)
  .replace(/{{store_name}}/g, 'Patricia Elias');

subject = subject
  .replace(/{{user_name}}/g, cart.user.name);

// Converter para HTML
const htmlContent = content
  .replace(/\\n/g, '<br>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

return {
  to: cart.user.email,
  subject: subject,
  html: htmlContent,
  cart_id: cart.cart_id
};
\`\`\`

### Node 4: AWS SES
\`\`\`
From Email: noreply@patriciaelias.com
To Email: {{ $json.to }}
Subject: {{ $json.subject }}
Body/Html: {{ $json.html }}
Body Type: HTML
\`\`\`

### Node 5: Supabase - Marcar Enviado
\`\`\`
Operation: Update
Table: abandoned_carts
Filters:
  - id = {{ $json.cart_id }}
Fields:
  - recovery_email_sent: true
  - updated_at: {{ $now }}
\`\`\`

## Template HTML Bonito

Use HTML para emails mais profissionais:

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4A90E2; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; background: #f9f9f9; }
    .button { display: inline-block; padding: 12px 30px; background: #4A90E2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛒 Você Esqueceu Algo!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{user_name}}</strong>,</p>
      <p>Notamos que você deixou alguns produtos no carrinho:</p>
      <p style="background: white; padding: 15px; border-left: 4px solid #4A90E2;">
        {{cart_items}}<br>
        <strong>Total: {{cart_total}}</strong>
      </p>
      <p>Finalize sua compra agora e garanta estes produtos!</p>
      <center>
        <a href="{{recovery_link}}" class="button">
          Finalizar Compra Agora
        </a>
      </center>
    </div>
    <div class="footer">
      <p>{{store_name}} • Enviado com 💙</p>
      <p>Você recebeu este email porque deixou produtos no carrinho.</p>
    </div>
  </div>
</body>
</html>
\`\`\`

## Boas Práticas

### ✅ Fazer

- Sempre use "From" verificado no SES
- Use HTML responsivo
- Inclua link de descadastro
- Personalize com nome do cliente
- Teste antes de enviar em massa

### ❌ Evitar

- Enviar de email não verificado
- Usar palavras spam (GRÁTIS, URGENTE, etc.)
- Enviar sem consentimento
- Emails muito longos

## Monitoramento

### Ver Métricas no SES

1. AWS Console → SES → Dashboard
2. Veja:
   - **Emails enviados**
   - **Bounces** (emails rejeitados)
   - **Complaints** (marcados como spam)
   - **Delivery rate**

### Alertas

Configure alertas para:
- Taxa de bounce > 5%
- Taxa de complaint > 0.1%
- Emails em fila

## Custos

Amazon SES é muito barato:
- **Primeiros 62.000 emails/mês**: GRÁTIS (se enviar via EC2)
- **Após isso**: $0.10 por 1.000 emails
- **Exemplo**: 10.000 emails = ~$1.00

## Troubleshooting

### Erro: Email not verified
**Solução**: Verifique o email/domínio no SES antes.

### Erro: Account in sandbox
**Solução**: Solicite saída do sandbox mode.

### Email vai para SPAM
**Soluções**:
- Configure SPF, DKIM, DMARC no DNS
- Use domínio verificado
- Evite palavras spam
- Inclua link de descadastro

### Bounce alto
**Soluções**:
- Valide emails antes de enviar
- Remova emails que deram bounce
- Use lista de opt-in

## Links Úteis

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [n8n AWS SES Node](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.awsses/)
- [Configurar DKIM/SPF](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication.html)
        `
    },
    {
        id: 'whatsapp-evolution',
        title: 'WhatsApp com Evolution API',
        icon: MessageSquare,
        category: 'Integrações',
        keywords: ['whatsapp', 'evolution', 'api', 'mensagem', 'recuperação'],
        content: `
# 💬 WhatsApp com Evolution API

## O que é Evolution API?

Evolution API é uma solução open-source para integrar WhatsApp em sistemas através de API REST.

## Instalação

### Docker (Recomendado)

\`\`\`bash
docker run -d \\
  --name evolution-api \\
  -p 8080:8080 \\
  atendai/evolution-api:latest
\`\`\`

### Cloud

Use serviços como:
- Railway.app
- Render.com
- DigitalOcean

## Configuração no n8n

### HTTP Request Node

**URL:** \`https://sua-evolution-api.com/message/sendText/instance-name\`

**Method:** POST

**Headers:**
- \`apikey\`: SUA_API_KEY
- \`Content-Type\`: application/json

**Body:**
\`\`\`json
{
  "number": "5511999999999",
  "text": "Olá {{user_name}}!\\n\\nSeu carrinho..."
}
\`\`\`

## Criar Instância

1. Acesse Evolution API Manager
2. Crie nova instância
3. Escaneie QR Code com WhatsApp
4. Copie API Key
5. Use no n8n

## Formatação de Mensagens

### Negrito
\`*texto*\` → **texto**

### Itálico
\`_texto_\` → _texto_

### Link
\`https://link.com\` → link clicável

### Quebra de linha
Use \`\\n\`

## Boas Práticas

- ✅ Sempre personalize com nome
- ✅ Seja breve e direto
- ✅ Inclua link de recuperação
- ✅ Use emojis com moderação
- ❌ Não envie spam
- ❌ Não use CAIXA ALTA
- ❌ Não envie mais de 3 mensagens

## Troubleshooting

### Erro 403
API Key incorreta. Verifique no Evolution Manager.

### Erro 404
Instância não encontrada. Verifique nome da instância na URL.

### Mensagem não enviada
- WhatsApp desconectado
- Número bloqueado
- Número inválido (falta DDI)

## Links Úteis

- [Documentação Evolution API](https://doc.evolution-api.com)
- [GitHub](https://github.com/EvolutionAPI/evolution-api)
        `
    }
]

export default function Documentation() {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedDoc, setSelectedDoc] = useState(null)
    const [selectedCategory, setSelectedCategory] = useState('all')

    const categories = ['all', ...new Set(documentationSections.map(doc => doc.category))]

    const filteredDocs = documentationSections.filter(doc => {
        const matchesSearch = searchTerm === '' ||
            doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.keywords.some(k => k.includes(searchTerm.toLowerCase())) ||
            doc.content.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory

        return matchesSearch && matchesCategory
    })

    const renderMarkdown = (content) => {
        // Simple markdown parser for display
        return content
            .split('\n')
            .map((line, i) => {
                // Headers
                if (line.startsWith('### ')) {
                    return <h3 key={i} className="text-lg font-semibold text-slate-900 mt-4 mb-2">{line.slice(4)}</h3>
                }
                if (line.startsWith('## ')) {
                    return <h2 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-3">{line.slice(3)}</h2>
                }
                if (line.startsWith('# ')) {
                    return <h1 key={i} className="text-2xl font-bold text-slate-900 mb-4">{line.slice(2)}</h1>
                }
                // Code blocks
                if (line.startsWith('```')) {
                    return null // Simplified - skip code fence markers
                }
                // Bullet points
                if (line.startsWith('- ')) {
                    return <li key={i} className="ml-6 text-slate-700">{line.slice(2)}</li>
                }
                // Bold
                const boldText = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                // Inline code
                const codeText = boldText.replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 rounded text-sm">$1</code>')

                // Regular paragraph
                if (line.trim()) {
                    return <p key={i} className="text-slate-700 mb-2" dangerouslySetInnerHTML={{ __html: codeText }} />
                }
                return <br key={i} />
            })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Book className="w-7 h-7 text-primary" />
                        Documentação & Guias
                    </h1>
                    <p className="text-slate-500">Tutoriais e manuais completos do sistema</p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar em guias e tutoriais..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                selectedCategory === cat
                                    ? 'bg-primary text-white'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {cat === 'all' ? 'Todos' : cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sidebar - List */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200">
                            <p className="text-sm font-medium text-slate-700">
                                {filteredDocs.length} {filteredDocs.length === 1 ? 'guia encontrado' : 'guias encontrados'}
                            </p>
                        </div>
                        <div className="divide-y divide-slate-200 max-h-[calc(100vh-300px)] overflow-y-auto">
                            {filteredDocs.map(doc => {
                                const Icon = doc.icon
                                return (
                                    <button
                                        key={doc.id}
                                        onClick={() => setSelectedDoc(doc)}
                                        className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                                            selectedDoc?.id === doc.id ? 'bg-primary/5 border-l-4 border-primary' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                                selectedDoc?.id === doc.id ? 'text-primary' : 'text-slate-400'
                                            }`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 text-sm">{doc.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{doc.category}</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        </div>
                                    </button>
                                )
                            })}
                            {filteredDocs.length === 0 && (
                                <div className="p-8 text-center text-slate-400">
                                    <Book className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum guia encontrado</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[600px]">
                        {selectedDoc ? (
                            <div>
                                <div className="flex items-start gap-3 mb-6 pb-6 border-b border-slate-200">
                                    {(() => {
                                        const Icon = selectedDoc.icon
                                        return <Icon className="w-8 h-8 text-primary flex-shrink-0" />
                                    })()}
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">{selectedDoc.title}</h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {selectedDoc.category} • {selectedDoc.keywords.slice(0, 3).join(', ')}
                                        </p>
                                    </div>
                                </div>
                                <div className="prose prose-slate max-w-none">
                                    {renderMarkdown(selectedDoc.content)}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Book className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-lg font-medium">Selecione um guia para começar</p>
                                <p className="text-sm mt-2">Escolha um tópico na lista ao lado</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* External Links */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <ExternalLink className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800">Documentação Externa</p>
                        <div className="mt-2 space-y-1">
                            <a
                                href="https://docs.n8n.io"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-sm text-blue-700 hover:text-blue-900"
                            >
                                → Documentação n8n
                            </a>
                            <a
                                href="https://doc.evolution-api.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-sm text-blue-700 hover:text-blue-900"
                            >
                                → Evolution API (WhatsApp)
                            </a>
                            <a
                                href="https://developers.google.com/analytics"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-sm text-blue-700 hover:text-blue-900"
                            >
                                → Google Analytics
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
