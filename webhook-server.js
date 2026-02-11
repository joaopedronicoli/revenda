import express from 'express'
import bodyParser from 'body-parser'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const app = express()
const PORT = process.env.WEBHOOK_PORT || 3001

// Supabase client - use both VITE_ prefixed and non-prefixed env vars
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase environment variables')
    console.error('   SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'NOT SET')
    console.error('   SUPABASE_KEY:', SUPABASE_KEY ? 'SET' : 'NOT SET')
    console.log('⚠️ Webhook server will start but Supabase sync will fail')
}

const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null

const WEBHOOK_SECRET = 'wc_webhook_secret_2026revenda'

// WooCommerce → App status mapping
const WC_TO_APP_STATUS = {
    'cancelled': 'cancelled',
    'pending': 'pending',
    'processing': 'paid',
    'on-hold': 'on-hold',
    'completed': 'completed',
    'refunded': 'refunded',
    'failed': 'failed',
    'clinica': 'clinica',
    'estoque': 'preparing',
    'devolvido': 'returned',
    'entrega': 'delivery-issue',
    'incorretos': 'incorrect-data',
    'separacao': 'preparing-shipment',
    'retirar': 'pickup',
    'recebido': 'payment-received',
    'enviado': 'shipped',
    'checkout-draft': 'draft'
}

// JSON body parser for webhook
app.use('/api/webhooks/woocommerce', bodyParser.json())

// Webhook endpoint
app.post('/api/webhooks/woocommerce', async (req, res) => {
    try {
        console.log('📨 Webhook received at', new Date().toISOString())

        // Handle ping/test from WooCommerce
        if (!req.body || Object.keys(req.body).length === 0) {
            console.log('ℹ️  Empty webhook (ping test), responding OK')
            return res.status(200).json({ message: 'Webhook endpoint ready' })
        }

        // Get signature from header (skip validation for now)
        const signature = req.headers['x-wc-webhook-signature']
        if (!signature) {
            console.warn('⚠️ Missing webhook signature - proceeding anyway for testing')
        }

        if (!supabase) {
            console.error('❌ Supabase client not initialized')
            return res.status(500).json({ error: 'Database not available' })
        }

        const wcOrder = req.body

        console.log(`📦 Received WooCommerce webhook for order #${wcOrder.number} (ID: ${wcOrder.id})`)
        console.log(`🔍 Searching: woocommerce_order_id=${wcOrder.id} (${typeof wcOrder.id}) OR woocommerce_order_number=${wcOrder.number} (${typeof wcOrder.number})`)

        // Use AbortController for 10 second timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
            console.log('⏰ Query timeout - aborting')
            controller.abort()
        }, 10000)

        try {
            // Try finding order - multiple attempts with type conversions
            let { data: orders, error: fetchError } = await supabase
                .from('orders')
                .select('id, order_number, status, woocommerce_order_id, woocommerce_order_number')
                .eq('woocommerce_order_id', wcOrder.id)
                .abortSignal(controller.signal)

            console.log(`Attempt 1 (ID as number ${wcOrder.id}):`, orders?.length || 0, 'results', fetchError ? `Error: ${fetchError.message}` : '')

            // If not found, try as string
            if (!orders || orders.length === 0) {
                console.log(`⚠️  Not found by ID as number, trying as string...`)
                const result = await supabase
                    .from('orders')
                    .select('id, order_number, status, woocommerce_order_id, woocommerce_order_number')
                    .eq('woocommerce_order_id', wcOrder.id.toString())
                    .abortSignal(controller.signal)
                orders = result.data
                fetchError = result.error
                console.log(`Attempt 2 (ID as string "${wcOrder.id}"):`, orders?.length || 0, 'results', fetchError ? `Error: ${fetchError.message}` : '')
            }

            // If still not found, try by order number
            if (!orders || orders.length === 0) {
                console.log(`⚠️  Not found by ID, trying by order number...`)
                const result = await supabase
                    .from('orders')
                    .select('id, order_number, status, woocommerce_order_id, woocommerce_order_number')
                    .eq('woocommerce_order_number', wcOrder.number)
                    .abortSignal(controller.signal)
                orders = result.data
                fetchError = result.error
                console.log(`Attempt 3 (number "${wcOrder.number}"):`, orders?.length || 0, 'results', fetchError ? `Error: ${fetchError.message}` : '')
            }

            clearTimeout(timeoutId)

            let order = orders?.[0]

            if (fetchError) {
                console.log(`❌ Database error:`, fetchError)
                return res.status(500).json({ message: 'Database error' })
            }

            if (!order || orders.length === 0) {
                console.log(`❌ Order WC#${wcOrder.id} (${wcOrder.number}) not found in app database`)
                console.log(`   Tried: woocommerce_order_id=${wcOrder.id} OR woocommerce_order_number=${wcOrder.number}`)
                return res.status(200).json({ message: 'Order not found in app' })
            }

            if (orders.length > 1) {
                console.log(`⚠️  Multiple orders found (${orders.length}), using first one`)
            }

            console.log(`🔗 Found app order: ${order.order_number} (${order.id})`)

            // Map WooCommerce status to app status
            const appStatus = WC_TO_APP_STATUS[wcOrder.status] || 'pending'

            console.log(`📝 Updating status: ${order.status} → ${appStatus}`)

            // Update order status in Supabase
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    status: appStatus,
                    woocommerce_order_number: wcOrder.number,
                    tracking_url: `https://patriciaelias.com.br/rastreio-de-pedido/?pedido=${wcOrder.number}`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', order.id)

            if (updateError) {
                console.error('❌ Error updating order:', updateError)
                throw updateError
            }

            console.log(`✅ Order ${order.id} updated to status: ${appStatus}`)
            res.status(200).json({ success: true, orderId: order.id, newStatus: appStatus })
        } catch (queryError) {
            clearTimeout(timeoutId)
            if (queryError.name === 'AbortError') {
                console.error('❌ Query timeout after 10s')
                return res.status(504).json({ error: 'Database query timeout' })
            }
            throw queryError
        }
    } catch (error) {
        console.error('❌ Webhook error:', error)
        res.status(500).json({ error: error.message })
    }
})

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'woocommerce-webhook' })
})

app.listen(PORT, () => {
    console.log(`🚀 Webhook server running on port ${PORT}`)
    console.log(`📍 Webhook URL: http://localhost:${PORT}/api/webhooks/woocommerce`)
})
