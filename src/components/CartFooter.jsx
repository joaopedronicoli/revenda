import { useCartStore } from '../store/cartStore'
import { ArrowRight, Lock, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'

const formatPrice = (price) => {
    const num = parseFloat(price)
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(isNaN(num) ? 0 : num)
}

const levelNames = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro' }

export default function CartFooter() {
    const { getSummary, cart } = useCartStore()
    const { isApproved, canAccessAdmin, user } = useAuth()
    const { totalWithDiscount, itemCount, meetsMinimum, minimumOrder, remainingToMinimum, discountStandard, isFirstOrder } = getSummary()
    const navigate = useNavigate()

    const percentComplete = minimumOrder > 0 ? Math.min(100, ((totalWithDiscount || 0) / minimumOrder) * 100) : 0

    // Admin bypassa pedido minimo
    const effectiveMeetsMinimum = canAccessAdmin || meetsMinimum
    const canCheckout = effectiveMeetsMinimum && isApproved

    if (itemCount === 0) return null

    const userLevel = user?.level || 'bronze'

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl z-40 pb-safe">
            <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
                {/* Approval Warning */}
                {!isApproved && (
                    <div className="bg-yellow-100 px-4 py-2 text-center text-xs sm:text-sm border-b border-yellow-200 mb-4 rounded-lg">
                        <span className="text-yellow-800 font-medium">
                            Aguardando aprovacao do cadastro para finalizar pedidos
                        </span>
                    </div>
                )}

                {/* Minimum Order Progress Bar */}
                {!effectiveMeetsMinimum && isApproved && (
                    <div className="bg-slate-100 px-4 py-2 text-center text-xs sm:text-sm border-b border-slate-200 mb-4 rounded-lg">
                        <div className="flex items-center justify-between mb-1 max-w-md mx-auto">
                            <span className="text-slate-600">
                                Pedido Minimo {isFirstOrder ? '(1o pedido)' : ''}: {formatPrice(minimumOrder)}
                            </span>
                            <span className="text-red-500 font-medium">Faltam {formatPrice(remainingToMinimum)}</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden max-w-md mx-auto">
                            <div
                                className="h-full bg-red-400 transition-all duration-500 ease-out"
                                style={{ width: `${percentComplete}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Level Discount Info */}
                {isApproved && (
                    <div className="flex items-center justify-center gap-2 mb-3 text-xs text-slate-500">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Nivel {levelNames[userLevel] || 'Bronze'} - {((parseFloat(discountStandard) || 0) * 100).toFixed(0)}% de desconto</span>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Cart Summary */}
                    <div className="flex items-center gap-2 sm:gap-6">
                        <div>
                            <p className="text-xs sm:text-sm text-slate-600">Total do Pedido</p>
                            <p className="text-lg sm:text-2xl font-bold text-primary">
                                {formatPrice(totalWithDiscount)}
                            </p>
                        </div>

                        <div className="h-10 sm:h-12 w-px bg-slate-200" />

                        <div>
                            <p className="text-xs sm:text-sm text-slate-600">Itens</p>
                            <p className="text-base sm:text-xl font-semibold text-slate-800">
                                {itemCount} {itemCount === 1 ? 'produto' : 'produtos'}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        {/* Botão Limpar - Discreto */}
                        <button
                            onClick={() => {
                                if (confirm(`Tem certeza que deseja limpar o carrinho? (${itemCount} ${itemCount === 1 ? 'produto' : 'produtos'})`)) {
                                    useCartStore.getState().clearCart()
                                }
                            }}
                            className="text-sm text-slate-400 hover:text-red-500 transition-colors underline"
                        >
                            Limpar
                        </button>

                        <button
                            onClick={() => navigate('/order-review')}
                            disabled={!canCheckout}
                            className={clsx(
                                "flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-md w-full sm:w-auto",
                                canCheckout
                                    ? "bg-primary text-white hover:bg-primary-dark hover:shadow-lg hover:scale-105"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            <Lock className="w-5 h-5" />
                            Finalizar Pedido
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
