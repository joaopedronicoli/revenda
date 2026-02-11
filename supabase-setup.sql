-- ============================================
-- SCRIPT DE CRIAÇÃO DAS TABELAS DO SUPABASE
-- Painel do Revendedor - Patricia Elias
-- ============================================

-- 1. TABELA DE ENDEREÇOS
-- Permite que cada usuário tenha múltiplos endereços salvos
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname VARCHAR(100) NOT NULL,
  cep VARCHAR(9) NOT NULL,
  street VARCHAR(255) NOT NULL,
  number VARCHAR(20) NOT NULL,
  complement VARCHAR(100),
  neighborhood VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para buscar endereços por usuário
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- Política RLS para addresses (Row Level Security)
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas seus próprios endereços
CREATE POLICY "Users can view own addresses" ON addresses
  FOR SELECT USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios endereços
CREATE POLICY "Users can insert own addresses" ON addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios endereços
CREATE POLICY "Users can update own addresses" ON addresses
  FOR UPDATE USING (auth.uid() = user_id);

-- Usuários podem deletar seus próprios endereços
CREATE POLICY "Users can delete own addresses" ON addresses
  FOR DELETE USING (auth.uid() = user_id);


-- 2. TABELA DE CÓDIGOS DE VERIFICAÇÃO
-- Para validação de alteração de email/whatsapp
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'email' ou 'whatsapp'
  new_value TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para buscar códigos por usuário
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id);

-- Política RLS para verification_codes
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas seus próprios códigos
CREATE POLICY "Users can view own verification codes" ON verification_codes
  FOR SELECT USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios códigos
CREATE POLICY "Users can insert own verification codes" ON verification_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios códigos
CREATE POLICY "Users can update own verification codes" ON verification_codes
  FOR UPDATE USING (auth.uid() = user_id);


-- 3. TABELA DE PEDIDOS (ORDERS)
-- Criar se não existir, ou adicionar colunas se já existir
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  details JSONB NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  address_id UUID REFERENCES addresses(id),
  tracking_code VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Se a tabela já existe, adicionar as colunas que faltam
DO $$ 
BEGIN
  -- Adicionar coluna status se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='orders' AND column_name='status') THEN
    ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
  END IF;
  
  -- Adicionar coluna address_id se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='orders' AND column_name='address_id') THEN
    ALTER TABLE orders ADD COLUMN address_id UUID REFERENCES addresses(id);
  END IF;
  
  -- Adicionar coluna tracking_code se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='orders' AND column_name='tracking_code') THEN
    ALTER TABLE orders ADD COLUMN tracking_code VARCHAR(100);
  END IF;
  
  -- Adicionar coluna updated_at se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='orders' AND column_name='updated_at') THEN
    ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Índice para buscar pedidos por usuário
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Índice para buscar pedidos por status
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Política RLS para orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas seus próprios pedidos
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Usuários podem inserir seus próprios pedidos
CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 4. STORAGE BUCKET PARA AVATARS
-- Criar bucket para armazenar fotos de perfil
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: usuários podem fazer upload de seus próprios avatars
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política de storage: usuários podem atualizar seus próprios avatars
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política de storage: usuários podem deletar seus próprios avatars
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política de storage: todos podem ver avatars (público)
CREATE POLICY "Avatars are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');


-- 5. FUNÇÃO PARA ATUALIZAR updated_at AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at em addresses
DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses;
CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar updated_at em orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- SCRIPT CONCLUÍDO
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- Dashboard > SQL Editor > New Query > Cole e Execute
-- ============================================
