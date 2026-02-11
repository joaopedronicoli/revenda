import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rrgrkbjmoezpesqnjilk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'
)

async function setLuisAsAdmin() {
  const userId = 'a8277a4d-3ab0-406d-80e9-402bebece0e4' // luis@patriciaelias.com.br

  console.log('Definindo Luis como administrador...')

  const { data, error } = await supabase
    .from('user_roles')
    .upsert([{
      user_id: userId,
      role: 'administrator'
    }], {
      onConflict: 'user_id'
    })
    .select()

  if (error) {
    console.error('❌ Erro:', error)
    return
  }

  console.log('✅ Luis agora é administrador!')
  console.log(data)
}

setLuisAsAdmin().catch(console.error)
