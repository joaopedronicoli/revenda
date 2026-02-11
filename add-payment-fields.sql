-- ============================================
-- SQL MIGRATION: Add Payment Fields to Orders
-- Execute in Supabase SQL Editor
-- ============================================

-- Add payment-related columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
ADD COLUMN IF NOT EXISTS installments INTEGER,
ADD COLUMN IF NOT EXISTS pix_discount DECIMAL(10, 2);

-- Add comment to columns for documentation
COMMENT ON COLUMN orders.payment_method IS 'Payment method: pix or installments';
COMMENT ON COLUMN orders.installments IS 'Number of installments if payment_method is installments';
COMMENT ON COLUMN orders.pix_discount IS 'PIX discount amount if payment_method is pix';

-- ============================================
-- CONCLUÍDO!
-- ============================================
