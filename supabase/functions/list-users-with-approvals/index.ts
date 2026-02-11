import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get filter from query params
    const url = new URL(req.url)
    const filter = url.searchParams.get('filter') || 'all'

    // Create Supabase client with service_role privileges
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 1. Get user_approvals
    let query = supabaseAdmin
      .from('user_approvals')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter === 'pending') {
      query = query.eq('approval_status', 'pending')
    } else if (filter === 'approved') {
      query = query.eq('approval_status', 'approved')
    }

    const { data: approvals, error: appError } = await query

    if (appError) throw appError

    // 2. Get user_roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')

    if (rolesError) throw rolesError

    // 3. Get all users from auth.users
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) throw authError

    // 4. Combine all data
    const enrichedUsers = (approvals || []).map(approval => {
      const authUser = authUsers.find(u => u.id === approval.user_id)
      const userRole = roles?.find(r => r.user_id === approval.user_id)

      return {
        ...approval,
        email: authUser?.email || '-',
        full_name: authUser?.user_metadata?.name || '-',
        whatsapp: authUser?.user_metadata?.whatsapp || '-',
        cpf: authUser?.user_metadata?.cpf || '-',
        cnpj: authUser?.user_metadata?.cnpj || '-',
        user_roles: userRole ? { role: userRole.role } : null
      }
    })

    return new Response(
      JSON.stringify({ users: enrichedUsers }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
