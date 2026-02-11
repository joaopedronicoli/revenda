-- Migration: Order Status Webhooks
-- Created: 2026-02-03
-- Description: Triggers webhooks automáticos para mudanças de status de pedidos

-- Add new webhook events for order recovery
INSERT INTO webhook_configurations (event_type, webhook_url, is_enabled, headers, timeout_ms, retry_count)
VALUES
    ('order_pending', '', false, '{"Content-Type": "application/json"}', 30000, 3),
    ('order_failed', '', false, '{"Content-Type": "application/json"}', 30000, 3),
    ('order_payment_error', '', false, '{"Content-Type": "application/json"}', 30000, 3),
    ('order_payment_refused', '', false, '{"Content-Type": "application/json"}', 30000, 3),
    ('order_expired', '', false, '{"Content-Type": "application/json"}', 30000, 3),
    ('order_cancelled', '', false, '{"Content-Type": "application/json"}', 30000, 3)
ON CONFLICT (event_type) DO NOTHING;

-- Create table to log webhook triggers
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    payload JSONB,
    status_code INTEGER,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    attempts INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_order ON webhook_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- Enable RLS
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook_logs" ON webhook_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'administrator'
        )
    );

-- Function to trigger webhook via Edge Function
CREATE OR REPLACE FUNCTION trigger_order_status_webhook()
RETURNS TRIGGER AS $$
DECLARE
    event_name TEXT;
    webhook_url TEXT;
BEGIN
    -- Determine event type based on status change
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            event_name := 'order_pending';
        ELSIF NEW.status = 'paid' THEN
            event_name := 'order_paid';
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        CASE NEW.status
            WHEN 'pending' THEN event_name := 'order_pending';
            WHEN 'paid' THEN event_name := 'order_paid';
            WHEN 'shipped' THEN event_name := 'order_shipped';
            WHEN 'delivered' THEN event_name := 'order_delivered';
            WHEN 'cancelled' THEN event_name := 'order_cancelled';
            WHEN 'failed' THEN event_name := 'order_failed';
            ELSE event_name := NULL;
        END CASE;

        -- Check if payment failed (iPag status)
        IF NEW.ipag_status IS NOT NULL AND OLD.ipag_status IS DISTINCT FROM NEW.ipag_status THEN
            IF NEW.ipag_status IN ('3', '7', 'refused', 'canceled', 'cancelled') THEN
                event_name := 'order_payment_refused';
            ELSIF NEW.ipag_status = 'error' THEN
                event_name := 'order_payment_error';
            END IF;
        END IF;
    END IF;

    -- Only proceed if we have a valid event
    IF event_name IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check if webhook is configured and enabled
    SELECT wc.webhook_url INTO webhook_url
    FROM webhook_configurations wc
    WHERE wc.event_type = event_name
    AND wc.is_enabled = true;

    IF webhook_url IS NULL OR webhook_url = '' THEN
        -- Webhook not configured, skip
        RETURN NEW;
    END IF;

    -- Call Edge Function asynchronously via pg_net
    -- This is a non-blocking call
    BEGIN
        PERFORM net.http_post(
            url := format('https://rrgrkbjmoezpesqnjilk.supabase.co/functions/v1/trigger-order-webhook'),
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', format('Bearer %s', current_setting('app.service_role_key', true))
            ),
            body := jsonb_build_object(
                'order_id', NEW.id,
                'event_type', event_name
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Failed to trigger webhook: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_order_status_change ON orders;
CREATE TRIGGER trigger_order_status_change
    AFTER INSERT OR UPDATE OF status, ipag_status
    ON orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_order_status_webhook();

-- Comments
COMMENT ON TABLE webhook_logs IS 'Log de webhooks disparados para pedidos';
COMMENT ON FUNCTION trigger_order_status_webhook() IS 'Dispara webhook automaticamente quando status do pedido muda';

-- Create view for webhook monitoring
CREATE OR REPLACE VIEW webhook_monitor AS
SELECT
    wc.event_type,
    wc.is_enabled,
    wc.webhook_url,
    wc.last_triggered_at,
    wc.last_status_code,
    wc.last_error,
    COUNT(wl.id) FILTER (WHERE wl.created_at > NOW() - INTERVAL '24 hours') as triggers_last_24h,
    COUNT(wl.id) FILTER (WHERE wl.created_at > NOW() - INTERVAL '24 hours' AND wl.success = true) as success_last_24h,
    COUNT(wl.id) FILTER (WHERE wl.created_at > NOW() - INTERVAL '24 hours' AND wl.success = false) as failed_last_24h
FROM webhook_configurations wc
LEFT JOIN webhook_logs wl ON wl.event_type = wc.event_type
GROUP BY wc.id, wc.event_type, wc.is_enabled, wc.webhook_url, wc.last_triggered_at, wc.last_status_code, wc.last_error
ORDER BY wc.event_type;

COMMENT ON VIEW webhook_monitor IS 'Monitoramento de webhooks com estatísticas das últimas 24h';
