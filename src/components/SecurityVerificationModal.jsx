import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { generateVerificationCode, verifyCode } from '../lib/database'
import { useAuth } from '../context/AuthContext'

export default function SecurityVerificationModal({ type, newValue, onSuccess, onCancel }) {
    const { user } = useAuth()
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [codeSent, setCodeSent] = useState(false)

    const sendCode = async () => {
        try {
            setLoading(true)
            setError('')
            const { code: generatedCode } = await generateVerificationCode(user.id, type, newValue)

            // Em produção, enviar código por email
            // Por enquanto, mostrar no console para desenvolvimento
            console.log('🔐 Código de verificação:', generatedCode)
            alert(`Código de verificação (DEV): ${generatedCode}\n\nEm produção, este código será enviado por email.`)

            setCodeSent(true)
        } catch (err) {
            setError('Erro ao enviar código. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async () => {
        if (code.length !== 6) {
            setError('Código deve ter 6 dígitos')
            return
        }

        try {
            setLoading(true)
            setError('')
            const verifiedValue = await verifyCode(user.id, code, type)
            onSuccess(verifiedValue)
        } catch (err) {
            setError('Código inválido ou expirado')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                >
                    <X size={24} />
                </button>

                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    Verificação de Segurança
                </h2>
                <p className="text-slate-600 mb-6">
                    Para alterar seu {type === 'email' ? 'email' : 'WhatsApp'}, precisamos confirmar sua identidade.
                </p>

                {!codeSent ? (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900">
                                <strong>Novo {type === 'email' ? 'email' : 'WhatsApp'}:</strong>
                                <br />
                                {newValue}
                            </p>
                        </div>

                        <button
                            onClick={sendCode}
                            disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Enviando...' : 'Enviar Código de Verificação'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Digite o código de 6 dígitos
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength={6}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                placeholder="000000"
                                autoFocus
                            />
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                Código enviado para seu email
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-800 text-sm">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={sendCode}
                                disabled={loading}
                                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Reenviar Código
                            </button>
                            <button
                                onClick={handleVerify}
                                disabled={loading || code.length !== 6}
                                className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Verificando...' : 'Verificar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
