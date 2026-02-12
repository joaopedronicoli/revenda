const axios = require('axios');

const MP_API_URL = 'https://api.mercadopago.com';

async function processCardPayment({ amount, orderId, cardData, customer, installments = 1, credentials }) {
    const accessToken = credentials.access_token;

    try {
        const payload = {
            transaction_amount: amount / 100,
            token: cardData.card_token,
            description: `Pedido ${orderId}`,
            installments: parseInt(installments) || 1,
            payment_method_id: cardData.payment_method_id || 'visa',
            payer: {
                email: customer.email,
                first_name: customer.name?.split(' ')[0] || '',
                last_name: customer.name?.split(' ').slice(1).join(' ') || '',
                identification: {
                    type: 'CPF',
                    number: (customer.cpf || '').replace(/\D/g, '')
                }
            },
            external_reference: orderId.toString(),
            notification_url: `${process.env.API_URL || 'https://revenda.pelg.com.br'}/webhooks/gateway/mercadopago`
        };

        const response = await axios.post(`${MP_API_URL}/v1/payments`, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `${orderId}-card-${Date.now()}`
            }
        });

        const data = response.data;
        const isApproved = data.status === 'approved';
        const isPending = data.status === 'in_process' || data.status === 'pending';

        return {
            success: true,
            status: isApproved ? 'approved' : (isPending ? 'pending' : 'rejected'),
            transaction_id: data.id?.toString(),
            message: data.status_detail || data.status,
            raw_response: data
        };
    } catch (error) {
        console.error('Mercado Pago Card Error:', error.response?.data || error.message);
        const mpError = error.response?.data;
        let errorMsg = 'Erro ao processar pagamento via Mercado Pago';
        if (mpError?.message) errorMsg = mpError.message;
        if (mpError?.cause?.[0]?.description) errorMsg = mpError.cause[0].description;
        throw new Error(errorMsg);
    }
}

async function generatePix({ amount, orderId, customer, credentials }) {
    const accessToken = credentials.access_token;

    try {
        const payload = {
            transaction_amount: amount / 100,
            description: `Pedido ${orderId}`,
            payment_method_id: 'pix',
            payer: {
                email: customer.email,
                first_name: customer.name?.split(' ')[0] || '',
                last_name: customer.name?.split(' ').slice(1).join(' ') || '',
                identification: {
                    type: 'CPF',
                    number: (customer.cpf || '').replace(/\D/g, '')
                }
            },
            external_reference: orderId.toString(),
            notification_url: `${process.env.API_URL || 'https://revenda.pelg.com.br'}/webhooks/gateway/mercadopago`
        };

        const response = await axios.post(`${MP_API_URL}/v1/payments`, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `${orderId}-pix-${Date.now()}`
            }
        });

        const data = response.data;
        const pixInfo = data.point_of_interaction?.transaction_data;

        if (!pixInfo?.qr_code) {
            throw new Error('Codigo PIX nao foi gerado pelo Mercado Pago');
        }

        return {
            success: true,
            pix: {
                qrcode: pixInfo.qr_code_base64 ? `data:image/png;base64,${pixInfo.qr_code_base64}` : null,
                qrcode_text: pixInfo.qr_code,
                transaction_id: data.id?.toString()
            }
        };
    } catch (error) {
        console.error('Mercado Pago PIX Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message || 'Erro ao gerar PIX via Mercado Pago');
    }
}

async function verifyPaymentStatus(transactionId, credentials) {
    const accessToken = credentials.access_token;

    try {
        const response = await axios.get(`${MP_API_URL}/v1/payments/${transactionId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const data = response.data;
        const isPaid = data.status === 'approved';

        return {
            success: true,
            status: isPaid ? 'paid' : 'pending',
            gateway_status: data.status,
            raw_response: data
        };
    } catch (error) {
        console.error('Mercado Pago Verify Error:', error.response?.data || error.message);
        return { success: false, status: 'pending', error: error.message };
    }
}

function parseWebhook(req) {
    const body = req.body;

    // MP envia notificacoes IPN com action e data.id
    if (body.action === 'payment.created' || body.action === 'payment.updated') {
        return {
            transactionId: body.data?.id?.toString(),
            action: body.action,
            needsFetch: true
        };
    }

    // Formato antigo: type=payment, data.id
    if (body.type === 'payment') {
        return {
            transactionId: body.data?.id?.toString(),
            action: 'payment.updated',
            needsFetch: true
        };
    }

    return null;
}

async function testConnection(credentials) {
    try {
        const response = await axios.get(`${MP_API_URL}/v1/payment_methods`, {
            headers: { 'Authorization': `Bearer ${credentials.access_token}` },
            timeout: 10000
        });
        return { success: true, message: `Conexao Mercado Pago OK (${response.data?.length || 0} metodos disponiveis)` };
    } catch (error) {
        return { success: false, message: error.response?.status === 401 ? 'Access token invalido' : error.message };
    }
}

module.exports = { processCardPayment, generatePix, verifyPaymentStatus, parseWebhook, testConnection };
