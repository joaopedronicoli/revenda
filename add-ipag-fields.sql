-- ============================================
-- Adicionar campos iPag na tabela orders
-- ============================================

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS ipag_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS ipag_status TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT, -- 'credit_card' ou 'pix'
ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
ADD COLUMN IF NOT EXISTS pix_code TEXT, -- Chave PIX copiável
ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMP WITH TIME ZONE;

-- Índice para buscar por transaction_id do iPag
CREATE INDEX IF NOT EXISTS idx_orders_ipag_transaction 
ON orders(ipag_transaction_id);

-- Comentários para documentação
COMMENT ON COLUMN orders.ipag_transaction_id IS 'ID da transação no iPag';
COMMENT ON COLUMN orders.ipag_status IS 'Status do pagamento no iPag (pending, approved, canceled)';
COMMENT ON COLUMN orders.payment_method IS 'Método de pagamento usado (credit_card ou pix)';
COMMENT ON COLUMN orders.pix_qr_code IS 'QR Code Base64 para pagamento PIX';
COMMENT ON COLUMN orders.pix_code IS 'Código PIX copiável (brcode)';
COMMENT ON COLUMN orders.pix_expires_at IS 'Data/hora de expiração do PIX';
