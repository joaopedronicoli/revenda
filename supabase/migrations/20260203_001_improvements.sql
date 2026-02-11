-- ================================================
-- PATRICIA ELIAS - MELHORIAS E CONFIGURAÇÕES
-- Data: 2026-02-03
-- ================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ADICIONAR CAMPOS DE CONFIGURAÇÃO DE TRACKING
-- Nota: Produtos não estão no banco, são carregados dinamicamente
INSERT INTO app_settings (key, value, description, updated_at) VALUES
    ('google_analytics_id', '""', 'ID do Google Analytics (ex: G-XXXXXXXXXX)', NOW()),
    ('google_ads_id', '""', 'ID do Google Ads (ex: AW-XXXXXXXXXX)', NOW()),
    ('facebook_pixel_id', '""', 'ID do Facebook Pixel', NOW()),
    ('enable_tracking', 'true', 'Habilitar rastreamento de eventos', NOW())
ON CONFLICT (key) DO NOTHING;

-- 3. MELHORAR TABELA DE RECOVERY TEMPLATES
ALTER TABLE recovery_templates ADD COLUMN IF NOT EXISTS send_via TEXT DEFAULT 'both' CHECK (send_via IN ('email', 'whatsapp', 'both'));
ALTER TABLE recovery_templates ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 30;
ALTER TABLE recovery_templates ADD COLUMN IF NOT EXISTS is_first_message BOOLEAN DEFAULT true;

-- 4. INSERIR TEMPLATES PRONTOS DE RECUPERAÇÃO

-- Template 1: Primeiro contato via Email (30 min após abandono)
INSERT INTO recovery_templates (name, type, subject, content, variables, is_active, is_default, send_via, delay_minutes, is_first_message) VALUES
(
    'Recuperação - Primeira Mensagem (Email)',
    'email',
    'Ops! Você esqueceu algo no carrinho 🛒',
    'Olá {{user_name}},

Notamos que você deixou alguns produtos incríveis no seu carrinho e não finalizou a compra! 😊

🛍️ **Seu carrinho:**
{{cart_items}}

💰 **Valor total:** {{cart_total}}

Não perca esta oportunidade! Complete sua compra agora e garanta estes produtos antes que acabem.

👉 [Finalizar minha compra]({{recovery_link}})

Se precisar de ajuda, estamos à disposição!

---
**{{store_name}}**
Enviado com 💙 para facilitar sua compra',
    '{"user_name": "Nome do cliente", "cart_items": "Lista de produtos", "cart_total": "Valor total", "recovery_link": "Link de recuperação", "store_name": "Nome da loja"}',
    true,
    true,
    'email',
    30,
    true
);

-- Template 2: Primeiro contato via WhatsApp (30 min após abandono)
INSERT INTO recovery_templates (name, type, subject, content, variables, is_active, is_default, send_via, delay_minutes, is_first_message) VALUES
(
    'Recuperação - Primeira Mensagem (WhatsApp)',
    'whatsapp',
    NULL,
    'Olá {{user_name}}! 👋

Vi que você deixou alguns produtos no carrinho e não finalizou a compra. Tudo bem? 😊

🛍️ Produtos no seu carrinho:
{{cart_items}}

💰 Total: {{cart_total}}

Finalize agora e garanta seus produtos! 🎁

👉 {{recovery_link}}

Qualquer dúvida, estou aqui para ajudar!

*{{store_name}}*',
    '{"user_name": "Nome do cliente", "cart_items": "Lista de produtos", "cart_total": "Valor total", "recovery_link": "Link de recuperação", "store_name": "Nome da loja"}',
    true,
    false,
    'whatsapp',
    30,
    true
);

-- Template 3: Segunda mensagem - Urgência (4 horas após abandono)
INSERT INTO recovery_templates (name, type, subject, content, variables, is_active, is_default, send_via, delay_minutes, is_first_message) VALUES
(
    'Recuperação - Segunda Mensagem (Urgência)',
    'email',
    '⏰ Última chance! Seu carrinho expira em breve',
    'Oi {{user_name}},

Seu carrinho ainda está esperando por você! ⏰

Mas corra, pois **os produtos podem acabar** a qualquer momento!

🛍️ **No seu carrinho:**
{{cart_items}}

💰 **Total:** {{cart_total}}

⚡ **ATENÇÃO:** Esta é sua última chance de garantir estes produtos pelo preço atual!

👉 [Comprar agora antes que acabe]({{recovery_link}})

Não deixe essa oportunidade passar!

---
**{{store_name}}**
Sua satisfação é nossa prioridade',
    '{"user_name": "Nome do cliente", "cart_items": "Lista de produtos", "cart_total": "Valor total", "recovery_link": "Link de recuperação", "store_name": "Nome da loja"}',
    true,
    false,
    'both',
    240,
    false
);

-- Template 4: Terceira mensagem - Desconto (24 horas após abandono)
INSERT INTO recovery_templates (name, type, subject, content, variables, is_active, is_default, send_via, delay_minutes, is_first_message) VALUES
(
    'Recuperação - Desconto Especial (24h)',
    'email',
    '🎁 Presente especial: Complete sua compra agora!',
    'Olá {{user_name}},

Sentimos sua falta! 💙

Como você demonstrou interesse nos produtos do seu carrinho, temos uma **oferta especial** só para você:

🎁 **CONDIÇÕES ESPECIAIS** para finalizar sua compra AGORA!

🛍️ **Seu carrinho:**
{{cart_items}}

💰 **Total:** {{cart_total}}

✨ Esta é uma oportunidade única e **válida apenas por hoje**!

👉 [Aproveitar oferta exclusiva]({{recovery_link}})

📞 Dúvidas? Entre em contato conosco!

---
**{{store_name}}**
Porque você merece o melhor',
    '{"user_name": "Nome do cliente", "cart_items": "Lista de produtos", "cart_total": "Valor total", "recovery_link": "Link de recuperação", "store_name": "Nome da loja"}',
    true,
    false,
    'both',
    1440,
    false
);

-- 5. CRIAR TABELA DE EVENTOS DE FUNIL (Checkout Analytics)
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

-- Index para queries rápidas
CREATE INDEX IF NOT EXISTS idx_checkout_events_user ON checkout_events(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_events_session ON checkout_events(session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_events_type ON checkout_events(event_type);
CREATE INDEX IF NOT EXISTS idx_checkout_events_created ON checkout_events(created_at DESC);

-- RLS Policies
ALTER TABLE checkout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own checkout events"
    ON checkout_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own checkout events"
    ON checkout_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all checkout events"
    ON checkout_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('administrator', 'manager')
        )
    );

-- 6. COMENTÁRIOS ÚTEIS
COMMENT ON TABLE checkout_events IS 'Rastreamento de eventos do funil de checkout (Google Analytics, Facebook Pixel, etc)';
COMMENT ON COLUMN recovery_templates.send_via IS 'Canal de envio: email, whatsapp ou both';
COMMENT ON COLUMN recovery_templates.delay_minutes IS 'Tempo em minutos após abandono para enviar a mensagem';
COMMENT ON COLUMN recovery_templates.is_first_message IS 'Se é a primeira mensagem da sequência de recuperação';
