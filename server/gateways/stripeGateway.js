const axios = require('axios');

async function processCardPayment({ amount, orderId, cardData, customer, installments = 1, credentials }) {
    let stripe;
    try {
        stripe = require('stripe')(credentials.secret_key);
    } catch (e) {
        throw new Error('Pacote stripe nao instalado. Execute: npm install stripe');
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // ja em centavos
            currency: 'brl',
            payment_method: cardData.payment_method_id,
            confirmation_method: 'manual',
            confirm: true,
            description: `Pedido ${orderId}`,
            metadata: { order_id: orderId.toString() },
            receipt_email: customer.email,
            return_url: `${process.env.FRONTEND_URL || 'https://revenda.pelg.com.br'}/confirmation`
        });

        if (paymentIntent.status === 'succeeded') {
            return {
                success: true,
                status: 'approved',
                transaction_id: paymentIntent.id,
                message: 'Pagamento aprovado',
                raw_response: { id: paymentIntent.id, status: paymentIntent.status }
            };
        } else if (paymentIntent.status === 'requires_action') {
            return {
                success: true,
                status: 'pending',
                transaction_id: paymentIntent.id,
                client_secret: paymentIntent.client_secret,
                message: 'Autenticacao 3DS necessaria',
                raw_response: { id: paymentIntent.id, status: paymentIntent.status }
            };
        } else {
            return {
                success: true,
                status: 'pending',
                transaction_id: paymentIntent.id,
                message: paymentIntent.status,
                raw_response: { id: paymentIntent.id, status: paymentIntent.status }
            };
        }
    } catch (error) {
        console.error('Stripe Card Error:', error.message);
        throw new Error(error.message || 'Erro ao processar pagamento via Stripe');
    }
}

async function generatePix() {
    throw new Error('Stripe nao suporta PIX. Use outro gateway para pagamentos PIX.');
}

async function verifyPaymentStatus(transactionId, credentials) {
    let stripe;
    try {
        stripe = require('stripe')(credentials.secret_key);
    } catch (e) {
        return { success: false, status: 'pending', error: 'Pacote stripe nao instalado' };
    }

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);
        const isPaid = paymentIntent.status === 'succeeded';

        return {
            success: true,
            status: isPaid ? 'paid' : 'pending',
            gateway_status: paymentIntent.status,
            raw_response: { id: paymentIntent.id, status: paymentIntent.status }
        };
    } catch (error) {
        console.error('Stripe Verify Error:', error.message);
        return { success: false, status: 'pending', error: error.message };
    }
}

function parseWebhook(req, credentials) {
    let stripe;
    try {
        stripe = require('stripe')(credentials.secret_key);
    } catch (e) {
        return null;
    }

    const sig = req.headers['stripe-signature'];
    if (!sig || !credentials.webhook_secret) return null;

    try {
        const event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, credentials.webhook_secret);

        if (event.type === 'payment_intent.succeeded') {
            const pi = event.data.object;
            return {
                transactionId: pi.id,
                isPaid: true,
                orderId: pi.metadata?.order_id,
                status: 'succeeded'
            };
        }

        if (event.type === 'payment_intent.payment_failed') {
            const pi = event.data.object;
            return {
                transactionId: pi.id,
                isPaid: false,
                orderId: pi.metadata?.order_id,
                status: 'failed'
            };
        }

        return null;
    } catch (error) {
        console.error('Stripe Webhook Error:', error.message);
        return null;
    }
}

async function testConnection(credentials) {
    let stripe;
    try {
        stripe = require('stripe')(credentials.secret_key);
    } catch (e) {
        return { success: false, message: 'Pacote stripe nao instalado' };
    }

    try {
        await stripe.paymentMethods.list({ type: 'card', limit: 1 });
        return { success: true, message: 'Conexao Stripe OK' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = { processCardPayment, generatePix, verifyPaymentStatus, parseWebhook, testConnection };
