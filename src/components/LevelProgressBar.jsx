import { useState, useEffect } from 'react'
import { TrendingUp, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import LevelBadge from './LevelBadge'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value)
}

export default function LevelProgressBar() {
    const [levelData, setLevelData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadLevelData()
    }, [])

    const loadLevelData = async () => {
        try {
            const { data } = await api.get('/users/me/level')
            setLevelData(data)
        } catch (err) {
            console.error('Error loading level data:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading || !levelData) return null

    return (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <LevelBadge level={levelData.level} showDiscount size="md" />
                    <span className="text-sm text-slate-600">
                        Desconto de {(levelData.discount * 100).toFixed(0)}%
                    </span>
                </div>
                {levelData.daysUntilDowngrade !== null && levelData.daysUntilDowngrade <= 30 && (
                    <div className="flex items-center gap-1 text-amber-600 text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        {levelData.daysUntilDowngrade} dias para manter nivel
                    </div>
                )}
            </div>

            {levelData.nextLevel && (
                <>
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-slate-600 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            Proximo: <strong>{levelData.nextLevelName}</strong>
                        </span>
                        <span className="text-slate-500">
                            Faltam {formatCurrency(levelData.amountToNext)}
                        </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, levelData.progressPercent)}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        {formatCurrency(levelData.totalAccumulated)} acumulado
                    </p>
                </>
            )}

            {!levelData.nextLevel && (
                <div className="bg-yellow-50 px-3 py-2 rounded-lg text-sm text-yellow-800 font-medium">
                    Nivel maximo atingido! Voce tem o melhor desconto disponivel.
                </div>
            )}
        </div>
    )
}
