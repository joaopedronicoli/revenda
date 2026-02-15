import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getOrders } from '../lib/database'
import { useCartStore } from '../store/cartStore'
import { Package, Clock, CheckCircle, Truck, AlertCircle, ShoppingCart, ExternalLink, CreditCard, FileText } from 'lucide-react'
import { getDeliveryEstimate, getEstimatedDeliveryDate } from '../lib/deliveryEstimates'

export default function OrderHistory() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { addToCart } = useCartStore()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    useEffect(() => {
        if (user?.id) loadOrders()
    }, [filter, user?.id])

    const loadOrders = async () => {
        try {
            setLoading(true)
            const data = await getOrders(
                user?.id,
                filter === 'all' ? null : filter
            )
            setOrders(data)
            setLoading(false)
        } catch (error) {
            console.error('Error loading orders:', error)
            setLoading(false)
        }
    }


    const statusConfig = {
        pending: {
            label: 'Pendente',
            icon: Clock,
            color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        },
        paid: {
            label: 'Pago',
            icon: CheckCircle,
            color: 'bg-green-100 text-green-800 border-green-200'
        },
        shipped: {
            label: 'Enviado',
            icon: Truck,
            color: 'bg-blue-100 text-blue-800 border-blue-200'
        },
        delivered: {
            label: 'Concluído',
            icon: CheckCircle,
            color: 'bg-slate-100 text-slate-800 border-slate-200'
        }
    }

    const filters = [
        { id: 'all', label: 'Todos' },
        { id: 'pending', label: 'Pendentes' },
        { id: 'paid', label: 'Pagos' },
        { id: 'shipped', label: 'Enviados' },
        { id: 'delivered', label: 'Concluídos' }
    ]

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    const formatDateTime = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getStatusColor = (order) => {
        const config = statusConfig[order.status]
        return config?.color || 'bg-slate-100 text-slate-800 border-slate-200'
    }

    const getStatusLabel = (order) => {
        const config = statusConfig[order.status]
        return config?.label || order.status || 'Desconhecido'
    }

    // Traduzir status do iPag para texto legível
    const formatIpagStatus = (ipagStatus, orderStatus) => {
        const status = (ipagStatus || '').toString().toLowerCase()

        // Códigos numéricos do iPag
        if (status === '1') return 'Iniciado'
        if (status === '2') return 'Aguardando Pagamento'
        if (status === '3') return 'Cancelado'
        if (status === '4') return 'Em Análise'
        if (status === '5') return 'Aprovado'
        if (status === '6') return 'Estornado'
        if (status === '7') return 'Recusado'
        if (status === '8') return 'Capturado'

        // Status textuais
        if (status.includes('approved') || status.includes('aprovado')) return 'Aprovado'
        if (status.includes('captured') || status.includes('capturado')) return 'Capturado'
        if (status.includes('canceled') || status.includes('cancelado')) return 'Cancelado'
        if (status.includes('refused') || status.includes('recusado')) return 'Recusado'
        if (status.includes('waiting') || status.includes('aguardando')) return 'Aguardando'
        if (status.includes('pago') || status.includes('paid')) return 'Pago'

        // Fallback para o status do pedido
        if (orderStatus === 'paid') return 'Pago'
        if (orderStatus === 'pending') return 'Pendente'

        return ipagStatus || orderStatus || 'Pendente'
    }

    // Função para comprar novamente
    const handleBuyAgain = (order) => {
        const items = order.details?.items || []

        // Adicionar todos os produtos do pedido ao carrinho
        items.forEach(item => {
            // Buscar produto completo para garantir que temos todos os dados
            const product = {
                id: item.id,
                name: item.name,
                tablePrice: item.tablePrice || item.price_unit_final || item.price_table || 0,
                reference_url: item.reference_url,
                // Adicionar imagem se disponível
                image: item.image,
                imageDark: item.imageDark
            }

            // Adicionar a quantidade correta ao carrinho
            const quantity = item.quantity || 1
            for (let i = 0; i < quantity; i++) {
                addToCart(product)
            }
        })

        // Navegar para a loja
        navigate('/')
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {filters.map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === f.id
                            ? 'bg-primary text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Orders List */}
            {orders.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                    <Package className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Nenhum pedido encontrado
                    </h3>
                    <p className="text-slate-600">
                        {filter === 'all'
                            ? 'Você ainda não fez nenhum pedido.'
                            : `Você não tem pedidos com status "${filters.find(f => f.id === filter)?.label}".`}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => {
                        const status = statusConfig[order.status] || statusConfig.pending
                        const StatusIcon = status.icon
                        const items = order.details?.items || []

                        return (
                            <div
                                key={order.id}
                                className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
                            >
                                {/* Order Header */}
                                <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Package size={18} className="text-primary" />
                                            <h3 className="font-semibold text-slate-900">
                                                Pedido #{order.order_number || order.id}
                                            </h3>
                                        </div>
                                        <p className="text-sm text-slate-600">
                                            {new Date(order.created_at).toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: 'long',
                                                year: 'numeric'
                                            })}
                                        </p>
                                        {order.woocommerce_order_id && order.woocommerce_order_number !== order.order_number && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                Nº Pedido Loja: #{order.woocommerce_order_number || order.woocommerce_order_id}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order)}`}>
                                            {getStatusLabel(order)}
                                        </span>
                                        {/* Tracking Link Button */}
                                        {order.status === 'shipped' && order.tracking_url && (
                                            <a
                                                href={order.tracking_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                                            >
                                                <Truck size={14} />
                                                Rastrear Pedido
                                                <ExternalLink size={12} />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Tracking, NF & Carrier Info */}
                                {['shipped', 'delivered'].includes(order.status) && (order.nota_fiscal_number || order.carrier || order.tracking_code) && (
                                    <div className="border-t border-slate-100 pt-4 mt-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                            {order.carrier && (
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Transportadora</span>
                                                    <span className="font-medium text-slate-900">{order.carrier}</span>
                                                </div>
                                            )}
                                            {order.tracking_code && (
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Codigo de Rastreio</span>
                                                    <span className="font-medium text-slate-900">{order.tracking_code}</span>
                                                </div>
                                            )}
                                            {order.nota_fiscal_number && (
                                                <div className="col-span-2">
                                                    <span className="text-slate-500 block text-xs">Nota Fiscal</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <FileText size={14} className="text-primary" />
                                                        <span className="font-medium text-slate-900">
                                                            NF {order.nota_fiscal_number}
                                                            {order.nota_fiscal_serie && ` / Serie ${order.nota_fiscal_serie}`}
                                                        </span>
                                                        {order.nota_fiscal_pdf_url && (
                                                            <a
                                                                href={`${(import.meta.env.VITE_API_URL || 'https://revenda.pelg.com.br')}${order.nota_fiscal_pdf_url}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20 transition-colors"
                                                            >
                                                                <ExternalLink size={10} />
                                                                Ver DANFE
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Items */}
                                <div className="border-t border-slate-100 pt-4">
                                    <p className="text-sm font-medium text-slate-700 mb-2">
                                        Itens do pedido:
                                    </p>
                                    <div className="space-y-1">
                                        {items.map((item, idx) => {
                                            const quantity = item.quantity || item.qty || 1
                                            return (
                                                <div
                                                    key={idx}
                                                    className="text-sm text-slate-600"
                                                >
                                                    {quantity}x {item.name}
                                                </div>
                                            )
                                        })}
                                        {order.details?.kit && (
                                            <div className="text-sm text-primary font-medium">
                                                + {order.details.kit.name}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between mt-3 pt-2 border-t border-slate-100">
                                        <span className="text-sm font-semibold text-slate-700">Total pago:</span>
                                        <span className="text-sm font-bold text-slate-900">{formatCurrency(order.total)}</span>
                                    </div>
                                </div>

                                {/* Payment Details */}
                                <div className="border-t border-slate-100 pt-4 mt-4 bg-slate-50/50 -mx-6 px-6 pb-2">
                                    <p className="text-sm font-medium text-slate-700 mb-2 mt-2">
                                        Detalhes do Pagamento:
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500 block text-xs">Método</span>
                                            <span className="font-medium text-slate-900 capitalize">
                                                {(order.payment_method === 'credit_card' || order.details?.payment?.method === 'credit_card') ? 'Cartão de Crédito' :
                                                    (order.payment_method === 'pix' || order.details?.payment?.method === 'pix') ? 'PIX' :
                                                        order.ipag_transaction_id ? 'Processado via iPag' : 'Não informado'}
                                            </span>
                                            {/* Show installments if available (root or details) */}
                                            {(order.installments || order.details?.payment?.installments) && (
                                                <span className="text-slate-500 text-xs ml-1">
                                                    ({order.installments || order.details?.payment?.installments}x)
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block text-xs">Data e Hora</span>
                                            <span className="font-medium text-slate-900">
                                                {formatDateTime(order.updated_at || order.created_at)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block text-xs">Status do Pagamento</span>
                                            <span className="font-medium text-slate-900">
                                                {formatIpagStatus(order.ipag_status, order.status)}
                                            </span>
                                        </div>
                                        {order.details?.payment?.brand && (
                                            <div>
                                                <span className="text-slate-500 block text-xs">Bandeira</span>
                                                <span className="font-medium text-slate-900 capitalize">
                                                    {order.details.payment.brand}
                                                    {order.details.payment.card_last4 && ` •••• ${order.details.payment.card_last4}`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Address */}
                                {
                                    order.addresses && (
                                        <div className="border-t border-slate-100 pt-4 mt-4">
                                            <p className="text-sm font-medium text-slate-700 mb-1">
                                                Endereço de entrega:
                                            </p>
                                            <p className="text-sm text-slate-600">
                                                {order.addresses.street}, {order.addresses.number}
                                                {order.addresses.complement && ` - ${order.addresses.complement}`}
                                                <br />
                                                {order.addresses.neighborhood}, {order.addresses.city} - {order.addresses.state}
                                                <br />
                                                CEP: {order.addresses.cep}
                                            </p>

                                            {/* Delivery Estimate */}
                                            {(() => {
                                                const { days } = getDeliveryEstimate(order.addresses.state)
                                                const estimatedDate = getEstimatedDeliveryDate(order.addresses.state)
                                                return (
                                                    <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                                                        <div className="flex items-start gap-2">
                                                            <Clock size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                                            <div className="flex-1">
                                                                <p className="text-xs font-medium text-blue-900">Prazo de Entrega</p>
                                                                <p className="text-xs text-blue-700 mt-0.5">{days}</p>
                                                                <p className="text-xs text-blue-600 mt-1">Previsão: até {estimatedDate}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    )
                                }

                                {/* Action Buttons */}
                                <div className="border-t border-slate-100 pt-4 mt-4 space-y-2">
                                    {order.status === 'pending' && (
                                        <button
                                            onClick={() => navigate(`/order-review?resumeOrderId=${order.id}`)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                                        >
                                            <CreditCard size={18} />
                                            Continuar Pagamento
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleBuyAgain(order)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
                                    >
                                        <ShoppingCart size={18} />
                                        Comprar Novamente
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )
            }
        </div >
    )
}
