import { createClient } from '@supabase/supabase-js'

// Using anon key to simulate the frontend behavior
const supabase = createClient(
  'https://rrgrkbjmoezpesqnjilk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjU2OTMsImV4cCI6MjA4NTE0MTY5M30.C9TEOaHumFN3lob33wUYEB_68SNmRplQlIyjmAir_ns'
)

async function testApproval() {
  console.log('Testando aprovação da Beatriz...\n')

  const beatrizUserId = 'd1769113-a87f-47f6-8a0a-86c5b3054f7a'

  console.log('1. Verificando registro atual:')
  const { data: currentData, error: selectError } = await supabase
    .from('user_approvals')
    .select('*')
    .eq('user_id', beatrizUserId)
    .single()

  if (selectError) {
    console.error('Erro ao buscar:', selectError)
    return
  }

  console.log('Registro atual:', currentData)
  console.log('')

  console.log('2. Tentando atualizar para approved:')
  const { data: updateData, error: updateError } = await supabase
    .from('user_approvals')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString()
    })
    .eq('user_id', beatrizUserId)
    .select()

  if (updateError) {
    console.error('❌ ERRO ao atualizar:')
    console.error('Código:', updateError.code)
    console.error('Mensagem:', updateError.message)
    console.error('Detalhes:', updateError.details)
    console.error('Hint:', updateError.hint)
  } else {
    console.log('✅ Atualização bem-sucedida!')
    console.log('Dados atualizados:', updateData)
  }
}

testApproval().catch(console.error)
