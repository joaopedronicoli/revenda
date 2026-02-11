import { useState, useEffect } from 'react'
import { Users, Search, Shield, CheckCircle, XCircle, Mail, DollarSign, ToggleLeft, ToggleRight, UserPlus } from 'lucide-react'
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
    const [showAddAffiliate, setShowAddAffiliate] = useState(false)
    const [newAffiliate, setNewAffiliate] = useState({ name: '', email: '', telefone: '', affiliate_type: 'gratuito' })
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState('')

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
                prev.map(a => a.id === affiliateId ? { ...a, affiliate_status: newStatus } : a)
            )
        } catch (err) {
            console.error('Error toggling affiliate status:', err)
            alert('Erro ao alterar status do afiliado')
        } finally {
            setToggling(null)
        }
    }

    const createAffiliate = async () => {
        if (!newAffiliate.name || !newAffiliate.email) {
            setCreateError('Nome e email sao obrigatorios')
            return
        }
        setCreating(true)
        setCreateError('')
        try {
            await api.post('/admin/users', {
                name: newAffiliate.name,
                email: newAffiliate.email,
                telefone: newAffiliate.telefone,
                role: 'client',
                approval_status: 'approved',
                affiliate_type: newAffiliate.affiliate_type
            })
            setShowAddAffiliate(false)
            setNewAffiliate({ name: '', email: '', telefone: '', affiliate_type: 'gratuito' })
            loadAffiliates()
        } catch (err) {
            console.error('Error creating affiliate:', err)
            setCreateError(err.response?.data?.message || 'Erro ao criar afiliado')
        } finally {
            setCreating(false)
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
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Users className="w-4 h-4" />
                        {affiliates.length} afiliados
                    </div>
                    <button
                        onClick={() => setShowAddAffiliate(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <UserPlus className="w-4 h-4" />
                        Adicionar Afiliado
                    </button>
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
                                    const type = typeConfig[affiliate.affiliate_type] || typeConfig.gratuito
                                    const level = levelConfig[affiliate.affiliate_level] || levelConfig.bronze
                                    const status = statusConfig[affiliate.affiliate_status] || statusConfig.active
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
                                                {affiliate.affiliate_sales_count || 0}
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
                                                    onClick={() => toggleStatus(affiliate.id, affiliate.affiliate_status)}
                                                    disabled={toggling === affiliate.id}
                                                    className={`flex items-center gap-1 text-sm font-medium transition-colors disabled:opacity-50 ${
                                                        affiliate.affiliate_status === 'active'
                                                            ? 'text-red-600 hover:text-red-700'
                                                            : 'text-green-600 hover:text-green-700'
                                                    }`}
                                                    title={affiliate.affiliate_status === 'active' ? 'Desativar' : 'Ativar'}
                                                >
                                                    {affiliate.affiliate_status === 'active'
                                                        ? <ToggleRight className="w-5 h-5" />
                                                        : <ToggleLeft className="w-5 h-5" />
                                                    }
                                                    {affiliate.affiliate_status === 'active' ? 'Desativar' : 'Ativar'}
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
            {/* Add Affiliate Modal */}
            {showAddAffiliate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">Adicionar Afiliado</h2>
                                <button
                                    onClick={() => { setShowAddAffiliate(false); setCreateError('') }}
                                    className="text-slate-400 hover:text-slate-600 text-xl"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            {createError && (
                                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                                    {createError}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                                <input
                                    type="text"
                                    value={newAffiliate.name}
                                    onChange={(e) => setNewAffiliate(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Nome do afiliado"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={newAffiliate.email}
                                    onChange={(e) => setNewAffiliate(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                <input
                                    type="text"
                                    value={newAffiliate.telefone}
                                    onChange={(e) => setNewAffiliate(prev => ({ ...prev, telefone: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="(11) 99999-9999"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Afiliado</label>
                                <select
                                    value={newAffiliate.affiliate_type}
                                    onChange={(e) => setNewAffiliate(prev => ({ ...prev, affiliate_type: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="gratuito">Gratuito</option>
                                    <option value="renda_extra">Renda Extra</option>
                                    <option value="influencer_pro">Influencer Pro</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setShowAddAffiliate(false); setCreateError('') }}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={createAffiliate}
                                    disabled={creating}
                                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {creating ? 'Criando...' : 'Criar Afiliado'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
