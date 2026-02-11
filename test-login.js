import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rrgrkbjmoezpesqnjilk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjU2OTMsImV4cCI6MjA4NTE0MTY5M30.C9TEOaHumFN3lob33wUYEB_68SNmRplQlIyjmAir_ns'
)

async function testLogin() {
  console.log('Testando login com a nova senha...\n')

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'bento_bias@outlook.com',
    password: 'Senha123!'
  })

  if (error) {
    console.error('❌ Login falhou:', error.message)
    return
  }

  console.log('✅ LOGIN BEM-SUCEDIDO!')
  console.log('\nDados do usuário:')
  console.log('ID:', data.user.id)
  console.log('Email:', data.user.email)
  console.log('Email confirmado:', data.user.email_confirmed_at ? 'SIM' : 'NÃO')
  console.log('\nToken de acesso gerado:', data.session.access_token.substring(0, 50) + '...')
}

testLogin().catch(console.error)
