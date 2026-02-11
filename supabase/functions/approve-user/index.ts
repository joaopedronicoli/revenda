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
        const { userId, action } = await req.json()

        if (!userId || !action) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing userId or action'
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

        // Atualizar ou criar registro de aprovação
        const { data, error } = await supabaseAdmin
            .from('user_approvals')
            .upsert({
                user_id: userId,
                approval_status: action === 'approve' ? 'approved' : 'rejected',
                approved_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select()

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
            userId,
            approvalStatus: action === 'approve' ? 'approved' : 'rejected',
            message: `Usuário ${action === 'approve' ? 'aprovado' : 'rejeitado'} com sucesso`
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
