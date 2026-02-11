import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: { autoRefreshToken: false, persistSession: false }
            }
        )

        const { order_id, event_type } = await req.json()

        console.log('🔔 Trigger webhook:', { order_id, event_type })

        if (!order_id || !event_type) {
            return new Response(
                JSON.stringify({ error: 'order_id e event_type são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get webhook configuration
        const { data: webhookConfig } = await supabaseClient
            .from('webhook_configurations')
            .select('*')
            .eq('event_type', event_type)
            .eq('is_enabled', true)
            .single()

        if (!webhookConfig || !webhookConfig.webhook_url) {
            console.log('⚠️ Webhook not configured or disabled:', event_type)
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Webhook não configurado ou desabilitado',
                    event_type
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get order details
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select(`
                *,
                user_approvals (
                    full_name,
                    email,
                    whatsapp,
                    cpf,
                    addresses
                )
            `)
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            console.error('Order not found:', orderError)
            return new Response(
                JSON.stringify({ error: 'Pedido não encontrado' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Build webhook payload
        const userApproval = Array.isArray(order.user_approvals)
            ? order.user_approvals[0]
            : order.user_approvals

        const payload = {
            event: event_type,
            timestamp: new Date().toISOString(),
            data: {
                order: {
                    id: order.id,
                    order_number: order.order_number,
                    status: order.status,
                    total: order.total,
                    payment_method: order.payment_method,
                    ipag_transaction_id: order.ipag_transaction_id,
                    ipag_status: order.ipag_status,
                    tracking_code: order.tracking_code,
                    tracking_url: order.tracking_url,
                    carrier: order.carrier,
                    items: order.details?.items || [],
                    created_at: order.created_at,
                    updated_at: order.updated_at
                },
                user: {
                    id: order.user_id,
                    name: userApproval?.full_name || 'Cliente',
                    email: userApproval?.email || '',
                    whatsapp: userApproval?.whatsapp || '',
                    cpf: userApproval?.cpf || ''
                },
                address: order.addresses || userApproval?.addresses || null,
                metadata: {
                    payment: order.details?.payment || {},
                    ipag_response: order.details?.ipag_response || {}
                }
            }
        }

        // Send webhook with retry logic
        let lastError = null
        let lastStatusCode = null
        const maxRetries = webhookConfig.retry_count || 3
        const timeout = webhookConfig.timeout_ms || 30000

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📤 Sending webhook (attempt ${attempt}/${maxRetries})...`)

                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), timeout)

                const response = await fetch(webhookConfig.webhook_url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(webhookConfig.headers || {})
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                })

                clearTimeout(timeoutId)
                lastStatusCode = response.status

                if (response.ok) {
                    // Update webhook config
                    await supabaseClient
                        .from('webhook_configurations')
                        .update({
                            last_triggered_at: new Date().toISOString(),
                            last_status_code: response.status,
                            last_error: null
                        })
                        .eq('id', webhookConfig.id)

                    console.log('✅ Webhook sent successfully')

                    return new Response(
                        JSON.stringify({
                            success: true,
                            message: 'Webhook enviado com sucesso',
                            event_type,
                            status_code: response.status
                        }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                lastError = `HTTP ${response.status}: ${await response.text()}`
                console.error(`❌ Webhook failed (attempt ${attempt}):`, lastError)

                // Wait before retry
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
                }

            } catch (error) {
                lastError = error.message
                console.error(`❌ Webhook error (attempt ${attempt}):`, error)

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
                }
            }
        }

        // All retries failed
        await supabaseClient
            .from('webhook_configurations')
            .update({
                last_triggered_at: new Date().toISOString(),
                last_status_code: lastStatusCode,
                last_error: lastError
            })
            .eq('id', webhookConfig.id)

        return new Response(
            JSON.stringify({
                success: false,
                message: 'Webhook falhou após todas as tentativas',
                error: lastError,
                attempts: maxRetries
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Fatal error:', error)
        return new Response(
            JSON.stringify({ error: 'Erro interno', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
