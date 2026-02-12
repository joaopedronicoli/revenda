import { useState, useEffect } from 'react'
import { Trash2, AlertTriangle, CheckCircle, RefreshCw, Search } from 'lucide-react'
import api from '../../services/api'

export default function CleanupDuplicates() {
    const [orders, setOrders] = useState([])
    const [duplicates, setDuplicates] = useState([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [result, setResult] = useState(null)

    useEffect(() => {
        loadOrders()
    }, [])

    const loadOrders = async () => {
        setLoading(true)
        try {
            const { data: allOrders } = await api.get('/admin/orders', { params: { limit: 9999 } })

            const ordersList = allOrders?.data || allOrders || []
            setOrders(ordersList)

            // Identificar duplicados por order_number
            const ordersByNumber = {}
            ordersList.forEach(order => {
                if (order.order_number) {
                    if (!ordersByNumber[order.order_number]) {
                        ordersByNumber[order.order_number] = []
                    }
                    ordersByNumber[order.order_number].push(order)
                }
            })

            // Filtrar apenas os que têm duplicatas
            const duplicateGroups = []
            Object.entries(ordersByNumber).forEach(([orderNumber, orders]) => {
                if (orders.length > 1) {
                    duplicateGroups.push({
                        orderNumber,
                        orders: orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                    })
                }
            })

            setDuplicates(duplicateGroups)
        } catch (err) {
            console.error('Error loading orders:', err)
        } finally {
            setLoading(false)
        }
    }

    const deleteDuplicates = async () => {
        if (!confirm('Tem certeza que deseja deletar os pedidos duplicados SEM transação do iPag?')) {
            return
        }

        setDeleting(true)
        setResult(null)

        try {
            let deletedCount = 0
            const errors = []

            // Para cada grupo de duplicatas
            for (const group of duplicates) {
                // Identificar quais deletar (sem ipag_transaction_id)
                const toDelete = group.orders.filter(o => !o.ipag_transaction_id)

                // Deletar cada um
                for (const order of toDelete) {
                    try {
                        await api.delete(`/admin/orders/${order.id}`)
                        deletedCount++
                    } catch (err) {
                        errors.push(`Erro ao deletar ${order.order_number}: ${err.response?.data?.message || err.message}`)
                    }
                }
            }

            setResult({
                success: true,
                deleted: deletedCount,
                errors: errors
            })

            // Recarregar lista
            await loadOrders()

        } catch (err) {
            setResult({
                success: false,
                error: err.message
            })
        } finally {
            setDeleting(false)
        }
    }

    const deleteSpecificOrder = async (orderId, orderNumber) => {
        if (!confirm(`Tem certeza que deseja deletar o pedido ${orderNumber}?`)) {
            return
        }

        try {
            await api.delete(`/admin/orders/${orderId}`)

            alert('Pedido deletado com sucesso!')
            await loadOrders()
        } catch (err) {
            alert(`Erro ao deletar: ${err.response?.data?.message || err.message}`)
        }
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
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
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-7 h-7 text-orange-500" />
                    Limpeza de Pedidos Duplicados
                </h1>
                <p className="text-slate-500">Identificar e remover pedidos duplicados do sistema</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-6 border border-slate-200">
                    <p className="text-sm text-slate-500">Total de Pedidos</p>
                    <p className="text-3xl font-bold text-slate-900">{orders.length}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-orange-200 bg-orange-50">
                    <p className="text-sm text-orange-700">Grupos Duplicados</p>
                    <p className="text-3xl font-bold text-orange-900">{duplicates.length}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-red-200 bg-red-50">
                    <p className="text-sm text-red-700">A Deletar (sem transação)</p>
                    <p className="text-3xl font-bold text-red-900">
                        {duplicates.reduce((sum, g) => sum + g.orders.filter(o => !o.ipag_transaction_id).length, 0)}
                    </p>
                </div>
            </div>

            {/* Actions */}
            {duplicates.length > 0 && (
                <div className="flex gap-4">
                    <button
                        onClick={deleteDuplicates}
                        disabled={deleting}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                        <Trash2 className="w-5 h-5" />
                        {deleting ? 'Deletando...' : 'Deletar Todos os Duplicados'}
                    </button>
                    <button
                        onClick={loadOrders}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Atualizar
                    </button>
                </div>
            )}

            {/* Result Message */}
            {result && (
                <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    {result.success ? (
                        <>
                            <p className="text-green-800 font-medium">✅ {result.deleted} pedidos duplicados deletados com sucesso!</p>
                            {result.errors.length > 0 && (
                                <div className="mt-2 text-red-700 text-sm">
                                    <p className="font-medium">Erros:</p>
                                    {result.errors.map((err, i) => (
                                        <p key={i}>- {err}</p>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-red-800">❌ Erro: {result.error}</p>
                    )}
                </div>
            )}

            {/* Duplicates List */}
            {duplicates.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                        Nenhum pedido duplicado encontrado!
                    </h3>
                    <p className="text-slate-600">
                        Todos os pedidos estão únicos no sistema.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {duplicates.map((group, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-orange-200 overflow-hidden">
                            <div className="bg-orange-50 px-6 py-3 border-b border-orange-200">
                                <h3 className="font-semibold text-orange-900">
                                    ⚠️ Pedido {group.orderNumber} - {group.orders.length} duplicatas
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-200">
                                {group.orders.map((order, orderIdx) => (
                                    <div
                                        key={order.id}
                                        className={`p-6 ${!order.ipag_transaction_id ? 'bg-red-50' : 'bg-green-50'}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                        order.ipag_transaction_id
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {order.ipag_transaction_id ? '✓ TEM Transação iPag' : '✗ SEM Transação iPag'}
                                                    </span>
                                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                                                        {order.status}
                                                    </span>
                                                    {orderIdx === 0 && (
                                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                                            Criado Primeiro
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                    <div>
                                                        <span className="text-slate-500">ID:</span>
                                                        <p className="font-mono text-slate-900">{order.id}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Transaction ID:</span>
                                                        <p className="font-mono text-slate-900">
                                                            {order.ipag_transaction_id || 'Nenhum'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Total:</span>
                                                        <p className="font-semibold text-slate-900">{formatCurrency(order.total)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Data:</span>
                                                        <p className="text-slate-900">
                                                            {new Date(order.created_at).toLocaleString('pt-BR')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                {!order.ipag_transaction_id && (
                                                    <button
                                                        onClick={() => deleteSpecificOrder(order.id, group.orderNumber)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Deletar
                                                    </button>
                                                )}
                                                {order.ipag_transaction_id && (
                                                    <div className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">
                                                        MANTER
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Como funciona:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>MANTER:</strong> Pedidos COM "ipag_transaction_id" (pagamento real no iPag)</li>
                    <li>• <strong>DELETAR:</strong> Pedidos SEM "ipag_transaction_id" (duplicatas criadas por erro)</li>
                    <li>• A limpeza automática remove apenas os pedidos sem transação</li>
                    <li>• Você também pode deletar pedidos específicos manualmente</li>
                </ul>
            </div>
        </div>
    )
}
