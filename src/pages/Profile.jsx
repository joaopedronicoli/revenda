import { User, Package, MapPin, LogOut, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import OrderHistory from '../components/OrderHistory'
import ProfileEditor from '../components/ProfileEditor'
import AddressManager from '../components/AddressManager'

export default function Profile() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'orders')

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const tabs = [
        { id: 'orders', label: 'Meus Pedidos', icon: Package },
        { id: 'profile', label: 'Meus Dados', icon: User },
        { id: 'addresses', label: 'Endereços', icon: MapPin }
    ]

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Meu Painel</h1>
                            <p className="text-slate-600 text-sm mt-1">
                                Ola, {user?.name || 'Revendedor'}!
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                to="/"
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                            >
                                <ShoppingBag size={18} />
                                Loja
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                <LogOut size={18} />
                                Sair
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex gap-1">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${activeTab === tab.id
                                            ? 'text-primary border-primary'
                                            : 'text-slate-600 border-transparent hover:text-slate-900'
                                        }`}
                                >
                                    <Icon size={18} />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                {activeTab === 'orders' && <OrderHistory />}
                {activeTab === 'profile' && <ProfileEditor />}
                {activeTab === 'addresses' && <AddressManager />}
            </div>
        </div>
    )
}
