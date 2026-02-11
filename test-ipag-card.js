// Script para testar pagamento com Cartão via API v1 (XML)
// Execute: node test-ipag-card.js

const IPAG_ID = process.env.IPAG_API_ID || 'SEU_ID_AQUI';
const IPAG_KEY = process.env.IPAG_API_KEY || 'SUA_KEY_AQUI';
const TEST_AMOUNT = '5.00'; // Valor sugerido

// Criar Basic Auth
const basicAuth = Buffer.from(`${IPAG_ID}:${IPAG_KEY}`).toString('base64');

async function testCardPayment() {
    console.log('💳 Testando Pagamento via Cartão (API v1 XML)...');
    console.log(`Valor: R$ ${TEST_AMOUNT}`);

    // v1 usa form-urlencoded
    const params = new URLSearchParams({
        identificacao: IPAG_ID,
        metodo: 'visa', // Tentando direto a bandeira
        operacao: 'Pagamento',
        pedido: 'TEST_CARD_' + Date.now(),
        valor: TEST_AMOUNT,
        nome: 'Teste Cartao',
        documento: '12345678900',
        email: 'teste@example.com',

        // Dados do Cartão de Teste
        bandeira: 'visa',
        num_cartao: '4111111111111111',
        titular_cartao: 'TESTE APROVADO',
        mes_validade_cartao: '12',
        ano_validade_cartao: '2028',
        cod_seguranca_cartao: '123',
        parcelas: '1',

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
        console.log('Response:', result);

        if (response.ok && result.includes('<mensagem_transacao>APPROVED')) {
            console.log('✅ Pagamento via Cartão APROVADO!');
        } else {
            console.log('❌ Pagamento FALHOU ou não foi aprovado automaticamente');
        }
    } catch (error) {
        console.log('❌ Erro ao testar:', error.message);
    }
}

testCardPayment();
