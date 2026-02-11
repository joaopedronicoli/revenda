import { useState } from 'react'
import { products } from '../data/products'
import ProductCard from '../components/ProductCard'
import CartFooter from '../components/CartFooter'
import { Search } from 'lucide-react'

export default function Dashboard() {
    const [searchTerm, setSearchTerm] = useState('')

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
