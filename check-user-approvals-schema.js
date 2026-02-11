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

async function checkSchema() {
  console.log('Verificando estrutura da tabela user_approvals...\n')

  const { data, error } = await supabase
    .from('user_approvals')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Erro:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('Campos disponíveis:')
    console.log(Object.keys(data[0]))
    console.log('\nExemplo de registro:')
    console.log(JSON.stringify(data[0], null, 2))
  }
}

checkSchema().catch(console.error)
