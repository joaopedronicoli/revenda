-- FIX: "Database error saving new user"
-- Recria tabelas e triggers com tratamento de erro

-- Criar tabelas se não existem
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

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    role TEXT DEFAULT 'client' CHECK (role IN ('client', 'manager', 'administrator')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recriar funções com EXCEPTION handler para nunca bloquear o signup
CREATE OR REPLACE FUNCTION public.create_user_approval()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        INSERT INTO public.user_approvals (user_id, approval_status)
        VALUES (NEW.id, 'pending')
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'create_user_approval failed: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_default_user_role()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'client')
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'create_default_user_role failed: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_user_approval();

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_user_role();

-- RLS e permissões
ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for user_approvals" ON public.user_approvals;
CREATE POLICY "Allow all for user_approvals" ON public.user_approvals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for user_roles" ON public.user_roles;
CREATE POLICY "Allow all for user_roles" ON public.user_roles FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.user_approvals TO postgres, service_role;
GRANT ALL ON public.user_roles TO postgres, service_role;
GRANT SELECT ON public.user_approvals TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
