# Configuração do n8n para Patricia Elias Reseller App

Este documento explica como configurar o n8n para integrar com o sistema de carrinhos abandonados e notificações de pedidos.

## Índice

1. [Instalação do n8n](#instalação-do-n8n)
2. [Configuração de Webhooks](#configuração-de-webhooks)
3. [Workflows de Exemplo](#workflows-de-exemplo)
4. [Variáveis Disponíveis](#variáveis-disponíveis)

---

## Instalação do n8n

### Opção 1: n8n Cloud (Recomendado)
1. Acesse [n8n.io](https://n8n.io) e crie uma conta
2. Seu workspace estará disponível em `https://seu-workspace.app.n8n.cloud`

### Opção 2: Self-hosted com Docker
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

---

## Configuração de Webhooks

### Passo 1: Criar um Workflow no n8n

1. Acesse seu n8n
2. Clique em "New Workflow"
3. Adicione um node "Webhook" como trigger
4. Configure o webhook:
   - **HTTP Method**: POST
   - **Path**: Escolha um nome único (ex: `carrinho-abandonado`)
5. Copie a URL gerada (ex: `https://seu-n8n.com/webhook/carrinho-abandonado`)

### Passo 2: Configurar no Admin

1. Acesse o painel admin: `/admin/webhooks`
2. Localize o evento desejado (ex: "Carrinho Abandonado")
3. Cole a URL do webhook no campo correspondente
4. Ative o webhook
5. Clique em "Testar Webhook" para verificar

---

## Workflows de Exemplo

### Workflow: Recuperação de Carrinho Abandonado via Email

```
[Webhook] → [IF (has email)] → [Send Email] → [Respond to Webhook]
```

**Nodes:**

1. **Webhook** (Trigger)
   - Method: POST
   - Path: `cart-abandoned`

2. **IF** (Condição)
   - Condição: `{{ $json.data.user.email }}` não está vazio

3. **Send Email** (Amazon SES)
   - Para: `{{ $json.data.user.email }}`
   - Assunto: `Você esqueceu algo no carrinho!`
   - Corpo:
   ```
   Olá {{ $json.data.user.name }},

   Notamos que você deixou alguns itens no seu carrinho:

   Total: {{ $json.data.total }}

   Clique aqui para finalizar sua compra:
   {{ $json.data.recovery_link }}

   Qualquer dúvida, estamos à disposição!

   Patricia Elias
   ```

4. **Respond to Webhook**
   - Response Code: 200
   - Response Body: `{ "success": true }`

---

### Workflow: Recuperação via WhatsApp (Evolution API)

```
[Webhook] → [IF (has whatsapp)] → [HTTP Request (Evolution)] → [Respond]
```

**Node HTTP Request:**
- Method: POST
- URL: `https://sua-evolution-api.com/message/sendText/instance-name`
- Headers:
  - `apikey`: Sua API key
  - `Content-Type`: application/json
- Body:
```json
{
  "number": "{{ $json.data.user.whatsapp }}",
  "text": "Olá {{ $json.data.user.name }}! 👋\n\nVimos que você deixou alguns itens no carrinho.\n\nTotal: {{ $json.data.total }}\n\nFinalize sua compra: {{ $json.data.recovery_link }}"
}
```

---

### Workflow: Notificação de Pedido Pago

```
[Webhook] → [Send Email] + [HTTP Request (WhatsApp)] → [Respond]
```

Quando um pedido é pago, você pode:
1. Enviar confirmação ao cliente
2. Notificar o admin/equipe
3. Integrar com ERP
4. Atualizar planilha

---

## Variáveis Disponíveis

### Carrinho Abandonado (`cart_abandoned`)

```json
{
  "event": "cart_abandoned",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "cart_id": "uuid-do-carrinho",
    "user": {
      "name": "Nome do Cliente",
      "email": "cliente@email.com",
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
    "recovery_link": "https://loja.com/?recover=uuid"
  }
}
```

### Pedido Criado (`order_created`)

```json
{
  "event": "order_created",
  "data": {
    "order_id": "uuid",
    "order_number": "REV-111001",
    "total": 299.90,
    "status": "pending",
    "payment_method": "pix",
    "items": [...],
    "user": {
      "name": "...",
      "email": "...",
      "whatsapp": "..."
    },
    "address": {
      "street": "...",
      "number": "...",
      "city": "...",
      "state": "..."
    }
  }
}
```

### Pedido Pago (`order_paid`)

```json
{
  "event": "order_paid",
  "data": {
    "order_id": "uuid",
    "order_number": "REV-111001",
    "total": 299.90,
    "payment_method": "pix",
    "pix_transaction_id": "...",
    "user": {...},
    "items": [...],
    "address": {...}
  }
}
```

### Pedido Enviado (`order_shipped`)

```json
{
  "event": "order_shipped",
  "data": {
    "order_id": "uuid",
    "order_number": "REV-111001",
    "tracking_code": "BR123456789BR",
    "user": {...}
  }
}
```

### Usuário Cadastrado (`user_registered`)

```json
{
  "event": "user_registered",
  "data": {
    "user_id": "uuid",
    "name": "Nome",
    "email": "email@test.com",
    "whatsapp": "11999999999",
    "cpf": "123.456.789-00"
  }
}
```

---

## Dicas

### Testando Webhooks

1. Use o botão "Testar Webhook" no admin
2. No n8n, ative o workflow e clique em "Listen for test event"
3. Execute o teste e veja os dados recebidos

### Tratamento de Erros

Configure retry no admin se o webhook falhar:
- Timeout: 30000ms (30 segundos)
- Retries: 3

### Segurança

1. Use HTTPS sempre
2. Configure headers de autenticação no admin se necessário
3. No n8n, você pode validar o payload recebido

---

## Suporte

Para dúvidas sobre o n8n:
- [Documentação oficial](https://docs.n8n.io)
- [Comunidade](https://community.n8n.io)

Para dúvidas sobre a integração:
- Contate o desenvolvedor do sistema
