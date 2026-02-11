# 🚀 Como Fazer Deploy das Edge Functions no Supabase

## Passo 1: Instalar Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Ou via NPM (qualquer sistema)
npm install -g supabase
```

---

## Passo 2: Login no Supabase

```bash
supabase login
```

Isso vai abrir o navegador para você autenticar.

---

## Passo 3: Link do Projeto Local ao Supabase Cloud

```bash
cd /Users/luisguimaraes/.gemini/antigravity/scratch/patricia-elias-reseller-app
supabase link --project-ref SEU_PROJECT_REF
```

**Como descobrir o Project Ref:**
1. Vá no Supabase Dashboard
2. Settings > General
3. Copie o **Reference ID** (ex: `rrgrkbjmoezpesqnjilk`)

---

## Passo 4: Deploy das Funções

```bash
# Deploy da função de aprovação
supabase functions deploy approve-user

# Deploy da função de status do pedido
supabase functions deploy update-order-status
```

---

## Passo 5: Testar as Funções

### Teste: Aprovar Usuário

```bash
curl -X POST \
  'https://bpbklahbndoycbxehqwi.supabase.co/functions/v1/approve-user' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"userId": "user-uuid", "status": "approved"}'
```

### Teste: Atualizar Status do Pedido

```bash
curl -X POST \
  'https://bpbklahbndoycbxehqwi.supabase.co/functions/v1/update-order-status' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"orderId": "order-uuid", "status": "shipped", "trackingCode": "BR123456789"}'
```

---

## 🔑 Onde Pegar a Service Role Key?

1. Vá no Supabase Dashboard
2. Settings > API
3. Na seção **Project API keys**, copie a **`service_role`** (secret key)
4. ⚠️ **NUNCA** compartilhe essa chave! Use apenas no n8n (servidor seguro)

---

## 📋 URLs Finais para o n8n

Depois do deploy, use essas URLs no n8n:

**### Approve User
```
POST https://bpbklahbndoycbxehqwi.supabase.co/functions/v1/approve-user
```

**### Update Order Status
```
POST https://bpbklahbndoycbxehqwi.supabase.co/functions/v1/update-order-status
```

---

## ✅ Pronto!

As funções estão deployadas e prontas para o n8n chamar!
