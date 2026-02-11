# Configurar Upload de Foto de Perfil (Avatares)

## Problema
O upload de foto de perfil está falhando porque o bucket `avatars` não existe ou não tem as permissões corretas no Supabase Storage.

## Solução

### 1. Criar o Bucket no Supabase

1. Acesse o **Supabase Dashboard**
2. Vá em **Storage** no menu lateral
3. Clique em **New bucket**
4. Configure:
   - **Name**: `avatars`
   - **Public bucket**: ✅ **Ativado** (importante!)
   - **File size limit**: `2097152` (2MB)
   - **Allowed MIME types**: `image/*`

5. Clique em **Create bucket**

### 2. Configurar Políticas de Acesso (RLS)

Após criar o bucket, configure as políticas:

```sql
-- Política para UPLOAD (INSERT)
-- Permite que usuários autenticados façam upload de suas próprias fotos
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para UPDATE
-- Permite que usuários atualizem suas próprias fotos
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para DELETE
-- Permite que usuários deletem suas próprias fotos
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para SELECT (visualização pública)
-- Permite que qualquer pessoa veja os avatares (bucket público)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

### 3. Aplicar as Políticas

1. No Supabase Dashboard, vá em **SQL Editor**
2. Cole o SQL acima
3. Clique em **Run**

### 4. Verificar Configuração

Execute este SQL para verificar se está tudo certo:

```sql
-- Ver configuração do bucket
SELECT * FROM storage.buckets WHERE name = 'avatars';

-- Ver políticas do bucket
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%avatar%';
```

## Estrutura de Pastas

Os avatares são salvos com esta estrutura:
```
avatars/
  └── {user_id}/
      └── avatar.{ext}
```

Exemplo:
```
avatars/
  └── 123e4567-e89b-12d3-a456-426614174000/
      └── avatar.jpg
```

## Testar Upload

Depois de configurar:

1. Faça logout e login novamente no app
2. Vá em **Perfil**
3. Clique no ícone de câmera
4. Selecione uma imagem (máximo 2MB)
5. A foto deve aparecer imediatamente

## Troubleshooting

### Erro: "Bucket not found"
- Verifique se o bucket `avatars` foi criado
- Confirme que o nome está correto (minúsculas)

### Erro: "Permission denied"
- Verifique se as políticas RLS foram aplicadas
- Confirme que o bucket está marcado como **público**

### Erro: "File too large"
- A imagem deve ter no máximo 2MB
- Comprima a imagem antes de fazer upload

### Imagem não aparece
- Verifique se o bucket é **público**
- Limpe o cache do navegador (Ctrl+Shift+R)
- Verifique a URL no console do navegador

## Verificar no Console do Navegador

Abra o DevTools (F12) e vá na aba **Console**. Se houver erros, eles aparecerão lá com detalhes sobre o que falhou.

Erros comuns:
- `StorageApiError: Bucket not found` → Bucket não foi criado
- `StorageApiError: new row violates row-level security policy` → Políticas RLS não configuradas
- `413 Payload Too Large` → Imagem maior que 2MB
