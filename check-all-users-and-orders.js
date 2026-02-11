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

async function checkAllUsersAndOrders() {
  console.log('=== VERIFICANDO TODOS OS USUÁRIOS ===\n')

  // Get all auth users
  const { data: { users } } = await supabase.auth.admin.listUsers()

  console.log(`Total de usuários no auth.users: ${users.length}\n`)

  for (const user of users) {
    console.log('---')
    console.log('Email:', user.email)
    console.log('ID:', user.id)
    console.log('Nome:', user.user_metadata?.name || '-')

    // Check user_approvals
    const { data: approval } = await supabase
      .from('user_approvals')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('user_approvals:', approval ? `✅ ${approval.approval_status}` : '❌ Não existe')

    // Check user_roles
    const { data: role } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('user_roles:', role ? `✅ ${role.role}` : '❌ Não existe')

    // Check orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, total, created_at')
      .eq('user_id', user.id)

    console.log('Pedidos:', orders?.length || 0)
    if (orders && orders.length > 0) {
      const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0)
      console.log(`  Total gasto: R$ ${totalSpent.toFixed(2)}`)
      console.log(`  Status dos pedidos:`, orders.map(o => o.status).join(', '))
    }
    console.log('')
  }

  // Check top customers
  console.log('\n=== TOP CLIENTES (calculado) ===\n')

  const { data: allOrders } = await supabase
    .from('orders')
    .select('user_id, total, status')
    .in('status', ['paid', 'shipped', 'delivered'])

  if (allOrders && allOrders.length > 0) {
    const customerTotals = {}
    allOrders.forEach(order => {
      if (!customerTotals[order.user_id]) {
        customerTotals[order.user_id] = 0
      }
      customerTotals[order.user_id] += order.total || 0
    })

    const topCustomers = Object.entries(customerTotals)
      .map(([userId, total]) => ({ userId, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    for (const customer of topCustomers) {
      const user = users.find(u => u.id === customer.userId)
      console.log(`${user?.email || customer.userId}: R$ ${customer.total.toFixed(2)}`)
    }
  } else {
    console.log('Nenhum pedido pago encontrado')
  }
}

checkAllUsersAndOrders().catch(console.error)
