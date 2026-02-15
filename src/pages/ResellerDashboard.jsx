import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Users, Zap, Package } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import LevelProgressBar from '../components/LevelProgressBar'
import AchievementBadge from '../components/AchievementBadge'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

export default function ResellerDashboard() {
    const { user } = useAuth()
    const [dashboard, setDashboard] = useState(null)
    const [achievements, setAchievements] = useState([])
    const [recentOrders, setRecentOrders] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [dashRes, achieveRes, ordersRes] = await Promise.all([
                api.get('/users/me/dashboard'),
                api.get('/users/me/achievements'),
                api.get('/users/me/sales-history')
            ])
            setDashboard(dashRes.data)
            setAchievements(Array.isArray(achieveRes.data) ? achieveRes.data : [])
            setRecentOrders(Array.isArray(ordersRes.data) ? ordersRes.data : [])
        } catch (err) {
            console.error('Error loading dashboard:', err)
        } finally {
            setLoading(false)
        }
    }

    const statCards = dashboard ? [
        {
            label: 'Vendas Total',
            value: formatCurrency(dashboard.totalSales || 0),
            icon: DollarSign,
            color: 'bg-green-50 text-green-600'
        },
        {
            label: 'Vendas do Mes',
            value: formatCurrency(dashboard.monthSales || 0),
            icon: TrendingUp,
            color: 'bg-blue-50 text-blue-600'
        },
        {
            label: 'Saldo Comissoes',
            value: formatCurrency(dashboard.commissionBalance || 0),
            icon: DollarSign,
            color: 'bg-purple-50 text-purple-600'
        },
        {
            label: 'Indicacoes Ativas',
            value: dashboard.activeReferrals || 0,
            icon: Users,
            color: 'bg-orange-50 text-orange-600'
        },
        {
            label: 'Pontos',
            value: (dashboard.points || 0).toLocaleString('pt-BR'),
            icon: Zap,
            color: 'bg-amber-50 text-amber-600'
        }
    ] : []

    const statusConfig = {
        pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
        paid: { label: 'Pago', color: 'bg-green-100 text-green-800' },
        processing: { label: 'Processando', color: 'bg-blue-100 text-blue-800' },
        shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
        delivered: { label: 'Entregue', color: 'bg-green-100 text-green-800' },
        canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
        cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Ola, {user?.name || 'Revendedora'}!
                    </h1>
                    <p className="text-slate-500">Acompanhe suas vendas, conquistas e indicacoes</p>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {statCards.map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{label}</p>
                            <p className="text-base sm:text-lg font-bold text-slate-900 truncate">{value}</p>
                        </div>
                    ))}
                </div>

                {/* Level Progress */}
                <LevelProgressBar />

                {/* Achievements */}
                {achievements.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Conquistas</h2>
                        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4">
                            {achievements.map((achievement) => (
                                <AchievementBadge key={achievement.id} achievement={achievement} size="sm" />
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Orders */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">Pedidos Recentes</h2>
                        <Package className="w-5 h-5 text-slate-400" />
                    </div>

                    {recentOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                            <Package className="w-10 h-10 mb-2" />
                            <p>Nenhum pedido ainda</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {recentOrders.slice(0, 10).map((order) => {
                                const status = statusConfig[order.status] || statusConfig.pending
                                return (
                                    <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">
                                                Pedido #{order.order_number || order.id}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(order.created_at).toLocaleDateString('pt-BR')}
                                                {order.items_count ? ` - ${order.items_count} itens` : ''}
                                            </p>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.color}`}>
                                                {status.label}
                                            </span>
                                            <p className="text-sm font-bold text-slate-900">
                                                {formatCurrency(order.total)}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
        </div>
    )
}
