import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Users, ShoppingBag, Copy, Share2, Check, ArrowUpRight } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

const levelConfig = {
    bronze: { label: 'Bronze', color: 'bg-orange-100 text-orange-800', next: 'Prata', nextTarget: 'R$ 5.000 em vendas' },
    prata: { label: 'Prata', color: 'bg-slate-200 text-slate-800', next: 'Ouro', nextTarget: 'R$ 15.000 em vendas' },
    ouro: { label: 'Ouro', color: 'bg-yellow-100 text-yellow-800', next: 'Diamante', nextTarget: 'R$ 50.000 em vendas' },
    diamante: { label: 'Diamante', color: 'bg-cyan-100 text-cyan-800', next: null, nextTarget: null }
}

export default function AffiliateDashboard() {
    const { user } = useAuth()
    const [dashboard, setDashboard] = useState(null)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            const { data } = await api.get('/affiliate/dashboard')
            setDashboard(data)
        } catch (err) {
            console.error('Error loading affiliate dashboard:', err)
        } finally {
            setLoading(false)
        }
    }

    const referralCode = dashboard?.referral_code || user?.referral_code || ''
    const shareLink = `${window.location.origin}/register?ref=${referralCode}`

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareLink)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Error copying link:', err)
        }
    }

    const shareNative = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Convite de afiliada',
                    text: `Compre com meu link e aproveite ofertas exclusivas!`,
                    url: shareLink
                })
            } catch (err) {
                // User cancelled
            }
        } else {
            copyLink()
        }
    }

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </Layout>
        )
    }

    const stats = [
        {
            label: 'Comissoes Totais',
            value: formatCurrency(dashboard?.total_commissions || 0),
            icon: DollarSign,
            color: 'bg-green-50 text-green-600'
        },
        {
            label: 'Comissoes do Mes',
            value: formatCurrency(dashboard?.month_commissions || 0),
            icon: TrendingUp,
            color: 'bg-blue-50 text-blue-600'
        },
        {
            label: 'Indicacoes Ativas',
            value: dashboard?.active_referrals || 0,
            icon: Users,
            color: 'bg-purple-50 text-purple-600'
        },
        {
            label: 'Total de Vendas',
            value: dashboard?.sales_count || 0,
            icon: ShoppingBag,
            color: 'bg-amber-50 text-amber-600'
        }
    ]

    const level = dashboard?.level || 'bronze'
    const levelInfo = levelConfig[level] || levelConfig.bronze

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Painel de Afiliada</h1>
                    <p className="text-slate-500">Acompanhe suas comissoes e indicacoes</p>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">{label}</p>
                            <p className="text-lg font-bold text-slate-900">{value}</p>
                        </div>
                    ))}
                </div>

                {/* Referral Code & Share Link */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Seu Link de Afiliada</h2>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                            <p className="text-lg font-bold text-primary tracking-wider text-center">
                                {referralCode || '---'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            value={shareLink}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600"
                        />
                        <button
                            onClick={copyLink}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                        <button
                            onClick={shareNative}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                        >
                            <Share2 className="w-4 h-4" />
                            Compartilhar
                        </button>
                    </div>
                </div>

                {/* Affiliate Level Progress */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Nivel de Afiliada</h2>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${levelInfo.color}`}>
                            {levelInfo.label}
                        </span>
                    </div>

                    {levelInfo.next ? (
                        <>
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-slate-600 flex items-center gap-1">
                                    <ArrowUpRight className="w-4 h-4" />
                                    Proximo nivel: <strong>{levelInfo.next}</strong>
                                </span>
                                <span className="text-slate-500">{levelInfo.nextTarget}</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, dashboard?.level_progress || 0)}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {dashboard?.level_progress || 0}% concluido
                            </p>
                        </>
                    ) : (
                        <div className="bg-yellow-50 px-3 py-2 rounded-lg text-sm text-yellow-800 font-medium">
                            Nivel maximo atingido! Parabens!
                        </div>
                    )}
                </div>

                {/* Commission History */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-900">Historico de Comissoes</h2>
                    </div>

                    {dashboard?.commission_history && dashboard.commission_history.length > 0 ? (
                        <div className="divide-y divide-slate-200">
                            {dashboard.commission_history.map((item, index) => (
                                <div key={index} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">{item.description}</p>
                                        <p className="text-xs text-slate-500">
                                            {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                            {item.referred_name && ` - via ${item.referred_name}`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${
                                            item.type === 'credit' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {item.type === 'credit' ? '+' : '-'}{formatCurrency(item.amount)}
                                        </p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            item.status === 'paid'
                                                ? 'bg-green-100 text-green-700'
                                                : item.status === 'pending'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {item.status === 'paid' ? 'Pago' : item.status === 'pending' ? 'Pendente' : item.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                            <DollarSign className="w-10 h-10 mb-2" />
                            <p>Nenhuma comissao ainda</p>
                            <p className="text-sm">Compartilhe seu link para comecar a ganhar!</p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
