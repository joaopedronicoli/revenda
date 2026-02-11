import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        console.log('Webhook received!')
        console.log('URL:', req.url)
        console.log('Method:', req.method)
        console.log('Search Params:', Array.from(url.searchParams.entries()))

        let orderId = url.searchParams.get('id')
        let data: any = {}
        const contentType = req.headers.get('content-type') || ''

        try {
            if (contentType.includes('application/json')) {
                data = await req.json()
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
                const formData = await req.formData()
                data = Object.fromEntries(formData.entries())
            } else {
                const text = await req.text()
                // Format: key=value&key2=value2
                const params = new URLSearchParams(text)
                data = Object.fromEntries(params.entries())
                data._raw = text
            }

            // Flatten wrappers (common in iPag)
            if (data.data) {
                console.log('Flattening data.data wrapper')
                data = { ...data, ...data.data }
            }
            if (data.retorno) {
                console.log('Flattening data.retorno wrapper')
                data = { ...data, ...data.retorno }
            }
        } catch (e) {
            console.error('Error parsing body:', e)
        }

        console.log('Webhook Data:', data)

        // Robust Order ID check
        if (!orderId) {
            const bodyOrderId = data?.attributes?.order_id || data?.order_id || data?.pedido
            if (bodyOrderId) {
                console.log('OrderId missing from URL, using from body:', bodyOrderId)
                orderId = bodyOrderId
            }
        }

        if (!orderId) {
            console.error('Missing order ID in webhook')
            return new Response(JSON.stringify({ error: 'Missing order ID param' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Handle Truncated/Prefix IDs
        // iPag v1 field 'pedido' is max 16 chars, but our UUIDs are 36.
        let fullOrderId = orderId
        if (orderId && orderId.length < 36) {
            console.log('Detected partial order ID, searching by prefix:', orderId)
            const { data: orders, error: searchError } = await supabase
                .from('orders')
                .select('id')
                .like('id', `${orderId}%`)
                .limit(2)

            if (searchError || !orders || orders.length === 0) {
                console.error('Order not found by prefix:', orderId, searchError)
                return new Response(JSON.stringify({ error: 'Order not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            if (orders.length > 1) {
                console.error('Multiple orders found for prefix:', orderId)
                return new Response(JSON.stringify({ error: 'Ambiguous order ID - multiple matches' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            fullOrderId = orders[0].id
            console.log('Resolved full order ID:', fullOrderId)
        }

        // Map status - Extrair de várias possíveis localizações
        const statusCode = data?.attributes?.status?.code?.toString() ||
            data?.status?.code?.toString() ||
            data?.codigo_transacao?.toString() ||
            data?.status_pagamento?.toString() ||
            ''
        const statusMessage = data?.attributes?.status?.message?.toString() ||
            data?.status?.message?.toString() ||
            data?.mensagem_transacao?.toString() ||
            data?.status?.toString() ||
            ''

        const ipagStatusRaw = statusCode || statusMessage || ''
        const ipagStatus = ipagStatusRaw.toLowerCase()

        console.log(`Status extraction - code: ${statusCode}, message: ${statusMessage}, final: ${ipagStatus}`)

        let status = 'pending'
        // iPag statuses (Reference: ipag-gateway-credito.php):
        // 1=Initiated, 2=Billet/Pending, 3=Canceled, 4=Analysis, 5=Approved, 6=Partial Refund, 7=Refused, 8=Captured

        // SUCCESS: 5 (Approved) ou 8 (Captured)
        if (ipagStatus === '5' || ipagStatus === '8' ||
            ipagStatus.includes('approved') ||
            ipagStatus.includes('capturado') ||
            ipagStatus.includes('succeeded') ||
            ipagStatus.includes('pago') ||
            ipagStatus.includes('sucesso')) {
            status = 'paid'
        }
        // CANCELED/REFUSED: 3 (Canceled) ou 7 (Refused)
        else if (ipagStatus === '3' || ipagStatus === '7' ||
            ipagStatus.includes('canceled') ||
            ipagStatus.includes('denied') ||
            ipagStatus.includes('recusado') ||
            ipagStatus.includes('cancelado') ||
            ipagStatus.includes('falha') ||
            ipagStatus.includes('refused')) {
            status = 'canceled'
        }
        // REFUNDED: 6 (Partial Refund/Estorno)
        else if (ipagStatus === '6' ||
            ipagStatus.includes('refunded') ||
            ipagStatus.includes('estornado')) {
            status = 'refunded'
        }
        // Tudo mais fica como 'pending' (1=Initiated, 2=Billet, 4=Analysis)

        console.log(`Updating order ${fullOrderId} with iPag status '${ipagStatus}' -> mapped to '${status}'`)

        // Update Order
        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update({
                ipag_status: ipagStatus,
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', fullOrderId)
            .select() // important: return data for N8N
            .single()

        if (updateError) {
            console.error('Error updating order:', updateError)
            return new Response(JSON.stringify({ error: 'Database error', details: updateError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Send to N8N
        const n8nUrl = Deno.env.get('N8N_WEBHOOK_URL')
        if (n8nUrl && updatedOrder) {
            console.log('Sending notification to N8N:', n8nUrl)
            try {
                // Send rich payload
                await fetch(n8nUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'payment_update',
                        timestamp: new Date().toISOString(),
                        order: updatedOrder,
                        webhook_source: 'ipag',
                        raw_data: data
                    })
                })
                console.log('N8N notification sent successfully')
            } catch (err) {
                console.error('Failed to notify N8N:', err)
            }
        }

        console.log(`SUCCESS: Order ${fullOrderId} updated to status '${status}'`)
        return new Response(JSON.stringify({
            success: true,
            message: 'Webhook processed',
            order_id: fullOrderId,
            status: status
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Webhook critical error:', error)
        return new Response(JSON.stringify({
            success: false,
            error: 'Internal Server Error',
            details: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
