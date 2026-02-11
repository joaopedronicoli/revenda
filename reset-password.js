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

async function resetUserPassword() {
  const userId = 'd1769113-a87f-47f6-8a0a-86c5b3054f7a'
  const newPassword = 'Senha123!' // Senha temporária forte

  console.log('Resetando senha para o usuário bento_bias@outlook.com...')

  const { data, error } = await supabase.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  )

  if (error) {
    console.error('❌ Erro ao resetar senha:', error)
    return
  }

  console.log('✅ Senha resetada com sucesso!')
  console.log('\n📧 Informe ao cliente:')
  console.log('Email: bento_bias@outlook.com')
  console.log('Senha temporária: Senha123!')
  console.log('\nOriente o cliente a trocar a senha após o primeiro login.')
}

resetUserPassword().catch(console.error)
