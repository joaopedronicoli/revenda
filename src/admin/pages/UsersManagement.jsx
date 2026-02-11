import { useState, useEffect } from 'react'
import { Users, Search, Shield, CheckCircle, Clock, XCircle, Mail, Phone } from 'lucide-react'
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
    rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-800', icon: XCircle }
}

export default function UsersManagement() {
    const { isAdmin } = useAuth()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedUser, setSelectedUser] = useState(null)
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        loadUsers()
    }, [filter])

    const loadUsers = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/admin/users', { params: { filter } })
            setUsers(data || [])
        } catch (err) {
            console.error('Error loading users:', err)
            setUsers([])
        } finally {
            setLoading(false)
        }
    }

    const updateApprovalStatus = async (userId, newStatus) => {
        setUpdating(true)
        try {
            await api.put(`/admin/users/${userId}/approve`, { status: newStatus })

            setUsers(prev =>
                prev.map(u => u.user_id === userId
                    ? { ...u, approval_status: newStatus }
                    : u
                )
            )
            setSelectedUser(null)
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
                prev.map(u => u.user_id === userId
                    ? { ...u, user_roles: { role: newRole } }
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

    const filteredUsers = users.filter(user => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return (
            user.full_name?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower) ||
            user.whatsapp?.includes(search)
        )
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
                    <p className="text-slate-500">Gerencie os usuários e aprovações</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email ou WhatsApp..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    {['all', 'pending', 'approved'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                                ? 'bg-primary text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {status === 'all' ? 'Todos' : status === 'pending' ? 'Pendentes' : 'Aprovados'}
                        </button>
                    ))}
                </div>
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
                        <p>Nenhum usuário encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usuário</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contato</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cadastro</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredUsers.map((user) => {
                                    const approval = approvalConfig[user.approval_status] || approvalConfig.pending
                                    const ApprovalIcon = approval.icon
                                    const role = user.user_roles?.role || 'client'
                                    const roleInfo = roleConfig[role] || roleConfig.client
                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-medium text-slate-900">
                                                    {user.full_name || '-'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {user.cpf || '-'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 text-sm text-slate-600">
                                                    <Mail className="w-3 h-3" />
                                                    {user.email || '-'}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <Phone className="w-3 h-3" />
                                                    {user.whatsapp || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${approval.color}`}>
                                                    <ApprovalIcon className="w-3 h-3" />
                                                    {approval.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
                                                    <Shield className="w-3 h-3" />
                                                    {roleInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => setSelectedUser(user)}
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
                    <div className="bg-white rounded-xl max-w-lg w-full">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">
                                    Gerenciar Usuário
                                </h2>
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* User Info */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-2">Informações</h3>
                                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                    <p><span className="font-medium">Nome:</span> {selectedUser.full_name}</p>
                                    <p><span className="font-medium">Email:</span> {selectedUser.email}</p>
                                    <p><span className="font-medium">WhatsApp:</span> {selectedUser.whatsapp}</p>
                                    <p><span className="font-medium">CPF:</span> {selectedUser.cpf}</p>
                                </div>
                            </div>

                            {/* Approval Actions */}
                            {selectedUser.approval_status === 'pending' && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 mb-2">Aprovação de Cadastro</h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateApprovalStatus(selectedUser.user_id, 'approved')}
                                            disabled={updating}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Aprovar
                                        </button>
                                        <button
                                            onClick={() => updateApprovalStatus(selectedUser.user_id, 'rejected')}
                                            disabled={updating}
                                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                        >
                                            Rejeitar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Role Assignment (Admin Only) */}
                            {isAdmin && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 mb-2">Alterar Role</h3>
                                    <div className="flex gap-2">
                                        {Object.entries(roleConfig).map(([key, config]) => (
                                            <button
                                                key={key}
                                                onClick={() => updateUserRole(selectedUser.user_id, key)}
                                                disabled={updating || (selectedUser.user_roles?.role || 'client') === key}
                                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                                                    (selectedUser.user_roles?.role || 'client') === key
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
        </div>
    )
}
