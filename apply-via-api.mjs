import { readFileSync } from 'fs'

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'

const migrations = [
    '20260203_004_create_admin_tables.sql',
    '20260203_005_add_tracking_fields.sql',
    '20260203_006_order_status_webhooks.sql'
]

console.log('\n' + '='.repeat(70))
console.log('📋 INSTRUÇÕES PARA APLICAR MIGRATIONS')
console.log('='.repeat(70))

console.log('\n1. Abra: https://supabase.com/dashboard/project/rrgrkbjmoezpesqnjilk/sql/new')
console.log('2. Para CADA migration abaixo, copie e execute:\n')

for (const migration of migrations) {
    console.log('\n' + '─'.repeat(70))
    console.log(`📄 ${migration}`)
    console.log('─'.repeat(70))

    const sql = readFileSync(`supabase/migrations/${migration}`, 'utf-8')

    console.log('\nCOPIE ESTE SQL:\n')
    console.log(sql)
    console.log('\n' + '─'.repeat(70))
    console.log('Cole no SQL Editor e clique RUN')
    console.log('─'.repeat(70) + '\n')

    // Pause for user to read
    await new Promise(resolve => setTimeout(resolve, 1000))
}

console.log('\n' + '='.repeat(70))
console.log('✅ Após executar os 3 SQLs acima, tudo estará pronto!')
console.log('='.repeat(70) + '\n')
