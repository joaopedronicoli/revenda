-- ============================================
-- Sistema de Aprovação de Usuários
-- ============================================

-- Criar tabela para tracking de aprovação
CREATE TABLE IF NOT EXISTS user_approvals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    approval_status TEXT DEFAULT 'pending', -- pending, approved, rejected
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own approval status"
ON user_approvals FOR SELECT
USING (auth.uid() = user_id);

-- Trigger para criar aprovação automática ao cadastrar novo usuário
CREATE OR REPLACE FUNCTION create_user_approval()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_approvals (user_id, approval_status)
    VALUES (NEW.id, 'pending')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_user_approval();

-- Índice para consultas rápidas
CREATE INDEX idx_user_approvals_status ON user_approvals(approval_status);
CREATE INDEX idx_user_approvals_user_id ON user_approvals(user_id);
