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

console.log('🔐 Credenciais carregadas:')
console.log('   API_ID:', IPAG_API_ID)
console.log('   API_KEY:', IPAG_API_KEY ? '***' + IPAG_API_KEY.slice(-4) : 'NÃO ENCONTRADA')

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

        const url = `${IPAG_API_URL}/consult?identificacao=${encodeURIComponent(IPAG_API_ID)}&transacao=${transactionId}`
        console.log('📡 URL:', url)

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/xml'
            }
        })

        const xmlText = await response.text()
        console.log('📄 Response Status:', response.status)
        console.log('📄 Response XML:', xmlText)

        if (!response.ok) {
            console.error('❌ Erro na API do iPag')
            return null
        }

        const data = parseXML(xmlText)
        console.log('✅ Dados parseados:', JSON.stringify(data, null, 2))

        return data
    } catch (error) {
        console.error('❌ Erro ao consultar iPag:', error)
        return null
    }
}

// Testar com as transaction IDs que vimos no banco
const testTransactionIds = ['10830674', '10830671']

async function testarConsultas() {
    console.log('\n🚀 Testando consultas ao iPag...\n')
    console.log('='.repeat(80))

    for (const txId of testTransactionIds) {
        await consultarTransacaoiPag(txId)
        console.log('\n' + '='.repeat(80))

        // Aguardar entre requisições
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log('\n✅ Testes concluídos!')
}

// Executar testes
testarConsultas()
