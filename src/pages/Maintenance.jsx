import { Navigate, useNavigate } from 'react-router-dom'
import { Wrench, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Maintenance() {
    const { user, canAccessAdmin, logout } = useAuth()
    const navigate = useNavigate()

    // Admins should never see this page
    if (user && canAccessAdmin) return <Navigate to="/" replace />

    const handleLogin = async () => {
        if (user) await logout()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                    <Wrench className="w-10 h-10 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-3">
                    Site em Manutenção
                </h1>
                <p className="text-slate-500 mb-6">
                    Estamos realizando melhorias. Voltaremos em breve!
                </p>
                <div className="w-16 h-1 bg-amber-400 rounded-full mx-auto mb-8" />
                <button
                    onClick={handleLogin}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                    <LogIn className="w-4 h-4" />
                    Entrar como administrador
                </button>
            </div>
        </div>
    )
}
