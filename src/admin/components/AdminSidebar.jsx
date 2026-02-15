import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    LayoutDashboard,
    ShoppingCart,
    Users,
    Package,
    Settings,
    FileText,
    LogOut,
    ChevronLeft,
    ShoppingBag,
    Book,
    UserCheck,
    Wallet,
    BarChart3,
    Image,
    CreditCard,
    Plug,
    X
} from 'lucide-react'

const menuItems = [
    {
        title: 'Dashboard',
        icon: LayoutDashboard,
        path: '/admin',
        exact: true
    },
    {
        title: 'Produtos',
        icon: ShoppingBag,
        path: '/admin/products',
        adminOnly: true
    },
    {
        title: 'Pedidos',
        icon: Package,
        path: '/admin/orders'
    },
    {
        title: 'Usuarios',
        icon: Users,
        path: '/admin/users'
    },
    {
        title: 'Carrinhos Abandonados',
        icon: ShoppingCart,
        path: '/admin/abandoned-carts'
    },
    {
        title: 'Indicadores',
        icon: UserCheck,
        path: '/admin/indicadores',
        adminOnly: true
    },
    {
        title: 'Saques',
        icon: Wallet,
        path: '/admin/payouts',
        adminOnly: true
    },
    {
        title: 'Relatorios',
        icon: BarChart3,
        path: '/admin/indicacao-reports',
        adminOnly: true
    },
    {
        title: 'Materiais',
        icon: Image,
        path: '/admin/creatives',
        adminOnly: true
    },
    {
        title: 'Gateways',
        icon: CreditCard,
        path: '/admin/payment-gateways',
        adminOnly: true
    },
    {
        title: 'Conexoes',
        icon: Plug,
        path: '/admin/connections',
        adminOnly: true
    },
    {
        title: 'Documentacao',
        icon: Book,
        path: '/admin/documentation'
    },
    {
        title: 'Templates',
        icon: FileText,
        path: '/admin/templates',
        adminOnly: true
    },
    {
        title: 'Configuracoes',
        icon: Settings,
        path: '/admin/settings',
        adminOnly: true
    }
]

export default function AdminSidebar({ collapsed, onCollapse, onCloseMobile }) {
    const { user, userRole, isAdmin, logout } = useAuth()

    const filteredItems = menuItems.filter(item => {
        if (item.adminOnly && !isAdmin) return false
        return true
    })

    return (
        <aside className={`bg-slate-900 text-white transition-all duration-300 flex flex-col h-full ${collapsed ? 'w-16' : 'w-64'}`}>
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="w-8 h-8 text-primary" />
                        <div>
                            <h1 className="font-bold text-lg">Admin</h1>
                            <p className="text-xs text-slate-400">Patricia Elias</p>
                        </div>
                    </div>
                )}
                {/* Close button on mobile, collapse on desktop */}
                <button
                    onClick={() => {
                        if (window.innerWidth < 768) {
                            onCloseMobile?.()
                        } else {
                            onCollapse(!collapsed)
                        }
                    }}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <span className="md:hidden"><X className="w-5 h-5" /></span>
                    <span className="hidden md:block"><ChevronLeft className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} /></span>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {filteredItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.exact}
                        onClick={() => onCloseMobile?.()}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                                ? 'bg-primary text-white'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* User Info */}
            <div className="p-4 border-t border-slate-700">
                {!collapsed && (
                    <div className="mb-3">
                        <p className="text-sm font-medium truncate">{user?.email}</p>
                        <p className="text-xs text-slate-400 capitalize">{userRole}</p>
                    </div>
                )}
                <div className="flex gap-2">
                    <NavLink
                        to="/"
                        onClick={() => onCloseMobile?.()}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                    >
                        <ShoppingBag className="w-4 h-4" />
                        {!collapsed && <span>Loja</span>}
                    </NavLink>
                    <button
                        onClick={logout}
                        className="flex items-center justify-center p-2 bg-slate-800 hover:bg-red-600 rounded-lg transition-colors"
                        title="Sair"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
