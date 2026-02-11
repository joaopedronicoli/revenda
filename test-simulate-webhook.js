
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load Env
const envPath = path.resolve('.env.local')
const envConfig = fs.readFileSync(envPath, 'utf8')
const env = {}
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) env[key.trim()] = value.trim()
})

const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function simulateWebhook() {
    console.log('🚀 Simulating iPag Webhook...')

    // 1. Get latest pending order
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error || !order) {
        console.error('❌ No pending order found to test.')
        return
    }

    console.log(`📝 Found Pending Order: ${order.id}`)
    console.log(`   Created At: ${order.created_at}`)
    console.log(`   Current Status: ${order.status}`)

    // 2. Send Webhook
    const webhookUrl = `${SUPABASE_URL}/functions/v1/ipag-webhook?id=${order.id}`
    console.log(`📨 Sending POST to: ${webhookUrl}`)

    const payload = {
        // iPag v1/v2 style payload
        id: order.ipag_transaction_id || '123456',
        mensagem_transacao: 'APPROVED',
        status: 'succeeded', // mapped internally
        code: '200',
        order_id: order.id,
        retorno: {
            // Nested structure
            status: 'approved',
            mensagem: 'Simulated Approval'
        }
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        console.log(`📡 Response Status: ${response.status} ${response.statusText}`)
        const text = await response.text()
        console.log(`📄 Response Body: ${text}`)

        if (response.ok) {
            console.log('\n✅ Webhook delivered successfully!')
            console.log('👀 Check the order status in Supabase now...')

            // 3. Verify Update
            const { data: updatedOrder } = await supabase
                .from('orders')
                .select('status, ipag_status')
                .eq('id', order.id)
                .single()

            console.log(`\n🔄 Order Updated Status: ${updatedOrder.status}`)
            console.log(`   iPag Status: ${updatedOrder.ipag_status}`)
        }

    } catch (e) {
        console.error('❌ Webhook simulation failed:', e)
    }
}

simulateWebhook()
