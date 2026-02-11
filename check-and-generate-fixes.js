import fs from 'fs'

// IDs coletados do Supabase
const pendingOrderIds = [
    'ffb91a3d-098e-4ffd-b9cb-6000e1c06eb1',
    'be6d2e32-3cc6-480e-a437-5b697d9d67fe',
    'b24b407b-77bc-48a3-90f1-f38a5119fec9',
    'a1c0df28-4922-4c4c-a317-6eeeafe93aa0',
    '22fce46f-8e8d-45ae-89dc-3d1f38f4a460',
    'fefbe62b-e210-4735-be42-88b83cc09b28',
    'e6d3cc5e-63b1-429f-ad5e-aa0b971cc213'
]

// Configuração iPag
const IPAG_API_URL = 'https://api.ipag.com.br/service'
const IPAG_API_ID = 'contato@patriciaelias.com.br'
const IPAG_API_KEY = '266C-AFC941C4-A7FC6FA1-2A1C78A7-0D35'
const BASIC_AUTH = Buffer.from(`${IPAG_API_ID}:${IPAG_API_KEY}`).toString('base64')

// Parser XML simples
function parseXML(xmlString) {
    const result = {}
    const tagRegex = /<([^><\/]+)>([^<]*)<\/\1>/g
    let match
    while ((match = tagRegex.exec(xmlString)) !== null) {
        result[match[1]] = match[2]
    }
    return result
}

// Mapa de Status
function mapStatus(ipagStatus) {
    const s = (ipagStatus || '').toLowerCase()
    if (['approved', 'capturado', 'succeeded', 'pago', 'sucesso', '3'].some(k => s.includes(k))) return 'paid'
    if (['canceled', 'denied', 'recusado', 'cancelado', 'falha', '4', '5', '7'].some(k => s.includes(k))) return 'canceled'
    return 'pending'
}

async function checkOrder(fullId) {
    const shortId = fullId.substring(0, 16)
    const url = `${IPAG_API_URL}/consult?identificacao=${encodeURIComponent(IPAG_API_ID)}&pedido=${shortId}`

    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Basic ${BASIC_AUTH}`,
                'Accept': 'application/xml'
            }
        })

        const text = await res.text()

        if (!res.ok || text.includes('<error>')) {
            return { found: false, id: fullId, error: text }
        }

        const data = parseXML(text)

        // Sucesso se tiver id_transacao ou mensagem de transacao
        if (data.id_transacao) {
            return { found: true, id: fullId, data }
        }

        return { found: false, id: fullId, error: 'No transaction ID in response' }

    } catch (e) {
        return { found: false, id: fullId, error: e.message }
    }
}

async function run() {
    console.log('🔍 Iniciando verificação de pedidos pendentes...\n')

    const updates = []

    for (const id of pendingOrderIds) {
        process.stdout.write(`Checking ${id.substring(0, 8)}... `)
        const result = await checkOrder(id)

        if (result.found) {
            console.log(`✅ ENCONTRADO! Status iPag: ${result.data.mensagem_transacao}`)

            const newStatus = mapStatus(result.data.mensagem_transacao)
            const ipagStatus = (result.data.mensagem_transacao || '').toLowerCase()
            const txId = result.data.id_transacao

            const sql = `UPDATE orders SET status = '${newStatus}', ipag_status = '${ipagStatus}', ipag_transaction_id = '${txId}', updated_at = NOW() WHERE id = '${id}';`
            updates.push(sql)

        } else {
            console.log(`❌ Não encontrado (provavelmente sandbox ou falha na criação)`)
        }

        await new Promise(r => setTimeout(r, 500)) // Throttle
    }

    console.log('\n' + '='.repeat(50))
    console.log('📝 SQL PARA ATUALIZAÇÃO (Copie e rode no Supabase):')
    console.log('='.repeat(50))

    if (updates.length > 0) {
        console.log(updates.join('\n'))
    } else {
        console.log('-- Nadenhum pedido encontrado no iPag Produção --')
    }
    console.log('='.repeat(50))
}

run()
