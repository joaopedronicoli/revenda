import { useState, useEffect } from 'react'
import { FileText, Plus, Edit2, Trash2, Mail, MessageSquare, Eye, Save } from 'lucide-react'
import api from '../../services/api'

const typeConfig = {
    email: { label: 'Email', icon: Mail, color: 'bg-blue-100 text-blue-800' },
    whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'bg-green-100 text-green-800' }
}

const availableVariables = [
    { key: '{{user_name}}', description: 'Nome do usuário' },
    { key: '{{user_email}}', description: 'Email do usuário' },
    { key: '{{user_whatsapp}}', description: 'WhatsApp do usuário' },
    { key: '{{cart_items}}', description: 'Lista de itens do carrinho' },
    { key: '{{cart_total}}', description: 'Valor total do carrinho' },
    { key: '{{item_count}}', description: 'Quantidade de itens' },
    { key: '{{recovery_link}}', description: 'Link para recuperar o carrinho' },
    { key: '{{store_name}}', description: 'Nome da loja' }
]

export default function RecoveryTemplates() {
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingTemplate, setEditingTemplate] = useState(null)
    const [showPreview, setShowPreview] = useState(false)
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        type: 'email',
        subject: '',
        content: '',
        is_active: true,
        is_default: false
    })

    useEffect(() => {
        loadTemplates()
    }, [])

    const loadTemplates = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/admin/recovery-templates')
            setTemplates(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error('Error loading templates:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!formData.name || !formData.content) {
            alert('Nome e conteúdo são obrigatórios')
            return
        }

        setSaving(true)
        try {
            if (editingTemplate) {
                await api.put(`/admin/recovery-templates/${editingTemplate.id}`, formData)
            } else {
                await api.post('/admin/recovery-templates', formData)
            }

            loadTemplates()
            resetForm()
        } catch (err) {
            console.error('Error saving template:', err)
            alert('Erro ao salvar template')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este template?')) return

        try {
            await api.delete(`/admin/recovery-templates/${id}`)
            loadTemplates()
        } catch (err) {
            console.error('Error deleting template:', err)
            alert('Erro ao excluir template')
        }
    }

    const handleEdit = (template) => {
        setEditingTemplate(template)
        setFormData({
            name: template.name,
            type: template.type,
            subject: template.subject || '',
            content: template.content,
            is_active: template.is_active,
            is_default: template.is_default
        })
    }

    const resetForm = () => {
        setEditingTemplate(null)
        setFormData({
            name: '',
            type: 'email',
            subject: '',
            content: '',
            is_active: true,
            is_default: false
        })
    }

    const insertVariable = (variable) => {
        setFormData(prev => ({
            ...prev,
            content: prev.content + variable
        }))
    }

    const getPreviewContent = () => {
        let preview = formData.content
        const sampleData = {
            '{{user_name}}': 'João Silva',
            '{{user_email}}': 'joao@email.com',
            '{{user_whatsapp}}': '11999999999',
            '{{cart_items}}': '2x Produto A, 1x Produto B',
            '{{cart_total}}': 'R$ 299,90',
            '{{item_count}}': '3',
            '{{recovery_link}}': 'https://loja.com/?recover=abc123',
            '{{store_name}}': 'Patricia Elias'
        }
        Object.entries(sampleData).forEach(([key, value]) => {
            preview = preview.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
        })
        return preview
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Templates de Recuperação</h1>
                    <p className="text-slate-500">Configure os templates para recuperação de carrinhos abandonados</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Template List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900">Templates</h2>
                        <button
                            onClick={resetForm}
                            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark"
                        >
                            <Plus className="w-4 h-4" />
                            Novo
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <FileText className="w-12 h-12 mb-2" />
                            <p>Nenhum template criado</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {templates.map((template) => {
                                const typeInfo = typeConfig[template.type] || typeConfig.email
                                const TypeIcon = typeInfo.icon
                                return (
                                    <div
                                        key={template.id}
                                        className={`p-4 hover:bg-slate-50 cursor-pointer ${
                                            editingTemplate?.id === template.id ? 'bg-primary/5' : ''
                                        }`}
                                        onClick={() => handleEdit(template)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${typeInfo.color}`}>
                                                        <TypeIcon className="w-3 h-3" />
                                                        {typeInfo.label}
                                                    </span>
                                                    {template.is_default && (
                                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                                                            Padrão
                                                        </span>
                                                    )}
                                                    {!template.is_active && (
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                                                            Inativo
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-medium text-slate-900">{template.name}</p>
                                                {template.subject && (
                                                    <p className="text-sm text-slate-500 truncate">{template.subject}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleEdit(template)
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDelete(template.id)
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Editor */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900">
                            {editingTemplate ? 'Editar Template' : 'Novo Template'}
                        </h2>
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                showPreview
                                    ? 'bg-primary text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            <Eye className="w-4 h-4" />
                            Preview
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nome do Template
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Ex: Recuperação - Primeiro contato"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        {/* Type */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Tipo
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, type: 'email' }))}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                        formData.type === 'email'
                                            ? 'bg-primary text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    <Mail className="w-4 h-4" />
                                    Email
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, type: 'whatsapp' }))}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                        formData.type === 'whatsapp'
                                            ? 'bg-primary text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    WhatsApp
                                </button>
                            </div>
                        </div>

                        {/* Subject (only for email) */}
                        {formData.type === 'email' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Assunto
                                </label>
                                <input
                                    type="text"
                                    value={formData.subject}
                                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                    placeholder="Ex: Você esqueceu algo no carrinho!"
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        )}

                        {/* Variables */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Variáveis Disponíveis
                            </label>
                            <div className="flex flex-wrap gap-1">
                                {availableVariables.map((v) => (
                                    <button
                                        key={v.key}
                                        type="button"
                                        onClick={() => insertVariable(v.key)}
                                        className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs hover:bg-slate-200"
                                        title={v.description}
                                    >
                                        {v.key}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Conteúdo
                            </label>
                            {showPreview ? (
                                <div className="w-full min-h-[200px] p-4 border border-slate-300 rounded-lg bg-slate-50 whitespace-pre-wrap">
                                    {getPreviewContent()}
                                </div>
                            ) : (
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                                    placeholder="Olá {{user_name}}, você deixou alguns itens no carrinho..."
                                    rows={8}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                />
                            )}
                        </div>

                        {/* Options */}
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                    className="w-4 h-4 text-primary rounded focus:ring-primary"
                                />
                                <span className="text-sm text-slate-700">Ativo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_default}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                                    className="w-4 h-4 text-primary rounded focus:ring-primary"
                                />
                                <span className="text-sm text-slate-700">Template padrão</span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                            {editingTemplate && (
                                <button
                                    onClick={resetForm}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
