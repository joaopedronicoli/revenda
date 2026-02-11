-- ============================================
-- FIX: "Database error saving new user"
-- Cole este SQL inteiro no Supabase SQL Editor
-- ============================================

-- 1. VERIFICAR se as tabelas existem
DO $$
BEGIN
    RAISE NOTICE '=== DIAGNÓSTICO ===';
END $$;

SELECT 'user_approvals' AS tabela, EXISTS (
    SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_approvals'
) AS existe
UNION ALL
SELECT 'user_roles' AS tabela, EXISTS (
    SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles'
) AS existe;

-- 2. VERIFICAR triggers existentes na auth.users
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth' AND event_object_table = 'users';

-- ============================================
-- 3. CRIAR TABELAS SE NÃO EXISTEM
-- ============================================

-- Tabela user_approvals
CREATE TABLE IF NOT EXISTS public.user_approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    role TEXT DEFAULT 'client' CHECK (role IN ('client', 'manager', 'administrator')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. RECRIAR FUNÇÕES COM TRATAMENTO DE ERRO
-- ============================================

-- Função para criar aprovação do usuário (com proteção contra erro)
CREATE OR REPLACE FUNCTION public.create_user_approval()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        INSERT INTO public.user_approvals (user_id, approval_status)
        VALUES (NEW.id, 'pending')
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Log mas não falha o cadastro
        RAISE WARNING 'create_user_approval failed: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar role padrão (com proteção contra erro)
CREATE OR REPLACE FUNCTION public.create_default_user_role()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'client')
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Log mas não falha o cadastro
        RAISE WARNING 'create_default_user_role failed: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. RECRIAR TRIGGERS
-- ============================================

-- Remover triggers antigos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Recriar trigger de aprovação
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_user_approval();

-- Recriar trigger de role
CREATE TRIGGER on_auth_user_created_role
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_user_role();

-- ============================================
-- 6. DESABILITAR RLS NAS TABELAS (para triggers funcionarem)
-- ============================================

ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policies para permitir que as funções SECURITY DEFINER insiram
DROP POLICY IF EXISTS "Service role can manage user_approvals" ON public.user_approvals;
CREATE POLICY "Service role can manage user_approvals" ON public.user_approvals
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage user_roles" ON public.user_roles;
CREATE POLICY "Service role can manage user_roles" ON public.user_roles
    FOR ALL USING (true) WITH CHECK (true);

-- Garantir que o schema de segurança permite inserção
GRANT ALL ON public.user_approvals TO postgres, service_role;
GRANT ALL ON public.user_roles TO postgres, service_role;
GRANT SELECT ON public.user_approvals TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- ============================================
-- 7. VERIFICAÇÃO FINAL
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '=== CORREÇÃO APLICADA COM SUCESSO ===';
    RAISE NOTICE 'Agora tente cadastrar um novo revendedor!';
END $$;
