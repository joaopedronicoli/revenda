import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCartStore } from '../store/cartStore'
import { getAddresses, getDefaultAddress } from '../lib/database'
import api from '../services/api'
import { MapPin, Edit2, Plus, Package, Truck, AlertCircle, X, Clock, Wallet, Gift, Tag } from 'lucide-react'
import PaymentSelector from '../components/PaymentSelector'
import { getDeliveryEstimate, getEstimatedDeliveryDate } from '../lib/deliveryEstimates'
import KitSelector from '../components/KitSelector'

export default function OrderReview() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { user, isProfileComplete } = useAuth()
    const { cart, getSummary, clearCart, selectedKit, setSelectedKit, commissionCredit, setCommissionCredit } = useCartStore()
    const [addresses, setAddresses] = useState([])
    const [selectedAddress, setSelectedAddress] = useState(null)
    const [paymentData, setPaymentData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [orderCreated, setOrderCreated] = useState(false)
    const [orderNumber, setOrderNumber] = useState(null)
    const [creditInput, setCreditInput] = useState('')
    const [couponCode, setCouponCode] = useState('')
    const [couponResult, setCouponResult] = useState(null)
    const [couponLoading, setCouponLoading] = useState(false)
    const [couponError, setCouponError] = useState('')
    const [gatewayInfo, setGatewayInfo] = useState(null)
    const [resumeOrder, setResumeOrder] = useState(null)
    const resumeOrderId = searchParams.get('resumeOrderId')

    const isFirstOrder = !user?.first_order_completed
    const userCommissionBalance = user?.commission_balance || 0

    useEffect(() => {
        loadAddressesAndCreateOrder()
    }, [])

    const loadAddressesAndCreateOrder = async () => {
        try {
            setLoading(true)
            const allAddresses = await getAddresses(user.id)
            setAddresses(allAddresses)

            // Selecionar endereco padrao
            const defaultAddr = allAddresses.find(a => a.is_default)
            const selectedAddr = defaultAddr || allAddresses[0] || null
            setSelectedAddress(selectedAddr)

            // Retomar pagamento de pedido existente (vindo do historico de pedidos)
            if (resumeOrderId) {
                try {
                    const { data: existingOrder } = await api.get(`/orders/${resumeOrderId}`)
                    if (existingOrder && existingOrder.status === 'pending') {
                        setResumeOrder(existingOrder)
                        setPaymentData({ orderId: resumeOrderId })
                        setOrderNumber(existingOrder.order_number)
                        setOrderCreated(true)
                        localStorage.setItem('pendingOrderId', resumeOrderId)
                        // Selecionar endereco do pedido
                        const orderAddr = allAddresses.find(a => a.id === existingOrder.address_id)
                        if (orderAddr) setSelectedAddress(orderAddr)
                        setLoading(false)
                        return
                    }
                } catch (err) {
                    console.error('Erro ao carregar pedido para retomar:', err)
                }
            }

            // Verificar se ja existe um pedido pendente para evitar duplicacao
            const existingOrderId = localStorage.getItem('pendingOrderId')
            if (existingOrderId) {
                try {
                    const { data: existingOrder } = await api.get(`/orders/${existingOrderId}`)

                    if (existingOrder && existingOrder.status === 'pending') {
                        console.log('Usando pedido existente:', existingOrderId)
                        setPaymentData({ orderId: existingOrderId })
                        setOrderNumber(existingOrder.order_number)
                        setOrderCreated(true)
                        setLoading(false)
                        return
                    } else if (existingOrder && existingOrder.status === 'failed') {
                        // Pedido falhou anteriormente, resetar para permitir nova tentativa
                        console.log('Pedido falhou anteriormente, resetando para retry:', existingOrderId)
                        try {
                            await api.put(`/orders/${existingOrderId}/retry-payment`)
                            setPaymentData({ orderId: existingOrderId, retrying: true })
                            setOrderNumber(existingOrder.order_number)
                            setOrderCreated(true)
                            setLoading(false)
                            return
                        } catch (retryErr) {
                            console.error('Erro ao resetar pedido falho:', retryErr)
                            localStorage.removeItem('pendingOrderId')
                        }
                    } else {
                        localStorage.removeItem('pendingOrderId')
                    }
                } catch {
                    localStorage.removeItem('pendingOrderId')
                }
            }

            // SE TEM ENDERECO, JA CRIAR O PEDIDO AUTOMATICAMENTE (apenas uma vez)
            if (selectedAddr && cart.length > 0 && !orderCreated) {
                // Block order creation if profile is incomplete
                if (!user?.document_type) {
                    setLoading(false)
                    return // Don't create order - user needs to complete profile
                }

                // Limpar qualquer pedido pendente orfao do usuario antes de criar novo
                await api.delete('/orders/pending-orphans').catch(() => {})

                const summary = getSummary()

                // Validate kit requirement for first order
                if (isFirstOrder && !selectedKit) {
                    setLoading(false)
                    return // Don't create order yet - user needs to select kit
                }

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
                            reference_url: item.reference_url,
                            woo_product_id: item.woo_product_id || null
                        })),
                        kit: selectedKit ? { id: selectedKit.id, name: selectedKit.name, price: selectedKit.price } : null,
                        summary: {
                            totalTable: summary.totalTable,
                            totalWithDiscount: summary.totalWithDiscount,
                            productTotal: summary.productTotal,
                            kitPrice: summary.kitPrice,
                            appliedCredit: summary.appliedCredit,
                            itemCount: summary.itemCount
                        }
                    },
                    total: summary.totalWithDiscount,
                    status: 'pending',
                    address_id: selectedAddr.id,
                    kit_id: selectedKit?.id || null,
                    commission_credit: summary.appliedCredit || 0
                }

                const { data: order } = await api.post('/orders', orderData)

                if (order) {
                    setPaymentData({ orderId: order.id })
                    setOrderNumber(order.order_number)
                    setOrderCreated(true)
                    localStorage.setItem('pendingOrderId', order.id)
                }
            }
        } catch (error) {
            console.error('Error loading addresses:', error)
        } finally {
            setLoading(false)
        }
    }

    // Fetch available payment methods when address changes
    useEffect(() => {
        if (!selectedAddress) return
        const fetchGatewayInfo = async () => {
            try {
                const { data } = await api.get(`/payments/available-methods?state=${selectedAddress.state}`)
                setGatewayInfo(data)
            } catch (err) {
                console.warn('Erro ao buscar metodos de pagamento:', err.message)
            }
        }
        fetchGatewayInfo()
    }, [selectedAddress?.id])

    // Create order after kit selection (for first orders)
    const createOrderWithKit = async () => {
        if (!selectedAddress || cart.length === 0) return

        try {
            setLoading(true)
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
                        reference_url: item.reference_url,
                        woo_product_id: item.woo_product_id || null
                    })),
                    kit: selectedKit ? { id: selectedKit.id, name: selectedKit.name, price: selectedKit.price } : null,
                    summary: {
                        totalTable: summary.totalTable,
                        totalWithDiscount: summary.totalWithDiscount,
                        productTotal: summary.productTotal,
                        kitPrice: summary.kitPrice,
                        appliedCredit: summary.appliedCredit,
                        itemCount: summary.itemCount
                    }
                },
                total: parseFloat(summary.totalWithDiscount) || 0,
                status: 'pending',
                address_id: selectedAddress.id,
                kit_id: selectedKit?.id || null,
                commission_credit: summary.appliedCredit || 0
            }

            const { data: order } = await api.post('/orders', orderData)

            if (order) {
                setPaymentData({ orderId: order.id })
                setOrderNumber(order.order_number)
                setOrderCreated(true)
                localStorage.setItem('pendingOrderId', order.id)
            }
        } catch (err) {
            console.error('Error creating order:', err)
            setError(err.response?.data?.error || 'Erro ao criar pedido')
        } finally {
            setLoading(false)
        }
    }

    // Auto-create order when kit is selected (first order) or immediately (recurring)
    useEffect(() => {
        if (!orderCreated && !resumeOrder && selectedAddress && cart.length > 0 && !loading) {
            if (isFirstOrder && selectedKit) {
                createOrderWithKit()
            } else if (!isFirstOrder && !orderCreated) {
                createOrderWithKit()
            }
        }
    }, [selectedKit])

    const handleApplyCredit = () => {
        const amount = parseFloat(creditInput)
        if (isNaN(amount) || amount <= 0) return
        const maxCredit = Math.min(amount, userCommissionBalance)
        setCommissionCredit(maxCredit)
        setCreditInput('')
    }

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return
        setCouponLoading(true)
        setCouponError('')
        setCouponResult(null)
        try {
            const total = resumeOrder ? parseFloat(resumeOrder.total) : getSummary().totalWithDiscount
            const { data } = await api.post('/coupons/validate', { code: couponCode, orderTotal: total })
            if (data.valid) {
                setCouponResult(data)
                // Atualizar total do pedido com desconto do cupom
                if (paymentData?.orderId) {
                    const newTotal = Math.max(total - parseFloat(data.discountAmount), 1)
                    await api.put(`/orders/${paymentData.orderId}`, {
                        total: newTotal,
                        coupon_code: couponCode.toUpperCase(),
                        coupon_discount: parseFloat(data.discountAmount)
                    }).catch(() => {})
                }
            } else {
                setCouponError(data.message || 'Cupom invalido')
            }
        } catch (err) {
            setCouponError('Erro ao validar cupom')
        } finally {
            setCouponLoading(false)
        }
    }

    const removeCoupon = async () => {
        // Reverter total do pedido
        if (paymentData?.orderId) {
            const total = resumeOrder ? parseFloat(resumeOrder.total) : getSummary().totalWithDiscount
            await api.put(`/orders/${paymentData.orderId}`, {
                total,
                coupon_code: null,
                coupon_discount: 0
            }).catch(() => {})
        }
        setCouponResult(null)
        setCouponCode('')
        setCouponError('')
    }

    const handlePaymentSuccess = (paymentResult) => {
        localStorage.setItem('lastOrderId', paymentData.orderId)
        localStorage.setItem('paymentCompleted', 'true')
        localStorage.removeItem('pendingOrderId')
        if (!resumeOrder) {
            clearCart()
        }
        navigate('/confirmation')
    }

    const handlePaymentError = (errorMessage) => {
        setError(errorMessage)
    }

    // Dados para exibicao: do pedido retomado ou do carrinho atual
    const displayItems = resumeOrder ? (resumeOrder.details?.items || []) : cart
    const displayKit = resumeOrder ? resumeOrder.details?.kit : selectedKit
    const resumeSummary = resumeOrder?.details?.summary
    const summary = resumeOrder ? {
        totalTable: resumeSummary?.totalTable || parseFloat(resumeOrder.total),
        totalWithDiscount: parseFloat(resumeOrder.total),
        productTotal: resumeSummary?.productTotal || parseFloat(resumeOrder.total),
        kitPrice: resumeSummary?.kitPrice || 0,
        appliedCredit: resumeSummary?.appliedCredit || 0,
        itemCount: resumeSummary?.itemCount || displayItems.reduce((a, i) => a + (i.quantity || 1), 0),
        discountStandard: resumeSummary?.discountStandard || 0.30,
    } : getSummary()

    const formatCurrency = (value) => {
        const num = parseFloat(value)
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(isNaN(num) ? 0 : num)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    // Verificar se carrinho esta vazio MAS nao e por causa de um pagamento completo
    // Pular check se estamos retomando pagamento de um pedido existente
    if (cart.length === 0 && !resumeOrder) {
        const paymentCompleted = localStorage.getItem('paymentCompleted')
        if (paymentCompleted === 'true') {
            localStorage.removeItem('paymentCompleted')
            navigate('/confirmation')
            return null
        }
        navigate('/')
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
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        {resumeOrder ? 'Continuar Pagamento' : 'Revisar Pedido'}
                    </h1>
                    <p className="text-slate-600">
                        {resumeOrder
                            ? <>Pedido <strong>#{orderNumber}</strong> — Finalize o pagamento do seu pedido</>
                            : orderNumber && !orderNumber.startsWith('TEMP-')
                                ? <>Pedido <strong>#{orderNumber}</strong> — Confira os detalhes antes de finalizar</>
                                : 'Confira os detalhes antes de finalizar'
                        }
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Kit Selector - First Order Only (esconder ao retomar pagamento) */}
                        {isFirstOrder && !resumeOrder && (
                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <KitSelector
                                    selectedKit={selectedKit}
                                    onSelectKit={setSelectedKit}
                                />
                            </div>
                        )}

                        {/* Delivery Address */}
                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <MapPin size={20} className="text-primary" />
                                    Endereco de Entrega
                                </h2>
                                <button
                                    onClick={() => navigate('/profile?tab=addresses')}
                                    className="text-primary hover:text-primary-dark text-sm font-medium flex items-center gap-1"
                                >
                                    <Plus size={16} />
                                    Novo Endereco
                                </button>
                            </div>

                            {addresses.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-slate-600 mb-4">Voce ainda nao tem enderecos cadastrados.</p>
                                    <button
                                        onClick={() => navigate('/profile?tab=addresses')}
                                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                                    >
                                        Cadastrar Endereco
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
                                                                Padrao
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
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Razao Social:</span>
                                            <span className="font-medium text-slate-900">
                                                {user?.companyName || 'Nao informado'}
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
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600">Nome:</span>
                                            <span className="font-medium text-slate-900">
                                                {user?.name || 'Nao informado'}
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

                        {/* Coupon Section */}
                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Tag size={20} className="text-primary" />
                                Cupom de Desconto
                            </h2>
                            {couponResult ? (
                                <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                                    <div>
                                        <span className="text-sm font-medium text-green-800">
                                            Cupom <strong>{couponCode.toUpperCase()}</strong> aplicado!
                                        </span>
                                        <p className="text-xs text-green-700 mt-0.5">
                                            Desconto: {formatCurrency(couponResult.discountAmount)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={removeCoupon}
                                        className="text-sm text-red-500 hover:text-red-700"
                                    >
                                        Remover
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={couponCode}
                                            onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                            placeholder="Digite o codigo do cupom"
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                                        />
                                        <button
                                            onClick={handleApplyCoupon}
                                            disabled={couponLoading || !couponCode.trim()}
                                            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            {couponLoading ? 'Validando...' : 'Aplicar'}
                                        </button>
                                    </div>
                                    {couponError && <p className="text-xs text-red-500 mt-2">{couponError}</p>}
                                </div>
                            )}
                        </div>

                        {/* Commission Credit Section (esconder ao retomar - ja aplicado na criacao) */}
                        {userCommissionBalance > 0 && !resumeOrder && (
                            <div className="bg-white rounded-xl p-6 border border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <Wallet size={20} className="text-green-600" />
                                    Usar Credito de Comissao
                                </h2>
                                <p className="text-sm text-slate-600 mb-3">
                                    Saldo disponivel: <strong className="text-green-600">{formatCurrency(userCommissionBalance)}</strong>
                                </p>
                                {commissionCredit > 0 ? (
                                    <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                                        <span className="text-sm text-green-800">
                                            Credito aplicado: <strong>{formatCurrency(commissionCredit)}</strong>
                                        </span>
                                        <button
                                            onClick={() => setCommissionCredit(0)}
                                            className="text-sm text-red-500 hover:text-red-700"
                                        >
                                            Remover
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={creditInput}
                                            onChange={(e) => setCreditInput(e.target.value)}
                                            placeholder={`Max ${formatCurrency(userCommissionBalance)}`}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                            max={userCommissionBalance}
                                            step="0.01"
                                        />
                                        <button
                                            onClick={handleApplyCredit}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                                        >
                                            Aplicar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Payment Method */}
                        <div className="bg-white rounded-xl p-6 border border-slate-200">
                            {!isProfileComplete ? (
                                <div className="text-center py-8">
                                    <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Cadastro incompleto</h3>
                                    <p className="text-sm text-slate-600 mb-4">
                                        Para finalizar seu pedido, complete seu cadastro com seus dados pessoais (documento, telefone, etc).
                                    </p>
                                    <button
                                        onClick={() => navigate('/complete-profile?returnTo=/order-review')}
                                        className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        Completar cadastro
                                    </button>
                                </div>
                            ) : paymentData?.orderId ? (
                                <>
                                {paymentData.retrying && (
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                        <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-amber-800">
                                            Seu pagamento anterior falhou. Tente novamente com outro cartao ou metodo de pagamento.
                                        </p>
                                    </div>
                                )}
                                <PaymentSelector
                                    total={Math.round(Math.max((parseFloat(summary.totalWithDiscount) - parseFloat(couponResult?.discountAmount || 0)) * 100, 100))} // Converter para centavos, minimo R$1
                                    customer={{
                                        name: user?.name,
                                        email: user?.email,
                                        cpf: user?.cpf,
                                        cnpj: user?.cnpj
                                    }}
                                    orderId={paymentData.orderId}
                                    onPaymentSuccess={handlePaymentSuccess}
                                    onPaymentError={handlePaymentError}
                                    state={selectedAddress?.state}
                                    gatewayInfo={gatewayInfo}
                                />
                                </>
                            ) : (
                                <div className="text-center py-8 text-slate-600">
                                    {isFirstOrder && !selectedKit
                                        ? 'Selecione um kit inicial acima para continuar'
                                        : 'Processando seu pedido...'}
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
                                {displayItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                                        <div>
                                            <p className="font-medium text-slate-900">{item.name}</p>
                                            <p className="text-sm text-slate-600">Quantidade: {item.quantity}</p>
                                        </div>
                                        <p className="font-semibold text-slate-900">
                                            {formatCurrency((parseFloat(item.tablePrice) || 0) * (item.quantity || 0))}
                                        </p>
                                    </div>
                                ))}
                                {displayKit && (
                                    <div className="flex justify-between items-center py-2 border-t-2 border-primary/20">
                                        <div>
                                            <p className="font-medium text-primary flex items-center gap-1">
                                                <Gift size={16} />
                                                {displayKit.name}
                                            </p>
                                            <p className="text-sm text-slate-600">Kit Inicial</p>
                                        </div>
                                        <p className="font-semibold text-primary">
                                            {formatCurrency(displayKit.price)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Summary Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl p-6 border border-slate-200 sticky top-4">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Resumo do Pedido</h2>

                            <div className="space-y-3 mb-4 pb-4 border-b border-slate-200">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Subtotal (tabela)</span>
                                    <span className="font-medium">{formatCurrency(summary.totalTable)}</span>
                                </div>
                                {summary.totalTable > summary.productTotal && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Desconto ({((parseFloat(summary.discountStandard) || 0) * 100).toFixed(0)}%)</span>
                                    <span className="font-medium text-green-600">
                                        -{formatCurrency(summary.totalTable - summary.productTotal)}
                                    </span>
                                </div>
                                )}
                                {summary.kitPrice > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Kit Inicial</span>
                                        <span className="font-medium">{formatCurrency(summary.kitPrice)}</span>
                                    </div>
                                )}
                                {summary.appliedCredit > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Credito Comissao</span>
                                        <span className="font-medium text-green-600">
                                            -{formatCurrency(summary.appliedCredit)}
                                        </span>
                                    </div>
                                )}
                                {couponResult && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 flex items-center gap-1">
                                            <Tag size={14} />
                                            Cupom {couponCode}
                                        </span>
                                        <span className="font-medium text-green-600">
                                            -{formatCurrency(couponResult.discountAmount)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center bg-green-50 -mx-2 px-2 py-2 rounded-lg">
                                    <span className="text-sm font-medium text-green-800 flex items-center gap-1">
                                        <Truck size={16} />
                                        Frete
                                    </span>
                                    <span className="font-bold text-green-800">GRATIS</span>
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
                                                    <p className="text-xs text-blue-600 mt-1">Previsao: ate {estimatedDate}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>

                            <div className="flex justify-between items-center mb-6">
                                <span className="text-lg font-semibold text-slate-900">Total</span>
                                <span className="text-2xl font-bold text-primary">
                                    {formatCurrency(Math.max(summary.totalWithDiscount - parseFloat(couponResult?.discountAmount || 0), 1))}
                                </span>
                            </div>

                            <button
                                onClick={() => navigate(resumeOrder ? '/profile?tab=orders' : '/')}
                                className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                            >
                                {resumeOrder ? 'Voltar aos Pedidos' : 'Voltar ao Carrinho'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
