import { useState, useEffect } from 'react'
import { CreditCard, Building2, Plus, Trash2, Edit2, CheckCircle2, XCircle, ToggleLeft, ToggleRight, TestTube, Wifi, Eye, EyeOff, ChevronDown, ChevronUp, Save, X, AlertCircle, Link, Unlink, Loader2, Copy, ExternalLink } from 'lucide-react'
import api from '../../services/api'

const BRAZILIAN_STATES = [
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
    'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
]

export default function PaymentGateways() {
    const [companies, setCompanies] = useState([])
    const [gateways, setGateways] = useState([])
    const [gatewayTypes, setGatewayTypes] = useState({})
    const [loading, setLoading] = useState(true)
    const [showCompanyForm, setShowCompanyForm] = useState(false)
    const [editingCompany, setEditingCompany] = useState(null)
    const [showGatewayForm, setShowGatewayForm] = useState(null) // billingCompanyId
    const [editingGateway, setEditingGateway] = useState(null)
    const [expandedCompany, setExpandedCompany] = useState(null)
    const [testResult, setTestResult] = useState(null)
    const [testingId, setTestingId] = useState(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [connectingOAuth, setConnectingOAuth] = useState(null)
    const [blingStatus, setBlingStatus] = useState({}) // { [companyId]: { connected, has_credentials, ... } }
    const [blingForms, setBlingForms] = useState({}) // { [companyId]: { client_id, client_secret } }
    const [blingTestResult, setBlingTestResult] = useState({})
    const [blingTesting, setBlingTesting] = useState(null)
    const [blingConnecting, setBlingConnecting] = useState(null)
    const [blingSaving, setBlingSaving] = useState(null)

    useEffect(() => { loadData() }, [])

    // Listener para callback OAuth do Mercado Pago e Bling
    useEffect(() => {
        const handler = (event) => {
            if (event.data === 'mercadopago-oauth-success') {
                flashSuccess('Mercado Pago conectado com sucesso!')
                setConnectingOAuth(null)
                loadData()
            }
            if (event.data === 'bling-company-oauth-success') {
                flashSuccess('Bling conectado com sucesso!')
                setBlingConnecting(null)
                loadData()
                // Reload bling status for all companies
                companies.forEach(c => loadBlingStatus(c.id))
            }
        }
        window.addEventListener('message', handler)
        return () => window.removeEventListener('message', handler)
    }, [companies])

    const loadData = async () => {
        try {
            setLoading(true)
            const [companiesRes, gatewaysRes, typesRes] = await Promise.all([
                api.get('/admin/billing-companies'),
                api.get('/admin/payment-gateways'),
                api.get('/admin/gateway-types')
            ])
            const companiesList = Array.isArray(companiesRes.data) ? companiesRes.data : []
            const gatewaysList = Array.isArray(gatewaysRes.data) ? gatewaysRes.data : []
            const typesObj = typesRes.data && typeof typesRes.data === 'object' && !Array.isArray(typesRes.data) ? typesRes.data : {}
            setCompanies(companiesList)
            setGateways(gatewaysList)
            setGatewayTypes(typesObj)

            if (companiesList.length > 0 && !expandedCompany) {
                setExpandedCompany(companiesList[0].id)
                loadBlingStatus(companiesList[0].id)
            }
        } catch (err) {
            setError('Erro ao carregar dados: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const flashSuccess = (msg) => {
        setSuccess(msg)
        setTimeout(() => setSuccess(''), 3000)
    }

    // ==========================================
    // Bling per-company helpers
    // ==========================================

    const loadBlingStatus = async (companyId) => {
        try {
            const { data } = await api.get(`/admin/billing-companies/${companyId}/bling`)
            setBlingStatus(prev => ({ ...prev, [companyId]: data }))
            if (data.client_id) {
                setBlingForms(prev => ({ ...prev, [companyId]: { client_id: data.client_id, client_secret: prev[companyId]?.client_secret || '' } }))
            }
        } catch (err) {
            // no bling configured yet
        }
    }

    const saveBlingCredentials = async (companyId) => {
        const form = blingForms[companyId]
        if (!form?.client_id || !form?.client_secret) {
            setError('Preencha Client ID e Client Secret')
            return
        }
        setBlingSaving(companyId)
        try {
            await api.put(`/admin/billing-companies/${companyId}/bling`, form)
            flashSuccess('Credenciais Bling salvas!')
            loadBlingStatus(companyId)
        } catch (err) {
            setError(err.response?.data?.error || err.message)
        } finally {
            setBlingSaving(null)
        }
    }

    const authorizeBling = async (companyId) => {
        setBlingConnecting(companyId)
        try {
            const { data } = await api.get(`/admin/billing-companies/${companyId}/bling/authorize`)
            window.open(data.url, '_blank', 'width=600,height=700')
        } catch (err) {
            setError(err.response?.data?.error || err.message)
            setBlingConnecting(null)
        }
    }

    const testBlingConnection = async (companyId) => {
        setBlingTesting(companyId)
        setBlingTestResult(prev => ({ ...prev, [companyId]: null }))
        try {
            const { data } = await api.post(`/admin/billing-companies/${companyId}/bling/test`)
            setBlingTestResult(prev => ({ ...prev, [companyId]: data }))
        } catch (err) {
            setBlingTestResult(prev => ({ ...prev, [companyId]: { success: false, message: err.message } }))
        } finally {
            setBlingTesting(null)
        }
    }

    // ==========================================
    // Company CRUD
    // ==========================================

    const CompanyForm = ({ company, onClose }) => {
        const [form, setForm] = useState({
            name: company?.name || '',
            cnpj: company?.cnpj || '',
            razao_social: company?.razao_social || '',
            states: company?.states || [],
            is_default: company?.is_default || false
        })

        const toggleState = (st) => {
            setForm(prev => ({
                ...prev,
                states: prev.states.includes(st) ? prev.states.filter(s => s !== st) : [...prev.states, st]
            }))
        }

        const handleSave = async () => {
            try {
                if (company) {
                    await api.put(`/admin/billing-companies/${company.id}`, form)
                } else {
                    await api.post('/admin/billing-companies', form)
                }
                flashSuccess(company ? 'Empresa atualizada' : 'Empresa criada')
                onClose()
                loadData()
            } catch (err) {
                setError(err.response?.data?.error || err.message)
            }
        }

        return (
            <div className="bg-white border-2 border-primary/20 rounded-xl p-6 mb-4">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                    {company ? 'Editar Empresa Faturadora' : 'Nova Empresa Faturadora'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                        <input
                            type="text" value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="Ex: Empresa SP"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                        <input
                            type="text" value={form.cnpj}
                            onChange={e => setForm({ ...form, cnpj: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="00.000.000/0001-00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Razao Social</label>
                        <input
                            type="text" value={form.razao_social}
                            onChange={e => setForm({ ...form, razao_social: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} className="rounded" />
                            <span className="text-sm text-slate-700">Empresa padrao (fallback)</span>
                        </label>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Estados atendidos</label>
                    <div className="flex flex-wrap gap-1.5">
                        {BRAZILIAN_STATES.map(st => (
                            <button key={st} onClick={() => toggleState(st)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                                    form.states.includes(st)
                                        ? 'bg-primary text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
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
    // Gateway Form
    // ==========================================

    const GatewayForm = ({ gateway, companyId, onClose }) => {
        const [form, setForm] = useState({
            gateway_type: gateway?.gateway_type || 'ipag',
            display_name: gateway?.display_name || '',
            supported_methods: gateway?.supported_methods || [],
            priority: gateway?.priority || 0,
            sandbox: gateway?.sandbox || false,
            credentials: {}
        })
        const [showPasswords, setShowPasswords] = useState({})

        const selectedType = gatewayTypes[form.gateway_type]
        const credFields = selectedType?.credentialFields || []

        const handleCredChange = (key, value) => {
            setForm(prev => ({
                ...prev,
                credentials: { ...prev.credentials, [key]: value }
            }))
        }

        const toggleMethod = (method) => {
            setForm(prev => ({
                ...prev,
                supported_methods: prev.supported_methods.includes(method)
                    ? prev.supported_methods.filter(m => m !== method)
                    : [...prev.supported_methods, method]
            }))
        }

        const handleSave = async () => {
            try {
                const payload = {
                    ...form,
                    billing_company_id: companyId
                }
                if (gateway) {
                    await api.put(`/admin/payment-gateways/${gateway.id}`, payload)
                } else {
                    await api.post('/admin/payment-gateways', payload)
                }
                flashSuccess(gateway ? 'Gateway atualizado' : 'Gateway criado')
                onClose()
                loadData()
            } catch (err) {
                setError(err.response?.data?.error || err.message)
            }
        }

        return (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mt-3">
                <h4 className="font-semibold text-slate-900 mb-4">
                    {gateway ? 'Editar Gateway' : 'Novo Gateway de Pagamento'}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Gateway</label>
                        <select
                            value={form.gateway_type}
                            onChange={e => setForm({ ...form, gateway_type: e.target.value, credentials: {}, supported_methods: gatewayTypes[e.target.value]?.supportedMethods || [] })}
                            disabled={!!gateway}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none disabled:bg-slate-100"
                        >
                            {Object.entries(gatewayTypes).map(([key, info]) => (
                                <option key={key} value={key}>{info.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome de exibicao</label>
                        <input
                            type="text" value={form.display_name}
                            onChange={e => setForm({ ...form, display_name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder={selectedType?.name || ''}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                        <input
                            type="number" value={form.priority}
                            onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.sandbox} onChange={e => setForm({ ...form, sandbox: e.target.checked })} className="rounded" />
                            <span className="text-sm text-slate-700">Modo Sandbox</span>
                        </label>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Metodos de pagamento</label>
                    <div className="flex gap-3">
                        {(selectedType?.supportedMethods || []).map(method => (
                            <label key={method} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.supported_methods.includes(method)} onChange={() => toggleMethod(method)} className="rounded" />
                                <span className="text-sm text-slate-700">
                                    {method === 'credit_card' ? 'Cartao de Credito' : 'PIX'}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Credenciais</label>
                    <div className="space-y-3">
                        {credFields.map(field => (
                            <div key={field.key}>
                                <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                                <div className="relative">
                                    <input
                                        type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                                        value={form.credentials[field.key] || ''}
                                        onChange={e => handleCredChange(field.key, e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none pr-10"
                                        placeholder={field.default || field.label}
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
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-blue-800 font-medium mb-1">URL do Webhook (configure no painel do gateway):</p>
                    <code className="text-xs text-blue-700 break-all">
                        {`${window.location.origin.replace(':5173', ':3000')}/webhooks/gateway/${form.gateway_type}`}
                    </code>
                </div>

                {/* Botao OAuth Mercado Pago (so aparece ao editar, com app_id preenchido) */}
                {form.gateway_type === 'mercadopago' && gateway?.id && (
                    <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-sky-900">Conexao OAuth</p>
                                <p className="text-xs text-sky-700 mt-0.5">
                                    {gateway?.credentials_masked?.oauth_connected
                                        ? 'Mercado Pago conectado via OAuth'
                                        : 'Conecte sua conta do Mercado Pago para obter os tokens automaticamente'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {gateway?.credentials_masked?.oauth_connected && (
                                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                                        <CheckCircle2 size={12} /> Conectado
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => connectMercadoPago(gateway.id)}
                                    disabled={connectingOAuth === gateway.id || !form.credentials?.app_id}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors ${
                                        gateway?.credentials_masked?.oauth_connected
                                            ? 'border border-sky-300 text-sky-700 hover:bg-sky-100'
                                            : 'bg-sky-500 text-white hover:bg-sky-600'
                                    }`}
                                >
                                    {connectingOAuth === gateway.id ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Link size={14} />
                                    )}
                                    {gateway?.credentials_masked?.oauth_connected ? 'Reconectar' : 'Conectar com Mercado Pago'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
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
    // Test Connection
    // ==========================================

    const handleTestConnection = async (gatewayId) => {
        try {
            setTestingId(gatewayId)
            setTestResult(null)
            const { data } = await api.post(`/admin/payment-gateways/${gatewayId}/test`)
            setTestResult({ id: gatewayId, ...data })
        } catch (err) {
            setTestResult({ id: gatewayId, success: false, message: err.message })
        } finally {
            setTestingId(null)
        }
    }

    const handleDeleteCompany = async (id) => {
        if (!window.confirm('Excluir empresa faturadora? Todos os gateways associados serao removidos.')) return
        try {
            await api.delete(`/admin/billing-companies/${id}`)
            flashSuccess('Empresa removida')
            loadData()
        } catch (err) {
            setError(err.response?.data?.error || err.message)
        }
    }

    const handleDeleteGateway = async (id) => {
        if (!window.confirm('Excluir este gateway?')) return
        try {
            await api.delete(`/admin/payment-gateways/${id}`)
            flashSuccess('Gateway removido')
            loadData()
        } catch (err) {
            setError(err.response?.data?.error || err.message)
        }
    }

    const handleToggleGateway = async (gw) => {
        try {
            await api.put(`/admin/payment-gateways/${gw.id}`, { active: !gw.active })
            loadData()
        } catch (err) {
            setError(err.message)
        }
    }

    const connectMercadoPago = async (gatewayId) => {
        setConnectingOAuth(gatewayId)
        try {
            const { data } = await api.get(`/admin/payment-gateways/${gatewayId}/mercadopago/authorize`)
            window.open(data.authUrl, '_blank', 'width=600,height=700')
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Erro ao conectar Mercado Pago')
            setConnectingOAuth(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Gateways de Pagamento</h1>
                    <p className="text-sm text-slate-600 mt-1">Gerencie empresas faturadoras e gateways de pagamento por estado</p>
                </div>
                <button
                    onClick={() => { setShowCompanyForm(true); setEditingCompany(null) }}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2"
                >
                    <Plus size={16} /> Nova Empresa
                </button>
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

            {/* Company Form */}
            {showCompanyForm && (
                <CompanyForm
                    company={editingCompany}
                    onClose={() => { setShowCompanyForm(false); setEditingCompany(null) }}
                />
            )}

            {/* Companies List */}
            {companies.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Nenhuma empresa faturadora</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        Crie pelo menos uma empresa faturadora para configurar os gateways de pagamento.
                    </p>
                    <button
                        onClick={() => setShowCompanyForm(true)}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                    >
                        Criar Empresa
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {companies.map(company => {
                        const companyGateways = gateways.filter(g => g.billing_company_id === company.id)
                        const isExpanded = expandedCompany === company.id

                        return (
                            <div key={company.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                {/* Company Header */}
                                <div
                                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => { setExpandedCompany(isExpanded ? null : company.id); if (!isExpanded) loadBlingStatus(company.id) }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${company.active ? 'bg-primary/10' : 'bg-slate-100'}`}>
                                            <Building2 className={`w-6 h-6 ${company.active ? 'text-primary' : 'text-slate-400'}`} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-slate-900">{company.name}</h3>
                                                {company.is_default && (
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Padrao</span>
                                                )}
                                                {!company.active && (
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">Inativa</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500">CNPJ: {company.cnpj}</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {(company.states || []).map(st => (
                                                    <span key={st} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded font-mono">{st}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-slate-500">{companyGateways.length} gateway(s)</span>
                                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => { setEditingCompany(company); setShowCompanyForm(true) }}
                                                className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteCompany(company.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                    </div>
                                </div>

                                {/* Expanded: Gateways */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-medium text-slate-800 flex items-center gap-2">
                                                <CreditCard size={16} className="text-primary" />
                                                Gateways de Pagamento
                                            </h4>
                                            <button
                                                onClick={() => { setShowGatewayForm(company.id); setEditingGateway(null) }}
                                                className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1"
                                            >
                                                <Plus size={14} /> Adicionar Gateway
                                            </button>
                                        </div>

                                        {/* Gateway Form */}
                                        {showGatewayForm === company.id && (
                                            <GatewayForm
                                                gateway={editingGateway}
                                                companyId={company.id}
                                                onClose={() => { setShowGatewayForm(null); setEditingGateway(null) }}
                                            />
                                        )}

                                        {/* Gateway Cards */}
                                        {companyGateways.length === 0 && showGatewayForm !== company.id ? (
                                            <p className="text-sm text-slate-500 text-center py-4">Nenhum gateway configurado</p>
                                        ) : (
                                            <div className="space-y-3 mt-3">
                                                {companyGateways.map(gw => (
                                                    <div key={gw.id} className={`bg-white rounded-lg border ${gw.active ? 'border-slate-200' : 'border-red-200'} p-4`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${gw.active ? 'bg-green-50' : 'bg-red-50'}`}>
                                                                    <Wifi className={`w-5 h-5 ${gw.active ? 'text-green-600' : 'text-red-400'}`} />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-medium text-slate-900">{gw.display_name || gw.gateway_type}</span>
                                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-mono">{gw.gateway_type}</span>
                                                                        {gw.sandbox && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Sandbox</span>}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        {(gw.supported_methods || []).map(m => (
                                                                            <span key={m} className="text-xs text-slate-500">
                                                                                {m === 'credit_card' ? 'Cartao' : 'PIX'}
                                                                            </span>
                                                                        ))}
                                                                        <span className="text-xs text-slate-400">| Prioridade: {gw.priority}</span>
                                                                    </div>
                                                                    {/* OAuth status para Mercado Pago */}
                                                                    {gw.gateway_type === 'mercadopago' && (
                                                                        <div className="mt-1">
                                                                            {gw.credentials_masked?.oauth_connected ? (
                                                                                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                                                                    <Link size={10} /> OAuth Conectado
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
                                                                                    <Unlink size={10} /> Nao conectado
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {/* Masked credentials (excluir oauth_connected do display) */}
                                                                    {gw.credentials_masked && (
                                                                        <div className="mt-1 flex gap-2 flex-wrap">
                                                                            {Object.entries(gw.credentials_masked).filter(([key]) => key !== 'oauth_connected').map(([key, val]) => (
                                                                                <span key={key} className="text-xs text-slate-400">{key}: {String(val)}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                {/* Botao OAuth MP */}
                                                                {gw.gateway_type === 'mercadopago' && gw.credentials_masked?.app_id && (
                                                                    <button
                                                                        onClick={() => connectMercadoPago(gw.id)}
                                                                        disabled={connectingOAuth === gw.id}
                                                                        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                                                                            gw.credentials_masked?.oauth_connected
                                                                                ? 'text-slate-600 border border-slate-300 hover:bg-slate-50'
                                                                                : 'bg-sky-500 text-white hover:bg-sky-600'
                                                                        }`}
                                                                        title={gw.credentials_masked?.oauth_connected ? 'Reconectar' : 'Conectar com Mercado Pago'}
                                                                    >
                                                                        {connectingOAuth === gw.id ? (
                                                                            <Loader2 size={12} className="animate-spin" />
                                                                        ) : (
                                                                            <Link size={12} />
                                                                        )}
                                                                        {gw.credentials_masked?.oauth_connected ? 'Reconectar' : 'Conectar'}
                                                                    </button>
                                                                )}
                                                                {/* Test */}
                                                                <button onClick={() => handleTestConnection(gw.id)} disabled={testingId === gw.id}
                                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                                                    title="Testar conexao">
                                                                    {testingId === gw.id ? (
                                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                                    ) : (
                                                                        <TestTube size={16} />
                                                                    )}
                                                                </button>
                                                                {/* Toggle */}
                                                                <button onClick={() => handleToggleGateway(gw)}
                                                                    className={`p-2 rounded-lg transition-colors ${gw.active ? 'text-green-500 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                                                    title={gw.active ? 'Desativar' : 'Ativar'}>
                                                                    {gw.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                                </button>
                                                                {/* Edit */}
                                                                <button onClick={() => { setEditingGateway(gw); setShowGatewayForm(company.id) }}
                                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors">
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                {/* Delete */}
                                                                <button onClick={() => handleDeleteGateway(gw.id)}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Test Result */}
                                                        {testResult?.id === gw.id && (
                                                            <div className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                                                {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                                {testResult.message}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Bling Integration Section */}
                                        <div className="mt-6 pt-5 border-t border-slate-200">
                                            <h4 className="font-medium text-slate-800 flex items-center gap-2 mb-4">
                                                <ExternalLink size={16} className="text-orange-500" />
                                                Integracao Bling
                                            </h4>

                                            {/* Client ID / Secret */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Client ID</label>
                                                    <input
                                                        type="text"
                                                        value={blingForms[company.id]?.client_id || ''}
                                                        onChange={e => setBlingForms(prev => ({ ...prev, [company.id]: { ...prev[company.id], client_id: e.target.value } }))}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                                                        placeholder="Client ID do Bling"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Client Secret</label>
                                                    <input
                                                        type="password"
                                                        value={blingForms[company.id]?.client_secret || ''}
                                                        onChange={e => setBlingForms(prev => ({ ...prev, [company.id]: { ...prev[company.id], client_secret: e.target.value } }))}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                                                        placeholder="Client Secret do Bling"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2 mb-4">
                                                <button
                                                    onClick={() => saveBlingCredentials(company.id)}
                                                    disabled={blingSaving === company.id}
                                                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {blingSaving === company.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                    Salvar Credenciais
                                                </button>

                                                {blingStatus[company.id]?.has_credentials && (
                                                    <button
                                                        onClick={() => authorizeBling(company.id)}
                                                        disabled={blingConnecting === company.id}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1 disabled:opacity-50 ${
                                                            blingStatus[company.id]?.connected
                                                                ? 'border border-orange-300 text-orange-700 hover:bg-orange-50'
                                                                : 'bg-orange-500 text-white hover:bg-orange-600'
                                                        }`}
                                                    >
                                                        {blingConnecting === company.id ? <Loader2 size={12} className="animate-spin" /> : <Link size={12} />}
                                                        {blingStatus[company.id]?.connected ? 'Reconectar Bling' : 'Autorizar no Bling'}
                                                    </button>
                                                )}

                                                {blingStatus[company.id]?.connected && (
                                                    <button
                                                        onClick={() => testBlingConnection(company.id)}
                                                        disabled={blingTesting === company.id}
                                                        className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 flex items-center gap-1 disabled:opacity-50"
                                                    >
                                                        {blingTesting === company.id ? <Loader2 size={12} className="animate-spin" /> : <TestTube size={12} />}
                                                        Testar Conexao
                                                    </button>
                                                )}
                                            </div>

                                            {/* Status badge */}
                                            <div className="flex items-center gap-2 mb-3">
                                                {blingStatus[company.id]?.connected ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        <CheckCircle2 size={12} /> Conectado
                                                    </span>
                                                ) : blingStatus[company.id]?.has_credentials ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                                        <AlertCircle size={12} /> Nao autorizado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                                        <XCircle size={12} /> Nao configurado
                                                    </span>
                                                )}
                                                {blingStatus[company.id]?.is_expiring && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                                        <AlertCircle size={12} /> Token expirando
                                                    </span>
                                                )}
                                            </div>

                                            {/* Test result */}
                                            {blingTestResult[company.id] && (
                                                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 mb-3 ${blingTestResult[company.id].success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                                    {blingTestResult[company.id].success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                    {blingTestResult[company.id].message}
                                                </div>
                                            )}

                                            {/* Webhook URL info */}
                                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                                <p className="text-xs text-orange-800 font-medium mb-1">URL do Webhook (configure no painel Bling):</p>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs text-orange-700 break-all flex-1">
                                                        {`${window.location.origin.replace(':5173', ':3000')}/webhooks/bling/${company.id}`}
                                                    </code>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(`${window.location.origin.replace(':5173', ':3000')}/webhooks/bling/${company.id}`)
                                                            flashSuccess('URL copiada!')
                                                        }}
                                                        className="p-1 text-orange-600 hover:text-orange-800"
                                                        title="Copiar URL"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
