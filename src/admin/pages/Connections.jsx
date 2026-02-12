import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Mail, Database, Megaphone, Webhook, CheckCircle2, XCircle, ToggleLeft, ToggleRight, TestTube, Edit2, Trash2, Save, X, Eye, EyeOff, AlertCircle, Plus, Plug, ExternalLink, Loader2, ChevronDown, Monitor } from 'lucide-react'
import api from '../../services/api'

const TYPE_ICONS = {
    woocommerce: ShoppingCart,
    smtp: Mail,
    bling: Database,
    meta: Megaphone
}

const TYPE_COLORS = {
    woocommerce: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    smtp: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    bling: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    meta: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' }
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
        name: 'Meta / Facebook', description: 'WhatsApp, Pixel e API de Conversoes via OAuth2', testable: true, oauth: true,
        credentialFields: [
            { key: 'app_id', label: 'App ID', type: 'text' },
            { key: 'app_secret', label: 'App Secret', type: 'password' }
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
    const [pixelDropdownOpen, setPixelDropdownOpen] = useState(false)
    const [pixelsList, setPixelsList] = useState([])
    const [loadingPixels, setLoadingPixels] = useState(false)
    const [webhookConfigs, setWebhookConfigs] = useState([])
    const [addingWebhook, setAddingWebhook] = useState(false)
    const [editingWebhookId, setEditingWebhookId] = useState(null)
    const [testingWebhookId, setTestingWebhookId] = useState(null)
    const [eventTypes, setEventTypes] = useState([])

    useEffect(() => { loadData() }, [])

    // Escutar mensagem do popup OAuth (Bling e Meta)
    useEffect(() => {
        const handler = (event) => {
            if (event.data === 'bling-oauth-success') {
                flashSuccess('Bling autorizado com sucesso!')
                loadData()
            }
            if (event.data === 'meta-oauth-success') {
                flashSuccess('Meta autorizado com sucesso!')
                loadData()
            }
        }
        window.addEventListener('message', handler)
        return () => window.removeEventListener('message', handler)
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [intRes, typesRes, whRes, evtRes] = await Promise.allSettled([
                api.get('/admin/integrations'),
                api.get('/admin/integration-types'),
                api.get('/admin/webhook-configurations'),
                api.get('/admin/webhook-event-types')
            ])
            if (intRes.status === 'fulfilled') {
                setIntegrations(Array.isArray(intRes.value.data) ? intRes.value.data : [])
            }
            const typesData = typesRes.status === 'fulfilled' ? typesRes.value.data : null
            const hasTypes = typesData && typeof typesData === 'object' && !Array.isArray(typesData) && Object.keys(typesData).length > 0
            setIntegrationTypes(hasTypes ? typesData : FALLBACK_TYPES)
            if (whRes.status === 'fulfilled') {
                setWebhookConfigs(Array.isArray(whRes.value.data) ? whRes.value.data : [])
            }
            if (evtRes.status === 'fulfilled') {
                setEventTypes(Array.isArray(evtRes.value.data) ? evtRes.value.data : [])
            }
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

    const handleLoadPixels = async () => {
        setLoadingPixels(true)
        try {
            const { data } = await api.get('/admin/integrations/meta/pixels')
            setPixelsList(Array.isArray(data) ? data : [])
            setPixelDropdownOpen(true)
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Erro ao buscar pixels')
        } finally {
            setLoadingPixels(false)
        }
    }

    const handleSelectPixel = async (pixel) => {
        try {
            await api.put('/admin/integrations/meta/pixel', {
                pixel_id: pixel.id,
                pixel_name: pixel.name
            })
            setPixelDropdownOpen(false)
            setPixelsList([])
            flashSuccess(`Pixel "${pixel.name}" selecionado!`)
            loadData()
        } catch (err) {
            setError(err.response?.data?.error || err.message)
        }
    }

    // ==========================================
    // Webhook handlers
    // ==========================================

    const handleSaveWebhook = async (formData) => {
        try {
            if (editingWebhookId) {
                await api.put(`/admin/webhook-configurations/${editingWebhookId}`, formData)
                flashSuccess('Webhook atualizado')
            } else {
                await api.post('/admin/webhook-configurations', formData)
                flashSuccess('Webhook adicionado')
            }
            setAddingWebhook(false)
            setEditingWebhookId(null)
            loadData()
        } catch (err) {
            setError(err.response?.data?.message || err.message)
        }
    }

    const handleDeleteWebhook = async (id) => {
        if (!window.confirm('Remover este webhook?')) return
        try {
            await api.delete(`/admin/webhook-configurations/${id}`)
            flashSuccess('Webhook removido')
            loadData()
        } catch (err) {
            setError(err.response?.data?.message || err.message)
        }
    }

    const handleTestWebhook = async (id) => {
        try {
            setTestingWebhookId(id)
            const { data } = await api.post(`/admin/webhook-configurations/${id}/test`)
            if (data.success) {
                flashSuccess(data.message)
            } else {
                setError(data.message)
            }
            loadData()
        } catch (err) {
            setError(err.response?.data?.message || err.message)
        } finally {
            setTestingWebhookId(null)
        }
    }

    const handleToggleWebhook = async (wh) => {
        try {
            await api.put(`/admin/webhook-configurations/${wh.id}`, {
                name: wh.name, url: wh.url, events: wh.events, active: !wh.active
            })
            loadData()
        } catch (err) {
            setError(err.response?.data?.message || err.message)
        }
    }

    const formatExpiry = (isoDate) => {
        if (!isoDate) return null
        const date = new Date(isoDate)
        const now = new Date()
        const diff = date.getTime() - now.getTime()
        if (diff <= 0) return 'Expirado'
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        if (days > 0) return `Expira em ${days}d ${hours}h`
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
    // Webhook Form (inline)
    // ==========================================

    const WebhookForm = ({ webhook, onSave, onCancel }) => {
        const [form, setForm] = useState({
            name: webhook?.name || '',
            url: webhook?.url || '',
            events: webhook?.events || [],
            active: webhook?.active ?? true
        })

        const toggleEvent = (evt) => {
            setForm(prev => ({
                ...prev,
                events: prev.events.includes(evt)
                    ? prev.events.filter(e => e !== evt)
                    : [...prev.events, evt]
            }))
        }

        return (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                <h4 className="font-semibold text-slate-900 mb-4">
                    {webhook ? 'Editar Webhook' : 'Novo Webhook'}
                </h4>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Nome (opcional)</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="Ex: Meu N8N, Zapier..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">URL *</label>
                        <input
                            type="url"
                            value={form.url}
                            onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="https://exemplo.com/webhook"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-2">Eventos</label>
                        <div className="flex flex-wrap gap-2">
                            {eventTypes.map(evt => (
                                <label key={evt.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                                    form.events.includes(evt.value)
                                        ? 'bg-primary/10 text-primary border-primary/30'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={form.events.includes(evt.value)}
                                        onChange={() => toggleEvent(evt.value)}
                                        className="sr-only"
                                    />
                                    {evt.label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-500">Ativo</label>
                        <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, active: !prev.active }))}
                            className={`${form.active ? 'text-green-500' : 'text-slate-400'}`}
                        >
                            {form.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 mt-4">
                    <button
                        onClick={() => {
                            if (!form.url) { setError('URL e obrigatoria'); return }
                            onSave(form)
                        }}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1"
                    >
                        <Save size={16} /> Salvar
                    </button>
                    <button onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-1">
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
                <p className="text-sm text-slate-600 mt-1">Gerencie integracoes externas e webhooks</p>
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
                                                {type === 'meta' && isConfigured && oauthOk && (
                                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium flex items-center gap-1 ${
                                                        oauthStatus?.pixel_id ? 'bg-sky-100 text-sky-700' : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        <Monitor size={12} />
                                                        {oauthStatus?.pixel_id
                                                            ? `Pixel: ${oauthStatus.pixel_name || oauthStatus.pixel_id}`
                                                            : 'Pixel nao selecionado'}
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
                                                        title={`Autorizar no ${typeInfo.name}`}
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

                                {/* Meta Pixel Selector */}
                                {type === 'meta' && isConfigured && oauthOk && editingType !== type && (
                                    <div className="mt-3">
                                        {oauthStatus?.pixel_id ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">
                                                    <span className="font-medium">Pixel:</span> {oauthStatus.pixel_name || oauthStatus.pixel_id} ({oauthStatus.pixel_id})
                                                </span>
                                                <button
                                                    onClick={handleLoadPixels}
                                                    disabled={loadingPixels}
                                                    className="text-xs text-sky-600 hover:text-sky-700 underline"
                                                >
                                                    {loadingPixels ? 'Carregando...' : 'Trocar'}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleLoadPixels}
                                                disabled={loadingPixels}
                                                className="px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg text-xs font-medium hover:bg-sky-100 flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                {loadingPixels ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <ChevronDown size={14} />
                                                )}
                                                Selecionar Pixel
                                            </button>
                                        )}
                                        {pixelDropdownOpen && (
                                            <div className="mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {pixelsList.length === 0 ? (
                                                    <p className="p-3 text-xs text-slate-500 text-center">Nenhum pixel encontrado nas contas de anuncio.</p>
                                                ) : (
                                                    pixelsList.map(pixel => (
                                                        <button
                                                            key={pixel.id}
                                                            onClick={() => handleSelectPixel(pixel)}
                                                            className="w-full text-left px-3 py-2 text-xs hover:bg-sky-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                                        >
                                                            <span className="font-medium text-slate-800">{pixel.name}</span>
                                                            <span className="text-slate-400 ml-2">({pixel.id})</span>
                                                            {pixel.ad_account_name && (
                                                                <span className="text-slate-400 ml-1">- {pixel.ad_account_name}</span>
                                                            )}
                                                        </button>
                                                    ))
                                                )}
                                                <button
                                                    onClick={() => { setPixelDropdownOpen(false); setPixelsList([]) }}
                                                    className="w-full px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 text-center font-medium"
                                                >
                                                    Fechar
                                                </button>
                                            </div>
                                        )}
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

            {/* ==========================================
                Webhooks Section
                ========================================== */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-50">
                                <Webhook className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">Webhooks</h3>
                                <p className="text-sm text-slate-500 mt-0.5">Configure URLs para receber eventos do sistema</p>
                            </div>
                        </div>
                        {!addingWebhook && !editingWebhookId && (
                            <button
                                onClick={() => setAddingWebhook(true)}
                                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1"
                            >
                                <Plus size={14} /> Adicionar
                            </button>
                        )}
                    </div>

                    {/* Add form */}
                    {addingWebhook && (
                        <div className="mb-4">
                            <WebhookForm
                                onSave={handleSaveWebhook}
                                onCancel={() => setAddingWebhook(false)}
                            />
                        </div>
                    )}

                    {/* Webhook list */}
                    {webhookConfigs.length === 0 && !addingWebhook && (
                        <p className="text-sm text-slate-400 text-center py-4">Nenhum webhook configurado</p>
                    )}

                    <div className="space-y-3">
                        {webhookConfigs.map(wh => (
                            <div key={wh.id} className={`border rounded-lg p-4 ${wh.active ? 'border-slate-200' : 'border-red-200 bg-red-50/30'}`}>
                                {editingWebhookId === wh.id ? (
                                    <WebhookForm
                                        webhook={wh}
                                        onSave={handleSaveWebhook}
                                        onCancel={() => setEditingWebhookId(null)}
                                    />
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-slate-900 text-sm">{wh.name || 'Webhook'}</span>
                                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${wh.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {wh.active ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1 truncate">{wh.url}</p>
                                                {wh.events && wh.events.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {wh.events.map(evt => {
                                                            const evtInfo = eventTypes.find(e => e.value === evt)
                                                            return (
                                                                <span key={evt} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                                                                    {evtInfo?.label || evt}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                                {wh.last_triggered_at && (
                                                    <p className={`text-xs mt-2 ${wh.last_error ? 'text-red-500' : 'text-slate-400'}`}>
                                                        Ultimo disparo: {new Date(wh.last_triggered_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        {wh.last_status_code && ` - Status ${wh.last_status_code}`}
                                                        {wh.last_error && ` - ${wh.last_error}`}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 ml-2 shrink-0">
                                                <button
                                                    onClick={() => handleTestWebhook(wh.id)}
                                                    disabled={testingWebhookId === wh.id}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Testar"
                                                >
                                                    {testingWebhookId === wh.id ? (
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                    ) : (
                                                        <TestTube size={16} />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleToggleWebhook(wh)}
                                                    className={`p-2 rounded-lg transition-colors ${wh.active ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                                    title={wh.active ? 'Desativar' : 'Ativar'}
                                                >
                                                    {wh.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                </button>
                                                <button
                                                    onClick={() => setEditingWebhookId(wh.id)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteWebhook(wh.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remover"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
