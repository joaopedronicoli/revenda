import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    try {
        console.log('=== Sync Pending Orders - Started ===')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Buscar pedidos pendentes criados nos últimos 2 dias
        const twoDaysAgo = new Date()
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

        const { data: pendingOrders, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('status', 'pending')
            .gte('created_at', twoDaysAgo.toISOString())
            .not('ipag_transaction_id', 'is', null)

        if (fetchError) {
            console.error('Error fetching pending orders:', fetchError)
            return new Response('Error fetching orders', { status: 500 })
        }

        if (!pendingOrders || pendingOrders.length === 0) {
            console.log('No pending orders to sync')
            return new Response(JSON.stringify({
                success: true,
                message: 'No pending orders',
                checked: 0
            }), {
                headers: { 'Content-Type': 'application/json' }
            })
        }

        console.log(`Found ${pendingOrders.length} pending orders to check`)

        const ipagApiId = Deno.env.get('IPAG_API_ID')
        const ipagApiKey = Deno.env.get('IPAG_API_KEY')
        const auth = btoa(`${ipagApiId}:${ipagApiKey}`)

        let updatedCount = 0
        let errorCount = 0

        // Processar cada pedido
        for (const order of pendingOrders) {
            try {
                console.log(`Checking order ${order.id} - iPag TID: ${order.ipag_transaction_id}`)

                // Consultar status no iPag
                const ipagResponse = await fetch(
                    `https://api.ipag.com.br/service/consult?tid=${order.ipag_transaction_id}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/xml'
                        }
                    }
                )

                if (!ipagResponse.ok) {
                    console.error(`iPag API error for order ${order.id}:`, ipagResponse.status)
                    errorCount++
                    continue
                }

                const xmlText = await ipagResponse.text()
                console.log(`iPag response for ${order.id}:`, xmlText.substring(0, 200))

                // Parse XML response
                const parser = new DOMParser()
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

                // Extrair status
                const statusElement = xmlDoc.querySelector('status')
                const statusCode = statusElement?.getAttribute('code') ||
                    xmlDoc.querySelector('status_pagamento')?.textContent ||
                    ''

                const statusMessage = statusElement?.textContent?.toLowerCase() || ''

                console.log(`Order ${order.id} - Status Code: ${statusCode}, Message: ${statusMessage}`)

                // Mapear status
                let newStatus = 'pending'
                const isPaid =
                    ['3', '10'].includes(statusCode) ||
                    ['approved', 'capturado', 'pago', 'sucesso', 'succeeded', 'paid'].some(s => statusMessage.includes(s))

                const isCanceled =
                    ['4', '5', '7'].includes(statusCode) ||
                    ['canceled', 'denied', 'recusado', 'cancelado', 'falha', 'expirado'].some(s => statusMessage.includes(s))

                const isRefunded =
                    ['6', '8'].includes(statusCode) ||
                    ['refunded', 'estornado'].some(s => statusMessage.includes(s))

                if (isPaid) {
                    newStatus = 'paid'
                } else if (isCanceled) {
                    newStatus = 'canceled'
                } else if (isRefunded) {
                    newStatus = 'refunded'
                }

                // Atualizar se status mudou
                if (newStatus !== order.status) {
                    console.log(`Updating order ${order.id}: ${order.status} -> ${newStatus}`)

                    const { error: updateError } = await supabase
                        .from('orders')
                        .update({
                            status: newStatus,
                            ipag_status: statusMessage || statusCode,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', order.id)

                    if (updateError) {
                        console.error(`Error updating order ${order.id}:`, updateError)
                        errorCount++
                    } else {
                        updatedCount++

                        // Notificar N8N
                        const n8nUrl = Deno.env.get('N8N_WEBHOOK_URL')
                        if (n8nUrl) {
                            try {
                                await fetch(n8nUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        event: 'payment_sync_update',
                                        order_id: order.id,
                                        old_status: order.status,
                                        new_status: newStatus,
                                        ipag_transaction_id: order.ipag_transaction_id,
                                        timestamp: new Date().toISOString()
                                    })
                                })
                                console.log(`N8N notified for order ${order.id}`)
                            } catch (n8nError) {
                                console.error(`N8N notification failed for ${order.id}:`, n8nError)
                            }
                        }
                    }
                } else {
                    console.log(`Order ${order.id} status unchanged: ${newStatus}`)
                }

            } catch (orderError) {
                console.error(`Error processing order ${order.id}:`, orderError)
                errorCount++
            }
        }

        console.log(`=== Sync Complete: ${updatedCount} updated, ${errorCount} errors ===`)

        return new Response(JSON.stringify({
            success: true,
            checked: pendingOrders.length,
            updated: updatedCount,
            errors: errorCount
        }), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Critical error in sync-pending-orders:', error)
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
