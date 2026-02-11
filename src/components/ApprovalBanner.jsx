import { useAuth } from '../context/AuthContext'
import { Clock, AlertCircle, ShieldOff } from 'lucide-react'

export default function ApprovalBanner() {
    const { approvalStatus, roleLoading } = useAuth()

    // Don't show banner if loading or approved
    if (roleLoading || !approvalStatus || approvalStatus === 'approved') {
        return null
    }

    // Show pending banner
    if (approvalStatus === 'pending') {
        return (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                                Cadastro Aguardando Aprovacao
                            </h3>
                            <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
                                Seu cadastro esta em analise. Voce sera notificado por email assim que for aprovado e podera comecar a fazer pedidos.
                            </p>
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                <span className="font-medium">Duvidas?</span> Entre em contato:{' '}
                                <a
                                    href="mailto:revendedor@patriciaelias.com.br"
                                    className="underline hover:text-yellow-900 dark:hover:text-yellow-200 font-medium"
                                >
                                    revendedor@patriciaelias.com.br
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Show rejected banner
    if (approvalStatus === 'rejected') {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
                                Cadastro Nao Aprovado
                            </h3>
                            <p className="text-sm text-red-800 dark:text-red-300">
                                Seu cadastro nao foi aprovado. Entre em contato conosco para mais informacoes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Show suspended banner
    if (approvalStatus === 'suspended') {
        return (
            <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-start gap-3">
                        <ShieldOff className="w-5 h-5 text-orange-600 dark:text-orange-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-200 mb-1">
                                Cadastro Suspenso
                            </h3>
                            <p className="text-sm text-orange-800 dark:text-orange-300 mb-2">
                                Seu cadastro foi suspenso. Entre em contato com nosso suporte para mais informacoes.
                            </p>
                            <p className="text-sm text-orange-800 dark:text-orange-300">
                                <span className="font-medium">Suporte:</span>{' '}
                                <a
                                    href="mailto:revendedor@patriciaelias.com.br"
                                    className="underline hover:text-orange-900 dark:hover:text-orange-200 font-medium"
                                >
                                    revendedor@patriciaelias.com.br
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return null
}
