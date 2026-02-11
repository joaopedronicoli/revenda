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

const IPAG_API_URL = 'https://api.ipag.com.br/service'
const IPAG_API_ID = envVars.VITE_IPAG_API_ID
const IPAG_API_KEY = envVars.VITE_IPAG_API_KEY
const BASIC_AUTH = Buffer.from(`${IPAG_API_ID}:${IPAG_API_KEY}`).toString('base64')

console.log('🔐 Credenciais carregadas:')
console.log('   API_ID:', IPAG_API_ID)

// Orders from the database check previously
const testOrders = [
    { id: '0f796125-2609-48ca-9c01-2292ab6c9a1c', txId: '10830674' },
    { id: '713c69c8-xxxx-xxxx-xxxx-xxxxxxxxxxxx', txId: '10830671' } // Approximate from previous log if available, otherwise just use the first one
]

async function queryByOrderId(fullOrderId) {
    // iPag v1 uses truncated order ID (16 chars)
    const ipagOrderId = fullOrderId.substring(0, 16)

    console.log(`\n🔍 Consultando PEDIDO: ${ipagOrderId} (Original: ${fullOrderId})`)

    const url = `${IPAG_API_URL}/consult?identificacao=${encodeURIComponent(IPAG_API_ID)}&pedido=${ipagOrderId}`
    console.log('📡 URL:', url)

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${BASIC_AUTH}`,
                'Accept': 'application/xml'
            }
        })

        const text = await response.text()
        console.log(`📄 Status: ${response.status}`)
        console.log('📄 Body:', text.substring(0, 500)) // Print first 500 chars

    } catch (err) {
        console.error('❌ Erro:', err.message)
    }
}

async function run() {
    await queryByOrderId('0f796125-2609-48ca-9c01-2292ab6c9a1c')
}

run()
