import { useState, useEffect } from 'react'
import { ShoppingCart, Search, RefreshCw, Send, Eye, CheckCircle, Clock, XCircle, MessageCircle } from 'lucide-react'
import api from '../../services/api'

const statusConfig = {
    abandoned: { label: 'Abandonado', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    recovered: { label: 'Recuperado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    expired: { label: 'Expirado', color: 'bg-slate-100 text-slate-800', icon: XCircle }
}

const formatCurrency = (value) => {
    const num = parseFloat(value)
    if (isNaN(num)) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(num)
}

// Calculate total from items array if total field is missing/NaN
const calculateCartTotal = (cart) => {
    const total = parseFloat(cart.total)
    if (!isNaN(total) && total > 0) return total

    // Fallback: calculate from items
    const items = parseCartItems(cart)
    return items.reduce((sum, item) => {
        const price = parseFloat(item.tablePrice || item.price || 0)
        const qty = parseInt(item.quantity) || 1
        return sum + (price * qty)
    }, 0)
}

// Parse items from JSONB - handles both string and object
const parseCartItems = (cart) => {
    let items = cart.items
    if (typeof items === 'string') {
        try { items = JSON.parse(items) } catch { items = [] }
    }
    return Array.isArray(items) ? items : []
}

export default function AbandonedCarts() {
    const [carts, setCarts] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedCart, setSelectedCart] = useState(null)
    const [sending, setSending] = useState(false)

    useEffect(() => {
        loadCarts()
    }, [filter])

    const loadCarts = async () => {
        setLoading(true)
        try {
            const params = {}
            if (filter !== 'all') {
                params.status = filter
            }
            const { data } = await api.get('/admin/abandoned-carts', { params })
            setCarts(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error('Error loading abandoned carts:', err)
        } finally {
            setLoading(false)
        }
    }

    const triggerRecovery = async (cartId, type) => {
        setSending(true)
        try {
            const cart = carts.find(c => c.id === cartId)
            if (!cart) return

            await api.post(`/admin/abandoned-carts/${cartId}/recover`, {
                type,
                recovery_link: `${window.location.origin}/?recover=${cart.id}`
            })

            // Update local state to reflect sent status
            setCarts(prev => prev.map(c => c.id === cartId
                ? { ...c, [type === 'email' ? 'recovery_email_sent' : 'recovery_whatsapp_sent']: true }
                : c
            ))

            alert(`Recuperacao via ${type === 'email' ? 'Email' : 'WhatsApp'} enviada!`)
        } catch (err) {
            console.error('Error triggering recovery:', err)
            alert('Erro ao enviar recuperacao')
        } finally {
            setSending(false)
        }
    }

    const filteredCarts = carts.filter(cart => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return (
            cart.user_name?.toLowerCase().includes(searchLower) ||
            cart.user_email?.toLowerCase().includes(searchLower) ||
            cart.telefone?.toLowerCase().includes(searchLower)
        )
    })

    const totalValue = filteredCarts.reduce((sum, cart) => sum + calculateCartTotal(cart), 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Carrinhos Abandonados</h1>
                    <p className="text-slate-500">
                        {filteredCarts.length} carrinhos {totalValue > 0 && `\u2022 ${formatCurrency(totalValue)} em valor potencial`}
                    </p>
                </div>
                <button
                    onClick={loadCarts}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou telefone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    {['all', 'abandoned', 'recovered', 'expired'].map((status) => (
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

            {/* Carts Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : filteredCarts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <ShoppingCart className="w-12 h-12 mb-2" />
                        <p>Nenhum carrinho abandonado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Itens</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Abandonado em</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Recuperacao</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acoes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredCarts.map((cart) => {
                                    const cartStatus = statusConfig[cart.status] || statusConfig.abandoned
                                    const StatusIcon = cartStatus.icon
                                    const items = parseCartItems(cart)
                                    const cartTotal = calculateCartTotal(cart)
                                    return (
                                        <tr key={cart.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-slate-900">
                                                    {cart.user_name || '-'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {cart.user_email || '-'}
                                                </p>
                                                {cart.telefone && (
                                                    <p className="text-xs text-slate-400">{cart.telefone}</p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-900">
                                                {cart.item_count || items.length} {(cart.item_count || items.length) === 1 ? 'item' : 'itens'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                {formatCurrency(cartTotal)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {new Date(cart.updated_at || cart.created_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cartStatus.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {cartStatus.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className={cart.recovery_email_sent ? 'text-green-600' : 'text-slate-400'}>
                                                        Email {cart.recovery_email_sent ? '\u2713' : '\u25CB'}
                                                    </span>
                                                    <span className={cart.recovery_whatsapp_sent ? 'text-green-600' : 'text-slate-400'}>
                                                        WhatsApp {cart.recovery_whatsapp_sent ? '\u2713' : '\u25CB'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedCart(cart)}
                                                        className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Ver detalhes"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {(!cart.status || cart.status === 'abandoned') && (
                                                        <>
                                                            <button
                                                                onClick={() => triggerRecovery(cart.id, 'email')}
                                                                disabled={sending || cart.recovery_email_sent}
                                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title={cart.recovery_email_sent ? 'Email ja enviado' : 'Enviar recuperacao por email'}
                                                            >
                                                                <Send className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => triggerRecovery(cart.id, 'whatsapp')}
                                                                disabled={sending || cart.recovery_whatsapp_sent}
                                                                className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title={cart.recovery_whatsapp_sent ? 'WhatsApp ja enviado' : 'Enviar recuperacao por WhatsApp'}
                                                            >
                                                                <MessageCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Cart Detail Modal */}
            {selectedCart && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">
                                    Detalhes do Carrinho
                                </h2>
                                <button
                                    onClick={() => setSelectedCart(null)}
                                    className="text-slate-400 hover:text-slate-600 text-xl"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Cliente */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-2">Cliente</h3>
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <p className="font-medium">{selectedCart.user_name || '-'}</p>
                                    <p className="text-sm text-slate-500">{selectedCart.user_email || '-'}</p>
                                    {selectedCart.telefone && (
                                        <p className="text-sm text-slate-500">{selectedCart.telefone}</p>
                                    )}
                                </div>
                            </div>

                            {/* Itens */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-2">Itens do Carrinho</h3>
                                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                    {(() => {
                                        const items = parseCartItems(selectedCart)
                                        if (items.length === 0) {
                                            return <p className="text-sm text-slate-400">Nenhum item</p>
                                        }
                                        return (
                                            <>
                                                {items.map((item, idx) => {
                                                    const price = parseFloat(item.tablePrice || item.price || 0)
                                                    const qty = parseInt(item.quantity) || 1
                                                    return (
                                                        <div key={idx} className="flex justify-between text-sm">
                                                            <span>{qty}x {item.name || `Produto #${item.id}`}</span>
                                                            <span className="font-medium">{formatCurrency(price * qty)}</span>
                                                        </div>
                                                    )
                                                })}
                                                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-medium">
                                                    <span>Total</span>
                                                    <span>{formatCurrency(calculateCartTotal(selectedCart))}</span>
                                                </div>
                                            </>
                                        )
                                    })()}
                                </div>
                            </div>

                            {/* Acoes de Recuperacao */}
                            {(!selectedCart.status || selectedCart.status === 'abandoned') && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 mb-2">Acoes de Recuperacao</h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => triggerRecovery(selectedCart.id, 'email')}
                                            disabled={sending || selectedCart.recovery_email_sent}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {selectedCart.recovery_email_sent ? 'Email Enviado' : 'Enviar Email'}
                                        </button>
                                        <button
                                            onClick={() => triggerRecovery(selectedCart.id, 'whatsapp')}
                                            disabled={sending || selectedCart.recovery_whatsapp_sent}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {selectedCart.recovery_whatsapp_sent ? 'WhatsApp Enviado' : 'Enviar WhatsApp'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Link de Recuperacao */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-2">Link de Recuperacao</h3>
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <code className="text-sm break-all">
                                        {window.location.origin}/?recover={selectedCart.id}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
