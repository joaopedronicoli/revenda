import { useState, useEffect } from 'react'
import { Copy, Share2, Users, DollarSign, Check, Clock } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

export default function Referrals() {
    const { user } = useAuth()
    const [referrals, setReferrals] = useState([])
    const [commissions, setCommissions] = useState({ balance: 0, history: [] })
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    const referralCode = user?.referral_code || ''
    const shareLink = `${window.location.origin}/register?ref=${referralCode}`

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const [referralsRes, commissionsRes] = await Promise.all([
                api.get('/users/me/referrals'),
                api.get('/users/me/commissions')
            ])
            setReferrals(referralsRes.data || [])
            setCommissions(commissionsRes.data || { balance: 0, history: [] })
        } catch (err) {
            console.error('Error loading referrals:', err)
        } finally {
            setLoading(false)
        }
    }

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(referralCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Error copying code:', err)
        }
    }

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
                    title: 'Convite para revenda',
                    text: `Use meu codigo de indicacao: ${referralCode}`,
                    url: shareLink
                })
            } catch (err) {
                // User cancelled share
            }
        } else {
            copyLink()
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Indicacoes</h1>
                    <p className="text-slate-500">Indique amigas e ganhe comissoes sobre as vendas delas</p>
                </div>

                {/* Referral Code & Share */}
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Seu Codigo de Indicacao</h2>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                            <p className="text-2xl font-bold text-primary tracking-widest text-center">
                                {referralCode || '---'}
                            </p>
                        </div>
                        <button
                            onClick={copyCode}
                            className="px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                            {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            value={shareLink}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600"
                        />
                        <button
                            onClick={shareNative}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                        >
                            <Share2 className="w-4 h-4" />
                            Compartilhar
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Indicacoes Ativas</p>
                                <p className="text-2xl font-bold text-slate-900">{referrals.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Saldo de Comissoes</p>
                                <p className="text-2xl font-bold text-slate-900">{formatCurrency(commissions.balance)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Referred Users */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-900">Pessoas Indicadas</h2>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : referrals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                            <Users className="w-10 h-10 mb-2" />
                            <p>Nenhuma indicacao ainda</p>
                            <p className="text-sm">Compartilhe seu codigo para comecar!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Data</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Compras</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {referrals.map((ref) => (
                                        <tr key={ref.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                {ref.name || ref.email}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {new Date(ref.created_at).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                                    ref.status === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {ref.status === 'active' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                    {ref.status === 'active' ? 'Ativa' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {ref.order_count || 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Commission History */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-900">Historico de Comissoes</h2>
                    </div>

                    {commissions.history && commissions.history.length > 0 ? (
                        <div className="divide-y divide-slate-200">
                            {commissions.history.map((item, index) => (
                                <div key={index} className="px-6 py-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-900">{item.description}</p>
                                        <p className="text-xs text-slate-500">
                                            {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${item.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.type === 'credit' ? '+' : '-'}{formatCurrency(item.amount)}
                                        </p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            item.status === 'paid'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {item.status === 'paid' ? 'Pago' : 'Pendente'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                            <DollarSign className="w-10 h-10 mb-2" />
                            <p>Nenhuma comissao ainda</p>
                        </div>
                    )}
                </div>
        </div>
    )
}
