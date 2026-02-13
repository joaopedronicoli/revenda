import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    DollarSign,
    Package,
    Users,
    ShoppingCart,
    TrendingUp,
    Clock,
    CheckCircle,
    Truck,
    AlertCircle,
    Filter,
    Star,
    Calendar,
    BarChart3,
    Download,
    Globe
} from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar
} from 'recharts'
import api from '../../services/api'

// Stat Card Component
function StatCard({ title, value, icon: Icon, color, subtitle, trend }) {
    const colorClasses = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        orange: 'bg-orange-500',
        purple: 'bg-purple-500',
        red: 'bg-red-500'
    }

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-slate-500 font-medium">{title}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                    {subtitle && (
                        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
                    )}
                    {trend && (
                        <p className={`text-sm mt-2 flex items-center gap-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
                            {Math.abs(trend)}% vs mês anterior
                        </p>
                    )}
                </div>
                <div className={`${colorClasses[color]} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </div>
    )
}

// Format currency
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

// Chart colors
const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6']

const CHANNEL_COLORS = {
    paid_google: '#22c55e',
    paid_social: '#8b5cf6',
    paid_microsoft: '#14b8a6',
    organic_google: '#3b82f6',
    organic: '#0ea5e9',
    organic_social: '#ec4899',
    email: '#f97316',
    referral: '#eab308',
    direct: '#94a3b8',
    revenda: '#6366f1'
}

const CHANNEL_LABELS = {
    paid_google: 'Google Ads',
    paid_social: 'Meta/TikTok Ads',
    paid_microsoft: 'Microsoft Ads',
    organic_google: 'Google Organico',
    organic: 'Organico',
    organic_social: 'Social Organico',
    email: 'Email',
    referral: 'Referral',
    direct: 'Direto',
    revenda: 'Revenda'
}

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true)
    const [dateRange, setDateRange] = useState('month') // today, week, month, 90days, year, all, custom
    const [customStartDate, setCustomStartDate] = useState('')
    const [customEndDate, setCustomEndDate] = useState('')
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
    const [metrics, setMetrics] = useState({
        sales: { today: 0, week: 0, month: 0, total: 0 },
        orders: { pending: 0, paid: 0, shipped: 0, delivered: 0, total: 0 },
        users: { total: 0, pending: 0, approved: 0, newThisMonth: 0 },
        abandonedCarts: { count: 0, value: 0 },
        crm: { avgTicket: 0, conversionRate: 0, repeatCustomers: 0, lifetimeValue: 0 },
        levelDistribution: { bronze: 0, prata: 0, ouro: 0 }
    })
    const [recentOrders, setRecentOrders] = useState([])
    const [salesChart, setSalesChart] = useState([])
    const [topCustomers, setTopCustomers] = useState([])
    const [channelDistribution, setChannelDistribution] = useState([])

    useEffect(() => {
        loadDashboardData()
    }, [dateRange, customStartDate, customEndDate])

    const loadDashboardData = async () => {
        try {
            setLoading(true)

            const params = { dateRange }
            if (dateRange === 'custom' && customStartDate && customEndDate) {
                params.customStartDate = customStartDate
                params.customEndDate = customEndDate
            }

            const dashboardData = await api.get('/admin/dashboard', { params })

            const {
                sales = { today: 0, week: 0, month: 0, total: 0 },
                orders = { pending: 0, paid: 0, shipped: 0, delivered: 0, total: 0 },
                users = { total: 0, pending: 0, approved: 0, newThisMonth: 0 },
                abandonedCarts = { count: 0, value: 0 },
                crm = { avgTicket: 0, conversionRate: 0, repeatCustomers: 0, lifetimeValue: 0 },
                levelDistribution = { bronze: 0, prata: 0, ouro: 0 },
                channelDistribution: channelDist = [],
                recentOrders: recent = [],
                salesChart: chart = [],
                topCustomers: topCust = []
            } = dashboardData.data

            setMetrics({
                sales,
                orders,
                users,
                abandonedCarts,
                crm,
                levelDistribution
            })

            setRecentOrders(recent)
            setSalesChart(chart)
            setTopCustomers(topCust)
            setChannelDistribution(channelDist.map(c => ({
                ...c,
                name: CHANNEL_LABELS[c.channel] || c.channel,
                fill: CHANNEL_COLORS[c.channel] || '#94a3b8'
            })))

        } catch (err) {
            console.error('Error loading dashboard:', err)
        } finally {
            setLoading(false)
        }
    }

    // Order status pie chart data
    const ordersPieData = [
        { name: 'Pendente', value: metrics.orders.pending, color: '#f59e0b' },
        { name: 'Pago', value: metrics.orders.paid, color: '#22c55e' },
        { name: 'Enviado', value: metrics.orders.shipped, color: '#3b82f6' },
        { name: 'Entregue', value: metrics.orders.delivered, color: '#8b5cf6' }
    ].filter(d => d.value > 0)

    const statusConfig = {
        pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
        paid: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle },
        shipped: { label: 'Enviado', color: 'bg-blue-100 text-blue-800', icon: Truck },
        delivered: { label: 'Entregue', color: 'bg-purple-100 text-purple-800', icon: CheckCircle }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header with Filters */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                        <p className="text-slate-500">Visão geral do seu negócio</p>
                    </div>
                    <button
                        onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                    >
                        <Calendar className="w-4 h-4" />
                        Data Personalizada
                    </button>
                </div>

                {/* Quick Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    {['today', 'week', 'month', '90days', 'year', 'all'].map((range) => (
                        <button
                            key={range}
                            onClick={() => {
                                setDateRange(range)
                                setShowCustomDatePicker(false)
                            }}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                dateRange === range
                                    ? 'bg-primary text-white'
                                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                            }`}
                        >
                            {range === 'today' && 'Hoje'}
                            {range === 'week' && '7 dias'}
                            {range === 'month' && '30 dias'}
                            {range === '90days' && '90 dias'}
                            {range === 'year' && 'Ano'}
                            {range === 'all' && 'Tudo'}
                        </button>
                    ))}
                </div>

                {/* Custom Date Picker */}
                {showCustomDatePicker && (
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Selecionar Período Personalizado</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Data Inicial
                                </label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Data Final
                                </label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                            </div>
                            <div>
                                <button
                                    onClick={() => {
                                        if (customStartDate && customEndDate) {
                                            setDateRange('custom')
                                        } else {
                                            alert('Selecione ambas as datas')
                                        }
                                    }}
                                    disabled={!customStartDate || !customEndDate}
                                    className="w-full px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Aplicar Filtro
                                </button>
                            </div>
                        </div>
                        {dateRange === 'custom' && customStartDate && customEndDate && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    <strong>Período ativo:</strong> {new Date(customStartDate).toLocaleDateString('pt-BR')} até {new Date(customEndDate).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Vendas do Mês"
                    value={formatCurrency(metrics.sales.month)}
                    icon={DollarSign}
                    color="green"
                    subtitle={`Hoje: ${formatCurrency(metrics.sales.today)}`}
                />
                <StatCard
                    title="Pedidos"
                    value={metrics.orders.total}
                    icon={Package}
                    color="blue"
                    subtitle={`${metrics.orders.pending} pendentes`}
                />
                <StatCard
                    title="Usuários"
                    value={metrics.users.total}
                    icon={Users}
                    color="purple"
                    subtitle={`${metrics.users.pending} aguardando aprovação`}
                />
                <StatCard
                    title="Carrinhos Abandonados"
                    value={metrics.abandonedCarts.count}
                    icon={ShoppingCart}
                    color="orange"
                    subtitle={formatCurrency(metrics.abandonedCarts.value)}
                />
            </div>

            {/* CRM Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Ticket Médio"
                    value={formatCurrency(metrics.crm.avgTicket)}
                    icon={BarChart3}
                    color="blue"
                    subtitle="Por pedido pago"
                />
                <StatCard
                    title="Taxa de Conversão"
                    value={`${metrics.crm.conversionRate.toFixed(1)}%`}
                    icon={TrendingUp}
                    color="green"
                    subtitle="Aprovados que compraram"
                />
                <StatCard
                    title="Clientes Recorrentes"
                    value={metrics.crm.repeatCustomers}
                    icon={Star}
                    color="purple"
                    subtitle="Compraram 2+ vezes"
                />
                <StatCard
                    title="Lifetime Value"
                    value={formatCurrency(metrics.crm.lifetimeValue)}
                    icon={DollarSign}
                    color="orange"
                    subtitle="Valor médio por cliente"
                />
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500" />
                        <h3 className="text-lg font-semibold text-slate-900">Top 10 Clientes</h3>
                    </div>
                    <button
                        onClick={() => {
                            const data = topCustomers.map(c => ({
                                Nome: c.name,
                                Email: c.email,
                                WhatsApp: c.whatsapp,
                                'Total Gasto': c.totalSpent,
                                'Pedidos': c.orderCount,
                                'Primeira Compra': new Date(c.firstPurchase).toLocaleDateString('pt-BR'),
                                'Última Compra': new Date(c.lastPurchase).toLocaleDateString('pt-BR')
                            }))
                            const csv = [
                                Object.keys(data[0]).join(','),
                                ...data.map(row => Object.values(row).join(','))
                            ].join('\n')
                            const blob = new Blob([csv], { type: 'text/csv' })
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = 'top-clientes.csv'
                            a.click()
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                    >
                        <Download className="w-4 h-4" />
                        Exportar CSV
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Posição</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contato</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total Gasto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pedidos</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Última Compra</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {topCustomers.map((customer, index) => (
                                <tr key={customer.user_id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                            index === 1 ? 'bg-slate-200 text-slate-700' :
                                            index === 2 ? 'bg-orange-100 text-orange-800' :
                                            'bg-slate-100 text-slate-600'
                                        } font-bold text-sm`}>
                                            {index + 1}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-medium text-slate-900">{customer.name}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-slate-600">{customer.email}</p>
                                        {customer.whatsapp && (
                                            <p className="text-xs text-slate-500">{customer.whatsapp}</p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-green-600">
                                            {formatCurrency(customer.totalSpent)}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {customer.orderCount} pedido{customer.orderCount !== 1 ? 's' : ''}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {new Date(customer.lastPurchase).toLocaleDateString('pt-BR')}
                                    </td>
                                </tr>
                            ))}
                            {topCustomers.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        Nenhum cliente com compras ainda
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Level Distribution */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Distribuicao por Nivel</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                        <p className="text-3xl font-bold text-amber-800">{metrics.levelDistribution.bronze || 0}</p>
                        <p className="text-sm text-slate-500 mt-1">Bronze (30%)</p>
                    </div>
                    <div className="text-center p-4 bg-slate-100 rounded-lg">
                        <p className="text-3xl font-bold text-slate-800">{metrics.levelDistribution.prata || 0}</p>
                        <p className="text-sm text-slate-500 mt-1">Prata (35%)</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <p className="text-3xl font-bold text-yellow-800">{metrics.levelDistribution.ouro || 0}</p>
                        <p className="text-sm text-slate-500 mt-1">Ouro (40%)</p>
                    </div>
                </div>
            </div>

            {/* Traffic Sources */}
            {channelDistribution.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold text-slate-900">Fontes de Trafego</h3>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={channelDistribution} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={120} />
                                    <Tooltip
                                        formatter={(value, name) => [name === 'revenue' ? formatCurrency(value) : value, name === 'revenue' ? 'Receita' : 'Pedidos']}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    />
                                    <Bar dataKey="revenue" name="Receita" radius={[0, 4, 4, 0]}>
                                        {channelDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="py-2 text-left text-xs font-medium text-slate-500 uppercase">Canal</th>
                                        <th className="py-2 text-right text-xs font-medium text-slate-500 uppercase">Pedidos</th>
                                        <th className="py-2 text-right text-xs font-medium text-slate-500 uppercase">Receita</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {channelDistribution.map((ch) => (
                                        <tr key={ch.channel} className="border-b border-slate-100">
                                            <td className="py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ch.fill }} />
                                                    <span className="font-medium text-slate-900">{ch.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-2 text-right text-slate-600">{ch.orders}</td>
                                            <td className="py-2 text-right font-medium text-slate-900">{formatCurrency(ch.revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerts */}
            {metrics.users.pending > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">
                            {metrics.users.pending} usuario(s) aguardando aprovacao
                        </p>
                    </div>
                    <Link
                        to="/admin/users"
                        className="text-sm font-medium text-yellow-700 hover:text-yellow-900"
                    >
                        Ver usuarios →
                    </Link>
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Vendas (Últimos 7 dias)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={salesChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                            <Tooltip
                                formatter={(value) => [formatCurrency(value), 'Vendas']}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="vendas"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Orders Pie Chart */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Pedidos por Status</h3>
                    {ordersPieData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={ordersPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {ordersPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-wrap gap-3 justify-center mt-4">
                                {ordersPieData.map((entry) => (
                                    <div key={entry.name} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                        <span className="text-sm text-slate-600">{entry.name}: {entry.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-48 text-slate-400">
                            Nenhum pedido ainda
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Pedidos Recentes</h3>
                    <Link
                        to="/admin/orders"
                        className="text-sm font-medium text-primary hover:text-primary-dark"
                    >
                        Ver todos →
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pedido</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {recentOrders.map((order) => {
                                const status = statusConfig[order.status] || statusConfig.pending
                                const StatusIcon = status.icon
                                return (
                                    <tr key={order.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                            {order.order_number || `#${order.id}`}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {new Date(order.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                            {formatCurrency(order.total)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {status.label}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                            {recentOrders.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        Nenhum pedido encontrado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
