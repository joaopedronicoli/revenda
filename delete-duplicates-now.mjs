import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load env
const env = readFileSync('.env.local', 'utf-8')
const envVars = {}
env.split('\n').forEach(line => {
    const idx = line.indexOf('=')
    if (idx > 0) {
        envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
})

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY)

console.log('\n🔍 BUSCANDO PEDIDOS DUPLICADOS...\n')

const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, ipag_transaction_id, status, total, created_at')
    .order('created_at', { ascending: true })

if (error) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
}

console.log(`📊 Total de pedidos: ${orders.length}\n`)

// Group by order_number
const groups = {}
orders.forEach(o => {
    if (!o.order_number) return
    if (!groups[o.order_number]) groups[o.order_number] = []
    groups[o.order_number].push(o)
})

const duplicates = Object.entries(groups).filter(([_, list]) => list.length > 1)

console.log(`⚠️  Grupos duplicados: ${duplicates.length}\n`)

if (duplicates.length === 0) {
    console.log('✅ NENHUM DUPLICADO!\n')
    process.exit(0)
}

let totalDeleted = 0

for (const [orderNum, orderList] of duplicates) {
    console.log(`\n📦 ${orderNum} (${orderList.length} pedidos)`)

    const withTxn = orderList.filter(o => o.ipag_transaction_id)
    const withoutTxn = orderList.filter(o => !o.ipag_transaction_id)

    console.log(`   ✅ COM iPag: ${withTxn.length}`)
    withTxn.forEach(o => {
        console.log(`      ${o.id.substring(0, 8)} | ${o.ipag_transaction_id} | ${o.status}`)
    })

    console.log(`   ❌ SEM iPag: ${withoutTxn.length} (DELETAR)`)

    for (const order of withoutTxn) {
        console.log(`\n      🗑️  Deletando ${order.id.substring(0, 8)}...`)

        const { error: delError } = await supabase
            .from('orders')
            .delete()
            .eq('id', order.id)

        if (delError) {
            console.log(`      ❌ ERRO: ${delError.message}`)
        } else {
            console.log(`      ✅ DELETADO!`)
            totalDeleted++
        }
    }
}

console.log(`\n${'='.repeat(60)}`)
console.log(`✅ TOTAL DELETADO: ${totalDeleted} pedidos`)
console.log('='.repeat(60) + '\n')
