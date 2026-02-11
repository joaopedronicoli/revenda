import { Zap } from 'lucide-react'

export default function PointsDisplay({ points = 0, size = 'md' }) {
    const sizeClasses = size === 'sm'
        ? 'text-sm px-2 py-0.5 gap-1'
        : 'text-base px-3 py-1 gap-1.5'

    return (
        <span className={`inline-flex items-center font-bold rounded-full bg-amber-50 text-amber-700 ${sizeClasses}`}>
            <Zap className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
            {points.toLocaleString('pt-BR')} pts
        </span>
    )
}
