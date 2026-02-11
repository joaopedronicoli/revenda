import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function ResetPassword() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { resetPassword } = useAuth()

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const token = searchParams.get('token')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        if (password !== confirmPassword) {
            setError('As senhas nao coincidem')
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setError('A senha deve ter no minimo 6 caracteres')
            setLoading(false)
            return
        }

        if (!token) {
            setError('Token de recuperacao nao encontrado. Solicite um novo link.')
            setLoading(false)
            return
        }

        try {
            await resetPassword(token, password)
            setSuccess(true)
            setTimeout(() => {
                navigate('/login')
            }, 3000)
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao redefinir senha')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
                    <div className="text-center">
                        <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6 border border-green-100">
                            <h2 className="text-xl font-bold mb-2">Senha Redefinida!</h2>
                            <p className="text-sm">
                                Sua senha foi alterada com sucesso. Redirecionando para o login...
                            </p>
                        </div>
                        <Link
                            to="/login"
                            className="text-primary hover:text-primary/80 font-semibold transition-colors"
                        >
                            Ir para o login
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary mb-2">
                        Redefinir Senha
                    </h1>
                    <p className="text-slate-500 font-medium">Digite sua nova senha</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Nova Senha</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            placeholder="Minimo 6 caracteres"
                            minLength={6}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Confirmar Nova Senha</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                            placeholder="Digite a senha novamente"
                            minLength={6}
                        />
                        {confirmPassword && password !== confirmPassword && (
                            <p className="text-xs text-red-500 mt-1">As senhas nao coincidem</p>
                        )}
                        {confirmPassword && password === confirmPassword && password.length >= 6 && (
                            <p className="text-xs text-green-600 mt-1">As senhas coincidem</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || password !== confirmPassword || password.length < 6}
                        className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Redefinir Senha
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-slate-100">
                    <Link
                        to="/login"
                        className="text-primary hover:text-primary/80 font-semibold transition-colors"
                    >
                        Voltar para o login
                    </Link>
                </div>
            </div>
        </div>
    )
}
