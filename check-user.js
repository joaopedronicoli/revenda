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

async function checkUser() {
  const email = 'bento_bias@outlook.com'

  console.log('Verificando usuário:', email)

  // 1. Verificar na tabela auth.users (usando admin API)
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('Erro ao listar usuários:', listError)
    return
  }

  const user = users.find(u => u.email === email)

  if (!user) {
    console.log('❌ Usuário NÃO encontrado no banco de dados')
    return
  }

  console.log('\n✅ Usuário encontrado:')
  console.log('ID:', user.id)
  console.log('Email:', user.email)
  console.log('Email confirmado:', user.email_confirmed_at ? '✅ SIM' : '❌ NÃO')
  console.log('Criado em:', user.created_at)
  console.log('Última atualização:', user.updated_at)
  console.log('Banned:', user.banned_until ? 'SIM' : 'NÃO')

  // 2. Verificar na tabela user_approvals
  const { data: approval, error: approvalError } = await supabase
    .from('user_approvals')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (approvalError) {
    console.log('\n⚠️  Não encontrado em user_approvals:', approvalError.message)
  } else {
    console.log('\n📋 Status de aprovação:')
    console.log('Status:', approval.approval_status)
    console.log('Aprovado por:', approval.approved_by || 'Ninguém')
    console.log('Aprovado em:', approval.approved_at || 'N/A')
  }

  // 3. Verificar na tabela user_roles
  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (roleError) {
    console.log('\n⚠️  Não encontrado em user_roles:', roleError.message)
  } else {
    console.log('\n👤 Role do usuário:')
    console.log('Role:', role.role)
  }

  // 4. Verificar endereço
  const { data: addresses, error: addressError } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)

  if (addressError) {
    console.log('\n⚠️  Erro ao buscar endereços:', addressError.message)
  } else {
    console.log('\n📍 Endereços cadastrados:', addresses.length)
    addresses.forEach(addr => {
      console.log(`  - ${addr.nickname}: ${addr.street}, ${addr.number} - ${addr.city}/${addr.state}`)
    })
  }

  // 5. Testar login
  console.log('\n🔐 Tentando fazer login...')
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: email,
    password: 'senha_teste_123' // Se souber a senha correta, coloque aqui
  })

  if (loginError) {
    console.log('❌ Erro no login:', loginError.message)
    if (loginError.message.includes('Email not confirmed')) {
      console.log('   → Email ainda não foi confirmado')
    } else if (loginError.message.includes('Invalid login credentials')) {
      console.log('   → Senha incorreta ou usuário não existe no sistema de auth')
    }
  } else {
    console.log('✅ Login bem-sucedido!')
  }
}

checkUser().catch(console.error)
