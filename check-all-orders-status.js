
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Manually load env
const envPath = path.resolve('.env.local')
const envConfig = fs.readFileSync(envPath, 'utf8')
const env = {}
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
        env[key.trim()] = value.trim()
    }
})

// Need Service Role to see all data (bypassing RLS if any issues, but here using anon to mimic frontend view)
// Ideally we should use Service Role but we don't have it easily in env.local. 
// Assuming Anon has read access to own orders or public orders table policy allowing this script?
// Actually, earlier check-latest-order failed with anon key because of RLS? 
// No, it returned "No orders found". That implies RLS is filtering them out because the script isn't logged in as a user.
// I need the SERVICE_ROLE_KEY to check ALL orders. The user said "database do supabase", implying global state.

// Let's try to read keys from sync-orders Function where I saw them being used or .env.production?
// I viewed .env.production earlier (Step 2329) but it had hashed keys? No, it had cleartext keys.
// Wait, Step 2329 shows VITE_SUPABASE_ANON_KEY.
// I need SERVICE_KEY. It's usually in .env or I can't run this script locally with full access unless I have it.
// The user has `supabase secrets set` so it's in the cloud.
// Locally, I might be limited. 

// Alternative: Create a SQL query file and run it via `npx supabase db query`? No, I don't have that tool configured fully (docker not running).
// Wait, I have `setup-database.js` which might have the key?
// Let's check `test-supabase.js`.

// Just use the credentials available. If it fails, I will explain to the user I validated the *mechanism* but cannot scan the full prod DB from local without admin keys.
// BUT, I can try to use the key from .env (local dev) if the user is running local instance? No, they are on production Supabase.
// I will try to use the Anon key, but if RLS blocks, I can't check *everything*.

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAllOrders() {
    console.log('🔍 Auditando Pedidos...')

    // Attempt to fetch all orders
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100) // Start with 100 to check

    if (error) {
        console.error('❌ Erro de acesso (RLS provável):', error.message)
        console.log('⚠️ Sem a chave mestra (Service Role), não consigo listar todos os pedidos de todos os clientes.')
        return
    }

    if (!orders || orders.length === 0) {
        console.log('⚠️ Nenhum pedido visível com a chave atual.')
        return
    }

    let total = orders.length
    let complete = 0
    let missingId = 0
    let pending = 0
    let paid = 0

    orders.forEach(o => {
        const hasId = o.ipag_transaction_id && o.ipag_transaction_id.length > 5;
        const isPaid = o.status === 'paid';

        if (hasId) complete++;
        else missingId++;

        if (isPaid) paid++;
        else pending++;
    })

    console.log(`📊 Relatório (Últimos ${total} pedidos acessíveis):`)
    console.log(`✅ Com ID Transação: ${complete}`)
    console.log(`⚠️ Sem ID Transação: ${missingId}`)
    console.log(`💰 Pagos:            ${paid}`)
    console.log(`⏳ Pendentes:        ${pending}`)

    // Show sample details
    const sample = orders.find(o => o.ipag_transaction_id)
    if (sample) {
        console.log('\nExemplo de pedido completo:')
        console.log(`ID: ${sample.id} | iPag ID: ${sample.ipag_transaction_id} | Status: ${sample.status}`)
    }
}

checkAllOrders()
