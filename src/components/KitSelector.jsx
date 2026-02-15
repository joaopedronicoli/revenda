import { useState, useEffect } from 'react'
import { Package, Check, Star } from 'lucide-react'
import api from '../services/api'

const formatPrice = (price) => {
    const num = parseFloat(price)
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(isNaN(num) ? 0 : num)
}

export default function KitSelector({ selectedKit, onSelectKit }) {
    const [kits, setKits] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadKits()
    }, [])

    const loadKits = async () => {
        try {
            const { data } = await api.get('/kits')
            setKits(data)
        } catch (err) {
            console.error('Error loading kits:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-slate-900">Escolha seu Kit Inicial</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
                O kit inicial e obrigatorio no primeiro pedido. Ele inclui produtos para demonstracao e inicio da sua jornada como revendedora.
            </p>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                {kits.map((kit) => {
                    const isSelected = selectedKit?.id === kit.id
                    const isBestValue = kit.slug === 'completo'

                    return (
                        <button
                            key={kit.id}
                            onClick={() => onSelectKit(kit)}
                            className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                                isSelected
                                    ? 'border-primary bg-primary/5 shadow-md'
                                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                            }`}
                        >
                            {isBestValue && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                    <Star className="w-3 h-3" />
                                    Melhor Custo-Beneficio
                                </div>
                            )}

                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h4 className="font-semibold text-slate-900">{kit.name}</h4>
                                    <p className="text-2xl font-bold text-primary mt-1">
                                        {formatPrice(kit.price)}
                                    </p>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                    isSelected ? 'border-primary bg-primary' : 'border-slate-300'
                                }`}>
                                    {isSelected && <Check className="w-4 h-4 text-white" />}
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 leading-relaxed">
                                {kit.description}
                            </p>
                        </button>
                    )
                })}
            </div>

            {!selectedKit && (
                <p className="text-sm text-red-500 mt-2">
                    Selecione um kit para continuar com seu primeiro pedido.
                </p>
            )}
        </div>
    )
}
