import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    LayoutDashboard,
    ShoppingCart,
    Users,
    Package,
    Settings,
    Bell,
    FileText,
    LogOut,
    ChevronLeft,
    ShoppingBag,
    Book,
    UserCheck
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
        title: 'Afiliados',
        icon: UserCheck,
        path: '/admin/affiliates',
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
        title: 'Webhooks',
        icon: Bell,
        path: '/admin/webhooks',
        adminOnly: true
    },
    {
        title: 'Configuracoes',
        icon: Settings,
        path: '/admin/settings',
        adminOnly: true
    }
]

export default function AdminSidebar({ collapsed, onCollapse }) {
    const { user, userRole, isAdmin, logout } = useAuth()

    const filteredItems = menuItems.filter(item => {
        if (item.adminOnly && !isAdmin) return false
        return true
    })

    return (
        <aside className={`bg-slate-900 text-white transition-all duration-300 flex flex-col ${collapsed ? 'w-16' : 'w-64'}`}>
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
                <button
                    onClick={() => onCollapse(!collapsed)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <ChevronLeft className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {filteredItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.exact}
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
