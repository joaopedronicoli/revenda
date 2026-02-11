
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Manually load env
const envPath = path.resolve('.env.local')
const envConfig = fs.readFileSync(envPath, 'utf8')
const env = {}
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
        env[key.trim()] = value.trim()
    }
})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLatestOrder() {
    console.log('🔍 Buscando o pedido mais recente...')

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

    if (error) {
        console.error('❌ Erro ao buscar pedido:', error)
        return
    }

    if (!orders || orders.length === 0) {
        console.log('⚠️ Nenhum pedido encontrado.')
        return
    }

    const order = orders[0]
    console.log('✅ Pedido mais recente encontrado:')
    console.log('--------------------------------------------------')
    console.log(`🆔 ID do Pedido: ${order.id}`)
    console.log(`📅 Criado em:    ${new Date(order.created_at).toLocaleString('pt-BR')}`)
    console.log(`👤 Cliente:      ${order.customer_name || 'N/A'} (${order.customer_email})`)
    console.log(`💰 Valor:        R$ ${(order.total_amount / 100).toFixed(2)}`)
    console.log(`📦 Status:       ${order.status.toUpperCase()}`)
    console.log(`💳 iPag Status:  ${order.ipag_status || 'N/A'}`)
    console.log(`🔗 iPag TransID: ${order.ipag_transaction_id || 'NÃO REGISTRADO'}`)
    console.log('--------------------------------------------------')

    // Check if details contains payment info
    if (order.details && order.details.payment) {
        console.log('🔍 Detalhes do Pagamento:', order.details.payment)
    }
}

checkLatestOrder()
