
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Configuration
const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'

// iPag Credentials (loaded from .env.local for safety/consistency)
const envPath = path.resolve('.env.local')
const envConfig = fs.readFileSync(envPath, 'utf8')
const env = {}
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) env[key.trim()] = value.trim()
})

const IPAG_API_ID = env.VITE_IPAG_API_ID
const IPAG_API_KEY = env.VITE_IPAG_API_KEY
const IPAG_API_URL = 'https://api.ipag.com.br/service/consult'

if (!IPAG_API_ID || !IPAG_API_KEY) {
    console.error('❌ Credenciais iPag não encontradas no .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

function parseXML(xml) {
    const result = {}
    const regex = /<([^>]+)>([^<]+)<\/\1>/g
    let match
    while ((match = regex.exec(xml)) !== null) {
        result[match[1]] = match[2]
    }
    return result
}

async function consultIpag(orderId) {
    // iPag limit orderId to 16 chars
    const pedido = orderId.substring(0, 16)

    // Try to consult by Order ID
    const params = new URLSearchParams()
    params.append('identificacao', IPAG_API_ID)
    params.append('pedido', pedido)
    params.append('transacao', '') // Consultar por pedido

    // Auth Basic
    const basicAuth = Buffer.from(`${IPAG_API_ID}:${IPAG_API_KEY}`).toString('base64')

    try {
        const response = await fetch(IPAG_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json' // Try JSON
            },
            body: params
        })

        const text = await response.text()
        let data = {}

        try {
            data = JSON.parse(text)
            // Flatten
            if (data.data) data = { ...data, ...data.data }
            if (data.retorno) data = { ...data, ...data.retorno }
        } catch (e) {
            // XML Fallback
            data = parseXML(text)
        }

        return data

    } catch (error) {
        console.error(`Erro na consulta iPag para ${pedido}:`, error.message)
        return null
    }
}

async function syncOrders() {
    console.log('🚀 Iniciando sincronização de pedidos antigos...')

    // Buscar pedidos pendentes ou sem ID de transação (criados nos últimos 30 dias)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Erro Supabase:', error)
        return
    }

    console.log(`📋 Encontrados ${orders.length} pedidos nos últimos 30 dias. Verificando status...`)

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const order of orders) {
        // Skip if already paid and has ID (unless re-verifying?)
        // Let's verify 'pending' ones OR paid ones without ID
        if (order.status === 'paid' && order.ipag_transaction_id) {
            skippedCount++
            process.stdout.write('.')
            continue
        }

        console.log(`\n🔍 Checking Order: ${order.id} (${order.status})`)

        // Delay to respect rate limit
        await new Promise(r => setTimeout(r, 600))

        const ipagData = await consultIpag(order.id)

        if (!ipagData || (!ipagData.id_transacao && !ipagData.id)) {
            console.log(`   🔸 Não encontrado no iPag (Pedido: ${order.id.substring(0, 16)})`)
            // Talvez não tenha sido enviado ao iPag (falha antes?)
            continue
        }

        const tid = ipagData.id_transacao || ipagData.id
        const msg = ipagData.mensagem_transacao || ipagData.message || ''
        const code = ipagData.status_pagamento || ipagData.code

        console.log(`   ✅ Encontrado iPag TID: ${tid} | Status: ${msg} (${code})`)

        let newStatus = order.status
        let newIpagStatus = msg.toLowerCase()

        if (['approved', 'capturado', 'succeeded', 'pago', 'sucesso'].some(s => newIpagStatus.includes(s))) {
            newStatus = 'paid'
        } else if (['canceled', 'denied', 'recusado', 'cancelado'].some(s => newIpagStatus.includes(s))) {
            newStatus = 'canceled'
        }

        // Update DB if different
        const needsUpdate = (order.status !== newStatus) || (!order.ipag_transaction_id) || (order.ipag_status !== newIpagStatus)

        if (needsUpdate) {
            console.log(`   🔄 Updating DB: ${order.status} -> ${newStatus}`)

            const updatePayload = {
                ipag_transaction_id: tid,
                ipag_status: newIpagStatus,
                status: newStatus,
                updated_at: new Date().toISOString()
            }

            // If just getting ID for paid order
            if (newStatus === 'paid' && !order.ipag_transaction_id) {
                // Keep paid
            }

            const { error: updateError } = await supabase
                .from('orders')
                .update(updatePayload)
                .eq('id', order.id)

            if (updateError) {
                console.error('   ❌ Falha ao atualizar Supabase:', updateError.message)
                errorCount++
            } else {
                updatedCount++
            }
        } else {
            console.log(`   ⚡ Já sincronizado.`)
            skippedCount++
        }
    }

    console.log('\n\n🏁 Sincronização Finalizada!')
    console.log(`✅ Atualizados: ${updatedCount}`)
    console.log(`⏭️  Pulados/Sem alteração: ${skippedCount}`)
    console.log(`❌ Erros: ${errorCount}`)
}

syncOrders()
