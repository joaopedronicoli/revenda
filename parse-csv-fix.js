import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

// Load environment variables for Supabase connection
const envContent = fs.readFileSync('.env.local', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
        envVars[match[1].trim()] = match[2].trim()
    }
})

const supabase = createClient(
    envVars.VITE_SUPABASE_URL,
    envVars.VITE_SUPABASE_ANON_KEY
    // OBS: ANON KEY pode não ter permissão para listar todos os pedidos se houver RLS.
    // O ideal seria SERVICE_ROLE_KEY, mas não tenho ela aqui (somente na edge function).
    // Vou gerar apenas os comandos SQL para rodar no dashboard, que é mais seguro.
)

async function run() {
    const csvContent = fs.readFileSync('2026-01-31-13-22-03-transaction-report-6598.csv', 'utf-8')
    const lines = csvContent.split('\n')

    // Ignorar cabeçalho (linha 0)
    const dataLines = lines.slice(1).filter(l => l.trim().length > 0)

    console.log(`🔍 Analisando ${dataLines.length} transações do CSV...\n`)

    const updates = []

    for (const line of dataLines) {
        const cols = line.split(';')

        // Coluna 0: Id (iPag Transaction ID)
        // Coluna 3: Numero_do_pedido (ID parcial do nosso sistema)
        // Coluna 4: Status

        const ipagId = cols[0]
        const partialOrderId = cols[3]
        const statusRaw = cols[4]
        const tid = cols[9] // Tid da adquirente (opcional, mas bom ter)

        if (!partialOrderId || partialOrderId.startsWith('TEST')) {
            console.log(`⚠️  Ignorando teste: ${partialOrderId}`)
            continue
        }

        // Mapear Status
        let status = 'pending'
        let ipagStatus = (statusRaw || '').toLowerCase()

        if (ipagStatus.includes('capturado') || ipagStatus.includes('succeeded') || ipagStatus.includes('pago')) {
            status = 'paid'
        } else if (ipagStatus.includes('cancelado') || ipagStatus.includes('recusado') || ipagStatus.includes('falha')) {
            status = 'canceled'
        }

        // Gerar SQL Update
        // Usamos LIKE para encontrar o pedido pelo ID parcial
        // O ID parcial tem 16 chars. UUID tem 36.
        // Cuidado com colisões, mas com 16 chars de UUID é muito difícil colidir.

        console.log(`✅ Processando: ${partialOrderId} -> iPag: ${ipagId} (${status})`)

        updates.push(`UPDATE orders 
        SET 
            ipag_transaction_id = '${ipagId}', 
            status = '${status}', 
            ipag_status = '${ipagStatus}',
            updated_at = NOW()
        WHERE id::text LIKE '${partialOrderId}%';`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('📝 EXECUTE ESTE SQL NO SUPABASE DASHBOARD:')
    console.log('='.repeat(60) + '\n')

    console.log(updates.join('\n'))

    console.log('\n' + '='.repeat(60))
}

run()
