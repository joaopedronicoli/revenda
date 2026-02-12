import { useState, useEffect } from 'react'
import { products as staticProducts } from '../data/products'
import ProductCard from '../components/ProductCard'
import CartFooter from '../components/CartFooter'
import { Search } from 'lucide-react'
import api from '../services/api'

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
    special_discount: p.special_discount ? parseFloat(p.special_discount) : null
})

export default function Dashboard() {
    const [searchTerm, setSearchTerm] = useState('')
    const [products, setProducts] = useState(staticProducts)

    useEffect(() => {
        api.get('/products')
            .then(({ data }) => {
                if (data && data.length > 0) {
                    setProducts(data.map(mapProduct))
                }
            })
            .catch(() => {
                // Fallback to static products
            })
    }, [])

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <>
            <div className="space-y-6">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Buscar produtos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                    />
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
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
