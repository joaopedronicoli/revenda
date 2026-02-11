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

async function createTestTransaction() {
    console.log('\n🚀 Criando transação de teste (PIX R$ 1,00)...')

    const payload = {
        identificacao: IPAG_API_ID,
        operacao: 'Pagamento',
        pedido: `TEST-${Date.now()}`.substring(0, 16), // Max 16 chars
        valor: '1.00',
        nome: 'Teste Sistema',
        email: 'teste@exemplo.com.br',
        metodo: 'pix',
        boleto_tipo: 'XML' // iPag v1 legacy requirement usually
    }

    // Convert to x-www-form-urlencoded
    const formBody = Object.keys(payload)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(payload[key]))
        .join('&')

    try {
        const response = await fetch(`${IPAG_API_URL}/payment`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${BASIC_AUTH}`,
                'Accept': 'application/xml',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formBody
        })

        const text = await response.text()
        console.log(`📄 Status: ${response.status}`)
        console.log('📄 Body:', text)

    } catch (err) {
        console.error('❌ Erro:', err.message)
    }
}

createTestTransaction()
