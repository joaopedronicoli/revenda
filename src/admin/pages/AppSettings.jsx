import { useState, useEffect } from 'react'
import { Settings, Save, RefreshCw, Clock, ShoppingCart, Bell, Store, Wallet, AlertTriangle } from 'lucide-react'
import api from '../../services/api'

const settingsConfig = {
    cart_abandonment_timeout_minutes: {
        label: 'Timeout de Carrinho Abandonado',
        description: 'Tempo em minutos sem atividade para considerar o carrinho como abandonado',
        icon: Clock,
        type: 'number',
        suffix: 'minutos'
    },
    recovery_first_delay_minutes: {
        label: 'Primeiro Envio de Recuperação',
        description: 'Tempo após abandono para enviar a primeira mensagem de recuperação',
        icon: Bell,
        type: 'number',
        suffix: 'minutos'
    },
    recovery_second_delay_minutes: {
        label: 'Segundo Envio de Recuperação',
        description: 'Tempo após o primeiro envio para enviar a segunda mensagem',
        icon: Bell,
        type: 'number',
        suffix: 'minutos'
    },
    store_name: {
        label: 'Nome da Loja',
        description: 'Nome usado nos templates e comunicações',
        icon: Store,
        type: 'text'
    },
    store_whatsapp: {
        label: 'WhatsApp da Loja',
        description: 'Número de WhatsApp para contato (com DDD)',
        icon: ShoppingCart,
        type: 'text'
    },
    enable_cart_tracking: {
        label: 'Rastreamento de Carrinho',
        description: 'Ativa o rastreamento automático de carrinhos abandonados',
        icon: ShoppingCart,
        type: 'boolean'
    },
    enable_auto_recovery: {
        label: 'Recuperação Automática',
        description: 'Envia mensagens de recuperação automaticamente via webhook',
        icon: Bell,
        type: 'boolean'
    },
    min_payout_amount: {
        label: 'Valor Minimo de Saque',
        description: 'Valor minimo que um afiliado precisa ter para solicitar saque',
        icon: Wallet,
        type: 'number',
        suffix: 'R$'
    },
    maintenance_mode: {
        label: 'Modo Manutenção',
        description: 'Quando ativo, apenas administradores podem acessar o site. Usuários verão uma página de manutenção.',
        icon: AlertTriangle,
        type: 'boolean'
    }
}

export default function AppSettings() {
    const [settings, setSettings] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/admin/app-settings')

            const settingsMap = {}
            if (Array.isArray(data)) {
                data.forEach(s => {
                    settingsMap[s.key] = s.value
                })
            } else if (data && typeof data === 'object') {
                Object.assign(settingsMap, data)
            }
            setSettings(settingsMap)
            setHasChanges(false)
        } catch (err) {
            console.error('Error loading settings:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
        setHasChanges(true)
    }

    const saveSettings = async () => {
        setSaving(true)
        try {
            await api.put('/admin/app-settings', settings)

            setHasChanges(false)
            alert('Configurações salvas com sucesso!')
        } catch (err) {
            console.error('Error saving settings:', err)
            alert('Erro ao salvar configurações')
        } finally {
            setSaving(false)
        }
    }

    const renderInput = (key, config) => {
        const value = settings[key]

        switch (config.type) {
            case 'number':
                return (
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={value || ''}
                            onChange={(e) => updateSetting(key, parseInt(e.target.value) || 0)}
                            className="w-32 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {config.suffix && (
                            <span className="text-sm text-slate-500">{config.suffix}</span>
                        )}
                    </div>
                )

            case 'text':
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => updateSetting(key, e.target.value)}
                        className="w-full max-w-md px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                )

            case 'boolean':
                return (
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={value || false}
                            onChange={(e) => updateSetting(key, e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                )

            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
                    <p className="text-slate-500">Configure as opções gerais do sistema</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadSettings}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Recarregar
                    </button>
                    <button
                        onClick={saveSettings}
                        disabled={!hasChanges || saving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Store Settings */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Store className="w-5 h-5" />
                            Informações da Loja
                        </h2>
                        <div className="space-y-6">
                            {['store_name', 'store_whatsapp', 'maintenance_mode'].map((key) => {
                                const config = settingsConfig[key]
                                if (!config) return null
                                return (
                                    <div key={key} className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <label className="font-medium text-slate-700">
                                                {config.label}
                                            </label>
                                        </div>
                                        <p className="text-sm text-slate-500">{config.description}</p>
                                        {renderInput(key, config)}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Cart Abandonment Settings */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5" />
                            Carrinhos Abandonados
                        </h2>
                        <div className="space-y-6">
                            {['cart_abandonment_timeout_minutes', 'enable_cart_tracking'].map((key) => {
                                const config = settingsConfig[key]
                                if (!config) return null
                                return (
                                    <div key={key} className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <label className="font-medium text-slate-700">
                                                {config.label}
                                            </label>
                                        </div>
                                        <p className="text-sm text-slate-500">{config.description}</p>
                                        {renderInput(key, config)}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Recovery Settings */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Bell className="w-5 h-5" />
                            Recuperação Automática
                        </h2>
                        <div className="space-y-6">
                            {['enable_auto_recovery', 'recovery_first_delay_minutes', 'recovery_second_delay_minutes'].map((key) => {
                                const config = settingsConfig[key]
                                if (!config) return null
                                return (
                                    <div key={key} className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <label className="font-medium text-slate-700">
                                                {config.label}
                                            </label>
                                        </div>
                                        <p className="text-sm text-slate-500">{config.description}</p>
                                        {renderInput(key, config)}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Affiliate Settings */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Wallet className="w-5 h-5" />
                            Afiliados
                        </h2>
                        <div className="space-y-6">
                            {['min_payout_amount'].map((key) => {
                                const config = settingsConfig[key]
                                if (!config) return null
                                return (
                                    <div key={key} className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <label className="font-medium text-slate-700">
                                                {config.label}
                                            </label>
                                        </div>
                                        <p className="text-sm text-slate-500">{config.description}</p>
                                        {renderInput(key, config)}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* System Info */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Informações do Sistema
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500">Versão do Sistema</p>
                                <p className="font-medium text-slate-900">1.0.0</p>
                            </div>
                            <div>
                                <p className="text-slate-500">Ambiente</p>
                                <p className="font-medium text-slate-900">
                                    {import.meta.env.MODE === 'production' ? 'Produção' : 'Desenvolvimento'}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500">API URL</p>
                                <p className="font-medium text-slate-900 truncate">
                                    {import.meta.env.VITE_API_URL || 'Configurado'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
