
import fs from 'fs'
import path from 'path'

// iPag Credentials
const envPath = path.resolve('.env.local')
const envConfig = fs.readFileSync(envPath, 'utf8')
const env = {}
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) env[key.trim()] = value.trim()
})

const IPAG_API_ID = env.VITE_IPAG_API_ID
const IPAG_API_KEY = env.VITE_IPAG_API_KEY
const IPAG_API_URL = 'https://api.ipag.com.br/service/consult'

if (!IPAG_API_ID || !IPAG_API_KEY) {
    console.error('❌ Credenciais iPag não encontradas no .env.local')
    process.exit(1)
}

function parseXML(xml) {
    const result = {}
    const regex = /<([^>]+)>([^<]+)<\/\1>/g
    let match
    while ((match = regex.exec(xml)) !== null) {
        result[match[1]] = match[2]
    }
    return result
}

async function consultIpagByTid(tid) {
    console.log(`🔎 Consultando TID: ${tid} (v1 GET)...`)

    // Auth Basic
    const basicAuth = Buffer.from(`${IPAG_API_ID}:${IPAG_API_KEY}`).toString('base64')

    // Try v1 GET
    const url = `${IPAG_API_URL}?identificacao=${encodeURIComponent(IPAG_API_ID)}&transacao=${encodeURIComponent(tid)}`

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/json'
            }
        })
        const text = await response.text()
        console.log('📄 Raw Response (v1 GET):', text)
    } catch (e) {
        console.error('Error v1:', e)
    }

    console.log(`🔎 Consultando TID: ${tid} (v2)...`)
    const v2Url = `https://api.ipag.com.br/v2/transactions/${tid}`

    try {
        const response = await fetch(v2Url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/json',
                'x-api-version': '2'
            }
        })

        const text = await response.text()
        console.log('📄 Raw Response (v2):', text)
    } catch (error) {
        console.error(`❌ Erro v2:`, error.message)
    }
}

// Known good IDs from Step 2270
const numericId = '10838086'
const orderId = 'TEST-JSON-1769879843657' // Approximate from memory/log?
// Step 2270 log: "num_pedido": "TEST-JSON-176987" (Wait, log says "TEST-JSON-176987..." but let's check exact log)
// Log: "num_pedido": "TEST-JSON-176987" ... wait, the log truncated it?
// Code: `const orderId = \`TEST-JSON-\${Date.now()}\``
// The log output in Step 2270 was: `"num_pedido":"TEST-JSON-176987"` ... wait, `176987...`
// I'll try searching by partial matching or just trust Numeric ID for now.

// Test 1: Search by Numeric ID in 'transacao'
console.log(`\n🔎 Test 1: Consult by Numeric ID: ${numericId}...`)
await consultWithParams({ transacao: numericId })

// Test 2: Search by Order ID (prefix) in 'pedido'
console.log(`\n🔎 Test 2: Consult by Order ID: TEST-JSON...`)
await consultWithParams({ pedido: 'TEST-JSON-176' }) // Try prefix?
// iPag v1 uses exact match usually?

async function consultWithParams(paramsObj) {
    const params = new URLSearchParams()
    params.append('identificacao', IPAG_API_ID)
    for (const [k, v] of Object.entries(paramsObj)) params.append(k, v)

    // Auth Basic
    const basicAuth = Buffer.from(`${IPAG_API_ID}:${IPAG_API_KEY}`).toString('base64')

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
        console.log('📄 Response:', text)
    } catch (e) {
        console.error('Error:', e)
    }
}
