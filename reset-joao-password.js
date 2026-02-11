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

async function resetJoaoPassword() {
  const email = 'joao@patriciaelias.com.br'
  const newPassword = 'Joao2026!'

  console.log(`Resetando senha para ${email}...`)

  // Find user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)

  if (!user) {
    console.error('❌ Usuário não encontrado')
    return
  }

  console.log('Usuário encontrado:', user.id)

  // Reset password
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  )

  if (error) {
    console.error('❌ Erro ao resetar senha:', error)
    return
  }

  console.log('✅ Senha resetada com sucesso!')
  console.log(`\nNova senha para ${email}: ${newPassword}`)
}

resetJoaoPassword().catch(console.error)
