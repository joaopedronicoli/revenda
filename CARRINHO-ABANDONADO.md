# 🛒 Sistema de Carrinho Abandonado - Guia Completo

## 📋 Índice
1. [Como Funciona](#como-funciona)
2. [Configuração Inicial](#configuração-inicial)
3. [Templates de Recuperação](#templates-de-recuperação)
4. [Integração com n8n](#integração-com-n8n)
5. [Workflow Recomendado](#workflow-recomendado)
6. [Monitoramento](#monitoramento)

---

## 🔄 Como Funciona

### Fluxo Automático

1. **Rastreamento**
   - Usuário adiciona produtos ao carrinho
   - Sistema salva automaticamente no banco (`abandoned_carts`)
   - Atualiza a cada mudança (add/remove/update)

2. **Detecção de Abandono**
   - Após **30 minutos** sem atividade, marca como `abandoned`
   - Cron job verifica carrinhos inativos a cada 15 minutos

3. **Disparo de Webhook**
   - Envia dados para n8n via webhook configurado
   - n8n processa e envia mensagens de recuperação

4. **Recuperação**
   - Se usuário finalizar compra, marca como `recovered`
   - Pedido é vinculado ao carrinho recuperado

---

## ⚙️ Configuração Inicial

### 1. Configurar Timeout (Admin)

Acesse: **Admin → Configurações**

- **Timeout de Carrinho**: 30 minutos (padrão)
- **Habilitar Rastreamento**: ✅ Ativo
- **Recuperação Automática**: ✅ Ativo

### 2. Configurar Webhooks

Acesse: **Admin → Webhooks**

#### Evento: `cart_abandoned`

**URL do Webhook**: Cole a URL do seu workflow n8n
```
https://seu-n8n.com/webhook/carrinho-abandonado
```

**Payload enviado:**
```json
{
  "event": "cart_abandoned",
  "timestamp": "2026-02-03T12:30:00Z",
  "data": {
    "cart_id": "uuid-do-carrinho",
    "user": {
      "name": "João Silva",
      "email": "joao@email.com",
      "whatsapp": "11999999999"
    },
    "items": [
      {
        "name": "Produto X",
        "quantity": 2,
        "price": 99.90
      }
    ],
    "total": 199.80,
    "item_count": 2,
    "recovery_link": "https://loja.com/?recover=uuid-carrinho"
  }
}
```

### 3. Testar Webhook

1. Clique em **"Testar Webhook"** no painel admin
2. Verifique se o n8n recebeu o payload
3. Se deu erro, verifique a URL e tente novamente

---

## 📧 Templates de Recuperação

### Templates Prontos (Já Criados)

#### 1️⃣ **Primeira Mensagem** - 30 minutos após abandono
- **Canal**: Email ou WhatsApp
- **Tom**: Amigável e útil
- **Objetivo**: Lembrar o cliente gentilmente

#### 2️⃣ **Segunda Mensagem** - 4 horas após abandono
- **Canal**: Email + WhatsApp
- **Tom**: Urgência e escassez
- **Objetivo**: Criar senso de urgência

#### 3️⃣ **Terceira Mensagem** - 24 horas após abandono
- **Canal**: Email + WhatsApp
- **Tom**: Oferta especial
- **Objetivo**: Incentivo final com benefício

### Configurar Templates

Acesse: **Admin → Templates**

1. **Ativar/Desativar** templates conforme necessário
2. **Definir como padrão** o template principal
3. **Escolher canal**: Email, WhatsApp ou Ambos
4. **Ajustar tempo**: Delay em minutos

### Variáveis Disponíveis

Use estas variáveis nos templates:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{user_name}}` | Nome do cliente | "João Silva" |
| `{{user_email}}` | Email do cliente | "joao@email.com" |
| `{{user_whatsapp}}` | WhatsApp do cliente | "11999999999" |
| `{{cart_items}}` | Lista de itens | "2x Produto A, 1x Produto B" |
| `{{cart_total}}` | Valor total | "R$ 299,90" |
| `{{item_count}}` | Quantidade de itens | "3" |
| `{{recovery_link}}` | Link de recuperação | "https://loja.com/?recover=abc123" |
| `{{store_name}}` | Nome da loja | "Patricia Elias" |

---

## 🔗 Integração com n8n

### Workflow Recomendado

```
[Webhook Trigger]
    ↓
[Verificar canal de envio]
    ↓
┌─────────────┴─────────────┐
│                           │
[Enviar Email]     [Enviar WhatsApp]
(Amazon SES)       (Evolution API)
    │                           │
    └─────────────┬─────────────┘
                  ↓
         [Aguardar resposta]
                  ↓
          [Enviar 2ª mensagem]
           (após 4 horas)
                  ↓
          [Enviar 3ª mensagem]
          (após 24 horas)
```

### Nodes Necessários

#### 1. **Webhook Node** (Trigger)
```
Method: POST
Path: /carrinho-abandonado
Authentication: None (opcional: adicionar auth)
```

#### 2. **IF Node** - Verificar canal
```
Condition: {{ $json.data.template.send_via }}
Values: "email", "whatsapp", "both"
```

#### 3. **Amazon SES Node** - Enviar Email
```
Para: {{ $json.data.user.email }}
Assunto: Use template do webhook
Corpo: Use template do webhook
```

#### 4. **HTTP Request Node** - WhatsApp (Evolution API)
```
Method: POST
URL: https://sua-evolution-api.com/message/sendText/{instance}
Headers:
  - apikey: SUA_API_KEY
  - Content-Type: application/json
Body:
{
  "number": "{{ $json.data.user.whatsapp }}",
  "text": "Template da mensagem com variáveis substituídas"
}
```

#### 5. **Wait Node** - Aguardar
```
Wait for: 4 hours
Resume: Webhook Call
```

#### 6. **Schedule Trigger** - Mensagens seguintes
```
Cron: */15 * * * * (a cada 15 minutos)
Verificar carrinhos abandonados pendentes
Enviar mensagens conforme delay configurado
```

### Exemplo de Workflow Completo (JSON)

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "parameters": {
        "path": "carrinho-abandonado",
        "responseMode": "responseNode",
        "options": {}
      }
    },
    {
      "name": "Verificar Canal",
      "type": "n8n-nodes-base.if",
      "position": [450, 300],
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json.template.send_via}}",
              "operation": "contains",
              "value2": "email"
            }
          ]
        }
      }
    },
    {
      "name": "Enviar Email",
      "type": "n8n-nodes-base.awsSes",
      "position": [650, 200],
      "parameters": {
        "toAddresses": "={{$json.data.user.email}}",
        "subject": "={{$json.template.subject}}",
        "body": "={{$json.template.content}}",
        "fromEmail": "noreply@patriciaelias.com.br"
      }
    },
    {
      "name": "Enviar WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 400],
      "parameters": {
        "url": "https://evolution-api.com/message/sendText/instance",
        "method": "POST",
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "SUA_API_KEY"
            }
          ]
        },
        "bodyParameters": {
          "parameters": [
            {
              "name": "number",
              "value": "={{$json.data.user.whatsapp}}"
            },
            {
              "name": "text",
              "value": "={{$json.template.content}}"
            }
          ]
        }
      }
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "Verificar Canal"}]]
    },
    "Verificar Canal": {
      "main": [
        [{"node": "Enviar Email"}],
        [{"node": "Enviar WhatsApp"}]
      ]
    }
  }
}
```

---

## 📊 Monitoramento

### Painel de Carrinhos Abandonados

Acesse: **Admin → Carrinhos Abandonados**

Você verá:
- 📊 **Total de carrinhos abandonados**
- 💰 **Valor potencial perdido**
- ✅ **Taxa de recuperação**
- 📧 **Status de envio** (email/WhatsApp)

### Métricas Importantes

| Métrica | Onde Ver | O que Significa |
|---------|----------|-----------------|
| **Taxa de Abandono** | Dashboard | % de carrinhos não finalizados |
| **Taxa de Recuperação** | Carrinhos Abandonados | % de carrinhos recuperados |
| **Valor Médio** | Carrinhos Abandonados | Ticket médio dos abandonos |
| **Tempo até Recuperação** | Detalhes do carrinho | Quanto tempo levou para recuperar |

### Ações Disponíveis

- ✅ **Enviar recuperação manual** - Dispara email/WhatsApp imediatamente
- 👁️ **Ver detalhes** - Mostra items, valores, histórico
- 🔗 **Copiar link de recuperação** - Para enviar manualmente

---

## 🎯 Boas Práticas

### ✅ DO (Faça)

1. **Personalize os templates** com o nome da sua loja
2. **Teste os webhooks** antes de ativar
3. **Monitore a taxa de recuperação** semanalmente
4. **Ajuste os delays** conforme resultado
5. **Use urgência com moderação** - só na 2ª mensagem

### ❌ DON'T (Não Faça)

1. **Não envie mais de 3 mensagens** - pode irritar o cliente
2. **Não use tom agressivo** - seja gentil e útil
3. **Não ignore métricas** - sempre analise os resultados
4. **Não desista cedo** - dê tempo para o sistema funcionar
5. **Não sobrecarregue com promoções** - foque na conveniência

---

## 🚀 Próximos Passos

1. ✅ Configure o webhook no n8n
2. ✅ Ative os templates de recuperação
3. ✅ Ajuste os delays conforme seu público
4. ✅ Monitore resultados por 1 semana
5. ✅ Otimize baseado nos dados

---

## 📞 Suporte

Dúvidas sobre:
- **n8n**: [Documentação oficial](https://docs.n8n.io)
- **Evolution API** (WhatsApp): [Docs Evolution](https://doc.evolution-api.com)
- **Sistema**: Contate o desenvolvedor

---

**💡 Dica Final:** Comece simples! Use apenas o template de 30 minutos por email e vá evoluindo conforme os resultados.
