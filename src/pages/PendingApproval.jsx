import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Clock, Mail, LogOut, RefreshCw, CheckCircle } from 'lucide-react'
import api from '../services/api'

export default function PendingApproval() {
    const { user, logout, approvalStatus, refreshApprovalStatus } = useAuth()
    const navigate = useNavigate()
    const [checking, setChecking] = useState(false)
    const [showApprovedModal, setShowApprovedModal] = useState(false)
    const [showStillPendingMessage, setShowStillPendingMessage] = useState(false)
    const [countdown, setCountdown] = useState(7)

    // Countdown timer when approved
    useEffect(() => {
        if (showApprovedModal && countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1)
            }, 1000)
            return () => clearTimeout(timer)
        } else if (showApprovedModal && countdown === 0) {
            navigate('/')
        }
    }, [showApprovedModal, countdown, navigate])

    const checkApprovalStatus = async (e) => {
        if (e) {
            e.preventDefault()
            e.stopPropagation()
        }

        setChecking(true)
        setShowStillPendingMessage(false)

        try {
            // Check directly from API
            const response = await api.get('/auth/me')
            const userData = response.data

            if (userData.approval_status === 'approved') {
                setShowApprovedModal(true)
                // Refresh context so ProtectedRoute picks it up
                await refreshApprovalStatus()
            } else {
                setShowStillPendingMessage(true)
                setTimeout(() => {
                    setShowStillPendingMessage(false)
                }, 3000)
            }
        } catch (error) {
            console.error('Error checking approval:', error)
        } finally {
            setChecking(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4 font-sans">
            <div className="max-w-2xl w-full">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 md:p-12 border border-yellow-200 dark:border-yellow-900">
                    <div className="flex justify-center mb-6">
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 p-6 rounded-full">
                            <Clock className="w-16 h-16 text-yellow-600 dark:text-yellow-500" />
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-white mb-4">
                        Cadastro em Analise
                    </h1>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-6">
                        <p className="text-center text-slate-700 dark:text-slate-300 text-lg mb-4">
                            Ola, <span className="font-semibold">{user?.name || user?.email}</span>!
                        </p>
                        <p className="text-center text-slate-600 dark:text-slate-400 mb-2">
                            Seu cadastro foi recebido e esta sendo analisado por nossa equipe.
                        </p>
                        <p className="text-center text-slate-600 dark:text-slate-400">
                            Em breve voce recebera um <strong>email de confirmacao</strong> e podera acessar nossa loja e fazer seus pedidos.
                        </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 mb-6">
                        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                            Tempo estimado de analise: <strong>ate 24 horas uteis</strong>
                        </p>
                    </div>

                    {showStillPendingMessage && (
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg mb-3 text-center animate-slideDown">
                            Seu cadastro ainda esta em analise. Aguarde!
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={checkApprovalStatus}
                        disabled={checking}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-6 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
                        {checking ? 'Verificando...' : 'Verificar Aprovacao'}
                    </button>

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mb-6">
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-3">
                            Precisa de ajuda?
                        </p>
                        <a
                            href="mailto:revendedor@patriciaelias.com.br"
                            className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-sm"
                        >
                            <Mail className="w-4 h-4" />
                            revendedor@patriciaelias.com.br
                        </a>
                    </div>

                    <button
                        type="button"
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-3 px-6 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Sair
                    </button>
                </div>

                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                    Voce recebera um email em <strong>{user?.email}</strong>
                </p>
            </div>

            {showApprovedModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 md:p-12 max-w-md w-full transform animate-scaleIn">
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75"></div>
                                <div className="relative bg-green-100 dark:bg-green-900/30 p-6 rounded-full">
                                    <CheckCircle className="w-20 h-20 text-green-600 dark:text-green-500 animate-checkmark" />
                                </div>
                            </div>
                        </div>

                        <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-4">
                            Aprovado!
                        </h2>

                        <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
                            Seu cadastro foi aprovado com sucesso!
                            <br />
                            Redirecionando para a loja...
                        </p>

                        <div className="flex justify-center">
                            <div className="relative w-20 h-20">
                                <svg className="transform -rotate-90 w-20 h-20">
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="transparent"
                                        className="text-slate-200 dark:text-slate-700"
                                    />
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="transparent"
                                        strokeDasharray={`${2 * Math.PI * 36}`}
                                        strokeDashoffset={`${2 * Math.PI * 36 * (1 - countdown / 7)}`}
                                        className="text-green-600 dark:text-green-500 transition-all duration-1000 ease-linear"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-green-600 dark:text-green-500">
                                        {countdown}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
