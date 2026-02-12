import { useState, useEffect } from 'react'
import { Package, Search, RefreshCw, Eye, EyeOff, ExternalLink, Save, X, Download, Edit2 } from 'lucide-react'
import api from '../../services/api'

const formatCurrency = (value) => {
    const num = parseFloat(value)
    if (isNaN(num)) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

export default function ProductManagement() {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')
    const [syncingWC, setSyncingWC] = useState(false)
    const [syncResult, setSyncResult] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [formData, setFormData] = useState({ sort_order: 0, special_discount: '', is_kit: false, active: true })
    const [saving, setSaving] = useState(false)

    useEffect(() => { loadProducts() }, [])

    const loadProducts = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/admin/products')
            setProducts(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error('Error loading products:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSyncWC = async () => {
        setSyncingWC(true)
        setSyncResult(null)
        try {
            const { data } = await api.post('/admin/woocommerce/sync-products')
            setSyncResult(data)
            loadProducts()
            setTimeout(() => setSyncResult(null), 5000)
        } catch (err) {
            console.error('Error syncing WC products:', err)
            alert('Erro ao sincronizar produtos do WooCommerce')
        } finally {
            setSyncingWC(false)
        }
    }

    const toggleActive = async (product) => {
        try {
            await api.put(`/admin/products/${product.id}`, { active: !product.active })
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, active: !p.active } : p))
        } catch (err) {
            console.error('Error toggling product:', err)
        }
    }

    const toggleKit = async (product) => {
        try {
            const { data } = await api.put(`/admin/products/${product.id}/toggle-kit`)
            setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_kit: data.is_kit } : p))
        } catch (err) {
            console.error('Error toggling kit:', err)
        }
    }

    const openEdit = (product) => {
        setEditingProduct(product)
        setFormData({
            sort_order: product.sort_order || 0,
            special_discount: product.special_discount || '',
            is_kit: product.is_kit || false,
            active: product.active !== false,
        })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingProduct(null)
    }

    const handleSave = async () => {
        if (!editingProduct) return
        setSaving(true)
        try {
            const payload = {
                sort_order: parseInt(formData.sort_order) || 0,
                special_discount: formData.special_discount ? parseFloat(formData.special_discount) : null,
                is_kit: formData.is_kit,
                active: formData.active,
            }
            await api.put(`/admin/products/${editingProduct.id}`, payload)
            closeModal()
            loadProducts()
        } catch (err) {
            console.error('Error saving product:', err)
            alert('Erro ao salvar produto')
        } finally {
            setSaving(false)
        }
    }

    const filteredProducts = products.filter(p => {
        if (filter === 'active' && !p.active) return false
        if (filter === 'inactive' && p.active) return false
        if (filter === 'kits' && !p.is_kit) return false
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
                        {products.length} produtos ({products.filter(p => p.active).length} ativos, {products.filter(p => p.is_kit).length} kits)
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadProducts} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                        <RefreshCw className="w-4 h-4" /> Atualizar
                    </button>
                    <button
                        onClick={handleSyncWC}
                        disabled={syncingWC}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                        {syncingWC ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {syncingWC ? 'Sincronizando...' : 'Sincronizar WooCommerce'}
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
                    {[
                        { key: 'all', label: 'Todos' },
                        { key: 'active', label: 'Ativos' },
                        { key: 'inactive', label: 'Inativos' },
                        { key: 'kits', label: 'Kits' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === f.key
                                ? 'bg-primary text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sync result banner */}
            {syncResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <div className="text-green-600 font-medium">
                        Sincronizacao concluida: {syncResult.imported} importados, {syncResult.updated} atualizados ({syncResult.total} no WooCommerce)
                    </div>
                </div>
            )}

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
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">SKU</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Preco Tabela</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Desc. Especial</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estoque</th>
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
                                        <td className="px-4 py-3">
                                            {product.is_kit ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                    <Package className="w-3 h-3" /> Kit
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-500">Produto</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 font-mono">{product.sku || '-'}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{formatCurrency(product.table_price)}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {product.special_discount ? (
                                                <span className="text-orange-600 font-medium">{Math.round(product.special_discount * 100)}%</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`font-medium ${(product.stock_quantity || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {product.stock_quantity || 0}
                                            </span>
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
                                                <button
                                                    onClick={() => toggleKit(product)}
                                                    className={`p-2 rounded-lg transition-colors ${product.is_kit
                                                        ? 'text-purple-600 bg-purple-50 hover:bg-purple-100'
                                                        : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'
                                                    }`}
                                                    title={product.is_kit ? 'Remover kit' : 'Marcar como kit'}
                                                >
                                                    <Package className="w-4 h-4" />
                                                </button>
                                                {product.reference_url && (
                                                    <a href={product.reference_url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver no site">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Simplified Edit Modal */}
            {showModal && editingProduct && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900">
                                    Editar — {editingProduct.name}
                                </h2>
                                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ordem de Exibicao</label>
                                <input
                                    type="number"
                                    value={formData.sort_order}
                                    onChange={e => setFormData(prev => ({ ...prev, sort_order: e.target.value }))}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Desconto Especial (decimal, ex: 0.70 = 70%)</label>
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

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="edit-is-kit"
                                    checked={formData.is_kit}
                                    onChange={e => setFormData(prev => ({ ...prev, is_kit: e.target.checked }))}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="edit-is-kit" className="text-sm font-medium text-slate-700">Marcar como Kit</label>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="edit-active"
                                    checked={formData.active}
                                    onChange={e => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="edit-active" className="text-sm font-medium text-slate-700">Produto ativo</label>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 flex gap-3">
                            <button onClick={closeModal} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
