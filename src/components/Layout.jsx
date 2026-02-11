import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useCartStore } from '../store/cartStore'
import { LogOut, ShoppingBag, Moon, Sun, User, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Layout({ children }) {
    const { user, logout, canAccessAdmin } = useAuth()
    const { darkMode, toggleDarkMode } = useTheme()
    const { getSummary } = useCartStore()
    const summary = getSummary()

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24 transition-colors">
            <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-primary dark:text-blue-400 truncate">
                            Patrícia Elias
                            <span className="hidden sm:inline text-slate-400 dark:text-slate-500 font-normal text-sm ml-2">Revendedor</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end text-sm">
                            <span className="text-slate-600 dark:text-slate-300">Olá, {user?.name || user?.email}</span>
                            <span className="text-primary dark:text-blue-400 font-medium">
                                Carrinho: {summary.itemCount} itens
                            </span>
                        </div>

                        <button
                            onClick={toggleDarkMode}
                            className="p-2 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                            title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
                        >
                            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        <Link
                            to="/profile"
                            className="p-2 text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors"
                            title="Meu Perfil"
                        >
                            <User size={20} />
                        </Link>

                        {canAccessAdmin && (
                            <Link
                                to="/admin"
                                className="p-2 text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                                title="Painel Admin"
                            >
                                <Settings size={20} />
                            </Link>
                        )}

                        <button
                            onClick={logout}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Sair"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </main>
        </div>
    )
}
