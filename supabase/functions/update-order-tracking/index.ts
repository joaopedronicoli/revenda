import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const {
            order_id,
            order_number,
            tracking_code,
            tracking_url,
            status,
            carrier
        } = await req.json()

        console.log('📦 Update tracking request:', {
            order_id,
            order_number,
            tracking_code,
            status
        })

        // Validate required fields
        if (!order_id && !order_number) {
            return new Response(
                JSON.stringify({
                    error: 'order_id ou order_number é obrigatório'
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Find order
        let query = supabaseClient.from('orders').select('id, order_number, status, tracking_code')

        if (order_id) {
            query = query.eq('id', order_id)
        } else {
            query = query.eq('order_number', order_number)
        }

        const { data: orders, error: selectError } = await query.single()

        if (selectError || !orders) {
            console.error('Order not found:', selectError)
            return new Response(
                JSON.stringify({
                    error: 'Pedido não encontrado',
                    details: selectError?.message
                }),
                {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Build update object
        const updateData: any = {
            updated_at: new Date().toISOString()
        }

        if (tracking_code) {
            updateData.tracking_code = tracking_code
        }

        if (tracking_url) {
            updateData.tracking_url = tracking_url
        }

        if (carrier) {
            updateData.carrier = carrier
        }

        // Update status if provided and valid
        const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
        if (status && validStatuses.includes(status)) {
            updateData.status = status

            // Set shipped_at when status changes to shipped
            if (status === 'shipped' && !orders.status.includes('shipped')) {
                updateData.shipped_at = new Date().toISOString()
            }

            // Set delivered_at when status changes to delivered
            if (status === 'delivered') {
                updateData.delivered_at = new Date().toISOString()
            }
        }

        // Update order
        const { data: updatedOrder, error: updateError } = await supabaseClient
            .from('orders')
            .update(updateData)
            .eq('id', orders.id)
            .select()
            .single()

        if (updateError) {
            console.error('Update error:', updateError)
            return new Response(
                JSON.stringify({
                    error: 'Erro ao atualizar pedido',
                    details: updateError.message
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        console.log('✅ Order updated:', updatedOrder.order_number)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Pedido atualizado com sucesso',
                order: {
                    id: updatedOrder.id,
                    order_number: updatedOrder.order_number,
                    tracking_code: updatedOrder.tracking_code,
                    tracking_url: updatedOrder.tracking_url,
                    status: updatedOrder.status,
                    carrier: updatedOrder.carrier
                }
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('Fatal error:', error)
        return new Response(
            JSON.stringify({
                error: 'Erro interno do servidor',
                details: error.message
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
