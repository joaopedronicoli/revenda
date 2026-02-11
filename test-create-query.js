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

async function queryOrder(orderId) {
    console.log(`\n🔍 Consultando PEDIDO: ${orderId}`)

    const url = `${IPAG_API_URL}/consult?identificacao=${encodeURIComponent(IPAG_API_ID)}&pedido=${encodeURIComponent(orderId)}`
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
        console.log('📄 Body:', text)

    } catch (err) {
        console.error('❌ Erro:', err.message)
    }
}

// ID do pedido criado no passo anterior (extraído do log visual ou output)
// No log anterior apareceu: Pedido TEST-17698759000
// ATENÇÃO: Se o código rodou novamente, o timestamp mudou.
// Vou usar um valor fixo se possível, ou passar como argumento.
// No passo anterior o script gerou `TEST-${Date.now()}`.
// Como não capturei o output dinâmico, vou tentar criar um NOVO pedido e consultar Imediatamente.

async function createAndQuery() {
    const orderId = `TEST-SYNC-${Date.now()}`.substring(0, 16)
    const payload = {
        identificacao: IPAG_API_ID,
        operacao: 'Pagamento',
        pedido: orderId,
        valor: '1.00',
        nome: 'Teste Query',
        email: 'teste@exemplo.com.br',
        metodo: 'pix',
        boleto_tipo: 'XML'
    }

    // 1. CREATE
    console.log(`\n🚀 1. Criando pedido ${orderId}...`)
    const formBody = Object.keys(payload)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(payload[key]))
        .join('&')

    await fetch(`${IPAG_API_URL}/payment`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${BASIC_AUTH}`,
            'Accept': 'application/xml',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formBody
    })

    // Esperar um pouco
    console.log('⏳ Aguardando 3 segundos...')
    await new Promise(r => setTimeout(r, 3000))

    // 2. QUERY
    console.log(`\n🚀 2. Consultando pedido ${orderId}...`)
    await queryOrder(orderId)
}

createAndQuery()
