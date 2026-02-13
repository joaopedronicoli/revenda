const axios = require('axios');

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

async function processCardPayment({ amount, orderId, cardData, customer, installments = 1, credentials }) {
    const apiUrl = credentials.api_url || 'https://api.ipag.com.br/service';
    const apiId = credentials.api_id;
    const apiKey = credentials.api_key;
    const basicAuth = Buffer.from(`${apiId}:${apiKey}`).toString('base64');

    try {
        const amountFormatted = (amount / 100).toFixed(2);
        const cardNumber = cardData.number.replace(/\s/g, '');
        let method = 'visa';
        if (cardNumber.startsWith('5')) method = 'mastercard';
        else if (cardNumber.startsWith('4')) method = 'visa';
        else if (cardNumber.startsWith('6')) method = 'elo';
        else if (cardNumber.startsWith('3')) method = 'amex';

        const [expiryMonth, expiryYear] = cardData.expiry.split('/');

        const webhookUrl = `${process.env.API_URL || 'https://revenda.pelg.com.br'}/webhooks/gateway/ipag?id=${orderId}`;

        const payload = {
            identificacao: apiId,
            operacao: 'Pagamento',
            pedido: orderId.toString().substring(0, 16),
            valor: amountFormatted,
            nome: customer.name,
            documento: (customer.cpf || '').replace(/\D/g, ''),
            email: customer.email,
            retorno_tipo: 'json',
            url_retorno: webhookUrl,
            callback_url: webhookUrl,
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

        const response = await axios.post(`${apiUrl}/payment`, formBody, {
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

async function generatePix({ amount, orderId, customer, credentials }) {
    const apiUrl = credentials.api_url || 'https://api.ipag.com.br/service';
    const apiId = credentials.api_id;
    const apiKey = credentials.api_key;
    const basicAuth = Buffer.from(`${apiId}:${apiKey}`).toString('base64');

    try {
        const amountFormatted = (amount / 100).toFixed(2);
        const webhookUrl = `${process.env.API_URL || 'https://revenda.pelg.com.br'}/webhooks/gateway/ipag?id=${orderId}`;

        const payload = {
            identificacao: apiId,
            operacao: 'Pagamento',
            pedido: orderId.toString().substring(0, 16),
            valor: amountFormatted,
            nome: customer.name,
            documento: (customer.cpf || '').replace(/\D/g, ''),
            email: customer.email,
            retorno_tipo: 'json',
            url_retorno: webhookUrl,
            callback_url: webhookUrl,
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

        const response = await axios.post(`${apiUrl}/payment`, formBody, {
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

async function verifyPaymentStatus(transactionId, credentials) {
    const apiUrl = credentials.api_url || 'https://api.ipag.com.br/service';
    const apiId = credentials.api_id;
    const apiKey = credentials.api_key;
    const basicAuth = Buffer.from(`${apiId}:${apiKey}`).toString('base64');

    try {
        const response = await axios.get(`${apiUrl}/consult?tid=${transactionId}`, {
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

function parseWebhook(req) {
    const body = req.body;
    const fallbackOrderId = req.query.id;

    let transactionId, statusStr, statusCode, orderId;

    // Format 1: v2 API — { id, attributes: { order_id, status: { code, message }, tid } }
    if (body.attributes) {
        transactionId = body.attributes.tid || body.id;
        statusCode = (body.attributes.status?.code || '').toString();
        statusStr = (body.attributes.status?.message || '').toString().toLowerCase();
        orderId = body.attributes.order_id;
    }
    // Format 2: Legacy retorno — { retorno: [{ id, num_pedido, status_pagamento, mensagem_transacao }] }
    else if (body.retorno && Array.isArray(body.retorno) && body.retorno.length > 0) {
        const retorno = body.retorno[0];
        transactionId = retorno.id_transacao || retorno.id;
        statusCode = (retorno.status_pagamento || '').toString();
        statusStr = (retorno.mensagem_transacao || '').toString().toLowerCase();
        orderId = retorno.num_pedido;
    }
    // Format 3: Simple — { id, status, order_id }
    else {
        transactionId = body.id;
        statusStr = (body.status || '').toString().toLowerCase();
        statusCode = '';
        orderId = body.order_id;
    }

    const isPaid = statusStr === 'approved' || statusStr === 'capturado' || statusStr === 'sucesso' ||
        statusStr === 'captured' ||
        statusStr.includes('aprovad') || statusStr.includes('captur') ||
        statusCode === '5' || statusCode === '8';

    return {
        transactionId,
        status: statusStr || statusCode || '',
        isPaid,
        orderId: fallbackOrderId || orderId,
        orderNumber: orderId
    };
}

async function testConnection(credentials) {
    try {
        const apiUrl = credentials.api_url || 'https://api.ipag.com.br/service';
        const basicAuth = Buffer.from(`${credentials.api_id}:${credentials.api_key}`).toString('base64');
        await axios.get(`${apiUrl}/consult?tid=test`, {
            headers: { 'Authorization': `Basic ${basicAuth}`, 'Accept': 'application/json' },
            timeout: 10000
        });
        return { success: true, message: 'Conexao iPag OK' };
    } catch (error) {
        if (error.response && error.response.status !== 401) {
            return { success: true, message: 'Conexao iPag OK (credenciais validas)' };
        }
        return { success: false, message: error.response?.status === 401 ? 'Credenciais invalidas' : error.message };
    }
}

module.exports = { processCardPayment, generatePix, verifyPaymentStatus, parseWebhook, testConnection };
