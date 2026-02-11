import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Loader2, Eye, EyeOff, Smartphone, Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function Login() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const { login, requestOTP, verifyOTP, forgotPassword } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const showVerificationMessage = location.state?.showVerificationMessage

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    // Modes: 'login', 'forgot', 'otp-request', 'otp-verify'
    const [mode, setMode] = useState('login')
    const [otpCode, setOtpCode] = useState('')
    const [sendVia, setSendVia] = useState('whatsapp')

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await login(email, password)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao fazer login')
        } finally {
            setLoading(false)
        }
    }

    const handleForgotPassword = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)

        try {
            await forgotPassword(email, sendVia)
            setSuccess(sendVia === 'whatsapp'
                ? 'Enviamos um link de recuperacao via WhatsApp!'
                : 'Enviamos um link de recuperacao por email!')
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao solicitar recuperacao')
        } finally {
            setLoading(false)
        }
    }

    const handleRequestOTP = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await requestOTP(email, sendVia)
            setMode('otp-verify')
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao solicitar codigo')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOTP = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await verifyOTP(email, otpCode, sendVia)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.message || 'Codigo invalido ou expirado')
        } finally {
            setLoading(false)
        }
    }

    const resetToLogin = () => {
        setMode('login')
        setError('')
        setSuccess('')
        setOtpCode('')
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary mb-2">
                        Patricia Elias
                    </h1>
                    <p className="text-slate-500 font-medium">Portal do Revendedor</p>
                </div>

                {showVerificationMessage && (
                    <div className="bg-blue-50 text-blue-700 p-4 rounded-lg mb-6 text-sm border border-blue-100 flex items-start gap-2">
                        <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-semibold">Cadastro realizado com sucesso!</p>
                            <p>Enviamos um link de verificacao para o seu email. Verifique sua caixa de entrada e spam.</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm border border-red-100">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-6 text-sm border border-green-100">
                        {success}
                    </div>
                )}

                {/* LOGIN MODE */}
                {mode === 'login' && (
                    <>
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    placeholder="seu@email.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Senha</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                        placeholder="Sua senha"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                <div className="flex justify-between mt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                                        className="text-sm text-primary hover:text-primary/80 font-medium"
                                    >
                                        Esqueci minha senha
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setMode('otp-request'); setError(''); setSuccess('') }}
                                        className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
                                    >
                                        <Smartphone size={14} />
                                        Entrar com codigo
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Entrar no Portal
                            </button>
                        </form>
                    </>
                )}

                {/* FORGOT PASSWORD MODE */}
                {mode === 'forgot' && (
                    <form onSubmit={handleForgotPassword} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Enviar recuperacao via:</label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSendVia('whatsapp')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 font-medium transition-all ${sendVia === 'whatsapp' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500'}`}
                                >
                                    <Smartphone size={18} />
                                    WhatsApp
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSendVia('email')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 font-medium transition-all ${sendVia === 'email' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                                >
                                    <Mail size={18} />
                                    Email
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={resetToLogin}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-1"
                            >
                                <ArrowLeft size={16} />
                                Voltar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Enviar
                            </button>
                        </div>
                    </form>
                )}

                {/* OTP REQUEST MODE */}
                {mode === 'otp-request' && (
                    <form onSubmit={handleRequestOTP} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Email da sua conta</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Receber codigo via:</label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSendVia('whatsapp')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 font-medium transition-all ${sendVia === 'whatsapp' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500'}`}
                                >
                                    <Smartphone size={18} />
                                    WhatsApp
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSendVia('email')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 font-medium transition-all ${sendVia === 'email' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                                >
                                    <Mail size={18} />
                                    Email
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={resetToLogin}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-1"
                            >
                                <ArrowLeft size={16} />
                                Voltar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Enviar Codigo
                            </button>
                        </div>
                    </form>
                )}

                {/* OTP VERIFY MODE */}
                {mode === 'otp-verify' && (
                    <form onSubmit={handleVerifyOTP} className="space-y-5">
                        <div className="text-center mb-2">
                            <p className="text-slate-600 text-sm">
                                Enviamos um codigo de 6 digitos para o {sendVia === 'whatsapp' ? 'WhatsApp' : 'email'} cadastrado.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Codigo de acesso</label>
                            <input
                                type="text"
                                required
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-center text-2xl tracking-[0.5em] font-mono"
                                placeholder="000000"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setMode('otp-request'); setOtpCode(''); setError('') }}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-1"
                            >
                                <ArrowLeft size={16} />
                                Voltar
                            </button>
                            <button
                                type="submit"
                                disabled={loading || otpCode.length !== 6}
                                className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Verificar
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleRequestOTP}
                            disabled={loading}
                            className="w-full text-sm text-primary hover:text-primary/80 font-medium"
                        >
                            Reenviar codigo
                        </button>
                    </form>
                )}

                <div className="mt-8 text-center pt-6 border-t border-slate-100">
                    <p className="text-slate-600 mb-2">Ainda nao e revendedor?</p>
                    <Link
                        to="/register"
                        className="text-primary hover:text-primary/80 font-semibold transition-colors"
                    >
                        Criar conta de revendedor
                    </Link>
                </div>
            </div>
        </div>
    )
}
