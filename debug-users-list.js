import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rrgrkbjmoezpesqnjilk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function debugUsersList() {
  console.log('Testando consulta do UsersManagement...\n')

  // 1. Get user_approvals
  console.log('1. Buscando user_approvals...')
  const { data: approvals, error: appError } = await supabase
    .from('user_approvals')
    .select('*')
    .order('created_at', { ascending: false })

  if (appError) {
    console.error('❌ Erro:', appError)
    return
  }

  console.log(`✅ Encontrados ${approvals?.length || 0} registros`)
  console.log('Approvals:', JSON.stringify(approvals, null, 2))

  // 2. Get user_roles
  console.log('\n2. Buscando user_roles...')
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id, role')

  if (rolesError) {
    console.error('❌ Erro:', rolesError)
    return
  }

  console.log(`✅ Encontrados ${roles?.length || 0} roles`)
  console.log('Roles:', JSON.stringify(roles, null, 2))

  // 3. Get auth users
  console.log('\n3. Buscando auth.users...')
  const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('❌ Erro:', authError)
    return
  }

  console.log(`✅ Encontrados ${authUsers?.length || 0} usuários`)

  // 4. Show combined data
  console.log('\n4. Dados combinados:')
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

  console.log(JSON.stringify(enrichedUsers, null, 2))
}

debugUsersList().catch(console.error)
