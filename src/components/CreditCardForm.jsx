import { useState, useEffect, useRef } from 'react'
import { CreditCard, Lock } from 'lucide-react'

const GATEWAY_LABELS = {
    ipag: 'iPag',
    rede: 'Rede',
    mercadopago: 'Mercado Pago',
    stripe: 'Stripe'
}

export default function CreditCardForm({ amount, onSubmit, loading, gatewayType, publicKey }) {
    const [formData, setFormData] = useState({
        number: '',
        holder: '',
        expiry: '',
        cvv: '',
        installments: 1
    })

    const [errors, setErrors] = useState({})
    const [mpReady, setMpReady] = useState(false)
    const [stripeReady, setStripeReady] = useState(false)
    const stripeElementsRef = useRef(null)
    const stripeRef = useRef(null)
    const cardElementRef = useRef(null)

    // Carregar SDK do Mercado Pago dinamicamente
    useEffect(() => {
        if (gatewayType !== 'mercadopago' || !publicKey) return

        const existingScript = document.getElementById('mp-sdk')
        if (existingScript) {
            setMpReady(true)
            return
        }

        const script = document.createElement('script')
        script.id = 'mp-sdk'
        script.src = 'https://sdk.mercadopago.com/js/v2'
        script.async = true
        script.onload = () => setMpReady(true)
        document.head.appendChild(script)
    }, [gatewayType, publicKey])

    // Carregar Stripe.js dinamicamente
    useEffect(() => {
        if (gatewayType !== 'stripe' || !publicKey) return

        const existingScript = document.getElementById('stripe-sdk')
        if (existingScript) {
            initStripeElements()
            return
        }

        const script = document.createElement('script')
        script.id = 'stripe-sdk'
        script.src = 'https://js.stripe.com/v3/'
        script.async = true
        script.onload = () => initStripeElements()
        document.head.appendChild(script)
    }, [gatewayType, publicKey])

    const initStripeElements = () => {
        if (!window.Stripe || !publicKey) return
        const stripe = window.Stripe(publicKey)
        stripeRef.current = stripe
        const elements = stripe.elements()
        stripeElementsRef.current = elements

        setTimeout(() => {
            if (cardElementRef.current) {
                const cardElement = elements.create('card', {
                    style: {
                        base: {
                            fontSize: '16px',
                            color: '#334155',
                            '::placeholder': { color: '#94a3b8' }
                        }
                    }
                })
                cardElement.mount(cardElementRef.current)
                setStripeReady(true)
            }
        }, 100)
    }

    // Mask para numero do cartao
    const maskCardNumber = (value) => {
        const cleaned = value.replace(/\D/g, '')
        const groups = cleaned.match(/.{1,4}/g) || []
        return groups.join(' ').substr(0, 19)
    }

    const maskExpiry = (value) => {
        const cleaned = value.replace(/\D/g, '')
        if (cleaned.length >= 2) {
            return `${cleaned.substr(0, 2)}/${cleaned.substr(2, 2)}`
        }
        return cleaned
    }

    const getCardBrand = (number) => {
        const cleaned = number.replace(/\s/g, '')
        if (cleaned.startsWith('4')) return 'visa'
        if (cleaned.startsWith('5')) return 'mastercard'
        if (cleaned.startsWith('6')) return 'elo'
        return null
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        let finalValue = value

        if (name === 'number') finalValue = maskCardNumber(value)
        else if (name === 'expiry') finalValue = maskExpiry(value)
        else if (name === 'cvv') finalValue = value.replace(/\D/g, '').substr(0, 4)
        else if (name === 'holder') finalValue = value.toUpperCase()

        setFormData(prev => ({ ...prev, [name]: finalValue }))
        setErrors(prev => ({ ...prev, [name]: null }))
    }

    const validate = () => {
        // Stripe usa seu proprio Card Element
        if (gatewayType === 'stripe') return true

        const newErrors = {}
        const cardNumber = formData.number.replace(/\s/g, '')
        if (cardNumber.length !== 16) newErrors.number = 'Numero do cartao invalido'
        if (!formData.holder || formData.holder.length < 3) newErrors.holder = 'Nome do titular invalido'
        const [month, year] = formData.expiry.split('/')
        if (!month || !year || parseInt(month) < 1 || parseInt(month) > 12) newErrors.expiry = 'Validade invalida'
        if (formData.cvv.length < 3) newErrors.cvv = 'CVV invalido'

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validate()) return

        const brand = getCardBrand(formData.number)

        // === MERCADO PAGO: tokenizar client-side ===
        if (gatewayType === 'mercadopago' && publicKey && mpReady) {
            try {
                const mp = new window.MercadoPago(publicKey)
                const [expiryMonth, expiryYear] = formData.expiry.split('/')
                const tokenResult = await mp.createCardToken({
                    cardNumber: formData.number.replace(/\s/g, ''),
                    cardholderName: formData.holder,
                    cardExpirationMonth: expiryMonth.trim(),
                    cardExpirationYear: '20' + expiryYear.trim(),
                    securityCode: formData.cvv,
                    identificationType: 'CPF',
                    identificationNumber: ''
                })

                onSubmit({
                    ...formData,
                    brand,
                    card_token: tokenResult.id,
                    payment_method_id: brand || 'visa'
                })
                return
            } catch (err) {
                console.error('MP tokenization error:', err)
                setErrors({ number: 'Erro ao processar cartao. Verifique os dados.' })
                return
            }
        }

        // === STRIPE: criar PaymentMethod client-side ===
        if (gatewayType === 'stripe' && stripeRef.current && stripeElementsRef.current) {
            try {
                const cardElement = stripeElementsRef.current.getElement('card')
                const { paymentMethod, error } = await stripeRef.current.createPaymentMethod({
                    type: 'card',
                    card: cardElement
                })

                if (error) {
                    setErrors({ number: error.message })
                    return
                }

                onSubmit({
                    ...formData,
                    brand: paymentMethod.card?.brand || null,
                    payment_method_id: paymentMethod.id
                })
                return
            } catch (err) {
                console.error('Stripe error:', err)
                setErrors({ number: 'Erro ao processar cartao via Stripe.' })
                return
            }
        }

        // === iPag / Rede / padrao: enviar dados brutos ===
        onSubmit({ ...formData, brand })
    }

    const cardBrand = getCardBrand(formData.number)

    const formatPrice = (valueInCents) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valueInCents / 100)
    }

    const getInstallmentOptions = () => {
        const options = []
        let maxInterestFree
        let maxInstallments

        if (amount <= 500000) {
            maxInterestFree = 3; maxInstallments = 12
        } else if (amount <= 1000000) {
            maxInterestFree = 6; maxInstallments = 12
        } else {
            maxInterestFree = 6; maxInstallments = 12
        }

        for (let i = 1; i <= maxInstallments; i++) {
            if (i <= maxInterestFree) {
                const installmentValue = amount / i
                options.push({
                    number: i, value: installmentValue, total: amount, hasInterest: false,
                    label: `${i}x de ${formatPrice(installmentValue)} sem juros`
                })
            } else {
                const monthlyRate = 0.02
                const totalWithInterest = amount * Math.pow(1 + monthlyRate, i)
                const installmentValue = totalWithInterest / i
                options.push({
                    number: i, value: installmentValue, total: totalWithInterest, hasInterest: true,
                    label: `${i}x de ${formatPrice(installmentValue)} com juros (Total: ${formatPrice(totalWithInterest)})`
                })
            }
        }
        return options
    }

    const installmentOptions = getInstallmentOptions()
    const gatewayLabel = GATEWAY_LABELS[gatewayType || 'ipag'] || gatewayType || 'iPag'

    // === STRIPE: renderizar Card Element ===
    if (gatewayType === 'stripe') {
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Dados do Cartao</label>
                    <div ref={cardElementRef} className="px-4 py-3 border border-slate-300 rounded-lg" />
                    {!stripeReady && <p className="text-xs text-slate-500 mt-1">Carregando Stripe...</p>}
                    {errors.number && <p className="text-red-500 text-xs mt-1">{errors.number}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Parcelas</label>
                    <select name="installments" value={formData.installments} onChange={handleChange}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none">
                        {installmentOptions.map(opt => (
                            <option key={opt.number} value={opt.number}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                <button type="submit" disabled={loading || !stripeReady}
                    className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? (
                        <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Processando...</>
                    ) : (
                        <><Lock size={20} /> Pagar {formatPrice(installmentOptions[formData.installments - 1]?.total || amount)}</>
                    )}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Lock size={14} /><span>Pagamento seguro via {gatewayLabel}</span>
                </div>
            </form>
        )
    }

    // === iPag / Rede / Mercado Pago: formulario padrao ===
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Numero do Cartao</label>
                <div className="relative">
                    <input type="text" name="number" value={formData.number} onChange={handleChange}
                        placeholder="0000 0000 0000 0000"
                        className={`w-full px-4 py-3 border ${errors.number ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none`}
                    />
                    {cardBrand && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <span className="text-xs font-bold text-slate-600 uppercase">{cardBrand}</span>
                        </div>
                    )}
                </div>
                {errors.number && <p className="text-red-500 text-xs mt-1">{errors.number}</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Titular</label>
                <input type="text" name="holder" value={formData.holder} onChange={handleChange}
                    placeholder="NOME COMO ESTA NO CARTAO"
                    className={`w-full px-4 py-3 border ${errors.holder ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none`}
                />
                {errors.holder && <p className="text-red-500 text-xs mt-1">{errors.holder}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Validade</label>
                    <input type="text" name="expiry" value={formData.expiry} onChange={handleChange}
                        placeholder="MM/AA"
                        className={`w-full px-4 py-3 border ${errors.expiry ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none`}
                    />
                    {errors.expiry && <p className="text-red-500 text-xs mt-1">{errors.expiry}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">CVV</label>
                    <input type="text" name="cvv" value={formData.cvv} onChange={handleChange}
                        placeholder="123"
                        className={`w-full px-4 py-3 border ${errors.cvv ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none`}
                    />
                    {errors.cvv && <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Parcelas</label>
                <select name="installments" value={formData.installments} onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none">
                    {installmentOptions.map(opt => (
                        <option key={opt.number} value={opt.number}>{opt.label}</option>
                    ))}
                </select>
            </div>

            <button type="submit" disabled={loading || (gatewayType === 'mercadopago' && !mpReady)}
                className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Processando...</>
                ) : (
                    <><Lock size={20} /> Pagar {formatPrice(installmentOptions[formData.installments - 1]?.total || amount)}</>
                )}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Lock size={14} /><span>Pagamento seguro via {gatewayLabel}</span>
            </div>
        </form>
    )
}
