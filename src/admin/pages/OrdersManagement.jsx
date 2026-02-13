import { useState, useEffect } from 'react'
import { Package, Search, Filter, Eye, Truck, CheckCircle, Clock, XCircle, FileText, ExternalLink, Globe, User, MapPin, CreditCard, Gift, Tag, Wallet, Copy, Hash } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const channelConfig = {
    paid_google: { label: 'Google Ads', color: 'bg-green-100 text-green-800' },
    paid_social: { label: 'Meta/TikTok Ads', color: 'bg-purple-100 text-purple-800' },
    paid_microsoft: { label: 'Microsoft Ads', color: 'bg-teal-100 text-teal-800' },
    organic_google: { label: 'Google Organico', color: 'bg-blue-100 text-blue-800' },
    organic: { label: 'Organico', color: 'bg-sky-100 text-sky-800' },
    organic_social: { label: 'Social Organico', color: 'bg-pink-100 text-pink-800' },
    email: { label: 'Email', color: 'bg-orange-100 text-orange-800' },
    referral: { label: 'Referral', color: 'bg-yellow-100 text-yellow-800' },
    direct: { label: 'Direto', color: 'bg-slate-100 text-slate-800' },
    revenda: { label: 'Revenda', color: 'bg-indigo-100 text-indigo-800' }
}

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
    const [channelFilter, setChannelFilter] = useState('')
    const [search, setSearch] = useState('')
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [trackingCode, setTrackingCode] = useState('')
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        loadOrders()
    }, [filter, channelFilter])

    const loadOrders = async () => {
        setLoading(true)
        try {
            const params = {}
            if (filter !== 'all') {
                params.status = filter
            }
            if (channelFilter) {
                params.channel = channelFilter
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
                <div className="flex gap-2 flex-wrap">
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
                    <select
                        value={channelFilter}
                        onChange={(e) => setChannelFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="">Todos os Canais</option>
                        {Object.entries(channelConfig).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                        ))}
                    </select>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Canal</th>
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
                                                {(() => {
                                                    const ch = order.tracking_data?.pe_channel || null
                                                    const cfg = ch ? channelConfig[ch] : null
                                                    return cfg ? (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                                                            {cfg.label}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )
                                                })()}
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
            {selectedOrder && (() => {
                const o = selectedOrder
                const d = o.details || {}
                const summary = d.summary || {}
                const status = statusConfig[o.status] || statusConfig.pending
                const StatusIcon = status.icon
                const chCfg = o.tracking_data?.pe_channel ? (channelConfig[o.tracking_data.pe_channel] || channelConfig.direct) : null

                return (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-xl font-bold text-slate-900">
                                            Pedido {o.order_number || `#${o.id}`}
                                        </h2>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                            <StatusIcon className="w-3 h-3" />
                                            {status.label}
                                        </span>
                                        {chCfg && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${chCfg.color}`}>
                                                {chCfg.label}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Criado em {new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        {o.updated_at && o.updated_at !== o.created_at && (
                                            <> — Atualizado em {new Date(o.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                                        )}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 p-1">
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* IDs e Referências */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-xs text-slate-500 mb-0.5">ID Interno</p>
                                    <p className="text-sm font-medium text-slate-900">{o.id}</p>
                                </div>
                                {o.woocommerce_order_id && (
                                    <div className="bg-slate-50 rounded-lg p-3">
                                        <p className="text-xs text-slate-500 mb-0.5">WooCommerce</p>
                                        <p className="text-sm font-medium text-slate-900">#{o.woocommerce_order_number || o.woocommerce_order_id}</p>
                                    </div>
                                )}
                                {o.bling_order_id && (
                                    <div className="bg-slate-50 rounded-lg p-3">
                                        <p className="text-xs text-slate-500 mb-0.5">Bling</p>
                                        <p className="text-sm font-medium text-slate-900">{o.bling_order_id}</p>
                                    </div>
                                )}
                                {o.gateway_transaction_id && (
                                    <div className="bg-slate-50 rounded-lg p-3">
                                        <p className="text-xs text-slate-500 mb-0.5">Gateway TX</p>
                                        <p className="text-sm font-medium text-slate-900 text-xs truncate" title={o.gateway_transaction_id}>{o.gateway_transaction_id}</p>
                                    </div>
                                )}
                            </div>

                            {/* Cliente */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                                    <User size={15} /> Cliente
                                </h3>
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-slate-500">Nome</span>
                                            <p className="font-medium text-slate-900">{o.user_name || d.user_name || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Email</span>
                                            <p className="font-medium text-slate-900">{o.user_email || d.user_email || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">WhatsApp</span>
                                            <p className="font-medium text-slate-900">{o.user_phone || d.user_whatsapp || '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">User ID</span>
                                            <p className="font-medium text-slate-900">{o.user_id}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Endereço */}
                            {o.addr_street && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                                        <MapPin size={15} /> Endereco de Entrega
                                    </h3>
                                    <div className="bg-slate-50 rounded-lg p-4 text-sm">
                                        {o.addr_nickname && <p className="font-medium text-slate-900 mb-1">{o.addr_nickname}</p>}
                                        <p className="text-slate-700">
                                            {o.addr_street}, {o.addr_number}
                                            {o.addr_complement && ` - ${o.addr_complement}`}
                                        </p>
                                        <p className="text-slate-500">
                                            {o.addr_neighborhood}, {o.addr_city} - {o.addr_state}
                                        </p>
                                        <p className="text-slate-500">CEP: {o.addr_cep}</p>
                                    </div>
                                </div>
                            )}

                            {/* Itens do Pedido */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                                    <Package size={15} /> Itens do Pedido
                                </h3>
                                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                    {d.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm py-1">
                                            <div className="flex-1">
                                                <span className="font-medium text-slate-900">{item.quantity}x {item.name}</span>
                                                {item.sku && <span className="text-xs text-slate-400 ml-2">SKU: {item.sku}</span>}
                                            </div>
                                            <span className="font-medium text-slate-900 ml-4">{formatCurrency((parseFloat(item.tablePrice) || 0) * (item.quantity || 1))}</span>
                                        </div>
                                    ))}

                                    {/* Kit */}
                                    {d.kit && (
                                        <div className="flex justify-between items-center text-sm py-1 border-t border-slate-200 pt-2">
                                            <span className="font-medium text-primary flex items-center gap-1">
                                                <Gift size={14} /> {d.kit.name}
                                            </span>
                                            <span className="font-medium text-primary">{formatCurrency(d.kit.price || summary.kitPrice)}</span>
                                        </div>
                                    )}

                                    {/* Resumo financeiro */}
                                    <div className="border-t border-slate-300 pt-3 mt-2 space-y-1.5">
                                        {summary.totalTable > 0 && (
                                            <div className="flex justify-between text-sm text-slate-500">
                                                <span>Subtotal (tabela)</span>
                                                <span>{formatCurrency(summary.totalTable)}</span>
                                            </div>
                                        )}
                                        {summary.totalTable > 0 && summary.productTotal > 0 && summary.totalTable > summary.productTotal && (
                                            <div className="flex justify-between text-sm text-green-600">
                                                <span>Desconto ({((parseFloat(summary.discountStandard) || 0.30) * 100).toFixed(0)}%)</span>
                                                <span>-{formatCurrency(summary.totalTable - summary.productTotal)}</span>
                                            </div>
                                        )}
                                        {summary.kitPrice > 0 && (
                                            <div className="flex justify-between text-sm text-slate-500">
                                                <span>Kit Inicial</span>
                                                <span>{formatCurrency(summary.kitPrice)}</span>
                                            </div>
                                        )}
                                        {d.commission_credit_applied > 0 && (
                                            <div className="flex justify-between text-sm text-green-600">
                                                <span className="flex items-center gap-1"><Wallet size={13} /> Credito Comissao</span>
                                                <span>-{formatCurrency(d.commission_credit_applied)}</span>
                                            </div>
                                        )}
                                        {d.coupon_code && parseFloat(d.coupon_discount || 0) > 0 && (
                                            <div className="flex justify-between text-sm text-green-600">
                                                <span className="flex items-center gap-1"><Tag size={13} /> Cupom {d.coupon_code}</span>
                                                <span>-{formatCurrency(d.coupon_discount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-base font-bold text-slate-900 pt-1">
                                            <span>Total</span>
                                            <span>{formatCurrency(o.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pagamento */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                                    <CreditCard size={15} /> Pagamento
                                </h3>
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                        <div>
                                            <span className="text-slate-500">Metodo</span>
                                            <p className="font-medium text-slate-900">
                                                {o.payment_method === 'pix' ? 'PIX' : o.payment_method === 'credit_card' ? 'Cartao de Credito' : o.payment_method || '-'}
                                            </p>
                                        </div>
                                        {o.installments > 1 && (
                                            <div>
                                                <span className="text-slate-500">Parcelas</span>
                                                <p className="font-medium text-slate-900">{o.installments}x</p>
                                            </div>
                                        )}
                                        {o.gateway_type && (
                                            <div>
                                                <span className="text-slate-500">Gateway</span>
                                                <p className="font-medium text-slate-900 capitalize">{o.gateway_type}</p>
                                            </div>
                                        )}
                                        {o.gateway_status && (
                                            <div>
                                                <span className="text-slate-500">Status Gateway</span>
                                                <p className="font-medium text-slate-900">{o.gateway_status}</p>
                                            </div>
                                        )}
                                        {(o.ipag_transaction_id || o.gateway_transaction_id) && (
                                            <div className="col-span-2">
                                                <span className="text-slate-500">Transaction ID</span>
                                                <p className="font-medium text-slate-900 text-xs break-all">{o.gateway_transaction_id || o.ipag_transaction_id}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Envio & NF */}
                            {(o.tracking_code || o.carrier || o.nota_fiscal_number) && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                                        <Truck size={15} /> Envio e Nota Fiscal
                                    </h3>
                                    <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                                        {o.carrier && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Transportadora</span>
                                                <span className="font-medium">{o.carrier}</span>
                                            </div>
                                        )}
                                        {o.tracking_code && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Rastreio</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{o.tracking_code}</span>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(o.tracking_code)}
                                                        className="text-slate-400 hover:text-slate-600"
                                                        title="Copiar"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                    {o.tracking_url && (
                                                        <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                                                            <ExternalLink size={12} /> Rastrear
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {o.nota_fiscal_number && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Nota Fiscal</span>
                                                <div className="flex items-center gap-2">
                                                    <FileText size={14} className="text-primary" />
                                                    <span className="font-medium">
                                                        NF {o.nota_fiscal_number}
                                                        {o.nota_fiscal_serie && ` / Serie ${o.nota_fiscal_serie}`}
                                                    </span>
                                                    {o.nota_fiscal_pdf_url && (
                                                        <a
                                                            href={`${window.location.origin.replace(':5173', ':3000')}${o.nota_fiscal_pdf_url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20"
                                                        >
                                                            <ExternalLink size={10} /> PDF
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Origem / Tracking UTM */}
                            {o.tracking_data && Object.keys(o.tracking_data).length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                                        <Globe size={15} /> Origem do Pedido
                                    </h3>
                                    <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                                        {o.tracking_data.pe_channel && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Canal</span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${(channelConfig[o.tracking_data.pe_channel] || channelConfig.direct).color}`}>
                                                    {(channelConfig[o.tracking_data.pe_channel] || { label: o.tracking_data.pe_channel }).label}
                                                </span>
                                            </div>
                                        )}
                                        {o.tracking_data.utm_source && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Fonte / Meio</span>
                                                <span className="font-medium">{o.tracking_data.utm_source}{o.tracking_data.utm_medium ? ` / ${o.tracking_data.utm_medium}` : ''}</span>
                                            </div>
                                        )}
                                        {o.tracking_data.utm_campaign && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Campanha</span>
                                                <span className="font-medium">{o.tracking_data.utm_campaign}</span>
                                            </div>
                                        )}
                                        {o.tracking_data.utm_term && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Termo</span>
                                                <span className="font-medium">{o.tracking_data.utm_term}</span>
                                            </div>
                                        )}
                                        {o.tracking_data.utm_content && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Conteudo</span>
                                                <span className="font-medium">{o.tracking_data.utm_content}</span>
                                            </div>
                                        )}
                                        {o.tracking_data.pe_landing && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Landing Page</span>
                                                <span className="font-medium text-xs max-w-[320px] truncate" title={o.tracking_data.pe_landing}>
                                                    {o.tracking_data.pe_landing}
                                                </span>
                                            </div>
                                        )}
                                        {o.tracking_data.pe_referrer && o.tracking_data.pe_referrer !== 'direct' && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Referrer</span>
                                                <span className="font-medium text-xs max-w-[320px] truncate" title={o.tracking_data.pe_referrer}>
                                                    {o.tracking_data.pe_referrer}
                                                </span>
                                            </div>
                                        )}
                                        {(o.tracking_data.gclid || o.tracking_data.gbraid || o.tracking_data.wbraid || o.tracking_data.fbclid || o.tracking_data.ttclid || o.tracking_data.msclkid) && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Click ID</span>
                                                <span className="font-medium text-xs">
                                                    {o.tracking_data.gclid ? `gclid: ${o.tracking_data.gclid.substring(0, 20)}...` :
                                                     o.tracking_data.fbclid ? `fbclid: ${o.tracking_data.fbclid.substring(0, 20)}...` :
                                                     o.tracking_data.ttclid ? `ttclid: ${o.tracking_data.ttclid.substring(0, 20)}...` :
                                                     o.tracking_data.msclkid ? `msclkid: ${o.tracking_data.msclkid.substring(0, 20)}...` :
                                                     o.tracking_data.gbraid ? `gbraid` : 'wbraid'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Codigo de Rastreio - Input */}
                            {o.status === 'paid' && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Adicionar Codigo de Rastreio</h3>
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
                            <div className="border-t border-slate-200 pt-4">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Atualizar Status</h3>
                                <div className="flex flex-wrap gap-2">
                                    {o.status === 'pending' && (
                                        <button
                                            onClick={() => updateOrderStatus(o.id, 'paid')}
                                            disabled={updating}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                                        >
                                            Marcar como Pago
                                        </button>
                                    )}
                                    {o.status === 'paid' && (
                                        <button
                                            onClick={() => updateOrderStatus(o.id, 'shipped')}
                                            disabled={updating}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                                        >
                                            Marcar como Enviado
                                        </button>
                                    )}
                                    {o.status === 'shipped' && (
                                        <button
                                            onClick={() => updateOrderStatus(o.id, 'delivered')}
                                            disabled={updating}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                                        >
                                            Marcar como Entregue
                                        </button>
                                    )}
                                    {['pending', 'paid'].includes(o.status) && (
                                        <button
                                            onClick={() => updateOrderStatus(o.id, 'canceled')}
                                            disabled={updating}
                                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
                                        >
                                            Cancelar Pedido
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                )
            })()}
        </div>
    )
}
