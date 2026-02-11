import { useCartStore } from '../store/cartStore'
import { ArrowRight, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'
import DiscountUnlockAlert from './DiscountUnlockAlert'

const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(price)
}

export default function CartFooter() {
    const { getSummary, cart } = useCartStore()
    const { isApproved } = useAuth()
    const { totalWithDiscount, itemCount, isHighTicket, isCloseToUnlock, remainingToUnlock35 } = getSummary()
    const navigate = useNavigate()

    const MIN_ORDER = 1000
    const remaining = Math.max(0, MIN_ORDER - totalWithDiscount)
    const percentComplete = Math.min(100, (totalWithDiscount / MIN_ORDER) * 100)

    // Permitir checkout se atingiu o valor mínimo E está aprovado
    const canCheckout = totalWithDiscount >= MIN_ORDER && isApproved

    if (itemCount === 0) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl z-40">
            <div className="max-w-7xl mx-auto px-4 py-4">
                {/* Approval Warning */}
                {!isApproved && (
                    <div className="bg-yellow-100 px-4 py-2 text-center text-xs sm:text-sm border-b border-yellow-200 mb-4 rounded-lg">
                        <span className="text-yellow-800 font-medium">
                            ⏳ Aguardando aprovação do cadastro para finalizar pedidos
                        </span>
                    </div>
                )}

                {/* Minimum Order Progress Bar */}
                {!canCheckout && isApproved && totalWithDiscount < MIN_ORDER && (
                    <div className="bg-slate-100 px-4 py-2 text-center text-xs sm:text-sm border-b border-slate-200 mb-4 rounded-lg">
                        <div className="flex items-center justify-between mb-1 max-w-md mx-auto">
                            <span className="text-slate-600">Pedido Mínimo: {formatPrice(MIN_ORDER)}</span>
                            <span className="text-red-500 font-medium">Faltam {formatPrice(remaining)}</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden max-w-md mx-auto">
                            <div
                                className="h-full bg-red-400 transition-all duration-500 ease-out"
                                style={{ width: `${percentComplete}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Discount Unlock Alert */}
                {isCloseToUnlock && !isHighTicket && (
                    <DiscountUnlockAlert remainingAmount={remainingToUnlock35} />
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Cart Summary */}
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-sm text-slate-600">Total do Pedido</p>
                            <p className="text-2xl font-bold text-primary">
                                {formatPrice(totalWithDiscount)}
                            </p>
                        </div>

                        <div className="h-12 w-px bg-slate-200" />

                        <div>
                            <p className="text-sm text-slate-600">Itens no Carrinho</p>
                            <p className="text-xl font-semibold text-slate-800">
                                {itemCount} {itemCount === 1 ? 'produto' : 'produtos'}
                            </p>
                        </div>

                        {isHighTicket && (
                            <>
                                <div className="h-12 w-px bg-slate-200" />
                                <div className="bg-green-100 px-3 py-2 rounded-lg">
                                    <p className="text-xs text-green-700 font-semibold">
                                        🎉 35% de Desconto Desbloqueado!
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
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
                                "flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all shadow-md",
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
