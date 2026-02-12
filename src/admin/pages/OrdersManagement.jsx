import { useState, useEffect } from 'react'
import { Package, Search, Filter, Eye, Truck, CheckCircle, Clock, XCircle } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const statusConfig = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    paid: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    shipped: { label: 'Enviado', color: 'bg-blue-100 text-blue-800', icon: Truck },
    delivered: { label: 'Entregue', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
    canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle }
}

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

export default function OrdersManagement() {
    const { user, isAdmin } = useAuth()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [trackingCode, setTrackingCode] = useState('')
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        loadOrders()
    }, [filter])

    const loadOrders = async () => {
        setLoading(true)
        try {
            const params = {}
            if (filter !== 'all') {
                params.status = filter
            }

            const { data } = await api.get('/admin/orders', { params })

            const raw = data?.data || data
            const ordersData = Array.isArray(raw) ? raw : []
            console.log(`Loaded ${ordersData.length} orders for admin`)
            setOrders(ordersData)
        } catch (err) {
            console.error('Error loading orders:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateOrderStatus = async (orderId, newStatus) => {
        setUpdating(true)
        try {
            const updates = { status: newStatus }

            if (newStatus === 'shipped' && trackingCode) {
                updates.tracking_code = trackingCode
            }

            await api.put(`/admin/orders/${orderId}`, updates)

            setOrders(prev =>
                prev.map(o => o.id === orderId ? { ...o, ...updates } : o)
            )
            setSelectedOrder(null)
            setTrackingCode('')
        } catch (err) {
            console.error('Error updating order:', err)
            alert('Erro ao atualizar pedido')
        } finally {
            setUpdating(false)
        }
    }

    const filteredOrders = orders.filter(order => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return (
            order.order_number?.toLowerCase().includes(searchLower) ||
            order.id.toLowerCase().includes(searchLower) ||
            order.details?.user_name?.toLowerCase().includes(searchLower) ||
            order.details?.user_email?.toLowerCase().includes(searchLower)
        )
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Pedidos</h1>
                    <p className="text-slate-500">Gerencie os pedidos da loja</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por pedido, nome ou email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    {['all', 'pending', 'paid', 'shipped', 'delivered'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                                ? 'bg-primary text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {status === 'all' ? 'Todos' : statusConfig[status]?.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Package className="w-12 h-12 mb-2" />
                        <p>Nenhum pedido encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pedido</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pagamento</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredOrders.map((order) => {
                                    const status = statusConfig[order.status] || statusConfig.pending
                                    const StatusIcon = status.icon
                                    return (
                                        <tr key={order.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-slate-900">
                                                    {order.order_number || `#${order.id}`}
                                                </p>
                                                {order.tracking_code && (
                                                    <p className="text-xs text-slate-500">
                                                        Rastreio: {order.tracking_code}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-slate-900">
                                                    {order.details?.user_name || '-'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {order.details?.user_email || '-'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {new Date(order.created_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                {formatCurrency(order.total)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 capitalize">
                                                {order.payment_method === 'pix' ? 'PIX' : 'Cartão'}
                                                {order.installments > 1 && ` (${order.installments}x)`}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">
                                    Pedido {selectedOrder.order_number || `#${selectedOrder.id}`}
                                </h2>
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Cliente */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-2">Cliente</h3>
                                <p className="font-medium">{selectedOrder.details?.user_name}</p>
                                <p className="text-sm text-slate-500">{selectedOrder.details?.user_email}</p>
                                <p className="text-sm text-slate-500">{selectedOrder.details?.user_whatsapp}</p>
                            </div>

                            {/* Itens */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-2">Itens</h3>
                                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                    {selectedOrder.details?.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span className="font-medium">{formatCurrency(item.tablePrice * item.quantity)}</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-medium">
                                        <span>Total</span>
                                        <span>{formatCurrency(selectedOrder.total)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Endereço */}
                            {selectedOrder.addresses && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 mb-2">Endereço de Entrega</h3>
                                    <p className="text-sm">
                                        {selectedOrder.addresses.street}, {selectedOrder.addresses.number}
                                        {selectedOrder.addresses.complement && ` - ${selectedOrder.addresses.complement}`}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {selectedOrder.addresses.neighborhood}, {selectedOrder.addresses.city} - {selectedOrder.addresses.state}
                                    </p>
                                    <p className="text-sm text-slate-500">CEP: {selectedOrder.addresses.cep}</p>
                                </div>
                            )}

                            {/* Código de Rastreio */}
                            {selectedOrder.status === 'paid' && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 mb-2">Código de Rastreio</h3>
                                    <input
                                        type="text"
                                        value={trackingCode}
                                        onChange={(e) => setTrackingCode(e.target.value)}
                                        placeholder="Ex: BR123456789BR"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            )}

                            {/* Atualizar Status */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-2">Atualizar Status</h3>
                                <div className="flex flex-wrap gap-2">
                                    {selectedOrder.status === 'pending' && (
                                        <button
                                            onClick={() => updateOrderStatus(selectedOrder.id, 'paid')}
                                            disabled={updating}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Marcar como Pago
                                        </button>
                                    )}
                                    {selectedOrder.status === 'paid' && (
                                        <button
                                            onClick={() => updateOrderStatus(selectedOrder.id, 'shipped')}
                                            disabled={updating}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            Marcar como Enviado
                                        </button>
                                    )}
                                    {selectedOrder.status === 'shipped' && (
                                        <button
                                            onClick={() => updateOrderStatus(selectedOrder.id, 'delivered')}
                                            disabled={updating}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                        >
                                            Marcar como Entregue
                                        </button>
                                    )}
                                    {['pending', 'paid'].includes(selectedOrder.status) && (
                                        <button
                                            onClick={() => updateOrderStatus(selectedOrder.id, 'canceled')}
                                            disabled={updating}
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                        >
                                            Cancelar Pedido
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
