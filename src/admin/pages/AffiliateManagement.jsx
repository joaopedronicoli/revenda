import { useState, useEffect } from 'react'
import { Users, Search, Shield, CheckCircle, XCircle, Mail, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

const typeConfig = {
    influencer_pro: { label: 'Influencer Pro', color: 'bg-purple-100 text-purple-800' },
    renda_extra: { label: 'Renda Extra', color: 'bg-amber-100 text-amber-800' },
    gratuito: { label: 'Gratuito', color: 'bg-slate-100 text-slate-800' }
}

const levelConfig = {
    bronze: { label: 'Bronze', color: 'bg-orange-100 text-orange-800' },
    prata: { label: 'Prata', color: 'bg-slate-200 text-slate-800' },
    ouro: { label: 'Ouro', color: 'bg-yellow-100 text-yellow-800' },
    diamante: { label: 'Diamante', color: 'bg-cyan-100 text-cyan-800' }
}

const statusConfig = {
    active: { label: 'Ativo', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    inactive: { label: 'Inativo', color: 'bg-red-100 text-red-800', icon: XCircle }
}

export default function AffiliateManagement() {
    const { isAdmin } = useAuth()
    const [affiliates, setAffiliates] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [toggling, setToggling] = useState(null)

    useEffect(() => {
        loadAffiliates()
    }, [])

    const loadAffiliates = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/admin/affiliates')
            setAffiliates(data || [])
        } catch (err) {
            console.error('Error loading affiliates:', err)
            setAffiliates([])
        } finally {
            setLoading(false)
        }
    }

    const toggleStatus = async (affiliateId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
        setToggling(affiliateId)
        try {
            await api.put(`/admin/affiliates/${affiliateId}/status`, { status: newStatus })
            setAffiliates(prev =>
                prev.map(a => a.id === affiliateId ? { ...a, status: newStatus } : a)
            )
        } catch (err) {
            console.error('Error toggling affiliate status:', err)
            alert('Erro ao alterar status do afiliado')
        } finally {
            setToggling(null)
        }
    }

    const filteredAffiliates = affiliates.filter(affiliate => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return (
            affiliate.name?.toLowerCase().includes(searchLower) ||
            affiliate.email?.toLowerCase().includes(searchLower)
        )
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Afiliados</h1>
                    <p className="text-slate-500">Gerencie os afiliados e suas comissoes</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Users className="w-4 h-4" />
                    {affiliates.length} afiliados
                </div>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : filteredAffiliates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Users className="w-12 h-12 mb-2" />
                        <p>Nenhum afiliado encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nivel</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendas</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Saldo Comissao</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acoes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredAffiliates.map((affiliate) => {
                                    const type = typeConfig[affiliate.type] || typeConfig.gratuito
                                    const level = levelConfig[affiliate.level] || levelConfig.bronze
                                    const status = statusConfig[affiliate.status] || statusConfig.active
                                    const StatusIcon = status.icon

                                    return (
                                        <tr key={affiliate.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-slate-900">
                                                    {affiliate.name || '-'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 text-sm text-slate-600">
                                                    <Mail className="w-3 h-3" />
                                                    {affiliate.email || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${type.color}`}>
                                                    {type.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${level.color}`}>
                                                    <Shield className="w-3 h-3" />
                                                    {level.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {affiliate.sales_count || 0}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 text-sm font-medium text-slate-900">
                                                    <DollarSign className="w-3 h-3 text-green-600" />
                                                    {formatCurrency(affiliate.commission_balance || 0)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => toggleStatus(affiliate.id, affiliate.status)}
                                                    disabled={toggling === affiliate.id}
                                                    className={`flex items-center gap-1 text-sm font-medium transition-colors disabled:opacity-50 ${
                                                        affiliate.status === 'active'
                                                            ? 'text-red-600 hover:text-red-700'
                                                            : 'text-green-600 hover:text-green-700'
                                                    }`}
                                                    title={affiliate.status === 'active' ? 'Desativar' : 'Ativar'}
                                                >
                                                    {affiliate.status === 'active'
                                                        ? <ToggleRight className="w-5 h-5" />
                                                        : <ToggleLeft className="w-5 h-5" />
                                                    }
                                                    {affiliate.status === 'active' ? 'Desativar' : 'Ativar'}
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
        </div>
    )
}
