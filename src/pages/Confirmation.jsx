import { useEffect, useState } from 'react'
import { useCartStore } from '../store/cartStore'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Confirmation() {
    const { cart, getSummary, clearCart } = useCartStore()
    const { user } = useAuth()
    const [status, setStatus] = useState('processing') // processing, success, error
    const [message, setMessage] = useState('Processando seu pedido...')

    useEffect(() => {
        if (status !== 'processing') return

        // Safety check: empty cart (maybe user refreshed)
        if (cart.length === 0) {
            // If already cleared, we might show success or redirect? 
            // For now assume if we land here with empty cart it's done or error.
            // But clearing happens AFTER success. 
            // So if empty, probably accessed directly.
            setStatus('error')
            setMessage('Carrinho vazio. Adicione produtos antes de finalizar.')
            return
        }

        const processOrder = async () => {
            try {
                const summary = getSummary()

                // Get selected address from localStorage
                const selectedAddressId = localStorage.getItem('selectedAddressId')

                // Get payment data from localStorage
                const paymentDataStr = localStorage.getItem('paymentData')
                const paymentData = paymentDataStr ? JSON.parse(paymentDataStr) : null

                const orderData = {
                    user_email: user.email,
                    user_name: user?.name || 'N/A',
                    user_whatsapp: user?.phone || 'N/A',
                    user_cpf: user?.cpf || null,
                    user_cnpj: user?.cnpj || null,
                    user_address: {
                        state: user?.state,
                        city: user?.city,
                        neighborhood: user?.neighborhood
                    },
                    reseller_survey: user?.survey,

                    items: cart.map(item => ({
                        id: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        tablePrice: item.tablePrice,
                        reference_url: item.reference_url
                    })),

                    summary: {
                        totalTable: summary.totalTable,
                        totalWithDiscount: summary.totalWithDiscount,
                        itemCount: summary.itemCount,
                        isHighTicket: summary.isHighTicket,
                        discountStandard: summary.discountStandard,
                        discountModelat: summary.discountModelat
                    },
                    payment: paymentData ? {
                        method: paymentData.method,
                        installments: paymentData.installments,
                        total: paymentData.total,
                        discount: paymentData.discount
                    } : null
                }

                // Save to API
                await api.post('/orders', {
                    details: orderData,
                    total: paymentData ? paymentData.total : summary.totalWithDiscount,
                    status: 'pending',
                    address_id: selectedAddressId || null,
                    payment_method: paymentData?.method || null,
                    installments: paymentData?.installments || null,
                    pix_discount: paymentData?.discount || null
                })

                clearCart()
                localStorage.removeItem('selectedAddressId')
                localStorage.removeItem('paymentData')
                setStatus('success')
                setMessage('Pedido realizado com sucesso!')

            } catch (err) {
                setStatus('error')
                setMessage('Erro ao processar pedido: ' + err.message)
            }
        }

        processOrder()
    }, []) // Empty dependency array, run once on mount

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4">
            {status === 'processing' && (
                <>
                    <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Processando...</h2>
                    <p className="text-slate-500">{message}</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Parabéns!</h2>
                    <p className="text-slate-600 max-w-md mx-auto mb-8">
                        Seu pedido foi recebido e está sendo processado pela nossa equipe.
                        Você receberá os detalhes em breve.
                    </p>
                    <Link
                        to="/"
                        className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft size={20} /> Voltar para Loja
                    </Link>
                </>
            )}

            {status === 'error' && (
                <>
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                        <span className="text-3xl font-bold">!</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado.</h2>
                    <p className="text-slate-600 max-w-md mx-auto mb-8">
                        {message}
                    </p>
                    <Link
                        to="/"
                        className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft size={20} /> Tentar Novamente
                    </Link>
                </>
            )}
        </div>
    )
}
