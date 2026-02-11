import { Plus, Minus, Info } from 'lucide-react'
import { useCartStore } from '../store/cartStore'
import { useAuth } from '../context/AuthContext'

const formatPrice = (price) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(price)
}

export default function ProductCard({ product }) {
    const { cart, addToCart, removeFromCart, updateQuantity, getSummary } = useCartStore()
    const { isApproved } = useAuth()
    const cartItem = cart.find(item => item.id === product.id)
    const quantity = cartItem?.quantity || 0

    // Connect to global discount logic
    const { isHighTicket, discountStandard, discountModelat } = getSummary()

    // Determine Rate for this product
    let discountRate = 0
    let discountedPrice = product.tablePrice

    if (product.id === 8) {
        // Modelat
        discountRate = discountModelat
        discountedPrice = product.tablePrice * (1 - discountRate)
    } else {
        // Produtos normais
        discountRate = discountStandard
        discountedPrice = product.tablePrice * (1 - discountRate)
    }

    const handleIncrement = () => {
        addToCart(product)
    }

    const handleDecrement = () => {
        if (quantity > 1) {
            updateQuantity(product.id, quantity - 1)
        } else {
            removeFromCart(product.id)
        }
    }

    const handleQuantityChange = (e) => {
        const value = e.target.value
        // Allow empty string during typing
        if (value === '') return

        const newQty = parseInt(value)
        if (!isNaN(newQty) && newQty >= 1) {
            updateQuantity(product.id, newQty)
        }
    }

    const handleQuantityBlur = (e) => {
        const value = e.target.value
        // If empty or invalid, reset to 1
        if (value === '' || parseInt(value) < 1) {
            updateQuantity(product.id, 1)
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow dark:bg-secondary dark:border-slate-800">
            <div className="relative aspect-square bg-slate-100">
                <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                />
                {quantity > 0 && (
                    <div className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                        {quantity} no carrinho
                    </div>
                )}
                {/* Special Badge for Modelat */}
                {product.id === 8 && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-1 rounded">
                        Oferta 70%
                    </div>
                )}
            </div>

            <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-semibold text-slate-900 text-lg mb-1 leading-tight dark:text-white">
                    {product.name}
                </h3>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2 dark:text-slate-400">
                    {product.description}
                </p>

                <div className="mt-auto">
                    <div className="flex flex-col mb-3">
                        <span className="text-xs text-slate-400 line-through">
                            De: {formatPrice(product.tablePrice)}
                        </span>
                        <span className="text-lg font-bold text-primary-dark dark:text-accent">
                            Por: {formatPrice(discountedPrice)}
                        </span>
                        <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded w-fit mt-0.5 dark:bg-green-900/30 dark:text-green-400">
                            {(discountRate * 100).toFixed(0)}% OFF
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        {quantity === 0 ? (
                            <button
                                onClick={handleIncrement}
                                disabled={!isApproved}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
                                title={!isApproved ? 'Aguarde aprovação do cadastro para fazer pedidos' : ''}
                            >
                                <Plus size={16} />
                                Adicionar
                            </button>
                        ) : (
                            <div className="flex items-center justify-between w-full bg-slate-50 rounded-lg p-1">
                                <button
                                    onClick={handleDecrement}
                                    disabled={!isApproved}
                                    className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Minus size={16} />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={handleQuantityChange}
                                    onBlur={handleQuantityBlur}
                                    disabled={!isApproved}
                                    className="font-semibold text-slate-900 w-12 text-center bg-transparent border-none outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50"
                                />
                                <button
                                    onClick={handleIncrement}
                                    disabled={!isApproved}
                                    className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
