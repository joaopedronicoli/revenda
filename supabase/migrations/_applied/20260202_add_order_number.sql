-- Migration: Add sequential order numbers (REV-111000, REV-111001, etc.)

-- 1. Adicionar coluna order_number
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;

-- 2. Criar sequência começando em 111000
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 111000;

-- 3. Criar função para gerar o número do pedido
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'REV-' || nextval('order_number_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para auto-gerar número em novos pedidos
DROP TRIGGER IF EXISTS set_order_number ON orders;
CREATE TRIGGER set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();

-- 5. Preencher pedidos existentes que não têm número (em ordem de criação)
WITH numbered_orders AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM orders
    WHERE order_number IS NULL
)
UPDATE orders o
SET order_number = 'REV-' || (110999 + no.rn)
FROM numbered_orders no
WHERE o.id = no.id;

-- 6. Ajustar a sequência para continuar após os pedidos existentes
SELECT setval('order_number_seq', COALESCE(
    (SELECT MAX(CAST(REPLACE(order_number, 'REV-', '') AS INTEGER)) FROM orders WHERE order_number LIKE 'REV-%'),
    110999
) + 1);
