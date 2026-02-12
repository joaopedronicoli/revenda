import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Users, ShoppingBag, Copy, Share2, Check, ArrowUpRight, MousePointerClick, Wallet, Tag, Image, Download, Clock, CheckCircle, XCircle } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

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

const payoutStatusConfig = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Aprovado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    paid: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: DollarSign },
    rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-800', icon: XCircle }
}

export default function AffiliateDashboard() {
    const { user } = useAuth()
    const [dashboard, setDashboard] = useState(null)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)
    const [copiedCoupon, setCopiedCoupon] = useState(false)

    // Click stats
    const [clickStats, setClickStats] = useState({ totalClicks: 0, uniqueClicks: 0, conversions: 0, conversionRate: '0.0' })

    // Payout
    const [payoutAmount, setPayoutAmount] = useState('')
    const [pixKey, setPixKey] = useState('')
    const [payoutLoading, setPayoutLoading] = useState(false)
    const [payoutError, setPayoutError] = useState('')
    const [payoutSuccess, setPayoutSuccess] = useState('')
    const [payoutHistory, setPayoutHistory] = useState([])

    // Coupon
    const [myCoupon, setMyCoupon] = useState(null)

    // Creatives
    const [creatives, setCreatives] = useState([])

    useEffect(() => {
        loadAll()
    }, [])

    const loadAll = async () => {
        try {
            const [dashRes, clickRes, payoutRes, couponRes, creativesRes] = await Promise.allSettled([
                api.get('/affiliate/dashboard'),
                api.get('/affiliate/click-stats'),
                api.get('/affiliate/payouts/history'),
                api.get('/affiliate/my-coupon'),
                api.get('/affiliate/creatives')
            ])
            if (dashRes.status === 'fulfilled') setDashboard(dashRes.value.data)
            if (clickRes.status === 'fulfilled') setClickStats(clickRes.value.data)
            if (payoutRes.status === 'fulfilled') setPayoutHistory(Array.isArray(payoutRes.value.data) ? payoutRes.value.data : [])
            if (couponRes.status === 'fulfilled') setMyCoupon(couponRes.value.data)
            if (creativesRes.status === 'fulfilled') setCreatives(Array.isArray(creativesRes.value.data) ? creativesRes.value.data : [])
        } catch (err) {
            console.error('Error loading affiliate data:', err)
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

    const requestPayout = async () => {
        setPayoutError('')
        setPayoutSuccess('')
        const amount = parseFloat(payoutAmount)
        if (!amount || amount <= 0) {
            setPayoutError('Informe um valor valido')
            return
        }
        if (!pixKey.trim()) {
            setPayoutError('Informe sua chave PIX')
            return
        }
        setPayoutLoading(true)
        try {
            await api.post('/affiliate/payouts/request', { amount, pixKey })
            setPayoutSuccess('Saque solicitado com sucesso!')
            setPayoutAmount('')
            setPixKey('')
            // Reload data
            const [dashRes, payoutRes] = await Promise.allSettled([
                api.get('/affiliate/dashboard'),
                api.get('/affiliate/payouts/history')
            ])
            if (dashRes.status === 'fulfilled') setDashboard(dashRes.value.data)
            if (payoutRes.status === 'fulfilled') setPayoutHistory(Array.isArray(payoutRes.value.data) ? payoutRes.value.data : [])
        } catch (err) {
            setPayoutError(err.response?.data?.message || 'Erro ao solicitar saque')
        } finally {
            setPayoutLoading(false)
        }
    }

    const copyCouponCode = async () => {
        if (!myCoupon?.code) return
        try {
            await navigator.clipboard.writeText(myCoupon.code)
            setCopiedCoupon(true)
            setTimeout(() => setCopiedCoupon(false), 2000)
        } catch (err) {
            console.error('Error copying coupon:', err)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    const stats = [
        { label: 'Comissoes Totais', value: formatCurrency(dashboard?.total_commissions || 0), icon: DollarSign, color: 'bg-green-50 text-green-600' },
        { label: 'Comissoes do Mes', value: formatCurrency(dashboard?.month_commissions || 0), icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
        { label: 'Indicacoes Ativas', value: dashboard?.active_referrals || 0, icon: Users, color: 'bg-purple-50 text-purple-600' },
        { label: 'Total de Vendas', value: dashboard?.sales_count || 0, icon: ShoppingBag, color: 'bg-amber-50 text-amber-600' }
    ]

    const clickStatCards = [
        { label: 'Total Cliques', value: clickStats.totalClicks, icon: MousePointerClick, color: 'bg-indigo-50 text-indigo-600' },
        { label: 'Cliques Unicos', value: clickStats.uniqueClicks, icon: MousePointerClick, color: 'bg-pink-50 text-pink-600' },
        { label: 'Taxa de Conversao', value: `${clickStats.conversionRate}%`, icon: TrendingUp, color: 'bg-teal-50 text-teal-600' }
    ]

    const level = dashboard?.level || 'bronze'
    const levelInfo = levelConfig[level] || levelConfig.bronze
    const balance = parseFloat(dashboard?.commission_balance || user?.commission_balance || 0)

    return (
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

            {/* Click Stats */}
            <div className="grid grid-cols-3 gap-4">
                {clickStatCards.map(({ label, value, icon: Icon, color }) => (
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

            {/* My Coupon */}
            {myCoupon && (
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <Tag className="w-5 h-5" />
                        Meu Cupom
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/5 border-2 border-dashed border-primary rounded-lg px-6 py-3">
                            <p className="text-xl font-bold text-primary tracking-wider">{myCoupon.code}</p>
                        </div>
                        <button
                            onClick={copyCouponCode}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                            {copiedCoupon ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copiedCoupon ? 'Copiado!' : 'Copiar'}
                        </button>
                    </div>
                    <div className="mt-3 flex gap-4 text-sm text-slate-500">
                        <span>Desconto: {myCoupon.discount_type === 'percentage' ? `${myCoupon.discount_value}%` : formatCurrency(myCoupon.discount_value)}</span>
                        {myCoupon.max_uses && <span>Usos: {myCoupon.current_uses}/{myCoupon.max_uses}</span>}
                    </div>
                </div>
            )}

            {/* Payout Request */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Solicitar Saque
                </h2>
                <p className="text-sm text-slate-500 mb-4">
                    Saldo disponivel: <strong className="text-green-700">{formatCurrency(balance)}</strong>
                </p>

                {payoutError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-3">{payoutError}</div>}
                {payoutSuccess && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-3">{payoutSuccess}</div>}

                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs text-slate-500 mb-1">Valor (R$)</label>
                        <input
                            type="number"
                            value={payoutAmount}
                            onChange={e => setPayoutAmount(e.target.value)}
                            className="w-40 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="0,00"
                            min="0"
                            step="0.01"
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-slate-500 mb-1">Chave PIX</label>
                        <input
                            type="text"
                            value={pixKey}
                            onChange={e => setPixKey(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="CPF, email, telefone ou chave aleatoria"
                        />
                    </div>
                    <button
                        onClick={requestPayout}
                        disabled={payoutLoading}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {payoutLoading ? 'Solicitando...' : 'Solicitar Saque'}
                    </button>
                </div>

                {/* Payout History */}
                {payoutHistory.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Historico de Saques</h3>
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                            {payoutHistory.map(payout => {
                                const st = payoutStatusConfig[payout.status] || payoutStatusConfig.pending
                                const StIcon = st.icon
                                return (
                                    <div key={payout.id} className="px-4 py-3 flex items-center justify-between bg-white hover:bg-slate-50">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{formatCurrency(payout.amount)}</p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(payout.requested_at).toLocaleDateString('pt-BR')}
                                                {payout.pix_key && ` - PIX: ${payout.pix_key}`}
                                            </p>
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>
                                            <StIcon className="w-3 h-3" />
                                            {st.label}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
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

            {/* Creatives/Materials */}
            {creatives.length > 0 && (
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <Image className="w-5 h-5" />
                        Materiais de Divulgacao
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {creatives.map(creative => (
                            <div key={creative.id} className="border border-slate-200 rounded-lg overflow-hidden">
                                <div className="h-32 bg-slate-100 flex items-center justify-center overflow-hidden">
                                    {(creative.type === 'image' || creative.type === 'banner') ? (
                                        <img src={creative.file_url} alt={creative.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <Image className="w-8 h-8 text-slate-400" />
                                    )}
                                </div>
                                <div className="p-3">
                                    <p className="text-sm font-medium text-slate-900 truncate">{creative.title}</p>
                                    {creative.dimensions && <p className="text-xs text-slate-400">{creative.dimensions}</p>}
                                    <a
                                        href={creative.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                        <Download className="w-3 h-3" />
                                        Baixar / Abrir
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
    )
}
