# Corrigir RLS para Administradores Verem Todos os Pedidos

## Problema
Os administradores (`luis@patriciaelias.com.br` e `joao@patriciaelias.com.br`) estão vendo apenas seus próprios pedidos no painel admin, não todos os pedidos.

## Causa
As políticas RLS (Row Level Security) da tabela `orders` estão filtrando por `user_id`, mesmo para administradores.

## Solução

Execute este SQL no Supabase (SQL Editor):

```sql
-- 1. Remover políticas antigas da tabela orders (se existirem)
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert their own orders" ON orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON orders;

-- 2. Criar nova política de SELECT que permite:
--    - Usuários verem seus próprios pedidos
--    - Administradores verem TODOS os pedidos
CREATE POLICY "Users can view own orders, admins can view all"
ON orders
FOR SELECT
USING (
  auth.uid() = user_id  -- Usuário vê seus próprios pedidos
  OR
  EXISTS (  -- OU é administrador
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'administrator'
  )
);

-- 3. Política de INSERT (usuários podem criar seus próprios pedidos)
CREATE POLICY "Users can insert their own orders"
ON orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Política de UPDATE que permite:
--    - Usuários atualizarem seus próprios pedidos
--    - Administradores atualizarem QUALQUER pedido
CREATE POLICY "Users can update own orders, admins can update all"
ON orders
FOR UPDATE
USING (
  auth.uid() = user_id  -- Usuário atualiza seus próprios pedidos
  OR
  EXISTS (  -- OU é administrador
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'administrator'
  )
);

-- 5. Verificar se os usuários têm role de administrator
SELECT u.email, ur.role
FROM auth.users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
WHERE u.email IN ('luis@patriciaelias.com.br', 'joao@patriciaelias.com.br');

-- Se não aparecerem como 'administrator', execute:
-- INSERT INTO user_roles (user_id, role)
-- SELECT id, 'administrator'
-- FROM auth.users
-- WHERE email IN ('luis@patriciaelias.com.br', 'joao@patriciaelias.com.br')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'administrator';
```

## Como Aplicar

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole o script acima
4. Clique em **Run**
5. Faça logout e login novamente no app
6. Verifique se agora vê todos os pedidos

## Verificar se Funcionou

Depois de aplicar, execute no SQL Editor:

```sql
-- Ver quantos pedidos existem no total
SELECT COUNT(*) as total_orders FROM orders;

-- Ver pedidos por usuário
SELECT 
  u.email,
  COUNT(o.id) as order_count
FROM orders o
JOIN auth.users u ON u.id = o.user_id
GROUP BY u.email
ORDER BY order_count DESC;
```

Se o total de pedidos for maior que os pedidos do admin, significa que há pedidos de outros usuários que devem aparecer.
