import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    // CORS headers
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
            }
        })
    }

    try {
        const { orderId, status, trackingCode } = await req.json()

        if (!orderId || !status) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing orderId or status'
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                status: 400
            })
        }

        // Validar status
        const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
        if (!validStatuses.includes(status)) {
            return new Response(JSON.stringify({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                status: 400
            })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Preparar dados de atualização
        const updateData: any = { status }
        if (trackingCode) updateData.tracking_code = trackingCode

        // Atualizar pedido
        const { data, error } = await supabaseAdmin
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .select()
            .single()

        if (error) {
            console.error('Database error:', error)
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                status: 400
            })
        }

        return new Response(JSON.stringify({
            success: true,
            orderId,
            status,
            trackingCode: trackingCode || null,
            updatedAt: data.updated_at,
            message: 'Status do pedido atualizado com sucesso'
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        })
    } catch (error) {
        console.error('Error:', error)
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            status: 500
        })
    }
})
