-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Desagendar se já existir para evitar duplicar
SELECT cron.unschedule('sync-orders-every-12h');

-- Agendar job
SELECT cron.schedule(
    'sync-orders-every-12h',
    '0 */12 * * *', -- A cada 12 horas
    $$
    SELECT
      net.http_post(
          url:='https://rrgrkbjmoezpesqnjilk.supabase.co/functions/v1/sync-orders',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjU2OTMsImV4cCI6MjA4NTE0MTY5M30.C9TEOaHumFN3lob33wUYEB_68SNmRplQlIyjmAir_ns"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);
