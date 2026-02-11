import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rrgrkbjmoezpesqnjilk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'
)

async function addAddressToBento() {
  const userId = 'd1769113-a87f-47f6-8a0a-86c5b3054f7a' // bento_bias@outlook.com

  // Dados fictícios - você pode pedir para a usuária atualizar depois
  const address = {
    user_id: userId,
    nickname: 'Endereço Principal',
    cep: '00000-000',
    street: 'Rua Exemplo',
    number: '123',
    complement: '',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    is_default: true
  }

  console.log('Adicionando endereço padrão para Beatriz...')

  const { data, error } = await supabase
    .from('addresses')
    .insert([address])
    .select()

  if (error) {
    console.error('❌ Erro:', error)
    return
  }

  console.log('✅ Endereço adicionado com sucesso!')
  console.log(data)
  console.log('\n📝 A usuária pode atualizar o endereço no perfil depois.')
}

addAddressToBento().catch(console.error)
