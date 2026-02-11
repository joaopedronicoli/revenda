import { useState, useEffect } from 'react'
import { Trophy, ShoppingBag, UserPlus, Zap } from 'lucide-react'
import api from '../services/api'
import Layout from '../components/Layout'
import LevelBadge from '../components/LevelBadge'
import PointsDisplay from '../components/PointsDisplay'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

const tabs = [
    { key: 'sellers', label: 'Top Vendedoras', icon: ShoppingBag, endpoint: '/rankings/top-sellers' },
    { key: 'referrers', label: 'Top Indicadoras', icon: UserPlus, endpoint: '/rankings/top-referrers' },
    { key: 'engagement', label: 'Top Engajamento', icon: Zap, endpoint: '/rankings/top-engagement' }
]

const positionStyles = {
    1: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    2: 'bg-slate-50 text-slate-600 border-slate-200',
    3: 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function Rankings() {
    const [activeTab, setActiveTab] = useState('sellers')
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadRanking()
    }, [activeTab])

    const loadRanking = async () => {
        setLoading(true)
        const tab = tabs.find(t => t.key === activeTab)
        try {
            const { data: result } = await api.get(tab.endpoint)
            setData(result || [])
        } catch (err) {
            console.error('Error loading ranking:', err)
            setData([])
        } finally {
            setLoading(false)
        }
    }

    const renderPosition = (position) => {
        const style = positionStyles[position]
        if (style) {
            return (
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border font-bold text-sm ${style}`}>
                    {position}
                </span>
            )
        }
        return (
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium text-slate-500">
                {position}
            </span>
        )
    }

    const renderSellersTable = () => (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nivel</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pedidos</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total Vendas</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {data.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-50">
                            <td className="px-6 py-4">{renderPosition(index + 1)}</td>
                            <td className="px-6 py-4">
                                <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            </td>
                            <td className="px-6 py-4">
                                <LevelBadge level={item.level} />
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{item.order_count}</td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                {formatCurrency(item.total_sales)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    const renderReferrersTable = () => (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Indicacoes</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendas Geradas</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Comissoes</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {data.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-50">
                            <td className="px-6 py-4">{renderPosition(index + 1)}</td>
                            <td className="px-6 py-4">
                                <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{item.referral_count}</td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                                {formatCurrency(item.total_sales || 0)}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-green-600">
                                {formatCurrency(item.total_commissions || 0)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    const renderEngagementTable = () => (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nivel</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pontos</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Conquistas</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {data.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-50">
                            <td className="px-6 py-4">{renderPosition(index + 1)}</td>
                            <td className="px-6 py-4">
                                <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            </td>
                            <td className="px-6 py-4">
                                <LevelBadge level={item.level} />
                            </td>
                            <td className="px-6 py-4">
                                <PointsDisplay points={item.points} size="sm" />
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                                {item.achievement_count || 0}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    const renderTable = () => {
        switch (activeTab) {
            case 'sellers': return renderSellersTable()
            case 'referrers': return renderReferrersTable()
            case 'engagement': return renderEngagementTable()
            default: return null
        }
    }

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-yellow-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Rankings</h1>
                        <p className="text-slate-500">Veja as melhores vendedoras e indicadoras</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 flex-wrap">
                    {tabs.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                activeTab === key
                                    ? 'bg-primary text-white'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Trophy className="w-12 h-12 mb-2" />
                            <p>Nenhum dado disponivel ainda</p>
                        </div>
                    ) : (
                        renderTable()
                    )}
                </div>
            </div>
        </Layout>
    )
}
