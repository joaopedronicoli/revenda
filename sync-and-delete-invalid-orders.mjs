import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Supabase com SERVICE_ROLE_KEY para ignorar RLS
const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
})

// iPag Credentials
const env = readFileSync('.env.local', 'utf-8')
const envVars = {}
env.split('\n').forEach(line => {
    const idx = line.indexOf('=')
    if (idx > 0) envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
})

const IPAG_API_ID = envVars.VITE_IPAG_API_ID
const IPAG_API_KEY = envVars.VITE_IPAG_API_KEY
const IPAG_API_URL = 'https://api.ipag.com.br/service/consult'

console.log('\n' + '='.repeat(70))
console.log('🔍 SINCRONIZAÇÃO E LIMPEZA DE PEDIDOS')
console.log('='.repeat(70) + '\n')

// Consultar iPag
async function consultIpag(orderNumber) {
    const pedido = orderNumber.substring(0, 16)
    const params = new URLSearchParams()
    params.append('identificacao', IPAG_API_ID)
    params.append('pedido', pedido)
    params.append('transacao', '')

    const basicAuth = Buffer.from(`${IPAG_API_ID}:${IPAG_API_KEY}`).toString('base64')

    try {
        const response = await fetch(IPAG_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: params
        })

        const text = await response.text()
        let data = {}

        try {
            data = JSON.parse(text)
            if (data.data) data = { ...data, ...data.data }
            if (data.retorno) data = { ...data, ...data.retorno }
        } catch {
            // Parse XML fallback
            const regex = /<([^>]+)>([^<]+)<\/\1>/g
            let match
            while ((match = regex.exec(text)) !== null) {
                data[match[1]] = match[2]
            }
        }

        return data
    } catch (error) {
        console.error(`   ❌ Erro ao consultar iPag: ${error.message}`)
        return null
    }
}

// Main
async function syncAndClean() {
    console.log('📊 Buscando pedidos do banco de dados...\n')

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, ipag_transaction_id, status, total, created_at')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Erro ao buscar pedidos:', error.message)
        process.exit(1)
    }

    console.log(`✅ Total de pedidos encontrados: ${orders.length}\n`)

    let checked = 0
    let deleted = 0
    let kept = 0
    let errors = 0

    for (const order of orders) {
        if (!order.order_number) {
            console.log(`⚠️  Pedido sem order_number: ${order.id.substring(0, 8)}`)
            continue
        }

        checked++
        console.log(`\n[${checked}/${orders.length}] 🔍 Verificando: ${order.order_number}`)
        console.log(`   ID: ${order.id.substring(0, 13)}...`)
        console.log(`   Status: ${order.status} | Total: R$ ${order.total}`)

        // Se já tem ipag_transaction_id, provavelmente é válido - mas vamos verificar mesmo assim
        if (order.ipag_transaction_id) {
            console.log(`   ✅ TEM transaction_id: ${order.ipag_transaction_id} → MANTER`)
            kept++
            continue
        }

        // Consultar no iPag
        console.log(`   🔎 Consultando no iPag...`)
        const ipagData = await consultIpag(order.order_number)

        // Aguardar um pouco para não sobrecarregar API
        await new Promise(resolve => setTimeout(resolve, 500))

        if (!ipagData) {
            console.log(`   ⚠️  Sem resposta do iPag - PULANDO (não vai deletar por segurança)`)
            errors++
            continue
        }

        // Verificar se existe no iPag
        const existsInIpag = ipagData.transacao || ipagData.transactionId || ipagData.tid ||
                           (ipagData.mensagem && !ipagData.mensagem.toLowerCase().includes('não encontrado'))

        if (existsInIpag) {
            console.log(`   ✅ EXISTE no iPag → MANTER`)
            kept++
        } else {
            console.log(`   ❌ NÃO EXISTE no iPag → DELETANDO...`)

            const { error: delError } = await supabase
                .from('orders')
                .delete()
                .eq('id', order.id)

            if (delError) {
                console.log(`   ❌ ERRO ao deletar: ${delError.message}`)
                errors++
            } else {
                console.log(`   ✅ DELETADO COM SUCESSO!`)
                deleted++
            }
        }
    }

    console.log('\n' + '='.repeat(70))
    console.log('📋 RESUMO FINAL')
    console.log('='.repeat(70))
    console.log(`✅ Pedidos verificados: ${checked}`)
    console.log(`🟢 Mantidos (válidos): ${kept}`)
    console.log(`🗑️  Deletados (inválidos): ${deleted}`)
    console.log(`⚠️  Erros/Pulados: ${errors}`)
    console.log('='.repeat(70) + '\n')
}

syncAndClean().catch(err => {
    console.error('\n❌ ERRO FATAL:', err.message)
    process.exit(1)
})
