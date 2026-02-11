import { Shield } from 'lucide-react'

const levelStyles = {
    starter: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Starter', discount: '30%' },
    prata:   { bg: 'bg-slate-200', text: 'text-slate-800', label: 'Prata', discount: '35%' },
    ouro:    { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Ouro', discount: '40%' }
}

export default function LevelBadge({ level = 'starter', showDiscount = false, size = 'sm' }) {
    const style = levelStyles[level] || levelStyles.starter

    const sizeClasses = size === 'sm'
        ? 'text-xs px-2 py-0.5 gap-1'
        : 'text-sm px-3 py-1 gap-1.5'

    return (
        <span className={`inline-flex items-center font-medium rounded-full ${style.bg} ${style.text} ${sizeClasses}`}>
            <Shield className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
            {style.label}
            {showDiscount && <span className="opacity-75">({style.discount})</span>}
        </span>
    )
}
