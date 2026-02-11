-- Migration: Add Tracking Fields to Orders
-- Created: 2026-02-03
-- Description: Adiciona campos de rastreamento e datas de envio/entrega

-- Add tracking fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- Add index for tracking queries
CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders(tracking_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Comments
COMMENT ON COLUMN orders.tracking_url IS 'URL completa para rastreamento (ex: https://rastreamento.correios.com.br/app/index.php?objeto=ABC123)';
COMMENT ON COLUMN orders.carrier IS 'Transportadora (ex: Correios, Jadlog, Total Express)';
COMMENT ON COLUMN orders.shipped_at IS 'Data e hora de envio do pedido';
COMMENT ON COLUMN orders.delivered_at IS 'Data e hora de entrega do pedido';
