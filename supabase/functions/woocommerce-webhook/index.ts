import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

serve(async (req) => {
    try {
        // Verify webhook signature
        const signature = req.headers.get('x-wc-webhook-signature')
        if (!signature) {
            console.error('Missing webhook signature')
            return new Response(JSON.stringify({ error: 'Missing signature' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Get request body
        const body = await req.text()

        // Verify signature (WooCommerce uses HMAC SHA256)
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(WEBHOOK_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        )
        const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
        const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

        if (signature !== expectedSignature) {
            console.error('Invalid webhook signature')
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Parse webhook data
        const wcOrder = JSON.parse(body)

        console.log(`📦 Received WooCommerce webhook for order #${wcOrder.number}`)

        // Check if this order is from the reseller app
        const revendaAppOrderId = wcOrder.meta_data?.find(
            meta => meta.key === '_revenda_app_order_id'
        )?.value

        if (!revendaAppOrderId) {
            console.log(`Order #${wcOrder.number} is not from reseller app, ignoring`)
            return new Response(JSON.stringify({ message: 'Not a reseller app order' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Map WooCommerce status to app status
        const appStatus = WC_TO_APP_STATUS[wcOrder.status] || 'pending'

        // Update order in Supabase
        const { error } = await supabase
            .from('orders')
            .update({
                status: appStatus,
                woocommerce_order_id: wcOrder.id,
                woocommerce_order_number: wcOrder.number,
                tracking_url: `https://patriciaelias.com.br/rastreio-de-pedido/?pedido=${wcOrder.number}`,
                updated_at: new Date().toISOString()
            })
            .eq('id', revendaAppOrderId)

        if (error) {
            console.error('Error updating order:', error)
            throw error
        }

        console.log(`✅ Order ${revendaAppOrderId} updated to status: ${appStatus}`)

        return new Response(
            JSON.stringify({
                success: true,
                orderId: revendaAppOrderId,
                newStatus: appStatus
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    } catch (error) {
        console.error('Webhook error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
})
