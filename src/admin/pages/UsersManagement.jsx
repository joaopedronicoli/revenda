import { useState, useEffect } from 'react'
import { Users, Search, Shield, CheckCircle, Clock, XCircle, ShieldOff, Mail, Phone, TrendingUp, UserPlus } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const roleConfig = {
    administrator: { label: 'Administrador', color: 'bg-purple-100 text-purple-800' },
    manager: { label: 'Gerente', color: 'bg-blue-100 text-blue-800' },
    client: { label: 'Cliente', color: 'bg-slate-100 text-slate-800' }
}

const approvalConfig = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-800', icon: XCircle },
    suspended: { label: 'Suspenso', color: 'bg-orange-100 text-orange-800', icon: ShieldOff }
}

const levelConfig = {
    starter: { label: 'Starter', color: 'bg-slate-100 text-slate-700', discount: '30%' },
    prata: { label: 'Prata', color: 'bg-slate-200 text-slate-800', discount: '35%' },
    ouro: { label: 'Ouro', color: 'bg-yellow-100 text-yellow-800', discount: '40%' }
}

export default function UsersManagement() {
    const { isAdmin } = useAuth()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [levelFilter, setLevelFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedUser, setSelectedUser] = useState(null)
    const [updating, setUpdating] = useState(false)
    const [rejectionReason, setRejectionReason] = useState('')
    const [showRejectForm, setShowRejectForm] = useState(false)
    const [levelHistory, setLevelHistory] = useState([])
    const [showLevelHistory, setShowLevelHistory] = useState(false)
    const [pendingLevel, setPendingLevel] = useState(null)
    const [showAddUser, setShowAddUser] = useState(false)
    const [newUser, setNewUser] = useState({ name: '', email: '', telefone: '', role: 'client', approval_status: 'approved' })
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState('')

    useEffect(() => {
        loadUsers()
    }, [filter, levelFilter])

    const loadUsers = async () => {
        setLoading(true)
        try {
            const params = { filter }
            if (levelFilter !== 'all') params.level = levelFilter
            const { data } = await api.get('/admin/users', { params })
            setUsers(data || [])
        } catch (err) {
            console.error('Error loading users:', err)
            setUsers([])
        } finally {
            setLoading(false)
        }
    }

    const updateApprovalStatus = async (userId, newStatus, reason) => {
        setUpdating(true)
        try {
            const payload = { status: newStatus }
            if (newStatus === 'rejected' && reason) {
                payload.rejection_reason = reason
            }
            await api.put(`/admin/users/${userId}/approve`, payload)

            setUsers(prev =>
                prev.map(u => u.id === userId
                    ? { ...u, approval_status: newStatus, rejection_reason: reason || null }
                    : u
                )
            )
            setSelectedUser(null)
            setShowRejectForm(false)
            setRejectionReason('')
        } catch (err) {
            console.error('Error updating approval:', err)
            alert('Erro ao atualizar status')
        } finally {
            setUpdating(false)
        }
    }

    const updateUserRole = async (userId, newRole) => {
        setUpdating(true)
        try {
            await api.put(`/admin/users/${userId}/role`, { role: newRole })

            setUsers(prev =>
                prev.map(u => u.id === userId
                    ? { ...u, role: newRole }
                    : u
                )
            )
            setSelectedUser(null)
        } catch (err) {
            console.error('Error updating role:', err)
            alert('Erro ao atualizar role')
        } finally {
            setUpdating(false)
        }
    }

    const updateUserLevel = async (userId, newLevel) => {
        setUpdating(true)
        try {
            await api.put(`/admin/users/${userId}/level`, { level: newLevel })

            setUsers(prev =>
                prev.map(u => u.id === userId
                    ? { ...u, level: newLevel }
                    : u
                )
            )
        } catch (err) {
            console.error('Error updating level:', err)
            alert('Erro ao atualizar nivel')
        } finally {
            setUpdating(false)
        }
    }

    const loadLevelHistory = async (userId) => {
        try {
            const { data } = await api.get(`/admin/level-history/${userId}`)
            setLevelHistory(data || [])
            setShowLevelHistory(true)
        } catch (err) {
            console.error('Error loading level history:', err)
        }
    }

    const createUser = async () => {
        if (!newUser.name.trim() || !newUser.email.trim()) {
            setCreateError('Nome e email sao obrigatorios')
            return
        }
        setCreating(true)
        setCreateError('')
        try {
            const { data } = await api.post('/admin/users', newUser)
            setUsers(prev => [data, ...prev])
            setShowAddUser(false)
            setNewUser({ name: '', email: '', telefone: '', role: 'client', approval_status: 'approved' })
        } catch (err) {
            setCreateError(err.response?.data?.message || 'Erro ao criar usuario')
        } finally {
            setCreating(false)
        }
    }

    const filteredUsers = users.filter(user => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return (
            user.name?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower) ||
            user.telefone?.includes(search)
        )
    })

    const filterButtons = [
        { key: 'all', label: 'Todos' },
        { key: 'pending', label: 'Pendentes' },
        { key: 'approved', label: 'Aprovados' },
        { key: 'rejected', label: 'Rejeitados' },
        { key: 'suspended', label: 'Suspensos' }
    ]

    const levelFilterButtons = [
        { key: 'all', label: 'Todos Niveis' },
        { key: 'starter', label: 'Starter' },
        { key: 'prata', label: 'Prata' },
        { key: 'ouro', label: 'Ouro' }
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
                    <p className="text-slate-500">Gerencie os usuarios e aprovacoes</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => { setShowAddUser(true); setCreateError(''); }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <UserPlus className="w-4 h-4" />
                        Adicionar Usuario
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou telefone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {filterButtons.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === key
                                ? 'bg-primary text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Level Filters */}
            <div className="flex gap-2 flex-wrap">
                <span className="text-sm text-slate-500 self-center mr-2">Nivel:</span>
                {levelFilterButtons.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setLevelFilter(key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${levelFilter === key
                            ? 'bg-slate-800 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Users className="w-12 h-12 mb-2" />
                        <p>Nenhum usuario encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usuario</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contato</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nivel</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ultima Compra</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acoes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredUsers.map((user) => {
                                    const approval = approvalConfig[user.approval_status] || approvalConfig.pending
                                    const ApprovalIcon = approval.icon
                                    const role = user.role || 'client'
                                    const roleInfo = roleConfig[role] || roleConfig.client
                                    const level = levelConfig[user.level] || levelConfig.starter
                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-slate-900">
                                                    {user.name || '-'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {user.cpf || user.cnpj || '-'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 text-sm text-slate-600">
                                                    <Mail className="w-3 h-3" />
                                                    {user.email || '-'}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <Phone className="w-3 h-3" />
                                                    {user.telefone || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${level.color}`}>
                                                    <Shield className="w-3 h-3" />
                                                    {level.label} ({level.discount})
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${approval.color}`}>
                                                    <ApprovalIcon className="w-3 h-3" />
                                                    {approval.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                                                    {roleInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {user.last_purchase_date
                                                    ? new Date(user.last_purchase_date).toLocaleDateString('pt-BR')
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => { setSelectedUser(user); setShowRejectForm(false); setRejectionReason(''); setShowLevelHistory(false); setPendingLevel(null); }}
                                                    className="text-sm font-medium text-primary hover:text-primary-dark"
                                                >
                                                    Gerenciar
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

            {/* User Detail Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">
                                    Gerenciar Usuario
                                </h2>
                                <button
                                    onClick={() => { setSelectedUser(null); setShowRejectForm(false); setRejectionReason(''); setShowLevelHistory(false); setPendingLevel(null); }}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    X
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* User Info */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-2">Informacoes</h3>
                                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                    <p><span className="font-medium">Nome:</span> {selectedUser.name || '-'}</p>
                                    <p><span className="font-medium">Email:</span> {selectedUser.email}</p>
                                    <p><span className="font-medium">Telefone:</span> {selectedUser.telefone || '-'}</p>
                                    <p><span className="font-medium">Documento:</span> {selectedUser.cpf || selectedUser.cnpj || '-'}</p>
                                    {selectedUser.company_name && (
                                        <p><span className="font-medium">Empresa:</span> {selectedUser.company_name}</p>
                                    )}
                                    {selectedUser.profession && (
                                        <p><span className="font-medium">Profissao:</span> {selectedUser.profession}</p>
                                    )}
                                    <p><span className="font-medium">Acumulado:</span> R$ {parseFloat(selectedUser.total_accumulated || 0).toFixed(2)}</p>
                                    <p><span className="font-medium">Saldo Comissao:</span> R$ {parseFloat(selectedUser.commission_balance || 0).toFixed(2)}</p>
                                    <p><span className="font-medium">Pontos:</span> {selectedUser.points || 0}</p>
                                    {selectedUser.rejection_reason && (
                                        <p className="text-red-600"><span className="font-medium">Motivo rejeicao:</span> {selectedUser.rejection_reason}</p>
                                    )}
                                </div>
                            </div>

                            {/* Level Management */}
                            {isAdmin && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-medium text-slate-500">Alterar Nivel</h3>
                                        <button
                                            onClick={() => loadLevelHistory(selectedUser.id)}
                                            className="text-xs text-primary hover:text-primary-dark"
                                        >
                                            Ver Historico
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        {Object.entries(levelConfig).map(([key, config]) => (
                                            <button
                                                key={key}
                                                onClick={() => setPendingLevel(key)}
                                                disabled={updating || (selectedUser.level || 'starter') === key}
                                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm ${
                                                    (selectedUser.level || 'starter') === key
                                                        ? 'bg-slate-800 text-white'
                                                        : pendingLevel === key
                                                        ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {config.label} ({config.discount})
                                            </button>
                                        ))}
                                    </div>

                                    {/* Level Change Confirmation */}
                                    {pendingLevel && (
                                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <p className="text-sm text-amber-800 mb-3">
                                                Alterar nivel de <strong>{levelConfig[selectedUser.level || 'starter']?.label}</strong> para <strong>{levelConfig[pendingLevel]?.label}</strong>?
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        await updateUserLevel(selectedUser.id, pendingLevel)
                                                        setSelectedUser(prev => prev ? { ...prev, level: pendingLevel } : null)
                                                        setPendingLevel(null)
                                                    }}
                                                    disabled={updating}
                                                    className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
                                                >
                                                    {updating ? 'Alterando...' : 'Confirmar'}
                                                </button>
                                                <button
                                                    onClick={() => setPendingLevel(null)}
                                                    className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Level History */}
                                    {showLevelHistory && levelHistory.length > 0 && (
                                        <div className="mt-3 bg-slate-50 rounded-lg p-3 space-y-2">
                                            <h4 className="text-xs font-medium text-slate-500">Historico de Nivel</h4>
                                            {levelHistory.map((entry, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs">
                                                    <span>
                                                        {levelConfig[entry.old_level]?.label || entry.old_level} → {levelConfig[entry.new_level]?.label || entry.new_level}
                                                    </span>
                                                    <span className="text-slate-400">
                                                        {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Approval Actions */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-2">Aprovacao de Cadastro</h3>
                                <div className="flex flex-wrap gap-2">
                                    {/* Aprovar - para pending, rejected, suspended */}
                                    {['pending', 'rejected', 'suspended'].includes(selectedUser.approval_status) && (
                                        <button
                                            onClick={() => updateApprovalStatus(selectedUser.id, 'approved')}
                                            disabled={updating}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Aprovar
                                        </button>
                                    )}

                                    {/* Rejeitar - para pending */}
                                    {selectedUser.approval_status === 'pending' && !showRejectForm && (
                                        <button
                                            onClick={() => setShowRejectForm(true)}
                                            disabled={updating}
                                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                        >
                                            Rejeitar
                                        </button>
                                    )}

                                    {/* Suspender - para approved */}
                                    {selectedUser.approval_status === 'approved' && (
                                        <button
                                            onClick={() => updateApprovalStatus(selectedUser.id, 'suspended')}
                                            disabled={updating}
                                            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                                        >
                                            Suspender
                                        </button>
                                    )}
                                </div>

                                {/* Rejection reason form */}
                                {showRejectForm && (
                                    <div className="mt-3 space-y-2">
                                        <textarea
                                            placeholder="Motivo da rejeicao (opcional)"
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                                            rows={3}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => updateApprovalStatus(selectedUser.id, 'rejected', rejectionReason)}
                                                disabled={updating}
                                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                                            >
                                                Confirmar Rejeicao
                                            </button>
                                            <button
                                                onClick={() => { setShowRejectForm(false); setRejectionReason(''); }}
                                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Role Assignment (Admin Only) */}
                            {isAdmin && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 mb-2">Alterar Role</h3>
                                    <div className="flex gap-2">
                                        {Object.entries(roleConfig).map(([key, config]) => (
                                            <button
                                                key={key}
                                                onClick={() => updateUserRole(selectedUser.id, key)}
                                                disabled={updating || (selectedUser.role || 'client') === key}
                                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                                                    (selectedUser.role || 'client') === key
                                                        ? 'bg-primary text-white'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {config.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Add User Modal */}
            {showAddUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">Adicionar Usuario</h2>
                                <button
                                    onClick={() => setShowAddUser(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    X
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                                <input
                                    type="text"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Nome completo"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                <input
                                    type="text"
                                    value={newUser.telefone}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, telefone: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="client">Cliente</option>
                                    <option value="manager">Gerente</option>
                                    <option value="administrator">Administrador</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status de Aprovacao</label>
                                <select
                                    value={newUser.approval_status}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, approval_status: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value="approved">Aprovado</option>
                                    <option value="pending">Pendente</option>
                                </select>
                            </div>

                            {createError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
                                    {createError}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={createUser}
                                    disabled={creating}
                                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
                                >
                                    {creating ? 'Criando...' : 'Criar Usuario'}
                                </button>
                                <button
                                    onClick={() => setShowAddUser(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
