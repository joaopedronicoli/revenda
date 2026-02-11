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

async function createTestTransactionJSON() {
    const orderId = `TEST-JSON-${Date.now()}`.substring(0, 16)
    console.log(`\n🚀 Criando transação de teste (JSON) - Pedido: ${orderId}...`)

    const payload = {
        identificacao: IPAG_API_ID,
        operacao: 'Pagamento',
        pedido: orderId,
        valor: '1.00',
        nome: 'Teste JSON',
        email: 'teste@exemplo.com.br',
        metodo: 'pix',
        boleto_tipo: 'JSON', // Tentando variação
        retorno_tipo: 'json' // Solicitando retorno JSON explícito
    }

    const formBody = Object.keys(payload)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(payload[key]))
        .join('&')

    try {
        const response = await fetch(`${IPAG_API_URL}/payment`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${BASIC_AUTH}`,
                'Accept': 'application/json', // Header JSON
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formBody
        })

        console.log(`📄 Status Code: ${response.status}`)
        const text = await response.text()
        console.log('📄 Body:', text)

        try {
            const json = JSON.parse(text)
            console.log('✅ JSON Parseado com sucesso:', json)
            if (json.id_transacao) {
                console.log('🎉 ID Transação recebido:', json.id_transacao)
            }
        } catch (e) {
            console.log('⚠️  Resposta não é JSON válido')
        }

    } catch (err) {
        console.error('❌ Erro:', err.message)
    }
}

createTestTransactionJSON()
