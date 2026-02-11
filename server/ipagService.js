const axios = require('axios');

const IPAG_API_URL = process.env.IPAG_API_URL || 'https://api.ipag.com.br/service';
const IPAG_API_ID = process.env.IPAG_API_ID || '';
const IPAG_API_KEY = process.env.IPAG_API_KEY || '';

const basicAuth = Buffer.from(`${IPAG_API_ID}:${IPAG_API_KEY}`).toString('base64');

function parseXML(xmlString) {
    const result = {};
    const tagRegex = /<([^><\/]+)>([^<]*)<\/\1>/g;
    let match;
    while ((match = tagRegex.exec(xmlString)) !== null) {
        result[match[1]] = match[2];
    }
    const statusWithCode = xmlString.match(/<status[^>]*code=["']?(\d+)["']?[^>]*>([^<]*)<\/status>/i);
    if (statusWithCode) {
        result.status_pagamento = statusWithCode[1];
        result.mensagem_transacao = statusWithCode[2].trim();
    }
    const codigoMatch = xmlString.match(/<codigo_transacao[^>]*>([^<]+)</);
    if (codigoMatch) result.codigo_transacao = codigoMatch[1].trim();
    const pixCodeMatch = xmlString.match(/<pix>([^<]+)<\/pix>/);
    if (pixCodeMatch) result.pix_code = pixCodeMatch[1].trim();
    const pixQrcodeMatch = xmlString.match(/<pix><qrcode>([^<]*)<\/qrcode><\/pix>/);
    if (pixQrcodeMatch) result.pix_qrcode = pixQrcodeMatch[1];
    return result;
}

async function processCardPayment({ amount, orderId, cardData, customer, installments = 1 }) {
    try {
        const amountFormatted = (amount / 100).toFixed(2);
        const cardNumber = cardData.number.replace(/\s/g, '');
        let method = 'visa';
        if (cardNumber.startsWith('5')) method = 'mastercard';
        else if (cardNumber.startsWith('4')) method = 'visa';
        else if (cardNumber.startsWith('6')) method = 'elo';
        else if (cardNumber.startsWith('3')) method = 'amex';

        const [expiryMonth, expiryYear] = cardData.expiry.split('/');

        const payload = {
            identificacao: IPAG_API_ID,
            operacao: 'Pagamento',
            pedido: orderId.substring(0, 16),
            valor: amountFormatted,
            nome: customer.name,
            documento: (customer.cpf || '').replace(/\D/g, ''),
            email: customer.email,
            retorno_tipo: 'json',
            url_retorno: `${process.env.API_URL || 'https://revenda.pelg.com.br'}/webhooks/ipag?id=${orderId}`,
            callback_url: `${process.env.API_URL || 'https://revenda.pelg.com.br'}/webhooks/ipag?id=${orderId}`,
            fone: customer.phone ? customer.phone.replace(/\D/g, '') : '',
            logradouro: 'Rua Principal',
            numero: '123',
            bairro: 'Centro',
            cidade: 'Sao Paulo',
            estado: 'SP',
            cep: '01001000',
            metodo: method,
            num_cartao: cardNumber,
            nome_cartao: cardData.holder.toUpperCase(),
            mes_cartao: expiryMonth.trim().padStart(2, '0'),
            ano_cartao: expiryYear.trim(),
            cvv_cartao: cardData.cvv,
            parcelas: installments
        };

        const formBody = Object.keys(payload)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(payload[key]))
            .join('&');

        const response = await axios.post(`${IPAG_API_URL}/payment`, formBody, {
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        let xmlData = {};
        try {
            xmlData = typeof response.data === 'object' ? response.data : JSON.parse(responseText);
            if (xmlData.data) xmlData = { ...xmlData, ...xmlData.data };
            if (xmlData.retorno) xmlData = { ...xmlData, ...xmlData.retorno };
        } catch (e) {
            xmlData = parseXML(responseText);
        }

        const realTid = xmlData.id_transacao || xmlData.tid || xmlData.retorno?.id_transacao || xmlData.retorno?.tid;
        const internalId = xmlData.id || xmlData.num_transacao;
        const finalTransactionId = realTid || internalId;

        const transactionMessage = (xmlData.mensagem_transacao || xmlData.status?.message || xmlData.message || '').toLowerCase();
        const statusPagamento = (xmlData.status_pagamento || xmlData.status?.code || xmlData.codigo_transacao || '').toString();

        const isApproved = transactionMessage === 'approved' || transactionMessage === 'capturado' || transactionMessage === 'sucesso' ||
            transactionMessage.includes('aprovad') || transactionMessage.includes('captur') || statusPagamento === '5' || statusPagamento === '8';

        return {
            success: true,
            status: isApproved ? 'approved' : 'pending',
            transaction_id: finalTransactionId,
            message: transactionMessage || statusPagamento,
            ipag_status: transactionMessage || statusPagamento,
            raw_response: xmlData
        };
    } catch (error) {
        console.error('iPag Card Payment Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message || 'Erro ao processar pagamento');
    }
}

async function generatePix({ amount, orderId, customer }) {
    try {
        const amountFormatted = (amount / 100).toFixed(2);

        const payload = {
            identificacao: IPAG_API_ID,
            operacao: 'Pagamento',
            pedido: orderId.substring(0, 16),
            valor: amountFormatted,
            nome: customer.name,
            documento: (customer.cpf || '').replace(/\D/g, ''),
            email: customer.email,
            retorno_tipo: 'json',
            url_retorno: `${process.env.API_URL || 'https://revenda.pelg.com.br'}/webhooks/ipag?id=${orderId}`,
            callback_url: `${process.env.API_URL || 'https://revenda.pelg.com.br'}/webhooks/ipag?id=${orderId}`,
            fone: customer.phone ? customer.phone.replace(/\D/g, '') : '',
            logradouro: 'Rua Principal',
            numero: '123',
            bairro: 'Centro',
            cidade: 'Sao Paulo',
            estado: 'SP',
            cep: '01001000',
            metodo: 'pix',
            boleto_tipo: 'JSON'
        };

        const formBody = Object.keys(payload)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(payload[key]))
            .join('&');

        const response = await axios.post(`${IPAG_API_URL}/payment`, formBody, {
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        let xmlData = {};
        try {
            xmlData = typeof response.data === 'object' ? response.data : JSON.parse(responseText);
            if (xmlData.data) xmlData = { ...xmlData, ...xmlData.data };
            if (xmlData.retorno) xmlData = { ...xmlData, ...xmlData.retorno };
        } catch (e) {
            xmlData = parseXML(responseText);
        }

        const qrcodeText = xmlData.pix?.qrcode || xmlData.pix_code || xmlData.pix_qrcode || xmlData.qrcode;
        const qrcodeImage = xmlData.pix?.link || xmlData.url_autenticacao || xmlData.link;
        const transactionId = xmlData.id_transacao || xmlData.tid || xmlData.id || xmlData.num_transacao;

        if (!qrcodeText) {
            throw new Error('Codigo PIX nao foi gerado');
        }

        return {
            success: true,
            pix: {
                qrcode: qrcodeImage,
                qrcode_text: qrcodeText,
                transaction_id: transactionId
            }
        };
    } catch (error) {
        console.error('iPag PIX Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message || 'Erro ao gerar PIX');
    }
}

async function verifyPaymentStatus(transactionId) {
    try {
        const response = await axios.get(`${IPAG_API_URL}/consult?tid=${transactionId}`, {
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/json'
            }
        });

        const data = typeof response.data === 'object' ? response.data : JSON.parse(response.data);
        const status = data.status?.toLowerCase() || data.mensagem_transacao?.toLowerCase() || 'pending';
        const isPaid = status === 'approved' || status === 'capturado' || status === 'paid' || status === 'sucesso';

        return {
            success: true,
            status: isPaid ? 'paid' : 'pending',
            ipag_status: status,
            raw_response: data
        };
    } catch (error) {
        console.error('iPag Verify Error:', error.response?.data || error.message);
        return { success: false, status: 'pending', error: error.message };
    }
}

module.exports = { processCardPayment, generatePix, verifyPaymentStatus };
