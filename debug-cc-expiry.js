
import fs from 'fs'
import path from 'path'

// iPag Credentials from .env.local
const envPath = path.resolve('.env.local')
const envConfig = fs.readFileSync(envPath, 'utf8')
const env = {}
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) env[key.trim()] = value.trim()
})

const IPAG_API_ID = env.VITE_IPAG_API_ID
const IPAG_API_KEY = env.VITE_IPAG_API_KEY
const IPAG_API_URL = 'https://api.ipag.com.br/service/payment'

async function testPayment(yearFormat, yearValue, monthVal = '12') {
    console.log(`\n🔎 Testing Expiry: ${monthVal}/${yearValue} (Format: ${yearFormat})...`)

    // Auth Basic
    const basicAuth = Buffer.from(`${IPAG_API_ID}:${IPAG_API_KEY}`).toString('base64')

    const params = new URLSearchParams()
    params.append('identificacao', IPAG_API_ID)
    params.append('operacao', 'Pagamento')
    params.append('metodo', 'visa') // Test card is Visa usually
    params.append('valor', '5.00')
    params.append('numero_cartao', '4111111111111111') // Visa Test
    params.append('nome_portador', 'TEST USER')
    params.append('mes_validade_cartao', monthVal)
    params.append('ano_validade_cartao', yearValue)
    params.append('codigo_cvv', '123')
    params.append('parcelas', '1')
    params.append('pedido', `TEST-EXP-${Date.now()}`)
    params.append('email', 'test@example.com')
    params.append('retorno_tipo', 'json')

    try {
        const response = await fetch(IPAG_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: params
        })
        const text = await response.text()
        console.log(`📄 Response for ${yearValue}:`, text)
    } catch (e) {
        console.error('Error:', e)
    }
}

async function runTests() {
    console.log('--- Target URL: ' + IPAG_API_URL + ' ---')

    // Test 1: Valid Future Date (Should be DECLINED)
    await testPayment('YYYY-Future', '2029', '12')

    // Test 2: Past Date (Should be INVALID/EXPIRED)
    await testPayment('YYYY-Past', '2020', '01')

    // Test 3: Invalid Month (Should be INVALID DATA)
    await testPayment('YYYY-BadMonth', '2029', '15')
}

runTests()
