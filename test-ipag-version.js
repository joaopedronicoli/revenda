// Script para testar qual versão da API iPag sua conta suporta
// Execute: node test-ipag-version.js

const IPAG_ID = process.env.IPAG_API_ID || 'SEU_ID_AQUI';
const IPAG_KEY = process.env.IPAG_API_KEY || 'SUA_KEY_AQUI';
const TEST_AMOUNT = '1.00';

// Criar Basic Auth
const basicAuth = Buffer.from(`${IPAG_ID}:${IPAG_KEY}`).toString('base64');

console.log('🔍 Testando API iPag...\n');
console.log(`ID: ${IPAG_ID.substring(0, 4)}...`);
console.log(`Key: ${IPAG_KEY.substring(0, 4)}...\n`);

// ============================================
// TESTE 1: API v2 (REST/JSON)
// ============================================
async function testV2() {
    console.log('📡 Testando API v2 (REST/JSON)...');

    const payload = {
        amount: TEST_AMOUNT,
        order_id: 'TEST' + Date.now(),
        customer: {
            name: 'Teste API',
            cpf_cnpj: '12345678900',
            email: 'teste@example.com'
        },
        payment: {
            type: 'pix',
            method: 'pix'
        }
    };

    try {
        const response = await fetch('https://api.ipag.com.br/payment', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/json',
                'x-api-version': '2'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(result, null, 2));

        if (response.ok) {
            console.log('✅ API v2 FUNCIONA!\n');
            return true;
        } else {
            console.log('❌ API v2 retornou erro\n');
            return false;
        }
    } catch (error) {
        console.log('❌ Erro ao testar v2:', error.message, '\n');
        return false;
    }
}

// ============================================
// TESTE 2: API v1 (XML/Form-data)
// ============================================
async function testV1() {
    console.log('📡 Testando API v1 (XML)...');

    // v1 usa form-urlencoded
    const params = new URLSearchParams({
        identificacao: IPAG_ID,
        metodo: 'pix',
        operacao: 'Pagamento',
        pedido: 'TEST' + Date.now(),
        valor: TEST_AMOUNT,
        nome: 'Teste API',
        documento: '12345678900',
        email: 'teste@example.com',
        fone: '11999999999',
        endereco: 'Rua Teste',
        numero_endereco: '123',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01234567',
        retorno_tipo: 'XML',
        url_retorno: 'https://example.com/callback'
    });

    try {
        const response = await fetch('https://api.ipag.com.br/service/payment', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/xml',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        const result = await response.text();

        console.log(`Status: ${response.status}`);
        console.log('Response:', result.substring(0, 500));

        if (response.ok) {
            console.log('✅ API v1 FUNCIONA!\n');
            return true;
        } else {
            console.log('❌ API v1 retornou erro\n');
            return false;
        }
    } catch (error) {
        console.log('❌ Erro ao testar v1:', error.message, '\n');
        return false;
    }
}

// ============================================
// Executar testes
// ============================================
async function runTests() {
    const v2Works = await testV2();
    const v1Works = await testV1();

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESULTADO:');
    console.log('='.repeat(50));

    if (v2Works && v1Works) {
        console.log('✅ Sua conta tem acesso a AMBAS versões (v1 e v2)');
        console.log('💡 Recomendação: Use v2 (mais moderna)');
    } else if (v2Works) {
        console.log('✅ Sua conta tem acesso apenas à v2');
        console.log('💡 Recomendação: Continue usando v2');
    } else if (v1Works) {
        console.log('✅ Sua conta tem acesso apenas à v1');
        console.log('💡 Recomendação: Migre para v1 (XML)');
    } else {
        console.log('❌ Nenhuma versão funcionou!');
        console.log('🔧 Possíveis problemas:');
        console.log('   - Credenciais incorretas');
        console.log('   - Conta não ativada');
        console.log('   - Ambiente sandbox vs produção');
    }
    console.log('='.repeat(50));
}

runTests();
