import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Mail, Database, Megaphone, Webhook, CheckCircle2, XCircle, ToggleLeft, ToggleRight, TestTube, Edit2, Trash2, Save, X, Eye, EyeOff, AlertCircle, Plus, Plug, ExternalLink, Loader2 } from 'lucide-react'
import api from '../../services/api'

const TYPE_ICONS = {
    woocommerce: ShoppingCart,
    smtp: Mail,
    bling: Database,
    meta: Megaphone,
    n8n: Webhook
}

const TYPE_COLORS = {
    woocommerce: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    smtp: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    bling: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    meta: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
    n8n: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' }
}

// Fallback local caso o endpoint /admin/integration-types falhe
const FALLBACK_TYPES = {
    woocommerce: {
        name: 'WooCommerce', description: 'Sincronizacao com loja WooCommerce', testable: true,
        credentialFields: [
            { key: 'wc_url', label: 'URL da Loja', type: 'text', placeholder: 'https://sualoja.com.br' },
            { key: 'wc_consumer_key', label: 'Consumer Key', type: 'password' },
            { key: 'wc_consumer_secret', label: 'Consumer Secret', type: 'password' }
        ]
    },
    smtp: {
        name: 'SMTP / Email', description: 'Configuracao de envio de emails via SMTP', testable: true,
        credentialFields: [
            { key: 'smtp_address', label: 'Servidor SMTP', type: 'text', placeholder: 'smtp.hostinger.com' },
            { key: 'smtp_port', label: 'Porta', type: 'text', placeholder: '587' },
            { key: 'smtp_username', label: 'Usuario (email)', type: 'text', placeholder: 'email@seudominio.com' },
            { key: 'smtp_password', label: 'Senha', type: 'password' }
        ]
    },
    bling: {
        name: 'Bling ERP', description: 'Integracao com Bling via OAuth2', testable: true, oauth: true,
        credentialFields: [
            { key: 'client_id', label: 'Client ID', type: 'text' },
            { key: 'client_secret', label: 'Client Secret', type: 'password' }
        ]
    },
    meta: {
        name: 'Meta / Facebook', description: 'Pixel do Facebook e API de Conversoes', testable: true,
        credentialFields: [
            { key: 'pixel_id', label: 'Pixel ID', type: 'text' },
            { key: 'access_token', label: 'Access Token', type: 'password' },
            { key: 'dataset_id', label: 'Dataset ID (opcional)', type: 'text' }
        ]
    },
    n8n: {
        name: 'N8N Webhooks', description: 'URLs de webhooks N8N para automacoes', testable: true,
        credentialFields: [
            { key: 'registration_webhook_url', label: 'Webhook de Cadastro', type: 'text', placeholder: 'https://n8n.seudominio.com/webhook/...' },
            { key: 'order_webhook_url', label: 'Webhook de Pedido', type: 'text', placeholder: 'https://n8n.seudominio.com/webhook/...' }
        ]
    }
}

