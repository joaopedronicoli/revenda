-- ============================================
-- CONFIGURAÇÃO DE CRON JOB PARA SYNC DE PEDIDOS
-- ============================================

-- Habilitar extensão pg_cron (se ainda não estiver habilitada)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Criar função que chama a Edge Function de sync
CREATE OR REPLACE FUNCTION trigger_sync_pending_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_role_key text;
BEGIN
  -- URL da Edge Function
  function_url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-pending-orders';
  service_role_key := current_setting('app.settings.service_role_key');
  
  -- Fazer requisição HTTP para a Edge Function
  PERFORM
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );
    
  RAISE NOTICE 'Sync pending orders triggered at %', now();
END;
$$;

-- Agendar execução a cada 12 horas
-- Executa às 00:00 e 12:00 todos os dias
SELECT cron.schedule(
  'sync-pending-orders-job',  -- Nome do job
  '0 0,12 * * *',             -- Cron expression: às 00:00 e 12:00
  $$SELECT trigger_sync_pending_orders()$$
);

-- Verificar jobs agendados
SELECT * FROM cron.job;

-- ============================================
-- COMANDOS ÚTEIS
-- ============================================

-- Ver histórico de execuções
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Desabilitar o job (se necessário)
-- SELECT cron.unschedule('sync-pending-orders-job');

-- Executar manualmente (para teste)
-- SELECT trigger_sync_pending_orders();

-- ============================================
