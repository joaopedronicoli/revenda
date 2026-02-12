import { useState, useEffect } from 'react'
import { Image, Plus, Edit, Trash2, Eye, EyeOff, Link, FileText, Video } from 'lucide-react'
import api from '../../services/api'

const typeIcons = {
    image: Image,
    banner: Image,
    video: Video,
    document: FileText,
    link: Link
}

export default function CreativeManagement() {
    const [creatives, setCreatives] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        title: '', description: '', type: 'image', fileUrl: '', dimensions: '', active: true, sortOrder: 0
    })

    useEffect(() => {
        loadCreatives()
    }, [])

    const loadCreatives = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/admin/creatives')
            setCreatives(data || [])
        } catch (err) {
            console.error('Error loading creatives:', err)
            setCreatives([])
        } finally {
            setLoading(false)
        }
    }

    const openCreate = () => {
        setEditing(null)
        setForm({ title: '', description: '', type: 'image', fileUrl: '', dimensions: '', active: true, sortOrder: 0 })
        setShowModal(true)
    }

    const openEdit = (creative) => {
        setEditing(creative.id)
        setForm({
            title: creative.title,
            description: creative.description || '',
            type: creative.type || 'image',
            fileUrl: creative.file_url,
            dimensions: creative.dimensions || '',
            active: creative.active,
            sortOrder: creative.sort_order || 0
        })
        setShowModal(true)
    }

    const saveCreative = async () => {
        if (!form.title || !form.fileUrl) {
            alert('Titulo e URL do arquivo sao obrigatorios')
            return
        }
        setSaving(true)
        try {
            if (editing) {
                await api.put(`/admin/creatives/${editing}`, form)
            } else {
                await api.post('/admin/creatives', form)
            }
            setShowModal(false)
            loadCreatives()
        } catch (err) {
            console.error('Error saving creative:', err)
            alert(err.response?.data?.message || 'Erro ao salvar material')
        } finally {
            setSaving(false)
        }
    }

    const deleteCreative = async (id, title) => {
        if (!confirm(`Tem certeza que deseja remover "${title}"?`)) return
        try {
            await api.delete(`/admin/creatives/${id}`)
            setCreatives(prev => prev.filter(c => c.id !== id))
        } catch (err) {
            console.error('Error deleting creative:', err)
            alert('Erro ao remover material')
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Image className="w-6 h-6" />
                        Materiais de Afiliados
                    </h1>
                    <p className="text-slate-500">Gerencie banners, imagens e materiais para afiliados</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Adicionar Material
                </button>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : creatives.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64 text-slate-400">
                    <Image className="w-12 h-12 mb-2" />
                    <p>Nenhum material cadastrado</p>
                    <button onClick={openCreate} className="mt-3 text-primary hover:underline text-sm">
                        Adicionar primeiro material
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {creatives.map(creative => {
                        const TypeIcon = typeIcons[creative.type] || Image
                        return (
                            <div key={creative.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Preview */}
                                <div className="h-48 bg-slate-100 flex items-center justify-center overflow-hidden">
                                    {creative.type === 'image' || creative.type === 'banner' ? (
                                        <img
                                            src={creative.file_url}
                                            alt={creative.title}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                                        />
                                    ) : null}
                                    <div className={`flex-col items-center justify-center text-slate-400 ${creative.type === 'image' || creative.type === 'banner' ? 'hidden' : 'flex'}`}>
                                        <TypeIcon className="w-12 h-12 mb-2" />
                                        <span className="text-xs uppercase">{creative.type}</span>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-slate-900 truncate flex-1">{creative.title}</h3>
                                        <span className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                            creative.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {creative.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                            {creative.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                    {creative.description && (
                                        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{creative.description}</p>
                                    )}
                                    {creative.dimensions && (
                                        <p className="text-xs text-slate-400 mb-3">{creative.dimensions}</p>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openEdit(creative)}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                        >
                                            <Edit className="w-3 h-3" />
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => deleteCreative(creative.id, creative.title)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remover"
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

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">
                                {editing ? 'Editar Material' : 'Adicionar Material'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Ex: Banner Instagram 1080x1080"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary h-20"
                                    placeholder="Descricao do material..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                    <select
                                        value={form.type}
                                        onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="image">Imagem</option>
                                        <option value="banner">Banner</option>
                                        <option value="video">Video</option>
                                        <option value="document">Documento</option>
                                        <option value="link">Link</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dimensoes</label>
                                    <input
                                        type="text"
                                        value={form.dimensions}
                                        onChange={e => setForm(prev => ({ ...prev, dimensions: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Ex: 1080x1080"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">URL do Arquivo *</label>
                                <input
                                    type="url"
                                    value={form.fileUrl}
                                    onChange={e => setForm(prev => ({ ...prev, fileUrl: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="https://exemplo.com/banner.jpg"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.active}
                                        onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                                        className="w-4 h-4 text-primary rounded"
                                    />
                                    <span className="text-sm text-slate-700">Ativo</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-slate-700">Ordem:</label>
                                    <input
                                        type="number"
                                        value={form.sortOrder}
                                        onChange={e => setForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                                        className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveCreative}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar Material'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
