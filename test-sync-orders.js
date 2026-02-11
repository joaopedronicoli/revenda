import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Load .env.local file manually
const envContent = fs.readFileSync('.env.local', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
        envVars[match[1].trim()] = match[2].trim()
    }
})

const supabase = createClient(
    envVars.VITE_SUPABASE_URL,
    envVars.VITE_SUPABASE_ANON_KEY
)

const IPAG_API_URL = 'https://api.ipag.com.br/service'
const IPAG_API_ID = envVars.VITE_IPAG_API_ID
const IPAG_API_KEY = envVars.VITE_IPAG_API_KEY

// Basic Auth para iPag
const basicAuth = Buffer.from(`${IPAG_API_ID}:${IPAG_API_KEY}`).toString('base64')

// Parser XML simples
function parseXML(xmlString) {
    const result = {}

    // Extract simple tags
    const tagRegex = /<([^><\/]+)>([^<]*)<\/\1>/g
    let match

    while ((match = tagRegex.exec(xmlString)) !== null) {
        const tagName = match[1]
        const value = match[2]
        result[tagName] = value
    }

    return result
}

async function consultarTransacaoiPag(transactionId) {
    try {
        console.log(`\n🔍 Consultando transação ${transactionId} no iPag...`)

        const response = await fetch(`${IPAG_API_URL}/consult?identificacao=${IPAG_API_ID}&transacao=${transactionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/xml'
            }
        })

        const xmlText = await response.text()
        console.log('📄 Response XML:', xmlText)

        if (!response.ok) {
            console.error('❌ Erro na API do iPag:', xmlText)
            return null
        }

        const data = parseXML(xmlText)
        console.log('✅ Dados parseados:', data)

        return data
    } catch (error) {
        console.error('❌ Erro ao consultar iPag:', error)
        return null
    }
}

async function atualizarPedido(orderId, ipagData) {
    try {
        console.log(`\n📝 Atualizando pedido ${orderId}...`)

        // Map iPag status to our status
        const ipagStatusRaw = ipagData.mensagem_transacao || ipagData.status || ''
        const ipagStatus = ipagStatusRaw.toLowerCase()

        let status = 'pending'
        if (['approved', 'capturado', 'succeeded', 'pago', 'sucesso', '3'].some(s => ipagStatus.includes(s))) {
            status = 'paid'
        } else if (['canceled', 'denied', 'recusado', 'cancelado', 'falha', '4', '5', '7'].some(s => ipagStatus.includes(s))) {
            status = 'canceled'
        }

        const updateData = {
            ipag_status: ipagStatus,
            status: status,
            updated_at: new Date().toISOString()
        }

        // Add additional iPag fields if they exist
        if (ipagData.valor) updateData.amount = parseFloat(ipagData.valor) * 100
        if (ipagData.metodo) updateData.payment_method = ipagData.metodo

        console.log('📦 Dados para atualizar:', updateData)

        const { data, error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .select()
            .single()

        if (error) {
            console.error('❌ Erro ao atualizar pedido:', error)
            return false
        }

        console.log('✅ Pedido atualizado com sucesso!')
        return true
    } catch (error) {
        console.error('❌ Erro ao atualizar pedido:', error)
        return false
    }
}

async function sincronizarTodosOsPedidos() {
    try {
        console.log('🚀 Iniciando sincronização de pedidos...\n')

        // Buscar todos os pedidos
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('❌ Erro ao buscar pedidos:', error)
            return
        }

        console.log(`📊 Total de pedidos encontrados: ${orders.length}\n`)
        console.log('='.repeat(80))

        let atualizados = 0
        let comErro = 0
        let semTransacao = 0

        for (const order of orders) {
            console.log(`\n📦 Pedido: ${order.id}`)
            console.log(`   Status: ${order.status}`)
            console.log(`   iPag Transaction ID: ${order.ipag_transaction_id || 'N/A'}`)
            console.log(`   iPag Status: ${order.ipag_status || 'N/A'}`)
            console.log(`   Created: ${order.created_at}`)

            if (!order.ipag_transaction_id) {
                console.log('⚠️  Pedido sem transaction_id do iPag - Pulando')
                semTransacao++
                continue
            }

            // Consultar no iPag
            const ipagData = await consultarTransacaoiPag(order.ipag_transaction_id)

            if (!ipagData) {
                console.log('❌ Não foi possível obter dados do iPag')
                comErro++
                continue
            }

            // Atualizar pedido
            const sucesso = await atualizarPedido(order.id, ipagData)
            if (sucesso) {
                atualizados++
            } else {
                comErro++
            }

            // Aguardar um pouco entre requisições para não sobrecarregar a API
            await new Promise(resolve => setTimeout(resolve, 1000))
        }

        console.log('\n' + '='.repeat(80))
        console.log('\n📊 RESUMO DA SINCRONIZAÇÃO:')
        console.log(`   ✅ Pedidos atualizados: ${atualizados}`)
        console.log(`   ❌ Com erro: ${comErro}`)
        console.log(`   ⚠️  Sem transaction_id: ${semTransacao}`)
        console.log(`   📦 Total processado: ${orders.length}`)

    } catch (error) {
        console.error('❌ Erro fatal:', error)
    }
}

// Executar sincronização
sincronizarTodosOsPedidos()
