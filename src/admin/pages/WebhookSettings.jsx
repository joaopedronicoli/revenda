import { useState, useEffect } from 'react'
import { Bell, Play, Check, X, RefreshCw, ExternalLink, Clock, AlertCircle } from 'lucide-react'
import api from '../../services/api'

const eventLabels = {
    order_created: 'Pedido Criado',
    order_paid: 'Pedido Pago',
    order_shipped: 'Pedido Enviado',
    order_delivered: 'Pedido Entregue',
    order_canceled: 'Pedido Cancelado',
    cart_abandoned: 'Carrinho Abandonado',
    user_registered: 'Usuário Cadastrado'
}

export default function WebhookSettings() {
    const [webhooks, setWebhooks] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null)
    const [testing, setTesting] = useState(null)
    const [testResult, setTestResult] = useState(null)

    useEffect(() => {
        loadWebhooks()
    }, [])

    const loadWebhooks = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/admin/webhook-configurations')
            setWebhooks(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error('Error loading webhooks:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateWebhook = async (id, field, value) => {
        setSaving(id)
        try {
            await api.put(`/admin/webhook-configurations/${id}`, { [field]: value })

            setWebhooks(prev =>
                prev.map(w => w.id === id ? { ...w, [field]: value } : w)
            )
        } catch (err) {
            console.error('Error updating webhook:', err)
            alert('Erro ao atualizar webhook')
        } finally {
            setSaving(null)
        }
    }

    const testWebhook = async (webhook) => {
        setTesting(webhook.id)
        setTestResult(null)
        try {
            const { data: result } = await api.post(`/admin/webhook-configurations/${webhook.id}/test`, {
                sampleData: getSampleData(webhook.event_type)
            })

            setTestResult({
                webhookId: webhook.id,
                success: result?.success ?? true,
                status: result?.status,
                message: result?.success ? 'Webhook executado com sucesso!' : 'Erro ao executar webhook'
            })

            loadWebhooks()
        } catch (err) {
            console.error('Error testing webhook:', err)
            setTestResult({
                webhookId: webhook.id,
                success: false,
                message: err.response?.data?.message || err.message
            })
        } finally {
            setTesting(null)
        }
    }

    const getSampleData = (eventType) => {
        const samples = {
            order_created: {
                order_id: 'sample-uuid',
                order_number: 'REV-111001',
                total: 299.90,
                status: 'pending',
                items: [{ name: 'Produto Teste', quantity: 2, price: 149.95 }],
                user: { name: 'João Silva', email: 'joao@email.com', whatsapp: '11999999999' }
            },
            order_paid: {
                order_id: 'sample-uuid',
                order_number: 'REV-111001',
                total: 299.90,
                payment_method: 'pix',
                user: { name: 'João Silva', email: 'joao@email.com' }
            },
            cart_abandoned: {
                cart_id: 'sample-uuid',
                total: 199.90,
                item_count: 3,
                user: { name: 'Maria Santos', email: 'maria@email.com', whatsapp: '11988888888' },
                recovery_link: 'https://loja.com/?recover=sample-uuid'
            },
            user_registered: {
                user_id: 'sample-uuid',
                name: 'Novo Usuário',
                email: 'novo@email.com',
                whatsapp: '11977777777'
            }
        }
        return samples[eventType] || { event: eventType, test: true }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Configurações de Webhook</h1>
                    <p className="text-slate-500">Configure webhooks para integração com n8n e outras ferramentas</p>
                </div>
                <button
                    onClick={loadWebhooks}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-blue-800">Integração com n8n</p>
                    <p className="text-sm text-blue-700 mt-1">
                        Para configurar um webhook, crie um novo workflow no n8n com o trigger "Webhook",
                        copie a URL do webhook e cole no campo correspondente abaixo.
                    </p>
                    <a
                        href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 mt-2"
                    >
                        Ver documentação do n8n
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>

            {/* Webhooks List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : webhooks.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-slate-400">
                        <Bell className="w-12 h-12 mb-2" />
                        <p>Nenhum webhook configurado</p>
                    </div>
                ) : (
                    webhooks.map((webhook) => (
                        <div
                            key={webhook.id}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-semibold text-slate-900">
                                            {eventLabels[webhook.event_type] || webhook.event_type}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            webhook.is_enabled
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {webhook.is_enabled ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Evento: <code className="bg-slate-100 px-1 rounded">{webhook.event_type}</code>
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={webhook.is_enabled}
                                        onChange={(e) => updateWebhook(webhook.id, 'is_enabled', e.target.checked)}
                                        disabled={saving === webhook.id}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            <div className="space-y-3">
                                {/* URL Input */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        URL do Webhook
                                    </label>
                                    <input
                                        type="url"
                                        value={webhook.webhook_url || ''}
                                        onChange={(e) => updateWebhook(webhook.id, 'webhook_url', e.target.value)}
                                        placeholder="https://seu-n8n.com/webhook/..."
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                    />
                                </div>

                                {/* Last Triggered Info */}
                                {webhook.last_triggered_at && (
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-1 text-slate-500">
                                            <Clock className="w-4 h-4" />
                                            Último disparo: {new Date(webhook.last_triggered_at).toLocaleString('pt-BR')}
                                        </div>
                                        {webhook.last_status_code && (
                                            <span className={`flex items-center gap-1 ${
                                                webhook.last_status_code >= 200 && webhook.last_status_code < 300
                                                    ? 'text-green-600'
                                                    : 'text-red-600'
                                            }`}>
                                                {webhook.last_status_code >= 200 && webhook.last_status_code < 300
                                                    ? <Check className="w-4 h-4" />
                                                    : <X className="w-4 h-4" />
                                                }
                                                Status: {webhook.last_status_code}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Test Result */}
                                {testResult && testResult.webhookId === webhook.id && (
                                    <div className={`p-3 rounded-lg text-sm ${
                                        testResult.success
                                            ? 'bg-green-50 text-green-800'
                                            : 'bg-red-50 text-red-800'
                                    }`}>
                                        {testResult.message}
                                        {testResult.status && ` (Status: ${testResult.status})`}
                                    </div>
                                )}

                                {/* Test Button */}
                                <button
                                    onClick={() => testWebhook(webhook)}
                                    disabled={!webhook.webhook_url || testing === webhook.id}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
                                >
                                    <Play className="w-4 h-4" />
                                    {testing === webhook.id ? 'Testando...' : 'Testar Webhook'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Payload Examples */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Exemplos de Payload</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Carrinho Abandonado</h4>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto">
{`{
  "event": "cart_abandoned",
  "data": {
    "cart_id": "uuid",
    "user": {
      "name": "João",
      "email": "joao@email.com",
      "whatsapp": "11999999999"
    },
    "items": [...],
    "total": 299.90,
    "recovery_link": "https://..."
  }
}`}
                        </pre>
                    </div>
                    <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Pedido Pago</h4>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto">
{`{
  "event": "order_paid",
  "data": {
    "order_id": "uuid",
    "order_number": "REV-111001",
    "total": 299.90,
    "payment_method": "pix",
    "user": {...},
    "items": [...],
    "address": {...}
  }
}`}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    )
}
