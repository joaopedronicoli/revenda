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

async function compareUsers() {
  const emails = ['luis@patriciaelias.com.br', 'bento_bias@outlook.com']

  for (const email of emails) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`USUÁRIO: ${email}`)
    console.log('='.repeat(60))

    // 1. Buscar usuário
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      console.log('❌ Usuário não encontrado')
      continue
    }

    console.log('\n📧 DADOS DO AUTH.USERS:')
    console.log('ID:', user.id)
    console.log('Email:', user.email)
    console.log('Email confirmado:', user.email_confirmed_at ? 'SIM' : 'NÃO')
    console.log('Criado em:', user.created_at)
    console.log('\n📝 USER METADATA (auth.users.user_metadata):')
    console.log(JSON.stringify(user.user_metadata, null, 2))

    // 2. Verificar user_approvals
    const { data: approval } = await supabase
      .from('user_approvals')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('\n✅ USER_APPROVALS:')
    if (approval) {
      console.log('Status:', approval.approval_status)
      console.log('Criado em:', approval.created_at)
    } else {
      console.log('❌ Não existe')
    }

    // 3. Verificar user_roles
    const { data: role } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('\n👤 USER_ROLES:')
    if (role) {
      console.log('Role:', role.role)
      console.log('Criado em:', role.created_at)
    } else {
      console.log('❌ Não existe')
    }

    // 4. Verificar endereços
    const { data: addresses } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)

    console.log('\n📍 ADDRESSES:')
    if (addresses && addresses.length > 0) {
      addresses.forEach((addr, idx) => {
        console.log(`\nEndereço ${idx + 1}:`)
        console.log('  Nickname:', addr.nickname)
        console.log('  CEP:', addr.cep)
        console.log('  Rua:', addr.street)
        console.log('  Número:', addr.number)
        console.log('  Bairro:', addr.neighborhood)
        console.log('  Cidade:', addr.city)
        console.log('  Estado:', addr.state)
        console.log('  Padrão:', addr.is_default ? 'SIM' : 'NÃO')
        console.log('  Criado em:', addr.created_at)
      })
    } else {
      console.log('❌ Nenhum endereço cadastrado')
    }
  }
}

compareUsers().catch(console.error)
