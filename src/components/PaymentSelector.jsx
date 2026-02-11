import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Smartphone, CheckCircle2, PartyPopper, ShoppingBag, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import CreditCardForm from './CreditCardForm'
import PixPayment from './PixPayment'
import api from '../services/api'
import { createWooCommerceOrder } from '../lib/woocommerceSync'

export default function PaymentSelector({ total, customer, orderId, onPaymentSuccess, onPaymentError }) {
    const navigate = useNavigate()
    const [paymentMethod, setPaymentMethod] = useState('credit_card') // 'credit_card' or 'pix'
    const [loading, setLoading] = useState(false)
    const [pixData, setPixData] = useState(null)
    const [creditCardSuccess, setCreditCardSuccess] = useState(null)

    // Quando pagamento de cartão confirmado, NÃO redireciona automaticamente
    // Usuário pode clicar em "Ver Meus Pedidos" ou continuar comprando

    const handleCreditCardSubmit = async (cardData) => {
        setLoading(true)
        try {
            const { data: result } = await api.post('/payments/process', {
                amount: total,
                orderId,
                paymentMethod: 'credit_card',
                cardData: {
                    number: cardData.number,
                    holder: cardData.holder,
                    expiry: cardData.expiry,
                    cvv: cardData.cvv
                },
                customer,
                installments: cardData.installments
            })

            if (!result.success) {
                let errorMsg = 'Falha no pagamento'
                if (typeof result.error === 'string') {
                    errorMsg = result.error
                } else if (typeof result.error === 'object') {
                    errorMsg = result.error.message || result.error.error || JSON.stringify(result.error)
                }
                throw new Error(errorMsg)
            }

            // Buscar order_number do banco
            const { data: { data: orderData } } = await api.get(`/orders/${orderId}`)

            // Pagamento aprovado - mostrar tela de sucesso E limpar carrinho
            if (result.status === 'approved' || result.status === 'paid') {
                setCreditCardSuccess({
                    ...result,
                    cardLast4: cardData.number.slice(-4),
                    installments: cardData.installments,
                    orderNumber: orderData?.order_number
                })

                // 🆕 CRIAR PEDIDO NO WOOCOMMERCE (status: processing)
                try {
                    console.log('🛒 Creating WooCommerce order for approved credit card payment...')
                    await createWooCommerceOrder(orderId)
                    console.log('✅ WooCommerce order created successfully with status: processing')
                } catch (wcError) {
                    console.error('⚠️ Failed to create WooCommerce order:', wcError)
                    // Não bloqueia o fluxo se falhar
                }

                // Limpar carrinho após pagamento aprovado
                onPaymentSuccess({ paymentMethod: 'credit_card', ...result })
            } else if (result.status === 'pending') {
                // Aguardando aprovação - também mostrar sucesso (será processado)
                setCreditCardSuccess({
                    ...result,
                    cardLast4: cardData.number.slice(-4),
                    installments: cardData.installments,
                    isPending: true,
                    orderNumber: orderData?.order_number
                })
                // Limpar carrinho mesmo em pending
                onPaymentSuccess({ paymentMethod: 'credit_card', ...result })
            } else {
                throw new Error('Pagamento não aprovado')
            }
        } catch (error) {
            console.error('Payment error:', error)
            onPaymentError(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handlePixRequest = async () => {
        setLoading(true)
        try {
            const { data: result } = await api.post('/payments/process', {
                amount: total,
                orderId,
                paymentMethod: 'pix',
                customer
            })

            if (!result.success) {
                // Se result.error é objeto, extrair a mensagem correta
                let errorMessage = 'Falha ao gerar PIX'
                if (typeof result.error === 'string') {
                    errorMessage = result.error
                } else if (result.error && typeof result.error === 'object') {
                    errorMessage = JSON.stringify(result.error, null, 2)
                }
                throw new Error(errorMessage)
            }

            setPixData(result.pix)

            // 🆕 CRIAR PEDIDO NO WOOCOMMERCE IMEDIATAMENTE (status: pending)
            try {
                console.log('🛒 Creating WooCommerce order for Pix payment...')
                await createWooCommerceOrder(orderId)
                console.log('✅ WooCommerce order created successfully with status: pending')
            } catch (wcError) {
                console.error('⚠️ Failed to create WooCommerce order:', wcError)
                // Não bloqueia o fluxo se falhar
            }
        } catch (error) {
            console.error('PIX error:', error)
            // Garantir que a mensagem é sempre string
            const errorMsg = error.message || String(error)
            onPaymentError(errorMsg)
        } finally {
            setLoading(false)
        }
    }

    const handlePixPaymentConfirmed = () => {
        onPaymentSuccess({ paymentMethod: 'pix' })
    }

    return (
        <div className="space-y-6">
            {!pixData && !creditCardSuccess && (
                <>
                    <h3 className="font-semibold text-slate-800 mb-3">Escolha a forma de pagamento</h3>

                    {/* Tab Selector */}
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setPaymentMethod('credit_card')}
                            className={clsx(
                                'flex-1 py-3 px-4 rounded-md font-medium transition-all flex items-center justify-center gap-2',
                                paymentMethod === 'credit_card'
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            )}
                        >
                            <CreditCard size={20} />
                            Cartão
                        </button>
                        <button
                            onClick={() => setPaymentMethod('pix')}
                            className={clsx(
                                'flex-1 py-3 px-4 rounded-md font-medium transition-all flex items-center justify-center gap-2',
                                paymentMethod === 'pix'
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            )}
                        >
                            <Smartphone size={20} />
                            PIX
                        </button>
                    </div>
                </>
            )}

            {/* Content */}
            <div className="mt-6">
                {paymentMethod === 'credit_card' && !pixData && !creditCardSuccess && (
                    <CreditCardForm
                        amount={total}
                        onSubmit={handleCreditCardSubmit}
                        loading={loading}
                    />
                )}

                {paymentMethod === 'pix' && !pixData && !creditCardSuccess && (
                    <div className="text-center py-8">
                        <Smartphone className="w-16 h-16 text-primary mx-auto mb-4" />
                        <h4 className="font-semibold text-lg text-slate-900 mb-2">
                            Pagamento via PIX
                        </h4>
                        <p className="text-slate-600 mb-6">
                            Clique no botão abaixo para gerar o código PIX
                        </p>
                        <button
                            onClick={handlePixRequest}
                            disabled={loading}
                            className="bg-primary text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline-block mr-2"></div>
                                    Gerando PIX...
                                </>
                            ) : (
                                'Gerar Código PIX'
                            )}
                        </button>
                    </div>
                )}

                {pixData && (
                    <PixPayment
                        pixData={pixData}
                        orderId={orderId}
                        onPaymentConfirmed={handlePixPaymentConfirmed}
                    />
                )}

                {/* Tela de sucesso do Cartão de Crédito */}
                {creditCardSuccess && (
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
                                {creditCardSuccess.isPending ? 'Pagamento em Processamento!' : 'Pagamento Confirmado!'}
                            </h2>
                            <p className="text-slate-600 max-w-sm">
                                {creditCardSuccess.isPending
                                    ? 'Seu pagamento está sendo processado. Você receberá a confirmação em breve.'
                                    : 'Seu pagamento via Cartão de Crédito foi aprovado com sucesso!'}
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
                                    <p className="text-xs text-green-600 font-mono">{creditCardSuccess.orderNumber || `#${orderId?.slice(0, 8)}`}</p>
                                </div>
                            </div>

                            {/* Detalhes do pagamento */}
                            <div className="bg-white/60 rounded-lg p-4 mb-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Método</span>
                                    <span className="font-medium text-slate-900 flex items-center gap-1">
                                        <CreditCard size={14} />
                                        Cartão de Crédito
                                    </span>
                                </div>
                                {creditCardSuccess.cardLast4 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Cartão</span>
                                        <span className="font-medium text-slate-900">
                                            •••• {creditCardSuccess.cardLast4}
                                        </span>
                                    </div>
                                )}
                                {creditCardSuccess.installments && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Parcelas</span>
                                        <span className="font-medium text-slate-900">
                                            {creditCardSuccess.installments}x
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm pt-2 border-t border-green-100">
                                    <span className="text-slate-600">Total</span>
                                    <span className="font-bold text-green-700">
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL'
                                        }).format(total / 100)}
                                    </span>
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
                )}
            </div>
        </div>
    )
}
