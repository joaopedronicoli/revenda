import { useState, useEffect } from 'react'
import { Package, Plus, Edit2, Trash2, Search, RefreshCw, Eye, EyeOff, ExternalLink, Save, X, ChevronUp, ChevronDown } from 'lucide-react'
import api from '../../services/api'

const formatCurrency = (value) => {
    const num = parseFloat(value)
    if (isNaN(num)) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

const emptyProduct = {
    name: '',
    description: '',
    table_price: '',
    image: '',
    reference_url: '',
    sku: '',
    woo_product_id: '',
    active: true,
    sort_order: 0,
    special_discount: ''
}

export default function ProductManagement() {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editing, setEditing] = useState(null)
    const [formData, setFormData] = useState({ ...emptyProduct })
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState('all')
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    useEffect(() => { loadProducts() }, [])

    const loadProducts = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/admin/products')
            setProducts(data || [])
        } catch (err) {
            console.error('Error loading products:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!formData.name || !formData.table_price) return
        setSaving(true)
        try {
            const payload = {
                ...formData,
                table_price: parseFloat(formData.table_price) || 0,
                woo_product_id: formData.woo_product_id ? parseInt(formData.woo_product_id) : null,
                sort_order: parseInt(formData.sort_order) || 0,
                special_discount: formData.special_discount ? parseFloat(formData.special_discount) : null
            }

            if (editing) {
                await api.put(`/admin/products/${editing}`, payload)
            } else {
                await api.post('/admin/products', payload)
            }
            closeModal()
            loadProducts()
        } catch (err) {
            console.error('Error saving product:', err)
            alert('Erro ao salvar produto')
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (product) => {
        try {
            await api.put(`/admin/products/${product.id}`, { ...product, active: !product.active })
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, active: !p.active } : p))
        } catch (err) {
            console.error('Error toggling product:', err)
        }
    }

    const handleDelete = async (id) => {
        try {
            await api.delete(`/admin/products/${id}`)
            setProducts(prev => prev.filter(p => p.id !== id))
            setDeleteConfirm(null)
        } catch (err) {
            console.error('Error deleting product:', err)
            alert('Erro ao excluir produto')
        }
    }

    const openEdit = (product) => {
        setEditing(product.id)
        setFormData({
            name: product.name || '',
            description: product.description || '',
            table_price: product.table_price || '',
            image: product.image || '',
            reference_url: product.reference_url || '',
            sku: product.sku || '',
            woo_product_id: product.woo_product_id || '',
            active: product.active !== false,
            sort_order: product.sort_order || 0,
            special_discount: product.special_discount || ''
        })
        setShowModal(true)
    }

    const openCreate = () => {
        setEditing(null)
        setFormData({ ...emptyProduct, sort_order: products.length + 1 })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditing(null)
        setFormData({ ...emptyProduct })
    }

    const filteredProducts = products.filter(p => {
        if (filter === 'active' && !p.active) return false
        if (filter === 'inactive' && p.active) return false
        if (!search) return true
        const s = search.toLowerCase()
        return p.name?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s)
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
                    <p className="text-slate-500">
                        {products.length} produtos ({products.filter(p => p.active).length} ativos)
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadProducts} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                        <RefreshCw className="w-4 h-4" /> Atualizar
                    </button>
                    <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
                        <Plus className="w-4 h-4" /> Novo Produto
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, SKU ou descricao..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    {['all', 'active', 'inactive'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === f
                                ? 'bg-primary text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Inativos'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Package className="w-12 h-12 mb-2" />
                        <p>Nenhum produto encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-12">Ord.</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Produto</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">SKU</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Preco Tabela</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Desc. Especial</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acoes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredProducts.map(product => (
                                    <tr key={product.id} className={`hover:bg-slate-50 ${!product.active ? 'opacity-60' : ''}`}>
                                        <td className="px-4 py-3 text-sm text-slate-500">{product.sort_order}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                                        <Package className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{product.name}</p>
                                                    <p className="text-xs text-slate-500">{product.description}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 font-mono">{product.sku || '-'}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatCurrency(product.table_price)}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {product.special_discount ? (
                                                <span className="text-orange-600 font-medium">{Math.round(product.special_discount * 100)}%</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => toggleActive(product)}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${product.active
                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {product.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                                {product.active ? 'Ativo' : 'Inativo'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => openEdit(product)} className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg" title="Editar">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                {product.reference_url && (
                                                    <a href={product.reference_url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver no site">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                )}
                                                <button onClick={() => setDeleteConfirm(product.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">
                                    {editing ? 'Editar Produto' : 'Novo Produto'}
                                </h2>
                                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Preview */}
                            {formData.image && (
                                <div className="flex justify-center">
                                    <img src={formData.image} alt="Preview" className="w-24 h-24 rounded-xl object-cover border border-slate-200" />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="Nome do produto"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="Descricao curta"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Preco Tabela (R$) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.table_price}
                                        onChange={e => setFormData(prev => ({ ...prev, table_price: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Desconto Especial (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        value={formData.special_discount}
                                        onChange={e => setFormData(prev => ({ ...prev, special_discount: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="0.70 = 70%"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">URL da Imagem</label>
                                    <input
                                        type="url"
                                        value={formData.image}
                                        onChange={e => setFormData(prev => ({ ...prev, image: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="https://..."
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">URL de Referencia (site)</label>
                                    <input
                                        type="url"
                                        value={formData.reference_url}
                                        onChange={e => setFormData(prev => ({ ...prev, reference_url: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="https://patriciaelias.com.br/produto/..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                                    <input
                                        type="text"
                                        value={formData.sku}
                                        onChange={e => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="0200"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">WooCommerce ID</label>
                                    <input
                                        type="number"
                                        value={formData.woo_product_id}
                                        onChange={e => setFormData(prev => ({ ...prev, woo_product_id: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="ID do produto no WooCommerce"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ordem de Exibicao</label>
                                    <input
                                        type="number"
                                        value={formData.sort_order}
                                        onChange={e => setFormData(prev => ({ ...prev, sort_order: e.target.value }))}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-6">
                                    <input
                                        type="checkbox"
                                        id="active"
                                        checked={formData.active}
                                        onChange={e => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                                        className="w-4 h-4"
                                    />
                                    <label htmlFor="active" className="text-sm font-medium text-slate-700">Produto ativo</label>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 flex gap-3">
                            <button onClick={closeModal} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.name || !formData.table_price}
                                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar Produto'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-red-600 mb-2">Excluir Produto</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Tem certeza que deseja excluir este produto? Esta acao nao pode ser desfeita.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                                Cancelar
                            </button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
