-- Migration: Customer Data Sync Webhooks for Chatwoot Integration
-- Created: 2026-02-03
-- Description: Adiciona eventos de webhook para sincronizar dados de clientes com n8n/Chatwoot

-- 1. Add new webhook events for customer sync
INSERT INTO webhook_configurations (event_type, webhook_url, is_enabled, headers, timeout_ms, retry_count, created_at, updated_at)
VALUES
    ('customer_created', '', false, '{"Content-Type": "application/json"}', 30000, 3, NOW(), NOW()),
    ('customer_updated', '', false, '{"Content-Type": "application/json"}', 30000, 3, NOW(), NOW()),
    ('customer_order_completed', '', false, '{"Content-Type": "application/json"}', 30000, 3, NOW(), NOW())
ON CONFLICT (event_type) DO NOTHING;

-- 2. Create customer_sync_log table to track synchronizations
CREATE TABLE IF NOT EXISTS customer_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    sync_status TEXT CHECK (sync_status IN ('pending', 'success', 'failed')) DEFAULT 'pending',
    payload JSONB,
    response JSONB,
    error_message TEXT,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying sync logs
CREATE INDEX IF NOT EXISTS idx_customer_sync_user ON customer_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_sync_status ON customer_sync_log(sync_status);
CREATE INDEX IF NOT EXISTS idx_customer_sync_created ON customer_sync_log(created_at DESC);

-- 3. Add RLS policies
ALTER TABLE customer_sync_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all sync logs
CREATE POLICY "Admins can view all customer_sync_log" ON customer_sync_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'administrator'
        )
    );

-- 4. Add app settings for Chatwoot integration
INSERT INTO app_settings (key, value, description, updated_at)
VALUES
    ('chatwoot_api_url', '""', 'URL da API do Chatwoot (ex: https://app.chatwoot.com/api/v1)', NOW()),
    ('chatwoot_api_key', '""', 'API Key do Chatwoot', NOW()),
    ('chatwoot_account_id', '""', 'ID da conta no Chatwoot', NOW()),
    ('chatwoot_inbox_id', '""', 'ID da inbox no Chatwoot para criar contatos', NOW()),
    ('n8n_customer_sync_webhook', '""', 'URL do webhook n8n para sincronização de clientes', NOW())
ON CONFLICT (key) DO NOTHING;

-- 5. Create function to trigger customer sync webhook
CREATE OR REPLACE FUNCTION trigger_customer_sync_webhook()
RETURNS TRIGGER AS $$
DECLARE
    webhook_url TEXT;
    event_name TEXT;
    customer_data JSONB;
    user_approval RECORD;
BEGIN
    -- Get webhook URL from settings
    SELECT value::text INTO webhook_url
    FROM app_settings
    WHERE key = 'n8n_customer_sync_webhook';

    -- Only proceed if webhook is configured
    IF webhook_url IS NULL OR webhook_url = '""' OR webhook_url = '' THEN
        RETURN NEW;
    END IF;

    -- Determine event type
    IF TG_OP = 'INSERT' THEN
        event_name := 'customer_created';
    ELSIF TG_OP = 'UPDATE' THEN
        event_name := 'customer_updated';
    ELSE
        RETURN NEW;
    END IF;

    -- Get user approval data
    SELECT * INTO user_approval
    FROM user_approvals
    WHERE user_id = NEW.user_id
    LIMIT 1;

    -- Build customer data payload
    customer_data := jsonb_build_object(
        'event', event_name,
        'timestamp', NOW(),
        'data', jsonb_build_object(
            'user_id', NEW.user_id,
            'email', user_approval.email,
            'full_name', user_approval.full_name,
            'whatsapp', user_approval.whatsapp,
            'cpf', user_approval.cpf,
            'approval_status', NEW.approval_status,
            'created_at', NEW.created_at,
            'updated_at', NEW.updated_at,
            'metadata', jsonb_build_object(
                'company_name', user_approval.company_name,
                'ie', user_approval.ie,
                'addresses', user_approval.addresses
            )
        )
    );

    -- Log sync attempt
    INSERT INTO customer_sync_log (user_id, event_type, sync_status, payload)
    VALUES (NEW.user_id, event_name, 'pending', customer_data);

    -- Trigger webhook via pg_net (requires supabase pg_net extension)
    -- Note: This is asynchronous and will be handled by the backend
    PERFORM net.http_post(
        url := webhook_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := customer_data::jsonb
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        INSERT INTO customer_sync_log (user_id, event_type, sync_status, error_message)
        VALUES (NEW.user_id, event_name, 'failed', SQLERRM);
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger on user_approvals for customer sync
DROP TRIGGER IF EXISTS trigger_user_approval_sync ON user_approvals;
CREATE TRIGGER trigger_user_approval_sync
    AFTER INSERT OR UPDATE ON user_approvals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_customer_sync_webhook();

-- 7. Comments
COMMENT ON TABLE customer_sync_log IS 'Log de sincronizações de dados de clientes com sistemas externos (n8n/Chatwoot)';
COMMENT ON FUNCTION trigger_customer_sync_webhook() IS 'Dispara webhook para sincronizar dados de clientes com n8n/Chatwoot';
