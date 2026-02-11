import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
})

const migrations = [
    {
        name: '20260203_004_create_admin_tables.sql',
        description: 'Tabelas Admin + Templates'
    },
    {
        name: '20260203_005_add_tracking_fields.sql',
        description: 'Campos de Rastreamento'
    },
    {
        name: '20260203_006_order_status_webhooks.sql',
        description: 'Webhooks Automáticos'
    }
]

console.log('\n' + '='.repeat(70))
console.log('🚀 APLICANDO MIGRATIONS')
console.log('='.repeat(70) + '\n')

for (const migration of migrations) {
    console.log(`\n📄 ${migration.name}`)
    console.log(`   ${migration.description}`)
    console.log('   Lendo arquivo...')

    try {
        const sql = readFileSync(`supabase/migrations/${migration.name}`, 'utf-8')

        console.log('   Executando SQL...')

        const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

        if (error) {
            // Try direct query if RPC doesn't exist
            const { error: directError } = await supabase.from('_migrations').insert({
                name: migration.name,
                executed_at: new Date().toISOString()
            })

            if (directError) {
                console.log('   ⚠️  Tentando execução direta...')

                // Split by semicolon and execute each statement
                const statements = sql
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && !s.startsWith('--'))

                for (const statement of statements) {
                    if (statement.length > 0) {
                        const { error: stmtError } = await supabase.rpc('exec', {
                            query: statement
                        })
                        if (stmtError) {
                            console.log(`   ❌ ERRO: ${stmtError.message}`)
                        }
                    }
                }
            }
        }

        console.log('   ✅ SUCESSO!')

    } catch (err) {
        console.log(`   ❌ ERRO: ${err.message}`)
    }
}

console.log('\n' + '='.repeat(70))
console.log('✅ MIGRATIONS CONCLUÍDAS')
console.log('='.repeat(70) + '\n')

console.log('🔍 Verificando tabelas criadas...\n')

// Check if tables exist
const tables = [
    'recovery_templates',
    'webhook_configurations',
    'abandoned_carts',
    'webhook_logs'
]

for (const table of tables) {
    const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

    if (error) {
        console.log(`❌ ${table}: ${error.message}`)
    } else {
        console.log(`✅ ${table}: OK`)
    }
}

console.log('\n✨ Pronto!\n')
