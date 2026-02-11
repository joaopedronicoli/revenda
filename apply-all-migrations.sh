#!/bin/bash

echo "=================================="
echo "🚀 APLICANDO MIGRATIONS"
echo "=================================="

# Database connection
DB_URL="postgresql://postgres.rrgrkbjmoezpesqnjilk:PatriciaElias@2025@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

echo ""
echo "📄 Migration 1: Tabelas Admin + Templates"
psql "$DB_URL" -f supabase/migrations/20260203_004_create_admin_tables.sql

echo ""
echo "📄 Migration 2: Campos de Rastreamento"
psql "$DB_URL" -f supabase/migrations/20260203_005_add_tracking_fields.sql

echo ""
echo "📄 Migration 3: Webhooks Automáticos"
psql "$DB_URL" -f supabase/migrations/20260203_006_order_status_webhooks.sql

echo ""
echo "=================================="
echo "✅ CONCLUÍDO"
echo "=================================="
