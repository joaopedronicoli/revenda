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

async function checkApprovals() {
  console.log('Checando user_approvals...\n')

  // Get all user_approvals
  const { data: approvals, error } = await supabase
    .from('user_approvals')
    .select('*')

  if (error) {
    console.error('Erro:', error)
    return
  }

  console.log(`Total de registros em user_approvals: ${approvals?.length || 0}\n`)

  if (approvals && approvals.length > 0) {
    for (const approval of approvals) {
      console.log('---')
      console.log('user_id:', approval.user_id)
      console.log('approval_status:', approval.approval_status)
      console.log('created_at:', approval.created_at)

      // Get user data from auth.users
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const user = users.find(u => u.id === approval.user_id)

      if (user) {
        console.log('Email:', user.email)
        console.log('Nome:', user.user_metadata?.name)
        console.log('WhatsApp:', user.user_metadata?.whatsapp)
        console.log('CPF:', user.user_metadata?.cpf)
      } else {
        console.log('❌ Usuário não encontrado no auth.users')
      }
      console.log('')
    }
  }
}

checkApprovals().catch(console.error)
