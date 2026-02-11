-- Script para encontrar e mostrar pedidos duplicados
-- NÃO deleta nada, apenas mostra

-- 1. Encontrar pedidos duplicados por order_number
SELECT
    order_number,
    COUNT(*) as total_duplicates,
    STRING_AGG(id::text, ', ') as order_ids,
    STRING_AGG(
        CASE
            WHEN ipag_transaction_id IS NOT NULL THEN 'WITH_TXN'
            ELSE 'NO_TXN'
        END,
        ', '
    ) as has_transaction
FROM orders
WHERE order_number IS NOT NULL
GROUP BY order_number
HAVING COUNT(*) > 1;

-- 2. Mostrar detalhes dos pedidos duplicados
SELECT
    o.order_number,
    o.id,
    o.ipag_transaction_id,
    o.status,
    o.total,
    o.created_at,
    CASE
        WHEN o.ipag_transaction_id IS NOT NULL THEN 'KEEP (has transaction)'
        ELSE 'DELETE (no transaction)'
    END as action_recommendation
FROM orders o
WHERE o.order_number IN (
    SELECT order_number
    FROM orders
    WHERE order_number IS NOT NULL
    GROUP BY order_number
    HAVING COUNT(*) > 1
)
ORDER BY o.order_number, o.created_at;
