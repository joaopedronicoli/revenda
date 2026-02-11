-- ============================================
-- SCRIPT DE CONFIGURAÇÃO DO BUCKET DE AVATARES
-- ============================================
-- Execute este script no Supabase SQL Editor para configurar
-- automaticamente o upload de fotos de perfil
--
-- IMPORTANTE: Execute TODO o script de uma vez só
-- ============================================

-- 1. CRIAR BUCKET (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Bucket público para que as fotos sejam visíveis
  2097152,  -- 2MB em bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[];

-- 2. REMOVER POLÍTICAS ANTIGAS (se existirem)
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- 3. CRIAR POLÍTICA DE UPLOAD (INSERT)
-- Permite que usuários autenticados façam upload de suas próprias fotos
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. CRIAR POLÍTICA DE ATUALIZAÇÃO (UPDATE)
-- Permite que usuários atualizem suas próprias fotos
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. CRIAR POLÍTICA DE EXCLUSÃO (DELETE)
-- Permite que usuários deletem suas próprias fotos
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. CRIAR POLÍTICA DE VISUALIZAÇÃO (SELECT)
-- Permite que qualquer pessoa veja os avatares (bucket público)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================
-- VERIFICAÇÃO DA CONFIGURAÇÃO
-- ============================================

-- Ver configuração do bucket
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE name = 'avatars';

-- Ver políticas criadas
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%avatar%'
ORDER BY policyname;

-- ============================================
-- RESULTADO ESPERADO
-- ============================================
-- Você deve ver:
-- 1. Um bucket chamado 'avatars' com public=true e file_size_limit=2097152
-- 2. Quatro políticas:
--    - Users can upload their own avatar (INSERT)
--    - Users can update their own avatar (UPDATE)
--    - Users can delete their own avatar (DELETE)
--    - Anyone can view avatars (SELECT)
-- ============================================
