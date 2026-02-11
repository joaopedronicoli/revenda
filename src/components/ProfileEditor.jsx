import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Camera, Save, AlertCircle, CheckCircle } from 'lucide-react'
import { uploadAvatar, getAvatarUrl } from '../lib/database'
import api from '../services/api'
import SecurityVerificationModal from './SecurityVerificationModal'

export default function ProfileEditor() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [avatarUrl, setAvatarUrl] = useState(null)
    const [showVerification, setShowVerification] = useState(false)
    const [verificationType, setVerificationType] = useState(null)
    const [pendingValue, setPendingValue] = useState('')

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

        // Validar tamanho (2MB)
        if (file.size > 2 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Imagem muito grande. Máximo 2MB.' })
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
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Verificar se email ou whatsapp mudaram
        const emailChanged = formData.email !== user.email
        const whatsappChanged = formData.whatsapp !== (user?.phone || '')

        if (emailChanged) {
            setPendingValue(formData.email)
            setVerificationType('email')
            setShowVerification(true)
            return
        }

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
                phone: verifiedValue || formData.whatsapp
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
                            JPG, PNG ou WebP. Máximo 2MB.
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

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            ⚠️ Alterações de email requerem verificação de segurança
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

                    {/* Documento (bloqueado) */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Documento
                        </label>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Tipo:</span>
                                <span className="font-medium text-slate-900">
                                    {formData.documentType === 'cpf' ? 'CPF' : 'CNPJ'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Número:</span>
                                <span className="font-medium text-slate-900">
                                    {formData.cpf || formData.cnpj}
                                </span>
                            </div>
                            {formData.profession && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Profissão:</span>
                                    <span className="font-medium text-slate-900">
                                        {formData.profession}
                                    </span>
                                </div>
                            )}
                            {formData.companyName && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Empresa:</span>
                                    <span className="font-medium text-slate-900">
                                        {formData.companyName}
                                    </span>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-3">
                            🔒 Dados de documento não podem ser alterados
                        </p>
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
