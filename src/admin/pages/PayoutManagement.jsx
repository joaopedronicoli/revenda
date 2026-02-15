import { useState, useEffect } from 'react'
import { Wallet, DollarSign, CheckCircle, XCircle, Clock, Search, CreditCard, Ban } from 'lucide-react'
import api from '../../services/api'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

const statusConfig = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Aprovado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    paid: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: DollarSign },
    rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-800', icon: XCircle }
}

const tabs = [
    { key: '', label: 'Todos' },
    { key: 'pending', label: 'Pendentes' },
    { key: 'approved', label: 'Aprovados' },
    { key: 'paid', label: 'Pagos' },
    { key: 'rejected', label: 'Rejeitados' }
]

export default function PayoutManagement() {
    const [payouts, setPayouts] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('')
    const [search, setSearch] = useState('')
    const [processing, setProcessing] = useState(null)
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectModal, setShowRejectModal] = useState(null)

    useEffect(() => {
        loadPayouts()
    }, [activeTab])

    const loadPayouts = async () => {
        setLoading(true)
        try {
            const params = activeTab ? `?status=${activeTab}` : ''
            const { data } = await api.get(`/admin/payouts${params}`)
            setPayouts(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error('Error loading payouts:', err)
            setPayouts([])
        } finally {
            setLoading(false)
        }
    }

    const processPayout = async (payoutId, action, notes) => {
        setProcessing(payoutId)
        try {
            await api.put(`/admin/payouts/${payoutId}/process`, { action, notes })
            loadPayouts()
            setShowRejectModal(null)
            setRejectReason('')
        } catch (err) {
            console.error('Error processing payout:', err)
            alert(err.response?.data?.message || 'Erro ao processar saque')
        } finally {
            setProcessing(null)
        }
    }

    const filteredPayouts = payouts.filter(p => {
        if (!search) return true
        const s = search.toLowerCase()
        return p.user_name?.toLowerCase().includes(s) || p.user_email?.toLowerCase().includes(s)
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Wallet className="w-6 h-6" />
                    Gestao de Saques
                </h1>
                <p className="text-slate-500">Gerencie as solicitacoes de saque dos indicadores</p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                            activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : filteredPayouts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Wallet className="w-12 h-12 mb-2" />
                        <p>Nenhum saque encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Email</th>
                                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase">Valor</th>
                                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Metodo</th>
                                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Chave PIX</th>
                                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Data</th>
                                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-slate-500 uppercase">Acoes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredPayouts.map(payout => {
                                    const st = statusConfig[payout.status] || statusConfig.pending
                                    const StIcon = st.icon
                                    return (
                                        <tr key={payout.id} className="hover:bg-slate-50">
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm font-medium text-slate-900">{payout.user_name || '-'}</td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm text-slate-600 hidden md:table-cell">{payout.user_email || '-'}</td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4">
                                                <span className="text-sm font-bold text-green-700">{formatCurrency(payout.amount)}</span>
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm text-slate-600 uppercase hidden md:table-cell">{payout.method}</td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm text-slate-600 font-mono hidden md:table-cell">{payout.pix_key || '-'}</td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>
                                                    <StIcon className="w-3 h-3" />
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm text-slate-500 hidden md:table-cell">
                                                {new Date(payout.requested_at).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 sm:py-4">
                                                <div className="flex items-center gap-1">
                                                    {payout.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => processPayout(payout.id, 'approve')}
                                                                disabled={processing === payout.id}
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Aprovar"
                                                            >
                                                                <CheckCircle className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setShowRejectModal(payout.id)}
                                                                disabled={processing === payout.id}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                title="Rejeitar"
                                                            >
                                                                <Ban className="w-5 h-5" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {payout.status === 'approved' && (
                                                        <button
                                                            onClick={() => processPayout(payout.id, 'pay')}
                                                            disabled={processing === payout.id}
                                                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                        >
                                                            <CreditCard className="w-3 h-3" />
                                                            Marcar Pago
                                                        </button>
                                                    )}
                                                    {payout.admin_notes && (
                                                        <span className="text-xs text-slate-400 ml-2" title={payout.admin_notes}>
                                                            Nota: {payout.admin_notes.substring(0, 30)}...
                                                        </span>
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

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Rejeitar Saque</h2>
                        <p className="text-sm text-slate-500 mb-4">O valor sera devolvido ao saldo do indicador.</p>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo (opcional)</label>
                            <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary h-24"
                                placeholder="Informe o motivo da rejeicao..."
                            />
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => { setShowRejectModal(null); setRejectReason('') }}
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => processPayout(showRejectModal, 'reject', rejectReason)}
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {processing ? 'Rejeitando...' : 'Rejeitar Saque'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
