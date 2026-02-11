import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mail, Loader2, CheckCircle, LogOut } from 'lucide-react'

export default function PendingVerification() {
    const { user, logout, resendVerificationEmail } = useAuth()
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')

    const handleResend = async () => {
        setLoading(true)
        setError('')
        setSent(false)

        try {
            await resendVerificationEmail()
            setSent(true)
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao reenviar email')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-primary mb-2">
                        Patricia Elias
                    </h1>
                    <p className="text-slate-500 font-medium">Portal do Revendedor</p>
                </div>

                <div className="py-4">
                    <Mail className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-800 mb-3">Verifique seu Email</h2>
                    <p className="text-slate-600 mb-2">
                        Enviamos um link de verificacao para:
                    </p>
                    <p className="text-primary font-semibold mb-6">
                        {user?.email || 'seu email'}
                    </p>
                    <p className="text-slate-500 text-sm mb-6">
                        Clique no link enviado para confirmar seu email e acessar o portal.
                        Verifique tambem a caixa de spam.
                    </p>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    {sent && (
                        <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm border border-green-100 flex items-center justify-center gap-2">
                            <CheckCircle size={16} />
                            Email reenviado com sucesso!
                        </div>
                    )}

                    <div className="space-y-3">
                        <button
                            onClick={handleResend}
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail size={18} />}
                            Reenviar Email de Verificacao
                        </button>

                        <button
                            onClick={logout}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} />
                            Sair
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