export default function Connections() {
    const [integrations, setIntegrations] = useState([])
    const [integrationTypes, setIntegrationTypes] = useState({})
    const [loading, setLoading] = useState(true)
    const [editingType, setEditingType] = useState(null)
    const [testResult, setTestResult] = useState(null)
    const [testingType, setTestingType] = useState(null)
    const [authorizingType, setAuthorizingType] = useState(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => { loadData() }, [])

    // Escutar mensagem do popup OAuth do Bling
    useEffect(() => {
        const handler = (event) => {
            if (event.data === 'bling-oauth-success') {
                flashSuccess('Bling autorizado com sucesso!')
                loadData()
            }
        }
        window.addEventListener('message', handler)
        return () => window.removeEventListener('message', handler)
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [intRes, typesRes] = await Promise.allSettled([
                api.get('/admin/integrations'),
                api.get('/admin/integration-types')
            ])
            if (intRes.status === 'fulfilled') {
                setIntegrations(Array.isArray(intRes.value.data) ? intRes.value.data : [])
            }
            const typesData = typesRes.status === 'fulfilled' ? typesRes.value.data : null
            const hasTypes = typesData && typeof typesData === 'object' && !Array.isArray(typesData) && Object.keys(typesData).length > 0
            setIntegrationTypes(hasTypes ? typesData : FALLBACK_TYPES)
        } catch (err) {
            setIntegrationTypes(FALLBACK_TYPES)
        } finally {
            setLoading(false)
        }
    }

    const flashSuccess = (msg) => {
        setSuccess(msg)
        setTimeout(() => setSuccess(''), 3000)
    }

    const getIntegration = (type) => {
        return integrations.find(i => i.integration_type === type) || null
    }

    const handleToggleActive = async (type) => {
        const integration = getIntegration(type)
        if (!integration) return
        try {
            await api.put(`/admin/integrations/${type}`, { active: !integration.active })
            loadData()
        } catch (err) {
            setError(err.response?.data?.error || err.message)
        }
    }

    const handleDelete = async (type) => {
        const typeInfo = integrationTypes[type]
        if (!window.confirm(`Remover integracao ${typeInfo?.name || type}? As credenciais serao apagadas.`)) return
        try {
            await api.delete(`/admin/integrations/${type}`)
            flashSuccess('Integracao removida')
            loadData()
        } catch (err) {
            setError(err.response?.data?.error || err.message)
        }
    }

    const handleTestConnection = async (type) => {
        try {
            setTestingType(type)
            setTestResult(null)
            const { data } = await api.post(`/admin/integrations/${type}/test`)
            setTestResult({ type, ...data })
            loadData()
        } catch (err) {
            setTestResult({ type, success: false, message: err.message })
        } finally {
            setTestingType(null)
        }
    }

    const handleAuthorize = async (type) => {
        setAuthorizingType(type)
        try {
            const { data } = await api.get(`/admin/integrations/${type}/authorize`)
            if (data.url) {
                window.open(data.url, '_blank', 'width=600,height=700')
            } else {
                throw new Error(data.error || 'URL nao retornada')
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Erro ao autorizar')
        } finally {
            setAuthorizingType(null)
        }
    }

    const formatExpiry = (isoDate) => {
        if (!isoDate) return null
        const date = new Date(isoDate)
        const now = new Date()
        const diff = date.getTime() - now.getTime()
        if (diff <= 0) return 'Expirado'
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        if (hours > 0) return `Expira em ${hours}h${minutes}m`
        return `Expira em ${minutes}m`
    }

    // ==========================================
    // Integration Form (inline)
    // ==========================================

    const IntegrationForm = ({ type, integration, onClose }) => {
        const typeInfo = integrationTypes[type]
        const credFields = typeInfo?.credentialFields || []
        const [form, setForm] = useState({})
        const [showPasswords, setShowPasswords] = useState({})

        const handleCredChange = (key, value) => {
            setForm(prev => ({ ...prev, [key]: value }))
        }

        const handleSave = async () => {
            try {
                if (integration) {
                    await api.put(`/admin/integrations/${type}`, { credentials: form })
                } else {
                    await api.post('/admin/integrations', { integration_type: type, credentials: form })
                }
                flashSuccess(integration ? 'Credenciais atualizadas' : 'Integracao configurada')
                onClose()
                loadData()
            } catch (err) {
                setError(err.response?.data?.error || err.message)
            }
        }

        return (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-5">
                <h4 className="font-semibold text-slate-900 mb-4">
                    {integration ? 'Editar Credenciais' : 'Configurar Integracao'}
                </h4>
                <div className="space-y-3">
                    {credFields.map(field => (
                        <div key={field.key}>
                            <label className="block text-xs font-medium text-slate-500 mb-1">{field.label}</label>
                            <div className="relative">
                                <input
                                    type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                                    value={form[field.key] || ''}
                                    onChange={e => handleCredChange(field.key, e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none pr-10"
                                    placeholder={integration?.credentials_masked?.[field.key] || field.placeholder || field.label}
                                />
                                {field.type === 'password' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPasswords[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-4">
                    <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1">
                        <Save size={16} /> Salvar
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-1">
                        <X size={16} /> Cancelar
                    </button>
                </div>
            </div>
        )
    }

    // ==========================================
    // Render
    // ==========================================

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    const allTypes = Object.keys(integrationTypes)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Conexoes</h1>
                <p className="text-sm text-slate-600 mt-1">Gerencie integracoes externas (WooCommerce, SMTP, Bling, Meta, N8N)</p>
            </div>

            {/* Alerts */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-500" />
                        <span className="text-sm text-red-800">{error}</span>
                    </div>
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-sm text-green-800">{success}</span>
                </div>
            )}

            {/* Integration Cards */}
            <div className="grid grid-cols-1 gap-4">
                {allTypes.map(type => {
                    const typeInfo = integrationTypes[type]
                    const integration = getIntegration(type)
                    const isConfigured = !!integration
                    const isActive = integration?.active ?? false
                    const Icon = TYPE_ICONS[type] || Plug
                    const colors = TYPE_COLORS[type] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }
                    const lastTest = integration?.last_test_result
                    const lastTestedAt = integration?.last_tested_at
                    const isOAuth = typeInfo.oauth || integration?.oauth
                    const oauthStatus = integration?.oauth_status
                    const oauthOk = oauthStatus?.authorized && !oauthStatus?.expired

                    return (
                        <div key={type} className={`bg-white rounded-xl border ${isConfigured ? (isActive ? 'border-slate-200' : 'border-red-200') : 'border-dashed border-slate-300'} overflow-hidden`}>
                            <div className="p-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors.bg}`}>
                                            <Icon className={`w-6 h-6 ${colors.text}`} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-slate-900">{typeInfo.name}</h3>
                                                {isConfigured && isActive && (
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Ativo</span>
                                                )}
                                                {isConfigured && !isActive && (
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">Inativo</span>
                                                )}
                                                {!isConfigured && (
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full font-medium">Nao configurado</span>
                                                )}
                                                {isConfigured && isOAuth && (
                                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium flex items-center gap-1 ${
                                                        oauthOk ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {oauthOk ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                        {oauthOk ? 'OAuth OK' : 'Nao autorizado'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 mt-0.5">{typeInfo.description}</p>
                                            {isConfigured && isOAuth && oauthStatus?.token_expires_at && (
                                                <p className={`text-xs mt-1 ${oauthStatus.expired ? 'text-red-500' : 'text-green-600'}`}>
                                                    Token: {formatExpiry(oauthStatus.token_expires_at)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {isConfigured && (
                                            <>
                                                {isOAuth && (
                                                    <button
                                                        onClick={() => handleAuthorize(type)}
                                                        disabled={authorizingType === type}
                                                        className="p-2 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Autorizar no Bling"
                                                    >
                                                        {authorizingType === type ? (
                                                            <Loader2 size={16} className="animate-spin" />
                                                        ) : (
                                                            <ExternalLink size={16} />
                                                        )}
                                                    </button>
                                                )}
                                                {typeInfo.testable && (
                                                    <button
                                                        onClick={() => handleTestConnection(type)}
                                                        disabled={testingType === type}
                                                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Testar conexao"
                                                    >
                                                        {testingType === type ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                        ) : (
                                                            <TestTube size={16} />
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleToggleActive(type)}
                                                    className={`p-2 rounded-lg transition-colors ${isActive ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                                    title={isActive ? 'Desativar' : 'Ativar'}
                                                >
                                                    {isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                </button>
                                                <button
                                                    onClick={() => setEditingType(editingType === type ? null : type)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(type)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remover"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                        {!isConfigured && (
                                            <button
                                                onClick={() => setEditingType(editingType === type ? null : type)}
                                                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1"
                                            >
                                                <Plus size={14} /> Configurar
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Masked credentials preview */}
                                {isConfigured && integration.credentials_masked && editingType !== type && (
                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                                        {Object.entries(integration.credentials_masked).map(([key, val]) => (
                                            <span key={key} className="text-xs text-slate-400">
                                                <span className="font-medium text-slate-500">{key}:</span> {val}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Last test result */}
                                {isConfigured && lastTestedAt && editingType !== type && (
                                    <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${lastTest?.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                        {lastTest?.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        <span className="font-medium">Ultimo teste:</span>
                                        {new Date(lastTestedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        {' - '}{lastTest?.message || (lastTest?.success ? 'Sucesso' : 'Falha')}
                                    </div>
                                )}

                                {/* Inline test result (just tested) */}
                                {testResult?.type === type && editingType !== type && !lastTestedAt && (
                                    <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                        {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        {testResult.message}
                                    </div>
                                )}

                                {/* Edit Form */}
                                {editingType === type && (
                                    <IntegrationForm
                                        type={type}
                                        integration={integration}
                                        onClose={() => setEditingType(null)}
                                    />
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
