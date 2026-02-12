import { Gift, TrendingUp } from 'lucide-react'

export default function DiscountUnlockAlert({ remainingAmount }) {
    const formatPrice = (price) => {
        const num = parseFloat(price)
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(isNaN(num) ? 0 : num)
    }

    return (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center">
                    <Gift className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-amber-900">
                            🎁 Desbloqueie 35% de Desconto!
                        </h3>
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                    </div>

                    <p className="text-sm text-amber-800">
                        Adicione mais <span className="font-bold text-amber-900">{formatPrice(remainingAmount)}</span> ao seu pedido e ganhe <span className="font-bold">35% de desconto</span> em todos os produtos!
                    </p>

                    <div className="mt-2 bg-amber-100 rounded-lg p-2">
                        <div className="flex items-center justify-between text-xs text-amber-700">
                            <span>Progresso para R$ 10.000</span>
                            <span className="font-semibold">
                                {formatPrice(10000 - remainingAmount)} / R$ 10.000
                            </span>
                        </div>
                        <div className="mt-1 h-2 bg-amber-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                                style={{ width: `${((10000 - remainingAmount) / 10000) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
