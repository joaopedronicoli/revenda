import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Clock, Mail, LogOut, RefreshCw, CheckCircle, XCircle, ShieldOff, Send } from 'lucide-react'
import api from '../services/api'

export default function PendingApproval() {
    const { user, logout, approvalStatus, refreshApprovalStatus } = useAuth()
    const navigate = useNavigate()
    const [checking, setChecking] = useState(false)
    const [requesting, setRequesting] = useState(false)
    const [showApprovedModal, setShowApprovedModal] = useState(false)
    const [showStillPendingMessage, setShowStillPendingMessage] = useState(false)
    const [requestSentMessage, setRequestSentMessage] = useState(false)
    const [countdown, setCountdown] = useState(7)

    // Auto-check approval every 30s
    useEffect(() => {
        if (showApprovedModal) return
        const interval = setInterval(async () => {
            try {
                const response = await api.get('/users/me')
                if (response.data?.approval_status === 'approved') {
                    setShowApprovedModal(true)
                    await refreshApprovalStatus()
                }
            } catch (e) { /* ignore */ }
        }, 30000)
        return () => clearInterval(interval)
    }, [showApprovedModal, refreshApprovalStatus])

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
            const response = await api.get('/users/me')
            const userData = response.data

            if (userData.approval_status === 'approved') {
                setShowApprovedModal(true)
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

    const requestReapproval = async () => {
        setRequesting(true)
        try {
            await api.post('/users/me/request-approval')
            setRequestSentMessage(true)
            await refreshApprovalStatus()
            setTimeout(() => setRequestSentMessage(false), 5000)
        } catch (error) {
            console.error('Error requesting reapproval:', error)
            alert('Erro ao reenviar solicitacao. Tente novamente.')
        } finally {
            setRequesting(false)
        }
    }

    const isSuspended = approvalStatus === 'suspended'
    const isRejected = approvalStatus === 'rejected'
    const isPending = !isSuspended && !isRejected

    const getStatusConfig = () => {
        if (isSuspended) {
            return {
                icon: ShieldOff,
                iconBg: 'bg-red-100 dark:bg-red-900/30',
                iconColor: 'text-red-600 dark:text-red-500',
                title: 'Cadastro Suspenso',
                bgGradient: 'from-red-50 to-orange-50 dark:from-slate-900 dark:to-slate-800',
                borderColor: 'border-red-200 dark:border-red-900',
                infoBg: 'bg-red-50 dark:bg-red-900/20',
                infoBorder: 'border-red-200 dark:border-red-800',
                message: 'Seu cadastro foi suspenso pela administracao.',
                submessage: 'Entre em contato com nosso suporte para mais informacoes sobre o motivo da suspensao.'
            }
        }
        if (isRejected) {
            return {
                icon: XCircle,
                iconBg: 'bg-red-100 dark:bg-red-900/30',
                iconColor: 'text-red-600 dark:text-red-500',
                title: 'Cadastro Nao Aprovado',
                bgGradient: 'from-red-50 to-orange-50 dark:from-slate-900 dark:to-slate-800',
                borderColor: 'border-red-200 dark:border-red-900',
                infoBg: 'bg-red-50 dark:bg-red-900/20',
                infoBorder: 'border-red-200 dark:border-red-800',
                message: 'Seu cadastro nao foi aprovado.',
                submessage: user?.rejection_reason
                    ? `Motivo: ${user.rejection_reason}`
                    : 'Voce pode reenviar sua solicitacao de aprovacao ou entrar em contato com nosso suporte.'
            }
        }
        return {
            icon: Clock,
            iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
            iconColor: 'text-yellow-600 dark:text-yellow-500',
            title: 'Cadastro em Analise',
            bgGradient: 'from-yellow-50 to-orange-50 dark:from-slate-900 dark:to-slate-800',
            borderColor: 'border-yellow-200 dark:border-yellow-900',
            infoBg: 'bg-yellow-50 dark:bg-yellow-900/20',
            infoBorder: 'border-yellow-200 dark:border-yellow-800',
            message: 'Seu cadastro foi recebido e esta sendo analisado por nossa equipe.',
            submessage: 'Em breve voce recebera um email de confirmacao e podera acessar nossa loja e fazer seus pedidos.'
        }
    }

    const config = getStatusConfig()
    const StatusIcon = config.icon

    return (
        <div className={`min-h-screen bg-gradient-to-br ${config.bgGradient} flex items-center justify-center px-4 font-sans`}>
            <div className="max-w-2xl w-full">
                <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 md:p-12 border ${config.borderColor}`}>
                    <div className="flex justify-center mb-6">
                        <div className={`${config.iconBg} p-6 rounded-full`}>
                            <StatusIcon className={`w-16 h-16 ${config.iconColor}`} />
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-white mb-4">
                        {config.title}
                    </h1>

                    <div className={`${config.infoBg} border ${config.infoBorder} rounded-lg p-6 mb-6`}>
                        <p className="text-center text-slate-700 dark:text-slate-300 text-lg mb-4">
                            Ola, <span className="font-semibold">{user?.name || user?.email}</span>!
                        </p>
                        <p className="text-center text-slate-600 dark:text-slate-400 mb-2">
                            {config.message}
                        </p>
                        <p className="text-center text-slate-600 dark:text-slate-400">
                            {config.submessage}
                        </p>
                    </div>

                    {isPending && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 mb-6">
                            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                                Tempo estimado de analise: <strong>ate 24 horas uteis</strong>
                            </p>
                        </div>
                    )}

                    {showStillPendingMessage && (
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg mb-3 text-center animate-slideDown">
                            Seu cadastro ainda esta em analise. Aguarde!
                        </div>
                    )}

                    {requestSentMessage && (
                        <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg mb-3 text-center animate-slideDown">
                            Solicitacao reenviada com sucesso! Aguarde a analise.
                        </div>
                    )}

                    {/* Botao verificar - para pending */}
                    {isPending && (
                        <button
                            type="button"
                            onClick={checkApprovalStatus}
                            disabled={checking}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-3 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
                            {checking ? 'Verificando...' : 'Verificar Aprovacao'}
                        </button>
                    )}

                    {/* Botao reenviar - para rejected */}
                    {isRejected && (
                        <button
                            type="button"
                            onClick={requestReapproval}
                            disabled={requesting}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-3 disabled:cursor-not-allowed"
                        >
                            <Send className={`w-5 h-5 ${requesting ? 'animate-pulse' : ''}`} />
                            {requesting ? 'Reenviando...' : 'Reenviar Solicitacao de Aprovacao'}
                        </button>
                    )}

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mb-6 mt-3">
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

                {isPending && (
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                        Voce recebera um email em <strong>{user?.email}</strong>
                    </p>
                )}
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
