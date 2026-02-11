import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const IPAG_API_URL = 'https://api.ipag.com.br/service'
const IPAG_API_ID = Deno.env.get('IPAG_API_ID') ?? ''
const IPAG_API_KEY = Deno.env.get('IPAG_API_KEY') ?? ''

// Basic Auth para iPag
const basicAuth = btoa(`${IPAG_API_ID}:${IPAG_API_KEY}`)

// Parser XML simples
function parseXML(xmlString: string): any {
    const result: any = {}

    // Extract simple tags
    const tagRegex = /<([^><\/]+)>([^<]*)<\/\1>/g
    let match

    while ((match = tagRegex.exec(xmlString)) !== null) {
        const tagName = match[1]
        const value = match[2]
        result[tagName] = value
    }

    // Extract status with code attribute: <status code="8">Capturado</status>
    const statusWithCode = xmlString.match(/<status[^>]*code=["']?(\d+)["']?[^>]*>([^<]*)<\/status>/i)
    if (statusWithCode) {
        result.status_pagamento = statusWithCode[1]
        result.mensagem_transacao = statusWithCode[2].trim()
    }

    // Extract codigo_transacao
    const codigoMatch = xmlString.match(/<codigo_transacao[^>]*>([^<]+)</)
    if (codigoMatch) {
        result.codigo_transacao = codigoMatch[1].trim()
    }

    // Extract PIX code text (the full content inside <pix> tags)
    // Format: <pix>00020126...99999</pix>
    const pixCodeMatch = xmlString.match(/<pix>([^<]+)<\/pix>/)
    if (pixCodeMatch) {
        result.pix_code = pixCodeMatch[1].trim()
    }

    // Also try to extract nested qrcode tag if it exists
    const pixQrcodeMatch = xmlString.match(/<pix><qrcode>([^<]*)<\/qrcode><\/pix>/)
    if (pixQrcodeMatch) {
        result.pix_qrcode = pixQrcodeMatch[1]
    }

    return result
}

serve(async (req) => {
    // CORS headers
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        })
    }

    try {
        const { amount, orderId, paymentMethod, cardData, customer, installments } = await req.json()

        // Conectar ao Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Buscar order_number do pedido para enviar ao iPag
        const { data: orderData } = await supabaseClient
            .from('orders')
            .select('order_number')
            .eq('id', orderId)
            .single()

        const orderNumber = orderData?.order_number || orderId.substring(0, 16)

        // Formatar valor para decimal (iPag v1 espera formato "1.00")
        const amountFormatted = (amount / 100).toFixed(2)

        // Montar payload base para iPag v1 (form-urlencoded)
        const payload: any = {
            identificacao: IPAG_API_ID,
            operacao: 'Pagamento',
            pedido: orderNumber, // Envia o order_number (REV-111132) ao invés do UUID
            valor: amountFormatted,
            nome: customer.name,
            documento: (customer.cpf || customer.cnpj || '').replace(/\D/g, ''),
            email: customer.email,
            retorno_tipo: 'json',
            url_retorno: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ipag-webhook?id=${orderId}`,
            callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ipag-webhook?id=${orderId}`, // Keep both for safety
            notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ipag-webhook?id=${orderId}`, // Sent in some implementations
            fone: customer.phone ? customer.phone.replace(/\D/g, '') : '',

            // Address (Simplified - required by some gateways)
            logradouro: 'Rua Principal',
            numero: '123',
            bairro: 'Centro',
            cidade: 'Sao Paulo',
            estado: 'SP',
            cep: '01001000'
        }

        console.log('Sending Payment Request to iPag:', JSON.stringify(payload, null, 2))

        // Variáveis auxiliares
        let method = 'pix'
        let cardNumber = ''

        // Adicionar dados específicos do método de pagamento
        if (paymentMethod === 'credit_card') {
            if (!cardData) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Card data required for credit card payment'
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    status: 400
                })
            }

            // Detectar bandeira
            cardNumber = cardData.number.replace(/\s/g, '')
            if (cardNumber.startsWith('5')) method = 'mastercard'
            else if (cardNumber.startsWith('4')) method = 'visa'
            else if (cardNumber.startsWith('6')) method = 'elo'
            else if (cardNumber.startsWith('3')) method = 'amex'
            else method = 'visa' // Fallback to visa if unknown, as 'credit_card' might be invalid for 'metodo'

            const [expiryMonth, expiryYear] = cardData.expiry.split('/')

            // Reference uses: nome_cartao, num_cartao, cvv_cartao, mes_cartao, ano_cartao
            payload.metodo = method
            payload.num_cartao = cardNumber
            payload.nome_cartao = cardData.holder.toUpperCase() // Was titular_cartao
            payload.mes_cartao = expiryMonth.trim().padStart(2, '0') // Was mes_validade_cartao

            // Reference handles 2 or 4 digit year. We use the input (MM/YY).
            // Helper to ensure 2 digit year if > 4 chars?
            const year = expiryYear.trim()
            payload.ano_cartao = year // Was ano_validade_cartao

            payload.cvv_cartao = cardData.cvv // Was cod_seguranca_cartao
            payload.parcelas = installments || 1

        } else if (paymentMethod === 'pix') {
            // Campos para PIX
            payload.metodo = 'pix'
            payload.boleto_tipo = 'JSON'
        }

        // Converter payload para form-urlencoded
        const formBody = Object.keys(payload)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(payload[key]))
            .join('&')

        // Chamar API do iPag v1
        const ipagResponse = await fetch(`${IPAG_API_URL}/payment`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/json', // Preferir JSON
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formBody
        })

        const responseText = await ipagResponse.text()
        console.log('iPag Raw Response:', responseText)

        // Parse Response (Tries JSON first, then XML)
        let xmlData: any = {}
        try {
            xmlData = JSON.parse(responseText)
            if (xmlData.data) {
                xmlData = { ...xmlData, ...xmlData.data }
            }
            if (xmlData.retorno) {
                xmlData = { ...xmlData, ...xmlData.retorno }
            }
        } catch (e) {
            console.log('Failed to parse as JSON, trying XML...')
            xmlData = parseXML(responseText)
        }

        console.log('iPag Parsed Response:', xmlData)

        // Definir Transaction ID - priorizar TID real sobre ID interno do iPag
        // O TID real está em: id_transacao, tid, retorno.id_transacao, etc.
        // O ID interno (mais curto, tipo 10842908) está em: id, num_transacao
        const realTid = xmlData.id_transacao ||
            xmlData.tid ||
            xmlData.retorno?.id_transacao ||
            xmlData.retorno?.tid
        const internalId = xmlData.id || xmlData.num_transacao
        const finalTransactionId = realTid || internalId

        console.log(`Transaction IDs - realTid: ${realTid}, internalId: ${internalId}, final: ${finalTransactionId}`)

        // Determine Success - verificar múltiplas condições
        // Extrair status de várias possíveis localizações
        const transactionMessage = (
            xmlData.mensagem_transacao ||
            xmlData.status?.message ||
            xmlData.message ||
            ''
        ).toLowerCase()

        const statusPagamento = (
            xmlData.status_pagamento ||
            xmlData.status?.code ||
            xmlData.codigo_transacao ||
            ''
        ).toString()

        console.log(`Status detection - transactionMessage: "${transactionMessage}", statusPagamento: "${statusPagamento}"`)

        const isApproved = transactionMessage === 'approved' ||
            transactionMessage === 'capturado' ||
            transactionMessage === 'sucesso' ||
            transactionMessage.includes('aprovad') ||
            transactionMessage.includes('captur') ||
            statusPagamento === '5' ||
            statusPagamento === '8'

        const hasTransaction = (xmlData.id_transacao && xmlData.id_transacao.length > 0) ||
            (xmlData.id && String(xmlData.id).length > 0)

        const isSuccess = hasTransaction || isApproved || paymentMethod === 'pix'

        console.log(`Payment result - message: ${transactionMessage}, status_pagamento: ${statusPagamento}, isApproved: ${isApproved}, hasTransaction: ${hasTransaction}`)

        // Determinar status do pedido
        // Para cartão: se aprovado imediatamente, marcar como 'paid'
        // Para PIX: sempre 'pending' até webhook confirmar
        let orderStatus = 'pending'
        if (paymentMethod === 'credit_card' && isApproved) {
            orderStatus = 'paid'
        }

        // --- SALVAR NO BANCO (CRITICAL: Save before returning) ---
        const { data: currentOrder } = await supabaseClient
            .from('orders')
            .select('details')
            .eq('id', orderId)
            .single()

        const currentDetails = currentOrder?.details || {}

        // Log entry
        const logEntry = {
            timestamp: new Date().toISOString(),
            request_id: orderId,
            ipag_response_raw: responseText,
            parsed_response: xmlData,
            success: isSuccess,
            approved: isApproved
        }

        await supabaseClient
            .from('orders')
            .update({
                ipag_transaction_id: finalTransactionId,
                status: orderStatus,
                ipag_status: transactionMessage || statusPagamento || 'pending',
                updated_at: new Date().toISOString(),
                payment_method: paymentMethod,
                installments: installments || 1,
                details: {
                    ...currentDetails,
                    payment: {
                        method: paymentMethod,
                        installments: installments || 1,
                        brand: paymentMethod === 'credit_card' ? method : null,
                        card_last4: paymentMethod === 'credit_card' ? cardNumber.slice(-4) : null
                    },
                    payment_logs: [
                        ...(currentDetails.payment_logs || []),
                        logEntry
                    ]
                }
            })
            .eq('id', orderId)

        // --- HANDLE ERRORS ---
        if (!ipagResponse.ok) {
            let errorMessage = responseText
            if (xmlData.message) errorMessage = xmlData.message
            else if (xmlData.error) errorMessage = xmlData.error

            return new Response(JSON.stringify({
                success: false,
                error: errorMessage
            }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 400 })
        }

        if ((xmlData.code && xmlData.code !== '200' && !isSuccess) || (xmlData.error && !isSuccess)) {
            return new Response(JSON.stringify({
                success: false,
                error: xmlData.message || xmlData.error || 'Payment failed'
            }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, status: 400 })
        }

        // Resposta para PIX
        if (paymentMethod === 'pix') {
            // Extrair QRCode do JSON ou XML
            // JSON: xmlData.pix.qrcode (Texto) e xmlData.pix.link (URL)
            // XML (antigo): pix_code / qrcode (root)

            const qrcodeText = xmlData.pix?.qrcode || xmlData.pix_code || xmlData.pix_qrcode || xmlData.qrcode
            const qrcodeImage = xmlData.pix?.link || xmlData.url_autenticacao || xmlData.link

            return new Response(JSON.stringify({
                success: true,
                pix: {
                    qrcode: qrcodeImage, // URL da imagem do QR Code
                    qrcode_text: qrcodeText, // Código Pix Copia e Cola
                    transaction_id: finalTransactionId
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            })
        }

        // Resposta para Cartão
        return new Response(JSON.stringify({
            success: true,
            status: isApproved ? 'approved' : 'pending',
            transaction_id: finalTransactionId,
            message: xmlData.mensagem_transacao || 'Processado'
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        })

    } catch (error) {
        console.error('Process payment error:', error)
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Internal server error'
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            status: 500
        })
    }
})
