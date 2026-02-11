import { Award, ShoppingBag, DollarSign, UserPlus, Shield, Flame, Package, TrendingUp, Star, Crown, Users } from 'lucide-react'

const iconMap = {
    'shopping-bag': ShoppingBag,
    'trending-up': TrendingUp,
    'award': Award,
    'star': Star,
    'crown': Crown,
    'dollar-sign': DollarSign,
    'user-plus': UserPlus,
    'users': Users,
    'shield': Shield,
    'flame': Flame,
    'package': Package
}

export default function AchievementBadge({ achievement, size = 'md' }) {
    const Icon = iconMap[achievement.icon] || Award
    const isEarned = achievement.earned

    const sizeClasses = size === 'sm'
        ? 'w-12 h-12'
        : size === 'md'
        ? 'w-16 h-16'
        : 'w-20 h-20'

    const iconSize = size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-7 h-7' : 'w-9 h-9'

    return (
        <div className={`flex flex-col items-center gap-1 ${!isEarned ? 'opacity-40 grayscale' : ''}`}>
            <div className={`${sizeClasses} rounded-full flex items-center justify-center ${
                isEarned ? 'bg-primary/10 text-primary ring-2 ring-primary/20' : 'bg-slate-100 text-slate-400'
            }`}>
                <Icon className={iconSize} />
            </div>
            <p className={`text-xs font-medium text-center leading-tight ${isEarned ? 'text-slate-900' : 'text-slate-400'}`}>
                {achievement.name}
            </p>
            {isEarned && achievement.points_reward > 0 && (
                <span className="text-[10px] text-primary font-medium">+{achievement.points_reward} pts</span>
            )}
        </div>
    )
}
