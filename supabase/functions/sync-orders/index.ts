import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Sync Orders Function Initialized")

const IPAG_API_URL = 'https://api.ipag.com.br/service'
const IPAG_API_ID = Deno.env.get('IPAG_API_ID') ?? ''
const IPAG_API_KEY = Deno.env.get('IPAG_API_KEY') ?? ''
const BASIC_AUTH = btoa(`${IPAG_API_ID}:${IPAG_API_KEY}`)

function parseXML(xmlString: string): any {
    const result: any = {}
    const tagRegex = /<([^><\/\s]+)[^>]*>([^<]*)<\/\1>/g
    let match
    while ((match = tagRegex.exec(xmlString)) !== null) {
        result[match[1]] = match[2].trim()
    }

    // Também extrair atributos de tags como <status code="8">Capturado</status>
    const statusWithCode = xmlString.match(/<status[^>]*code=["']?(\d+)["']?[^>]*>([^<]*)<\/status>/i)
    if (statusWithCode) {
        result.status_pagamento = statusWithCode[1]
        result.mensagem_transacao = statusWithCode[2].trim()
    }

    // Extrair id_transacao ou tid
    const tidMatch = xmlString.match(/<(?:id_transacao|tid)[^>]*>([^<]+)</)
    if (tidMatch) {
        result.id_transacao = tidMatch[1].trim()
    }

    console.log('Parsed XML result:', result)
    return result
}

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
        let specificOrderId = url.searchParams.get('id')

        // Também aceitar orderId do body para POST requests
        if (req.method === 'POST' && !specificOrderId) {
            try {
                const body = await req.json()
                if (body.orderId) specificOrderId = body.orderId
            } catch {
                // Body vazio ou inválido, continuar com batch sync
            }
        }

        // Criar cliente Supabase com Service Role
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let orders: any[] = []

        if (specificOrderId) {
            console.log(`Syncing specific order: ${specificOrderId}`)
            const { data, error } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('id', specificOrderId)
                .single()

            if (error) {
                console.error("Error fetching specific order:", error)
            } else if (data) {
                orders = [data]
            }
        } else {
            console.log("Batch syncing pending orders...")
            const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
            const { data, error } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('status', 'pending')
                .gte('created_at', twoDaysAgo)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw new Error(`Database error: ${error.message}`)
            orders = data || []
        }

        console.log(`Found ${orders.length} orders to sync.`)

        const results = {
            total: orders.length,
            updated: 0,
            errors: 0,
            skipped: 0,
            details: [] as string[]
        }

        for (const order of orders) {
            try {
                // ID do pedido truncado (16 chars) usado na criação no iPag
                const ipagOrderId = order.id.substring(0, 16)

                // Tentar extrair o TID real dos payment_logs
                // O TID está em parsed_response.id_transacao ou parsed_response.retorno.id_transacao
                let realTid: string | null = null
                const paymentLogs = order.details?.payment_logs || []
                console.log(`Order has ${paymentLogs.length} payment logs`)

                for (const log of paymentLogs) {
                    if (!log || !log.parsed_response) continue
                    const parsed = log.parsed_response

                    // Tentar várias localizações possíveis
                    const tid = parsed.id_transacao ||
                        (parsed.retorno && parsed.retorno.id_transacao) ||
                        parsed.tid

                    console.log(`Log TID found: ${tid}`)

                    if (tid && String(tid).length > 10) {
                        realTid = String(tid)
                        console.log(`Using TID: ${realTid}`)
                        break
                    }
                }

                // Se temos o TID real, consultar por TID
                // Senão, tentar pelo número do pedido
                let payload: Record<string, string>

                if (realTid) {
                    console.log(`Using real TID from payment_logs: ${realTid}`)
                    payload = {
                        identificacao: IPAG_API_ID,
                        transId: realTid,
                        url_retorno: 'XML'
                    }
                } else if (order.ipag_transaction_id && order.ipag_transaction_id.length > 15) {
                    // TID armazenado parece ser o real (>15 chars)
                    payload = {
                        identificacao: IPAG_API_ID,
                        transId: order.ipag_transaction_id,
                        url_retorno: 'XML'
                    }
                } else {
                    // Consulta por número do pedido
                    payload = {
                        identificacao: IPAG_API_ID,
                        pedido: ipagOrderId,
                        url_retorno: 'XML'
                    }
                }

                console.log(`Consulting iPag for order ${ipagOrderId}:`, JSON.stringify(payload))
                console.log(`IPAG_API_ID configured: ${IPAG_API_ID ? 'yes' : 'NO'}`)

                const formBody = Object.entries(payload)
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                    .join('&')

                console.log(`Request body: ${formBody}`)

                // iPag consult API usa POST com form-urlencoded (como no plugin WooCommerce)
                const response = await fetch(`${IPAG_API_URL}/consult`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${BASIC_AUTH}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formBody
                })

                console.log(`iPag response status: ${response.status}`)

                const text = await response.text()
                let data: any = {}

                try {
                    data = JSON.parse(text)
                    // iPag wraps response in 'retorno' object
                    if (data.retorno) {
                        console.log('Unwrapping retorno wrapper')
                        data = { ...data, ...data.retorno }
                    }
                    if (data.data) {
                        data = { ...data, ...data.data }
                    }
                } catch {
                    try { data = parseXML(text) } catch { }
                }

                console.log(`Parsed data keys: ${Object.keys(data).join(', ')}`)
                const transactionId = data.id_transacao || data.id || data.tid

                console.log(`Order ${ipagOrderId} - iPag response:`, JSON.stringify(data))

                if (!transactionId) {
                    results.skipped++
                    results.details.push(`${ipagOrderId}: Not found in iPag`)
                    continue
                }

                // Mapear Status - extrair de várias fontes possíveis
                const statusCode = (data.status_pagamento || data.codigo_transacao || '').toString()
                const statusMessage = (data.status || data.mensagem_transacao || '').toString().toLowerCase()
                const ipagStatusRaw = statusCode || statusMessage

                console.log(`Order ${ipagOrderId} - status_code: ${statusCode}, status_message: ${statusMessage}`)

                let newStatus = 'pending'

                // SUCCESS: 5 (Approved) ou 8 (Captured)
                if (statusCode === '5' || statusCode === '8' ||
                    statusMessage.includes('approved') ||
                    statusMessage.includes('capturado') ||
                    statusMessage.includes('succeeded') ||
                    statusMessage.includes('pago') ||
                    statusMessage.includes('sucesso')) {
                    newStatus = 'paid'
                }
                // CANCELED/REFUSED: 3 (Canceled) ou 7 (Refused)
                else if (statusCode === '3' || statusCode === '7' ||
                    statusMessage.includes('canceled') ||
                    statusMessage.includes('denied') ||
                    statusMessage.includes('recusado') ||
                    statusMessage.includes('cancelado') ||
                    statusMessage.includes('falha')) {
                    newStatus = 'canceled'
                }

                if (newStatus !== order.status || !order.ipag_transaction_id) {
                    console.log(`Updating order ${order.id}: ${order.status} -> ${newStatus}`)
                    const { error: updateError } = await supabaseAdmin
                        .from('orders')
                        .update({
                            status: newStatus,
                            ipag_status: ipagStatusRaw,
                            ipag_transaction_id: transactionId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', order.id)

                    if (updateError) results.errors++
                    else {
                        results.updated++
                        results.details.push(`${ipagOrderId}: Updated to ${newStatus}`)
                    }
                } else {
                    results.skipped++
                }

                // Throttle slightly
                await new Promise(r => setTimeout(r, 100))

            } catch (err) {
                console.error(`Error syncing order ${order.id}:`, err)
                results.errors++
            }
        }

        console.log('Sync completed:', results)
        return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Sync error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
