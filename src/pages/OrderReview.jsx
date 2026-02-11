import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCartStore } from '../store/cartStore'
import { getAddresses, getDefaultAddress } from '../lib/database'
import api from '../services/api'
import { MapPin, Edit2, Plus, Package, Truck, AlertCircle, X, Clock } from 'lucide-react'
import PaymentSelector from '../components/PaymentSelector'
import { getDeliveryEstimate, getEstimatedDeliveryDate } from '../lib/deliveryEstimates'

export default function OrderReview() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { cart, getSummary, clearCart } = useCartStore()
    const [addresses, setAddresses] = useState([])
    const [selectedAddress, setSelectedAddress] = useState(null)
    const [paymentData, setPaymentData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [orderCreated, setOrderCreated] = useState(false)

    useEffect(() => {
        loadAddressesAndCreateOrder()
    }, [])

    const loadAddressesAndCreateOrder = async () => {
        try {
            setLoading(true)
            const allAddresses = await getAddresses(user.id)
            setAddresses(allAddresses)

            // Selecionar endereço padrão
            const defaultAddr = allAddresses.find(a => a.is_default)
            const selectedAddr = defaultAddr || allAddresses[0] || null
            setSelectedAddress(selectedAddr)

            // Verificar se já existe um pedido pendente para evitar duplicação
            const existingOrderId = localStorage.getItem('pendingOrderId')
            if (existingOrderId) {
                // Verificar se o pedido ainda existe e está pendente
                try {
                    const { data: existingOrder } = await api.get(`/orders/${existingOrderId}`)

                    if (existingOrder && existingOrder.status === 'pending') {
                        console.log('Usando pedido existente:', existingOrderId)
                        setPaymentData({ orderId: existingOrderId })
                        setOrderCreated(true)
                        setLoading(false)
                        return
                    } else {
                        // Pedido não existe mais ou já foi pago, limpar
                        localStorage.removeItem('pendingOrderId')
                    }
                } catch {
                    // Pedido não encontrado, limpar
                    localStorage.removeItem('pendingOrderId')
                }
            }

            // SE TEM ENDEREÇO, JÁ CRIAR O PEDIDO AUTOMATICAMENTE (apenas uma vez)
            if (selectedAddr && cart.length > 0 && !orderCreated) {
                // Limpar qualquer pedido pendente órfão do usuário antes de criar novo
                await api.delete('/orders/pending-orphans').catch(() => {})

                const summary = getSummary()
                const orderData = {
                    details: {
                        user_email: user.email,
                        user_name: user?.name || 'N/A',
                        user_whatsapp: user?.phone || 'N/A',
                        items: cart.map(item => ({
                            id: item.id,
                            name: item.name,
                            quantity: item.quantity,
                            tablePrice: item.tablePrice,
                            reference_url: item.reference_url
                        })),
                        summary: {
                            totalTable: summary.totalTable,
                            totalWithDiscount: summary.totalWithDiscount,
                            itemCount: summary.itemCount
                        }
                    },
                    total: summary.totalWithDiscount,
                    status: 'pending',
                    address_id: selectedAddr.id
                }

                const { data: order } = await api.post('/orders', orderData)

                if (order) {
                    setPaymentData({ orderId: order.id })
                    setOrderCreated(true) // Marcar como criado para evitar duplicação
                    localStorage.setItem('pendingOrderId', order.id) // Salvar no localStorage
                }
            }
        } catch (error) {
            console.error('Error loading addresses:', error)
        } finally {
            setLoading(false)
        }
    }

    const handlePaymentSuccess = (paymentResult) => {
        // IMPORTANTE: Salvar orderId e navegar ANTES de limpar carrinho
        // para evitar race condition com o check cart.length === 0
        localStorage.setItem('lastOrderId', paymentData.orderId)
        localStorage.setItem('paymentCompleted', 'true') // Flag para evitar redirect
        localStorage.removeItem('pendingOrderId') // Limpar pedido pendente

        // Limpar carrinho
        clearCart()

        // Redirecionar para confirmação
        navigate('/confirmation')
    }

    const handlePaymentError = (errorMessage) => {
        setError(errorMessage)
    }

    const summary = getSummary()

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    // Verificar se carrinho está vazio MAS não é por causa de um pagamento completo
    if (cart.length === 0) {
        const paymentCompleted = localStorage.getItem('paymentCompleted')
        if (paymentCompleted === 'true') {
            // Pagamento foi concluído, limpar flag e deixar continuar para confirmation
            localStorage.removeItem('paymentCompleted')
            navigate('/confirmation')
            return null
        }
        // Carrinho realmente vazio, voltar para cart
        navigate('/cart')
        return null
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8">
            {/* Error Modal */}
            {error && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                    Erro no Pagamento
                                </h3>
                                <p className="text-slate-600 text-sm mb-4">
                                    {error}
                                </p>
                                <button
                                    onClick={() => setError(null)}
                                    className="w-full bg-primary text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-dark transition-colors"
                                >
                                    Tentar Novamente
                                </button>
                            </div>
                            <button
                                onClick={() => setError(null)}
                                className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Revisar Pedido</h1>
                    <p className="text-slate-600">Confira os detalhes antes de finalizar</p>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Delivery Address */}
                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <MapPin size={20} className="text-primary" />
                                    Endereço de Entrega
                                </h2>
                                <button
                                    onClick={() => navigate('/profile?tab=addresses')}
                                    className="text-primary hover:text-primary-dark text-sm font-medium flex items-center gap-1"
                                >
                                    <Plus size={16} />
                                    Novo Endereço
                                </button>
                            </div>

                            {addresses.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-slate-600 mb-4">Você ainda não tem endereços cadastrados.</p>
                                    <button
                                        onClick={() => navigate('/profile?tab=addresses')}
                                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                                    >
                                        Cadastrar Endereço
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {addresses.map(address => (
                                        <label
                                            key={address.id}
                                            className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedAddress?.id === address.id
                                                ? 'border-primary bg-primary/5'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="radio"
                                                    name="address"
                                                    checked={selectedAddress?.id === address.id}
                                                    onChange={() => setSelectedAddress(address)}
                                                    className="mt-1"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-slate-900">
                                                            {address.nickname}
                                                        </span>
                                                        {address.is_default && (
                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                                                                Padrão
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-600">
                                                        {address.street}, {address.number}
                                                        {address.complement && ` - ${address.complement}`}
                                                        <br />
                                                        {address.neighborhood}, {address.city} - {address.state}
                                                        <br />
                                                        CEP: {address.cep}
                                                    </p>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Document Info */}
                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Dados do Documento</h2>
                            <div className="space-y-2">
                                {user?.documentType === 'cnpj' ? (
                                    <>
                                        {/* CNPJ: Mostrar Razão Social */}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Razão Social:</span>
                                            <span className="font-medium text-slate-900">
                                                {user?.companyName || 'Não informado'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">CNPJ:</span>
                                            <span className="font-medium text-slate-900">
                                                {user?.cnpj}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* CPF: Mostrar Nome */}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Nome:</span>
                                            <span className="font-medium text-slate-900">
                                                {user?.name || 'Não informado'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">CPF:</span>
                                            <span className="font-medium text-slate-900">
                                                {user?.cpf}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            {paymentData?.orderId ? (
                                <PaymentSelector
                                    total={Math.round(summary.totalWithDiscount * 100)} // Converter para centavos
                                    customer={{
                                        name: user?.name,
                                        email: user?.email,
                                        cpf: user?.cpf,
                                        cnpj: user?.cnpj
                                    }}
                                    orderId={paymentData.orderId}
                                    onPaymentSuccess={handlePaymentSuccess}
                                    onPaymentError={handlePaymentError}
                                />
                            ) : (
                                <div className="text-center py-8 text-slate-600">
                                    Clique em "Continuar para Pagamento" para processar seu pedido
                                </div>
                            )}
                        </div>

                        {/* Items */}
                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Package size={20} className="text-primary" />
                                Itens do Pedido
                            </h2>
                            <div className="space-y-3">
                                {cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                                        <div>
                                            <p className="font-medium text-slate-900">{item.name}</p>
                                            <p className="text-sm text-slate-600">Quantidade: {item.quantity}</p>
                                        </div>
                                        <p className="font-semibold text-slate-900">
                                            {formatCurrency(item.tablePrice * item.quantity)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Summary Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl p-6 border border-slate-200 sticky top-4">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Resumo do Pedido</h2>

                            <div className="space-y-3 mb-4 pb-4 border-b border-slate-200">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Subtotal</span>
                                    <span className="font-medium">{formatCurrency(summary.totalTable)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Desconto</span>
                                    <span className="font-medium text-green-600">
                                        -{formatCurrency(summary.totalTable - summary.totalWithDiscount)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-green-50 -mx-2 px-2 py-2 rounded-lg">
                                    <span className="text-sm font-medium text-green-800 flex items-center gap-1">
                                        <Truck size={16} />
                                        Frete
                                    </span>
                                    <span className="font-bold text-green-800">GRÁTIS</span>
                                </div>

                                {/* Delivery Estimate */}
                                {selectedAddress && (() => {
                                    const { days, isFreeShipping } = getDeliveryEstimate(selectedAddress.state)
                                    const estimatedDate = getEstimatedDeliveryDate(selectedAddress.state)
                                    return (
                                        <div className="bg-blue-50 -mx-2 px-2 py-3 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Clock size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-blue-900">Prazo de Entrega</p>
                                                    <p className="text-xs text-blue-700 mt-0.5">{days}</p>
                                                    <p className="text-xs text-blue-600 mt-1">Previsão: até {estimatedDate}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>

                            <div className="flex justify-between items-center mb-6">
                                <span className="text-lg font-semibold text-slate-900">Total</span>
                                <span className="text-2xl font-bold text-primary">
                                    {formatCurrency(summary.totalWithDiscount)}
                                </span>
                            </div>

                            <button
                                onClick={() => navigate('/cart')}
                                className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                            >
                                Voltar ao Carrinho
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
