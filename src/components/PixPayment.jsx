import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, CheckCircle2, Clock, QrCode, RefreshCw, PartyPopper, ShoppingBag, Hourglass, ExternalLink } from 'lucide-react'
import QRCode from 'qrcode'
import api from '../services/api'
import { createWooCommerceOrder } from '../lib/woocommerceSync'

export default function PixPayment({ pixData, orderId, onPaymentConfirmed }) {
    const navigate = useNavigate()
    const [qrCodeUrl, setQrCodeUrl] = useState(null)
    const [copied, setCopied] = useState(false)
    const [checking, setChecking] = useState(false)
    const [timeRemaining, setTimeRemaining] = useState(null)
    const [paymentSuccess, setPaymentSuccess] = useState(false)
    const [hourglassFlip, setHourglassFlip] = useState(false)
    const [orderNumber, setOrderNumber] = useState(null)

    // Gerar QR Code a partir do código PIX
    useEffect(() => {
        const pixCode = pixData?.qrcode_text || pixData?.code
        if (pixCode) {
            QRCode.toDataURL(pixCode, {
                width: 300,
                margin: 1,
                color: {
                    dark: '#073a70',
                    light: '#ffffff'
                }
            }).then(setQrCodeUrl)
        }
    }, [pixData?.qrcode_text, pixData?.code])

    // Countdown do tempo de expiração
    useEffect(() => {
        if (!pixData?.expiresAt) return

        const interval = setInterval(() => {
            const now = new Date()
            const expires = new Date(pixData.expiresAt)
            const diff = expires - now

            if (diff <= 0) {
                setTimeRemaining('Expirado')
                clearInterval(interval)
            } else {
                const minutes = Math.floor(diff / 60000)
                const seconds = Math.floor((diff % 60000) / 1000)
                setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [pixData?.expiresAt])

    // Função para verificar pagamento
    const checkPayment = useCallback(async () => {
        if (!orderId || paymentSuccess) return false

        try {
            setChecking(true)

            // Sincronizar com iPag
            await api.post(`/orders/${orderId}/sync`).catch(() => { })

            // Verificar no banco
            const { data: { data } } = await api.get(`/orders/${orderId}`)

            const successStatuses = ['approved', 'paid', 'capturado', 'succeeded', 'sucesso', 'pago', '5', '8']
            const ipagStatus = (data?.ipag_status || '').toLowerCase()
            const orderStatus = (data?.status || '').toLowerCase()
            const isSuccess = successStatuses.some(s => ipagStatus.includes(s)) || orderStatus === 'paid'

            if (data && isSuccess) {
                setOrderNumber(data.order_number)
                setPaymentSuccess(true)

                // Atualizar status do pedido no WooCommerce (de pending para processing)
                // O pedido já foi criado quando o Pix foi gerado

                return true
            }
            return false
        } catch (err) {
            console.error('Error checking payment:', err)
            return false
        } finally {
            setChecking(false)
        }
    }, [orderId, paymentSuccess])

    // Polling automático a cada 5 segundos
    useEffect(() => {
        if (!orderId || paymentSuccess) return

        const interval = setInterval(() => {
            checkPayment()
        }, 5000)

        // Verificar imediatamente também
        checkPayment()

        return () => clearInterval(interval)
    }, [orderId, paymentSuccess, checkPayment])

    // Quando pagamento confirmado, NÃO redireciona automaticamente
    // Usuário pode clicar em "Ver Meus Pedidos" ou voltar manualmente

    // Efeito de virar a ampulheta a cada 5 segundos
    useEffect(() => {
        if (paymentSuccess) return

        const interval = setInterval(() => {
            setHourglassFlip(prev => !prev)
        }, 5000)

        return () => clearInterval(interval)
    }, [paymentSuccess])

    const copyPixCode = () => {
        const pixCode = pixData?.qrcode_text || pixData?.code
        navigator.clipboard.writeText(pixCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Tela de sucesso
    if (paymentSuccess) {
        return (
            <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
                {/* Círculo animado de sucesso */}
                <div className="relative mb-6">
                    <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl animate-bounce-slow">
                        <CheckCircle2 className="w-16 h-16 text-white" strokeWidth={2.5} />
                    </div>
                    {/* Partículas decorativas */}
                    <div className="absolute -top-2 -right-2 animate-ping">
                        <PartyPopper className="w-8 h-8 text-yellow-500" />
                    </div>
                    <div className="absolute -bottom-1 -left-3 animate-pulse">
                        <div className="w-4 h-4 bg-green-300 rounded-full"></div>
                    </div>
                    <div className="absolute top-1/2 -right-6 animate-pulse delay-100">
                        <div className="w-3 h-3 bg-emerald-300 rounded-full"></div>
                    </div>
                </div>

                {/* Mensagem de sucesso */}
                <div className="text-center space-y-3">
                    <h2 className="text-2xl font-bold text-slate-900">
                        Pagamento Confirmado!
                    </h2>
                    <p className="text-slate-600 max-w-sm">
                        Seu pagamento via PIX foi processado com sucesso. Obrigado pela sua compra!
                    </p>
                </div>

                {/* Card com resumo do pedido */}
                <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 w-full max-w-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                            <ShoppingBag className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-green-700 font-medium">Pedido recebido</p>
                            <p className="text-xs text-green-600 font-mono">{orderNumber || `#${orderId?.slice(0, 8)}`}</p>
                        </div>
                    </div>

                    {/* Link para Meus Pedidos */}
                    <button
                        onClick={() => navigate('/profile?tab=orders')}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-green-300 text-green-700 py-3 px-4 rounded-lg font-medium hover:bg-green-50 transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Ver Meus Pedidos
                    </button>
                </div>

                {/* Botão para continuar comprando */}
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 text-primary hover:text-primary-dark font-medium transition-colors"
                >
                    Continuar Comprando
                </button>
            </div>
        )
    }

    // Tela de aguardando pagamento
    return (
        <div className="space-y-6">
            {/* QR Code */}
            <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-200 mb-4 relative">
                    {qrCodeUrl ? (
                        <img
                            src={qrCodeUrl}
                            alt="QR Code PIX"
                            className="w-64 h-64"
                        />
                    ) : (
                        <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-lg">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    )}
                    {/* Indicador de verificação */}
                    {checking && (
                        <div className="absolute -top-2 -right-2 bg-primary text-white rounded-full p-1.5 shadow-lg">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <QrCode size={16} />
                    <span>Escaneie o QR Code com seu banco</span>
                </div>
            </div>

            {/* Código PIX Copiável */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ou copie o código PIX
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={pixData?.qrcode_text || pixData?.code || ''}
                        readOnly
                        className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-600 select-all"
                    />
                    <button
                        onClick={copyPixCode}
                        className={`px-4 py-3 rounded-lg font-semibold transition-colors ${copied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-primary text-white hover:bg-primary-dark'
                            }`}
                    >
                        {copied ? (
                            <CheckCircle2 size={20} />
                        ) : (
                            <Copy size={20} />
                        )}
                    </button>
                </div>
                {copied && (
                    <p className="text-green-600 text-sm mt-2 flex items-center gap-1">
                        <CheckCircle2 size={16} />
                        Código copiado!
                    </p>
                )}
            </div>

            {/* Alerta de Reserva - Urgência */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-xl p-5 relative overflow-hidden">
                {/* Faixa decorativa */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400"></div>

                <div className="flex items-start gap-4">
                    <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
                            {/* Ampulheta que vira */}
                            <Hourglass
                                className={`w-7 h-7 text-orange-600 transition-transform duration-500 ${hourglassFlip ? 'rotate-180' : 'rotate-0'}`}
                            />
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-orange-900 text-lg mb-1">
                            Seu pedido está reservado!
                        </h4>
                        <p className="text-sm text-orange-800 mb-2">
                            Complete o pagamento para garantir seus produtos.
                        </p>
                        <div className="flex items-center gap-2 text-xs font-medium text-orange-700 bg-orange-100 px-3 py-2 rounded-lg inline-flex">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Código válido por 3 horas</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Aviso de estoque */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">⚡</span>
                </div>
                <div>
                    <p className="text-sm font-semibold text-red-800">Estoque limitado</p>
                    <p className="text-xs text-red-600">Os produtos serão liberados caso o pagamento não seja confirmado</p>
                </div>
            </div>

            {/* Instruções - Modernizadas */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h5 className="font-medium text-slate-800 mb-4 text-center">Como pagar</h5>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">1</span>
                        </div>
                        <p className="text-sm text-slate-600">Abra o app do seu banco</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">2</span>
                        </div>
                        <p className="text-sm text-slate-600">Escolha "Pagar com PIX"</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">3</span>
                        </div>
                        <p className="text-sm text-slate-600">Escaneie ou cole o código</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">4</span>
                        </div>
                        <p className="text-sm text-slate-600">Confirme o pagamento</p>
                    </div>
                </div>
            </div>

            {/* Mensagem de segurança */}
            <p className="text-center text-xs text-slate-500">
                Seu pagamento será confirmado automaticamente. Não feche esta página.
            </p>

            {/* CSS para animações customizadas */}
            <style>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s ease-in-out infinite;
                }
                .animate-fade-in {
                    animation: fadeIn 0.5s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    )
}
