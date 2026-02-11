
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Configuration
const SUPABASE_URL = 'https://rrgrkbjmoezpesqnjilk.supabase.co'
// Service Role Key needed for bypass
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3JrYmptb2V6cGVzcW5qaWxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU2NTY5MywiZXhwIjoyMDg1MTQxNjkzfQ.LSlYspAEayf7Epf5i1EtORvOP-_pVXTv5fZAqUVYGA4'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

const ORDER_ID = 'ddcc09a2-2cdc-4078-8de7-d37697f768cb'
const IPAG_TID = '41162601312204189362' // From user screenshot

async function forceUpdate() {
    console.log(`🚀 Forçando atualização do pedido ${ORDER_ID}...`)

    const { error } = await supabase
        .from('orders')
        .update({
            status: 'paid',
            ipag_status: 'captured', // 'capturado'
            ipag_transaction_id: IPAG_TID,
            updated_at: new Date().toISOString()
        })
        .eq('id', ORDER_ID)

    if (error) {
        console.error('❌ Erro:', error)
    } else {
        console.log('✅ Pedido atualizado para PAID com sucesso!')
    }
}

forceUpdate()
