-- =====================================================
-- ADMIN PANEL - Database Migration
-- Patricia Elias Reseller App
-- =====================================================

-- =====================================================
-- 1. USER ROLES - Controle de Acesso (RBAC)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'client', -- 'administrator', 'manager', 'client'
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- RLS para user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver seu próprio role
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_user_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_roles_timestamp ON user_roles;
CREATE TRIGGER update_user_roles_timestamp
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_roles_updated_at();

-- =====================================================
-- 2. ABANDONED CARTS - Carrinhos Abandonados
-- =====================================================
CREATE TABLE IF NOT EXISTS abandoned_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cart_data JSONB NOT NULL, -- Estado completo do carrinho
    total DECIMAL(10, 2) NOT NULL,
    item_count INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'abandoned', 'recovered', 'expired'

    -- Tracking de webhooks e recuperação
    webhook_sent BOOLEAN DEFAULT false,
    webhook_sent_at TIMESTAMP WITH TIME ZONE,
    recovery_email_sent BOOLEAN DEFAULT false,
    recovery_email_sent_at TIMESTAMP WITH TIME ZONE,
    recovery_whatsapp_sent BOOLEAN DEFAULT false,
    recovery_whatsapp_sent_at TIMESTAMP WITH TIME ZONE,

    -- Recuperação
    recovered_at TIMESTAMP WITH TIME ZONE,
    recovered_order_id UUID REFERENCES orders(id),

    -- Timestamps
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user_id ON abandoned_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON abandoned_carts(status);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_last_activity ON abandoned_carts(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_created_at ON abandoned_carts(created_at);

-- RLS para abandoned_carts
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver seus próprios carrinhos abandonados
CREATE POLICY "Users can view own abandoned carts" ON abandoned_carts
    FOR SELECT USING (auth.uid() = user_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_abandoned_carts_timestamp ON abandoned_carts;
CREATE TRIGGER update_abandoned_carts_timestamp
    BEFORE UPDATE ON abandoned_carts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. RECOVERY TEMPLATES - Templates de Recuperação
-- =====================================================
CREATE TABLE IF NOT EXISTS recovery_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'email', 'whatsapp'
    subject VARCHAR(200), -- Apenas para email
    content TEXT NOT NULL,
    variables JSONB DEFAULT '["user_name", "user_email", "user_whatsapp", "cart_items", "cart_total", "item_count", "recovery_link", "store_name"]',
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_templates_type ON recovery_templates(type);
CREATE INDEX IF NOT EXISTS idx_recovery_templates_is_active ON recovery_templates(is_active);

-- RLS para recovery_templates
ALTER TABLE recovery_templates ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_recovery_templates_timestamp ON recovery_templates;
CREATE TRIGGER update_recovery_templates_timestamp
    BEFORE UPDATE ON recovery_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Templates padrão
INSERT INTO recovery_templates (name, type, subject, content, is_default) VALUES
(
    'Email de Recuperação Padrão',
    'email',
    'Você esqueceu algo no carrinho! 🛒',
    'Olá {{user_name}},

Notamos que você deixou alguns itens no seu carrinho:

{{cart_items}}

Total: {{cart_total}}

Não perca essa oportunidade! Clique no link abaixo para finalizar sua compra:

{{recovery_link}}

Qualquer dúvida, estamos à disposição!

Equipe {{store_name}}',
    true
),
(
    'WhatsApp de Recuperação Padrão',
    'whatsapp',
    NULL,
    'Olá {{user_name}}! 👋

Vi que você deixou alguns produtos no carrinho:

{{cart_items}}

*Total: {{cart_total}}*

Posso te ajudar a finalizar? 😊

Acesse aqui: {{recovery_link}}',
    true
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. WEBHOOK CONFIGURATIONS - Configurações de Webhook
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    webhook_url TEXT,
    is_enabled BOOLEAN DEFAULT false,
    headers JSONB DEFAULT '{}',
    timeout_ms INTEGER DEFAULT 30000,
    retry_count INTEGER DEFAULT 3,

    -- Status da última execução
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_status_code INTEGER,
    last_response TEXT,
    last_error TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_configurations_event_type ON webhook_configurations(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_is_enabled ON webhook_configurations(is_enabled);

-- RLS para webhook_configurations
ALTER TABLE webhook_configurations ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_webhook_configurations_timestamp ON webhook_configurations;
CREATE TRIGGER update_webhook_configurations_timestamp
    BEFORE UPDATE ON webhook_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Eventos de webhook padrão
INSERT INTO webhook_configurations (event_type, name, description) VALUES
    ('cart_abandoned', 'Carrinho Abandonado', 'Disparado quando um carrinho é considerado abandonado (30 min sem atividade)'),
    ('cart_recovered', 'Carrinho Recuperado', 'Disparado quando um carrinho abandonado resulta em compra'),
    ('order_created', 'Pedido Criado', 'Disparado quando um novo pedido é criado'),
    ('order_paid', 'Pedido Pago', 'Disparado quando um pedido é marcado como pago'),
    ('order_shipped', 'Pedido Enviado', 'Disparado quando um pedido é marcado como enviado'),
    ('user_registered', 'Usuário Cadastrado', 'Disparado quando um novo usuário se cadastra'),
    ('user_approved', 'Usuário Aprovado', 'Disparado quando um usuário é aprovado')
ON CONFLICT (event_type) DO NOTHING;

-- =====================================================
-- 5. APP SETTINGS - Configurações do App
-- =====================================================
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
CREATE INDEX IF NOT EXISTS idx_app_settings_category ON app_settings(category);

-- RLS para app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Configurações padrão
INSERT INTO app_settings (key, value, description, category) VALUES
    ('cart_abandonment_timeout_minutes', '30', 'Minutos de inatividade para considerar carrinho abandonado', 'cart'),
    ('cart_abandonment_enabled', 'true', 'Habilitar/desabilitar tracking de carrinho abandonado', 'cart'),
    ('recovery_email_delay_minutes', '60', 'Delay em minutos antes de enviar email de recuperação', 'recovery'),
    ('recovery_whatsapp_delay_minutes', '120', 'Delay em minutos antes de enviar WhatsApp de recuperação', 'recovery'),
    ('store_name', '"Patricia Elias"', 'Nome da loja para uso em templates', 'general'),
    ('support_whatsapp', '"+5511999999999"', 'WhatsApp de suporte', 'general')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 6. MODIFICAÇÕES EM TABELAS EXISTENTES
-- =====================================================

-- Adicionar coluna para rastrear se pedido veio de carrinho recuperado
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS recovered_from_cart_id UUID REFERENCES abandoned_carts(id);

-- =====================================================
-- 7. FUNÇÕES AUXILIARES
-- =====================================================

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
    role_value VARCHAR;
BEGIN
    SELECT role INTO role_value FROM user_roles WHERE user_id = user_uuid;
    RETURN COALESCE(role_value, 'client');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é admin ou manager
CREATE OR REPLACE FUNCTION is_admin_or_manager(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role FROM user_roles WHERE user_id = user_uuid;
    RETURN user_role IN ('administrator', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_administrator(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role FROM user_roles WHERE user_id = user_uuid;
    RETURN user_role = 'administrator';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. CONFIGURAR ADMINS INICIAIS
-- =====================================================

-- Inserir roles para admins (será executado se os usuários existirem)
DO $$
DECLARE
    luis_id UUID;
    joao_id UUID;
BEGIN
    -- Buscar ID do luis@patriciaelias.com
    SELECT id INTO luis_id FROM auth.users WHERE email = 'luis@patriciaelias.com';
    IF luis_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role)
        VALUES (luis_id, 'administrator')
        ON CONFLICT (user_id) DO UPDATE SET role = 'administrator';
        RAISE NOTICE 'Admin configurado: luis@patriciaelias.com';
    ELSE
        RAISE NOTICE 'Usuário luis@patriciaelias.com não encontrado';
    END IF;

    -- Buscar ID do joao@patriciaelias.com.br
    SELECT id INTO joao_id FROM auth.users WHERE email = 'joao@patriciaelias.com.br';
    IF joao_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role)
        VALUES (joao_id, 'administrator')
        ON CONFLICT (user_id) DO UPDATE SET role = 'administrator';
        RAISE NOTICE 'Admin configurado: joao@patriciaelias.com.br';
    ELSE
        RAISE NOTICE 'Usuário joao@patriciaelias.com.br não encontrado';
    END IF;
END $$;

-- =====================================================
-- 9. TRIGGER PARA CRIAR ROLE DEFAULT EM NOVOS USUÁRIOS
-- =====================================================

CREATE OR REPLACE FUNCTION create_default_user_role()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.id, 'client')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_user_role();
