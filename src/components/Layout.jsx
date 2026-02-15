import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useCartStore } from '../store/cartStore'
import { LogOut, ShoppingBag, Moon, Sun, User, Settings, BarChart2, Users2, Trophy, Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import LevelBadge from './LevelBadge'

export default function Layout({ children }) {
    const { user, logout, canAccessAdmin } = useAuth()
    const { darkMode, toggleDarkMode } = useTheme()
    const { getSummary } = useCartStore()
    const summary = getSummary()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 transition-colors">
            <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 transition-colors pt-safe">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base sm:text-xl font-bold text-primary dark:text-blue-400 truncate">
                            Patricia Elias
                            <span className="hidden sm:inline text-slate-400 dark:text-slate-500 font-normal text-sm ml-2">Revendedor</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3">
                        {/* User info + Level Badge - desktop only */}
                        <div className="hidden sm:flex flex-col items-end text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-600 dark:text-slate-300">Ola, {user?.name || user?.email}</span>
                                <LevelBadge level={user?.level || 'bronze'} size="sm" />
                            </div>
                            <span className="text-primary dark:text-blue-400 font-medium">
                                Carrinho: {summary.itemCount} itens
                            </span>
                        </div>

                        {/* Primary icons - always visible */}
                        <Link
                            to="/my-dashboard"
                            className="p-2 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                            title="Meu Painel"
                        >
                            <BarChart2 size={18} />
                        </Link>

                        {/* Secondary icons - hidden on mobile, shown on sm+ */}
                        <Link
                            to="/referrals"
                            className="hidden sm:flex p-2 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                            title="Indicacoes"
                        >
                            <Users2 size={18} />
                        </Link>

                        <Link
                            to="/rankings"
                            className="hidden sm:flex p-2 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                            title="Rankings"
                        >
                            <Trophy size={18} />
                        </Link>

                        <button
                            onClick={toggleDarkMode}
                            className="hidden sm:flex p-2 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                            title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
                        >
                            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <Link
                            to="/profile"
                            className="hidden sm:flex p-2 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                            title="Meu Perfil"
                        >
                            <User size={18} />
                        </Link>

                        {canAccessAdmin && (
                            <Link
                                to="/admin"
                                className="hidden sm:flex p-2 text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                                title="Painel Admin"
                            >
                                <Settings size={18} />
                            </Link>
                        )}

                        <button
                            onClick={logout}
                            className="hidden sm:flex p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Sair"
                        >
                            <LogOut size={18} />
                        </button>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="sm:hidden p-2 text-slate-400 hover:text-primary transition-colors"
                        >
                            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown menu */}
                {mobileMenuOpen && (
                    <div className="sm:hidden border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 space-y-1">
                        {/* User info on mobile */}
                        <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
                            <span className="text-sm text-slate-600 dark:text-slate-300">{user?.name || user?.email}</span>
                            <LevelBadge level={user?.level || 'bronze'} size="sm" />
                        </div>

                        <Link
                            to="/referrals"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                        >
                            <Users2 size={18} />
                            <span className="text-sm">Indicacoes</span>
                        </Link>

                        <Link
                            to="/rankings"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                        >
                            <Trophy size={18} />
                            <span className="text-sm">Rankings</span>
                        </Link>

                        <Link
                            to="/profile"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                        >
                            <User size={18} />
                            <span className="text-sm">Meu Perfil</span>
                        </Link>

                        <button
                            onClick={toggleDarkMode}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                        >
                            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                            <span className="text-sm">{darkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                        </button>

                        {canAccessAdmin && (
                            <Link
                                to="/admin"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg"
                            >
                                <Settings size={18} />
                                <span className="text-sm">Painel Admin</span>
                            </Link>
                        )}

                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                            <LogOut size={18} />
                            <span className="text-sm">Sair</span>
                        </button>
                    </div>
                )}
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </main>
        </div>
    )
}
