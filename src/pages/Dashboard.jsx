import { useState, useEffect } from 'react'
import { products as staticProducts } from '../data/products'
import ProductCard from '../components/ProductCard'
import CartFooter from '../components/CartFooter'
import { Search, Package } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

// Map API product (snake_case) to frontend format (camelCase)
const mapProduct = (p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    tablePrice: parseFloat(p.table_price),
    image: p.image,
    imageDark: p.image,
    reference_url: p.reference_url,
    sku: p.sku,
    woo_product_id: p.woo_product_id,
    special_discount: p.special_discount ? parseFloat(p.special_discount) : null,
    isKit: p.is_kit || false
})

export default function Dashboard() {
    const [searchTerm, setSearchTerm] = useState('')
    const [products, setProducts] = useState(staticProducts)
    const [typeFilter, setTypeFilter] = useState('all')
    const { user } = useAuth()

    const isFirstOrder = !user?.first_order_completed

    useEffect(() => {
        api.get('/products')
            .then(({ data }) => {
                if (Array.isArray(data) && data.length > 0) {
                    setProducts(data.map(mapProduct))
                }
            })
            .catch(() => {
                // Fallback to static products
            })
    }, [])

    const filteredProducts = products
        .filter(product => {
            // First order: hide kits from catalog (they appear only in order review)
            if (isFirstOrder && product.isKit) return false

            // Type filter
            if (typeFilter === 'products' && product.isKit) return false
            if (typeFilter === 'kits' && !product.isKit) return false

            // Search filter
            if (!searchTerm) return true
            return product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.description.toLowerCase().includes(searchTerm.toLowerCase())
        })
        // Kits always below individual products
        .sort((a, b) => {
            if (a.isKit !== b.isKit) return a.isKit ? 1 : -1
            return 0 // keep alphabetical order from API
        })

    // Only show filter tabs if not first order (first order has no kits to filter)
    const showKitFilter = !isFirstOrder

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Buscar produtos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                        />
                        <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
                    </div>
                    {showKitFilter && (
                        <div className="flex gap-2">
                            {[
                                { key: 'all', label: 'Todos' },
                                { key: 'products', label: 'Produtos' },
                                { key: 'kits', label: 'Kits' },
                            ].map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setTypeFilter(f.key)}
                                    className={`px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap ${typeFilter === f.key
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {f.key === 'kits' && <Package className="w-4 h-4 inline mr-1 -mt-0.5" />}
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map(product => (
                        <div key={product.id} className="min-w-0">
                            <ProductCard product={product} />
                        </div>
                    ))}
                </div>

                {filteredProducts.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        Nenhum produto encontrado.
                    </div>
                )}
            </div>

            <CartFooter />
        </>
    )
}
