import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Camera, Save, AlertCircle, CheckCircle, Trash2 } from 'lucide-react'
import { uploadAvatar, getAvatarUrl } from '../lib/database'
import api from '../services/api'
import SecurityVerificationModal from './SecurityVerificationModal'

export default function ProfileEditor() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [avatarUrl, setAvatarUrl] = useState(null)
    const [showVerification, setShowVerification] = useState(false)
    const [verificationType, setVerificationType] = useState(null)
    const [pendingValue, setPendingValue] = useState('')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        whatsapp: user?.phone || '',
        documentType: user?.documentType || '',
        cpf: user?.cpf || '',
        cnpj: user?.cnpj || '',
        profession: user?.profession || '',
        companyName: user?.companyName || ''
    })

    useEffect(() => {
        loadAvatar()
    }, [])

    const loadAvatar = async () => {
        try {
            const url = await getAvatarUrl(user.id)
            setAvatarUrl(url)
        } catch (error) {
            console.error('Error loading avatar:', error)
        }
    }

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validar tamanho (10MB)
        if (file.size > 10 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Imagem muito grande. Máximo 10MB.' })
            return
        }

        // Validar tipo
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Apenas imagens são permitidas.' })
            return
        }

        try {
            setLoading(true)
            setMessage(null)
            const url = await uploadAvatar(user.id, file)
            setAvatarUrl(url)
            setMessage({ type: 'success', text: 'Foto atualizada com sucesso!' })
        } catch (error) {
            console.error('Avatar upload error:', error)

            // Mensagens de erro específicas
            let errorMessage = 'Erro ao fazer upload da foto.'

            if (error.message?.includes('Bucket not found')) {
                errorMessage = 'Erro de configuração: bucket de storage não encontrado. Entre em contato com o suporte.'
            } else if (error.message?.includes('row-level security')) {
                errorMessage = 'Erro de permissão: você não tem autorização para fazer upload. Entre em contato com o suporte.'
            } else if (error.message?.includes('413') || error.message?.includes('Payload Too Large')) {
                errorMessage = 'Imagem muito grande. Tente uma imagem menor.'
            } else if (error.message) {
                errorMessage = `Erro: ${error.message}`
            }

            setMessage({ type: 'error', text: errorMessage })
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        let finalValue = value
        if (name === 'whatsapp') {
            const digits = value.replace(/\D/g, '').slice(0, 11)
            if (digits.length === 0) finalValue = ''
            else if (digits.length <= 2) finalValue = `(${digits}`
            else if (digits.length <= 7) finalValue = `(${digits.slice(0, 2)}) ${digits.slice(2)}`
            else finalValue = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
        }
        setFormData(prev => ({ ...prev, [name]: finalValue }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Verificar se whatsapp mudou (email não é editável)
        const whatsappChanged = formData.whatsapp !== (user?.phone || '')

        if (whatsappChanged) {
            setPendingValue(formData.whatsapp)
            setVerificationType('whatsapp')
            setShowVerification(true)
            return
        }

        // Salvar outros dados
        await saveProfile()
    }

    const saveProfile = async (verifiedValue = null) => {
        try {
            setLoading(true)

            const updates = {
                name: formData.name,
                telefone: verifiedValue || formData.whatsapp,
                document_type: formData.documentType,
                cpf: formData.cpf,
                cnpj: formData.cnpj,
                company_name: formData.companyName,
                profession: formData.profession,
            }

            // Se email foi verificado, incluir no update
            if (verifiedValue && verificationType === 'email') {
                updates.email = verifiedValue
            }

            await api.put('/users/me', updates)

            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' })
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao atualizar perfil.' })
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAccount = async () => {
        setDeleteLoading(true)
        try {
            await api.delete('/users/me')
            await logout()
            navigate('/login')
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao excluir conta. Tente novamente.' })
            setShowDeleteConfirm(false)
        } finally {
            setDeleteLoading(false)
        }
    }

    const handleVerificationSuccess = async (newValue) => {
        setShowVerification(false)
        if (verificationType === 'email') {
            setFormData(prev => ({ ...prev, email: newValue }))
        } else {
            setFormData(prev => ({ ...prev, whatsapp: newValue }))
        }
        await saveProfile(newValue)
    }

    return (
        <div className="max-w-2xl">
            {message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-xl p-8 border border-slate-200">
                {/* Avatar */}
                <div className="flex items-center gap-6 mb-8 pb-8 border-b border-slate-200">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-slate-200 overflow-hidden">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-3xl font-bold">
                                    {formData.name?.[0]?.toUpperCase() || '?'}
                                </div>
                            )}
                        </div>
                        <label className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full cursor-pointer hover:bg-primary-dark transition-colors">
                            <Camera size={16} />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="hidden"
                            />
                        </label>
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900 mb-1">Foto de Perfil</h3>
                        <p className="text-sm text-slate-600">
                            JPG, PNG ou WebP. Máximo 10MB.
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Nome */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Nome Completo
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                    </div>

                    {/* Email (não editável) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            disabled
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            O email não pode ser alterado
                        </p>
                    </div>

                    {/* WhatsApp */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            WhatsApp
                        </label>
                        <input
                            type="text"
                            name="whatsapp"
                            value={formData.whatsapp}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            ⚠️ Alterações de WhatsApp requerem verificação de segurança
                        </p>
                    </div>

                    {/* Documento */}
                    <div className="space-y-4 p-4 rounded-lg border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700">Dados do Documento</h4>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Documento</label>
                            <select
                                name="documentType"
                                value={formData.documentType}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            >
                                <option value="">Selecione...</option>
                                <option value="cpf">CPF</option>
                                <option value="cnpj">CNPJ</option>
                            </select>
                        </div>

                        {formData.documentType === 'cpf' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                                <input
                                    type="text"
                                    name="cpf"
                                    value={formData.cpf}
                                    onChange={handleChange}
                                    placeholder="000.000.000-00"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                            </div>
                        )}

                        {formData.documentType === 'cnpj' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                                    <input
                                        type="text"
                                        name="cnpj"
                                        value={formData.cnpj}
                                        onChange={handleChange}
                                        placeholder="00.000.000/0000-00"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Empresa</label>
                                    <input
                                        type="text"
                                        name="companyName"
                                        value={formData.companyName}
                                        onChange={handleChange}
                                        placeholder="Razão Social"
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Profissão</label>
                            <input
                                type="text"
                                name="profession"
                                value={formData.profession}
                                onChange={handleChange}
                                placeholder="Ex: Esteticista, Farmacêutico..."
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Save size={20} />
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </form>
            </div>

            {/* Delete Account */}
            <div className="mt-8 pt-8 border-t border-red-200">
                <h4 className="text-sm font-semibold text-red-600 mb-2">Zona de Perigo</h4>
                <p className="text-xs text-slate-500 mb-4">
                    Ao excluir sua conta, todos os seus dados, pedidos e endereços serão removidos permanentemente.
                </p>
                <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
                >
                    <Trash2 size={16} />
                    Excluir minha conta
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-red-600 mb-2">Excluir Conta</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Esta ação é irreversível. Todos os seus dados serão excluídos permanentemente.
                        </p>
                        <p className="text-sm text-slate-700 mb-3">
                            Digite <strong>EXCLUIR</strong> para confirmar:
                        </p>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none mb-4"
                            placeholder="EXCLUIR"
                        />
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={deleteConfirmText !== 'EXCLUIR' || deleteLoading}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {deleteLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Modal */}
            {showVerification && (
                <SecurityVerificationModal
                    type={verificationType}
                    newValue={pendingValue}
                    onSuccess={handleVerificationSuccess}
                    onCancel={() => setShowVerification(false)}
                />
            )}
        </div>
    )
}
