-- Migration: Create Admin Panel Tables
-- Created: 2026-02-03
-- Description: Cria todas as tabelas necessárias para o painel administrativo

-- 1. Recovery Templates Table
CREATE TABLE IF NOT EXISTS recovery_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('email', 'whatsapp')) NOT NULL DEFAULT 'email',
    subject TEXT,
    content TEXT NOT NULL,
    send_via TEXT DEFAULT 'both' CHECK (send_via IN ('email', 'whatsapp', 'both')),
    delay_minutes INTEGER DEFAULT 30,
    is_first_message BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    variables JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Webhook Configurations Table
CREATE TABLE IF NOT EXISTS webhook_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT UNIQUE NOT NULL,
    webhook_url TEXT,
    is_enabled BOOLEAN DEFAULT false,
    headers JSONB DEFAULT '{"Content-Type": "application/json"}',
    timeout_ms INTEGER DEFAULT 30000,
    retry_count INTEGER DEFAULT 3,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_status_code INTEGER,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Abandoned Carts Table
CREATE TABLE IF NOT EXISTS abandoned_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cart_data JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    item_count INTEGER NOT NULL,
    status TEXT CHECK (status IN ('abandoned', 'recovered', 'expired')) DEFAULT 'abandoned',
    webhook_sent BOOLEAN DEFAULT false,
    recovery_email_sent BOOLEAN DEFAULT false,
    recovery_whatsapp_sent BOOLEAN DEFAULT false,
    recovered_at TIMESTAMP WITH TIME ZONE,
    recovered_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. App Settings Table (if not exists)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. User Roles Table (if not exists)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('administrator', 'manager', 'client')) NOT NULL DEFAULT 'client',
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- 6. Checkout Events Table (for analytics)
CREATE TABLE IF NOT EXISTS checkout_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase')),
    cart_data JSONB,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recovery_templates_active ON recovery_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_recovery_templates_type ON recovery_templates(type);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_event ON webhook_configurations(event_type);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user ON abandoned_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON abandoned_carts(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_events_user ON checkout_events(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_events_session ON checkout_events(session_id);

-- Enable RLS
ALTER TABLE recovery_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recovery_templates
CREATE POLICY "Admins can manage recovery_templates" ON recovery_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'administrator'
        )
    );

-- RLS Policies for webhook_configurations
CREATE POLICY "Admins can manage webhook_configurations" ON webhook_configurations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'administrator'
        )
    );

-- RLS Policies for abandoned_carts
CREATE POLICY "Admins can view all abandoned_carts" ON abandoned_carts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('administrator', 'manager')
        )
    );

CREATE POLICY "Users can view own abandoned_carts" ON abandoned_carts
    FOR SELECT
    USING (user_id = auth.uid());

-- RLS Policies for app_settings
CREATE POLICY "Admins can manage app_settings" ON app_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'administrator'
        )
    );

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON user_roles
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON user_roles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'administrator'
        )
    );

-- RLS Policies for checkout_events
CREATE POLICY "Users can insert own checkout_events" ON checkout_events
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all checkout_events" ON checkout_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'administrator'
        )
    );

-- Insert default templates
INSERT INTO recovery_templates (name, type, subject, content, send_via, delay_minutes, is_first_message, is_active, is_default)
VALUES
    (
        'Email - Primeira Mensagem (30min)',
        'email',
        '🛒 Você esqueceu algo no carrinho!',
        'Olá {{user_name}},

Notamos que você deixou alguns itens no seu carrinho:

{{cart_items}}

Total: {{cart_total}}

Não perca essa oportunidade! Finalize sua compra agora:
{{recovery_link}}

Atenciosamente,
Equipe {{store_name}}',
        'email',
        30,
        true,
        true,
        true
    ),
    (
        'WhatsApp - Primeira Mensagem (30min)',
        'whatsapp',
        NULL,
        'Olá *{{user_name}}*! 👋

Notei que você deixou alguns produtos no carrinho:

{{cart_items}}

💰 Total: *{{cart_total}}*

Quer finalizar sua compra? É rapidinho:
{{recovery_link}}',
        'whatsapp',
        30,
        true,
        true,
        false
    ),
    (
        'Email - Segunda Mensagem (4h)',
        'email',
        '⏰ Última chance! Seu carrinho está esperando',
        'Oi {{user_name}},

Seus itens ainda estão reservados, mas não vai durar muito tempo!

{{cart_items}}

Total: {{cart_total}}

⚠️ Estoque limitado! Finalize agora:
{{recovery_link}}

{{store_name}}',
        'email',
        240,
        false,
        true,
        false
    ),
    (
        'WhatsApp - Oferta Final (24h)',
        'whatsapp',
        NULL,
        '🎁 *OFERTA ESPECIAL* para você, {{user_name}}!

Seus produtos ainda estão no carrinho:
{{cart_items}}

💥 *DESCONTO ESPECIAL* de 10% se finalizar nas próximas 2 horas!

Total: ~~{{cart_total}}~~

👉 Aproveite: {{recovery_link}}',
        'whatsapp',
        1440,
        false,
        true,
        false
    )
ON CONFLICT (id) DO NOTHING;

-- Insert default webhook configurations
INSERT INTO webhook_configurations (event_type, webhook_url, is_enabled)
VALUES
    ('cart_abandoned', '', false),
    ('order_created', '', false),
    ('order_paid', '', false),
    ('order_shipped', '', false),
    ('user_registered', '', false)
ON CONFLICT (event_type) DO NOTHING;

-- Insert default app settings
INSERT INTO app_settings (key, value, description)
VALUES
    ('cart_abandonment_timeout', '30', 'Tempo em minutos para considerar carrinho abandonado'),
    ('google_analytics_id', '""', 'ID do Google Analytics (ex: G-XXXXXXXXXX)'),
    ('google_ads_id', '""', 'ID do Google Ads (ex: AW-XXXXXXXXXX)'),
    ('facebook_pixel_id', '""', 'ID do Facebook Pixel'),
    ('store_name', '"Patricia Elias"', 'Nome da loja'),
    ('support_email', '"contato@patriciaelias.com.br"', 'Email de suporte'),
    ('support_whatsapp', '""', 'WhatsApp de suporte')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE recovery_templates IS 'Templates de recuperação de carrinho abandonado';
COMMENT ON TABLE webhook_configurations IS 'Configurações de webhooks para integração com n8n';
COMMENT ON TABLE abandoned_carts IS 'Carrinhos abandonados pelos usuários';
COMMENT ON TABLE app_settings IS 'Configurações gerais do aplicativo';
COMMENT ON TABLE user_roles IS 'Roles e permissões dos usuários';
COMMENT ON TABLE checkout_events IS 'Eventos do funil de checkout para analytics';
