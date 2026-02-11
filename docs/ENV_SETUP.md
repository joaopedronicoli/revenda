# Como Configurar o .env.production no Servidor

## 1. Criar o arquivo no servidor

No servidor, execute:

```bash
cd /opt/apps/revenda-patriciaelias
nano .env.production
```

## 2. Cole este conteúdo:

```bash
# Supabase Configuration (Production)
VITE_SUPABASE_URL=https://bpbklahbndoycbxehqwi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYmtsYWhibmRveWNieGVocXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc5NDUwNTcsImV4cCI6MjA1MzUyMTA1N30.hxSr_JUi9QOoBpzr7B_6OjOlUkbhRpjdYohKQNWpsjk

# Webhook Configuration (Production)
VITE_N8N_WEBHOOK_URL=https://webhook.pelg.com.br/webhook/ped/revenda/pedido-novo
VITE_N8N_REGISTRATION_WEBHOOK_URL=https://webhook.pelg.com.br/webhook/ped/revenda/cadastro/revendedor

# iPag Credentials
VITE_IPAG_API_ID=contato@patriciaelias.com.br
VITE_IPAG_API_KEY=266C-AFC941C4-A7FC6FA1-2A1C78A7-0D35
```

## 3. Salvar e sair

- `Ctrl + O` para salvar
- `Enter` para confirmar
- `Ctrl + X` para sair

## 4. Rebuildar a imagem

Depois de criar o arquivo, rebuild a imagem:

```bash
docker build --no-cache -t patricia-elias-reseller-app:latest .
docker service update --force patricia-elias_frontend
```

## ⚠️ Importante

O `.env.production` **não está no Git** por segurança (está no `.gitignore`). Você precisa criá-lo manualmente no servidor sempre que fizer deploy em um novo ambiente.
