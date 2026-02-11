-- Produto de teste para validar integração iPag
INSERT INTO products (name, description, table_price, reference_url, is_high_ticket, created_at)
VALUES (
  '🧪 PRODUTO TESTE - iPag',
  'Produto de teste para validar integração de pagamento iPag. Valor: R$ 1,00',
  1.00,
  'https://teste-ipag.com',
  false,
  NOW()
);
