import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Zap, Gift, CheckCircle, ArrowRight } from 'lucide-react'
import api from '../services/api'

const tracks = [
    {
        type: 'influencer_pro',
        name: 'Influencer Pro',
        price: null,
        priceLabel: 'Gratuito',
        icon: Star,
        color: 'border-purple-500 bg-purple-50',
        iconColor: 'text-purple-600',
        highlight: true,
        description: 'Para influenciadoras digitais que querem monetizar sua audiencia',
        commissions: [
            'Comissao de 15% em vendas diretas',
            'Comissao de 5% em vendas de indicadas',
            'Acesso a materiais exclusivos',
            'Suporte prioritario'
        ]
    },
    {
        type: 'renda_extra',
        name: 'Renda Extra',
        price: 97,
        priceLabel: 'R$ 97,00',
        icon: Zap,
        color: 'border-amber-500 bg-amber-50',
        iconColor: 'text-amber-600',
        highlight: false,
        description: 'Para quem quer uma renda extra indicando produtos de qualidade',
        commissions: [
            'Comissao de 20% em vendas diretas',
            'Comissao de 8% em vendas de indicadas',
            'Kit de divulgacao completo',
            'Treinamento exclusivo',
            'Acesso ao grupo VIP'
        ]
    },
    {
        type: 'gratuito',
        name: 'Gratuito',
        price: null,
        priceLabel: 'Gratuito',
        icon: Gift,
        color: 'border-slate-300 bg-slate-50',
        iconColor: 'text-slate-600',
        highlight: false,
        description: 'Comece a indicar sem custos e ganhe comissoes por cada venda',
        commissions: [
            'Comissao de 10% em vendas diretas',
            'Link de indicacao personalizado',
            'Painel de acompanhamento'
        ]
    }
]

export default function IndicacaoRegister() {
    const navigate = useNavigate()
    const [selectedType, setSelectedType] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleRegister = async () => {
        if (!selectedType) {
            setError('Selecione uma modalidade para continuar')
            return
        }

        setLoading(true)
        setError('')

        try {
            await api.post('/indicacao/register', { type: selectedType })
            navigate('/indicacao/dashboard')
        } catch (err) {
            console.error('Error registering as indicador:', err)
            setError(err.response?.data?.message || 'Erro ao realizar cadastro. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-900">Programa de Indicadores</h1>
                    <p className="text-slate-500 mt-1">Escolha a modalidade ideal para voce e comece a ganhar comissoes</p>
                </div>

                {/* Track Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {tracks.map((track) => {
                        const Icon = track.icon
                        const isSelected = selectedType === track.type

                        return (
                            <button
                                key={track.type}
                                onClick={() => { setSelectedType(track.type); setError(''); }}
                                className={`relative text-left bg-white rounded-xl p-6 border-2 shadow-sm transition-all ${
                                    isSelected
                                        ? 'border-primary ring-2 ring-primary/20'
                                        : track.highlight
                                        ? track.color
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {track.highlight && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                                        Recomendado
                                    </span>
                                )}

                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        isSelected ? 'bg-primary/10 text-primary' : track.color
                                    }`}>
                                        <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : track.iconColor}`} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">{track.name}</h3>
                                        <p className="text-sm font-medium text-primary">{track.priceLabel}</p>
                                    </div>
                                </div>

                                <p className="text-sm text-slate-600 mb-4">{track.description}</p>

                                <ul className="space-y-2">
                                    {track.commissions.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>

                                {isSelected && (
                                    <div className="mt-4 flex items-center justify-center gap-1 text-primary font-medium text-sm">
                                        <CheckCircle className="w-4 h-4" />
                                        Selecionado
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-center">
                        {error}
                    </div>
                )}

                {/* Register Button */}
                <div className="flex justify-center">
                    <button
                        onClick={handleRegister}
                        disabled={loading || !selectedType}
                        className="px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <>
                                Cadastrar como Indicadora
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
        </div>
    )
}
