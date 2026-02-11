# 🗄️ Configuração do Supabase

## Como Executar o Script SQL

### Passo 1: Acessar o Supabase
1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login na sua conta
3. Selecione seu projeto

### Passo 2: Abrir o SQL Editor
1. No menu lateral, clique em **SQL Editor**
2. Clique em **New Query**

### Passo 3: Executar o Script
1. Abra o arquivo `supabase-setup.sql` no seu editor
2. **Copie TODO o conteúdo** do arquivo
3. **Cole** no SQL Editor do Supabase
4. Clique em **Run** (ou pressione Ctrl/Cmd + Enter)

### Passo 4: Verificar
Após executar, verifique se as tabelas foram criadas:
1. Vá em **Table Editor** no menu lateral
2. Você deve ver as seguintes tabelas:
   - ✅ `addresses`
   - ✅ `verification_codes`
   - ✅ `orders`

---

## 📋 O Que o Script Cria

### Tabelas

#### 1. **addresses**
Armazena múltiplos endereços por usuário
- `id` - UUID único
- `user_id` - Referência ao usuário
- `nickname` - Apelido do endereço (ex: "Casa", "Trabalho")
- `cep`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`
- `is_default` - Marca o endereço padrão
- `created_at`, `updated_at`

#### 2. **verification_codes**
Códigos de verificação para alteração de email/whatsapp
- `id` - UUID único
- `user_id` - Referência ao usuário
- `code` - Código de 6 dígitos
- `type` - Tipo ('email' ou 'whatsapp')
- `new_value` - Novo valor a ser salvo
- `expires_at` - Data de expiração
- `used` - Se já foi usado
- `created_at`

#### 3. **orders** (atualizada)
Adiciona campos para rastreamento de pedidos
- Campos existentes mantidos
- **Novos campos**:
  - `status` - Status do pedido (pending, paid, shipped, delivered)
  - `address_id` - Endereço de entrega
  - `tracking_code` - Código de rastreamento
  - `updated_at` - Data da última atualização

### Storage Bucket

#### **avatars**
Bucket público para armazenar fotos de perfil
- Organizado por `user_id`
- Tamanho máximo: 2MB (configurar no dashboard)
- Formatos aceitos: JPG, PNG, WebP

### Segurança (RLS)

Todas as tabelas têm **Row Level Security (RLS)** ativado:
- Usuários só podem ver/editar seus próprios dados
- Políticas automáticas de INSERT, SELECT, UPDATE, DELETE

---

## 🔍 Verificação de Erros

Se houver algum erro ao executar:

1. **Erro: "relation already exists"**
   - Algumas tabelas já existem
   - O script é seguro e não vai sobrescrever dados

2. **Erro: "permission denied"**
   - Você precisa de permissões de admin
   - Verifique se está usando o projeto correto

3. **Erro: "syntax error"**
   - Certifique-se de copiar TODO o script
   - Não copie apenas partes

---

## 📞 Próximos Passos

Após executar o script com sucesso:
1. ✅ Verificar tabelas criadas no Table Editor
2. ✅ Verificar bucket 'avatars' em Storage
3. ✅ Prosseguir com a implementação dos componentes React

---

## 🆘 Precisa de Ajuda?

Se encontrar algum problema:
1. Tire um print do erro
2. Me envie para eu ajudar a resolver
3. Não se preocupe - seus dados existentes estão seguros!
