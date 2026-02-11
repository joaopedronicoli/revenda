import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rrgrkbjmoezpesqnjilk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'
)

async function createApprovalsForAdmins() {
  console.log('Criando registros de aprovação para administradores...\n')

  const admins = [
    { id: '88dacc08-6391-4df6-a8c1-9e577d52a24f', email: 'joao@patriciaelias.com.br' },
    { id: 'a8277a4d-3ab0-406d-80e9-402bebece0e4', email: 'luis@patriciaelias.com.br' }
  ]

  for (const admin of admins) {
    console.log(`Criando aprovação para ${admin.email}...`)

    const { data, error } = await supabase
      .from('user_approvals')
      .upsert([{
        user_id: admin.id,
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: admin.id, // auto-aprovado
      }], {
        onConflict: 'user_id'
      })
      .select()

    if (error) {
      console.error('❌ Erro:', error)
    } else {
      console.log('✅ Criado com sucesso!')
    }
  }

  console.log('\n✅ Todos os administradores agora têm registro de aprovação!')
}

createApprovalsForAdmins().catch(console.error)
