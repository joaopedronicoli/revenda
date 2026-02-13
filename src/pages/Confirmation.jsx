import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { CheckCircle, ArrowLeft, Package, ShoppingBag, ExternalLink } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function Confirmation() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadOrder = async () => {
            try {
                const orderId = localStorage.getItem('lastOrderId')
                const paymentCompleted = localStorage.getItem('paymentCompleted')

                if (!orderId || !paymentCompleted) {
                    navigate('/')
                    return
                }

                // Buscar dados do pedido
                const { data } = await api.get(`/orders/${orderId}`)
                setOrder(data)

                // Limpar flags do localStorage
                localStorage.removeItem('paymentCompleted')
                localStorage.removeItem('pendingOrderId')
            } catch (err) {
                console.error('Erro ao carregar pedido:', err)
            } finally {
                setLoading(false)
            }
        }

        loadOrder()
    }, [])

    const formatCurrency = (value) => {
        const num = parseFloat(value)
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(isNaN(num) ? 0 : num)
    }

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
                <CheckCircle size={40} />
            </div>

            <h2 className="text-3xl font-bold text-slate-900 mb-2">Pedido Confirmado!</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-6">
                Seu pedido foi recebido e esta sendo processado.
            </p>

            {order && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-sm mb-6 text-left">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-800">Pedido</p>
                            <p className="text-xs text-slate-500 font-mono">
                                {order.order_number || `#${String(order.id).slice(0, 8)}`}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Status</span>
                            <span className="font-medium text-green-600 capitalize">
                                {order.status === 'paid' ? 'Pago' : order.status === 'pending' ? 'Pendente' : order.status}
                            </span>
                        </div>
                        {order.payment_method && (
                            <div className="flex justify-between">
                                <span className="text-slate-500">Pagamento</span>
                                <span className="font-medium text-slate-800">
                                    {order.payment_method === 'credit_card' ? 'Cartao de Credito' : order.payment_method === 'pix' ? 'PIX' : order.payment_method}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-slate-100">
                            <span className="text-slate-500">Total</span>
                            <span className="font-bold text-slate-900">{formatCurrency(order.total)}</span>
                        </div>
                    </div>

                    {order.tracking_url && (
                        <a
                            href={order.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 flex items-center justify-center gap-2 text-sm text-primary hover:text-primary-dark font-medium"
                        >
                            <ExternalLink size={14} />
                            Acompanhar Pedido
                        </a>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-3 w-full max-w-sm">
                <Link
                    to="/profile?tab=orders"
                    className="w-full bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                    <Package size={20} /> Ver Meus Pedidos
                </Link>
                <Link
                    to="/"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-8 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowLeft size={20} /> Continuar Comprando
                </Link>
            </div>
        </div>
    )
}
