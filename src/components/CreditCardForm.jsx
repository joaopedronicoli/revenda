import { useState } from 'react'
import { CreditCard, Lock } from 'lucide-react'

export default function CreditCardForm({ amount, onSubmit, loading }) {
    const [formData, setFormData] = useState({
        number: '',
        holder: '',
        expiry: '',
        cvv: '',
        installments: 1
    })

    const [errors, setErrors] = useState({})

    // Mask para número do cartão
    const maskCardNumber = (value) => {
        const cleaned = value.replace(/\D/g, '')
        const groups = cleaned.match(/.{1,4}/g) || []
        return groups.join(' ').substr(0, 19) // 16 dígitos + 3 espaços
    }

    // Mask para validade
    const maskExpiry = (value) => {
        const cleaned = value.replace(/\D/g, '')
        if (cleaned.length >= 2) {
            return `${cleaned.substr(0, 2)}/${cleaned.substr(2, 2)}`
        }
        return cleaned
    }

    // Detectar bandeira
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

        if (name === 'number') {
            finalValue = maskCardNumber(value)
        } else if (name === 'expiry') {
            finalValue = maskExpiry(value)
        } else if (name === 'cvv') {
            finalValue = value.replace(/\D/g, '').substr(0, 4)
        } else if (name === 'holder') {
            finalValue = value.toUpperCase()
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }))
        setErrors(prev => ({ ...prev, [name]: null }))
    }

    const validate = () => {
        const newErrors = {}

        const cardNumber = formData.number.replace(/\s/g, '')
        if (cardNumber.length !== 16) {
            newErrors.number = 'Número do cartão inválido'
        }

        if (!formData.holder || formData.holder.length < 3) {
            newErrors.holder = 'Nome do titular inválido'
        }

        const [month, year] = formData.expiry.split('/')
        if (!month || !year || parseInt(month) < 1 || parseInt(month) > 12) {
            newErrors.expiry = 'Validade inválida'
        }

        if (formData.cvv.length < 3) {
            newErrors.cvv = 'CVV inválido'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (validate()) {
            onSubmit({
                ...formData,
                brand: getCardBrand(formData.number)
            })
        }
    }

    const cardBrand = getCardBrand(formData.number)


    const formatPrice = (valueInCents) => {
        // Value já está em centavos, apenas formatar
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valueInCents / 100)
    }

    // Calcular parcelas disponíveis baseado no valor (amount está em CENTAVOS)
    const getInstallmentOptions = () => {
        const options = []

        // Definir max parcelas sem juros baseado no valor (em centavos)
        let maxInterestFree
        let maxInstallments

        if (amount <= 500000) { // R$ 5.000,00 em centavos
            maxInterestFree = 3
            maxInstallments = 12
        } else if (amount <= 1000000) { // R$ 10.000,00 em centavos
            maxInterestFree = 6
            maxInstallments = 12
        } else {
            maxInterestFree = 6
            maxInstallments = 12
        }

        // Gerar opções de parcelas
        for (let i = 1; i <= maxInstallments; i++) {
            if (i <= maxInterestFree) {
                // Sem juros
                const installmentValue = amount / i // valor em centavos
                options.push({
                    number: i,
                    value: installmentValue,
                    total: amount,
                    hasInterest: false,
                    label: `${i}x de ${formatPrice(installmentValue)} sem juros`
                })
            } else {
                // Com juros de 2% ao mês (juros compostos)
                const monthlyRate = 0.02
                const totalWithInterest = amount * Math.pow(1 + monthlyRate, i)
                const installmentValue = totalWithInterest / i

                options.push({
                    number: i,
                    value: installmentValue,
                    total: totalWithInterest,
                    hasInterest: true,
                    label: `${i}x de ${formatPrice(installmentValue)} com juros (Total: ${formatPrice(totalWithInterest)})`
                })
            }
        }

        return options
    }

    const installmentOptions = getInstallmentOptions()

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Número do Cartão */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número do Cartão
                </label>
                <div className="relative">
                    <input
                        type="text"
                        name="number"
                        value={formData.number}
                        onChange={handleChange}
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

            {/* Nome do Titular */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome do Titular
                </label>
                <input
                    type="text"
                    name="holder"
                    value={formData.holder}
                    onChange={handleChange}
                    placeholder="NOME COMO EST NO CARTÃO"
                    className={`w-full px-4 py-3 border ${errors.holder ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none`}
                />
                {errors.holder && <p className="text-red-500 text-xs mt-1">{errors.holder}</p>}
            </div>

            {/* Validade e CVV */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Validade
                    </label>
                    <input
                        type="text"
                        name="expiry"
                        value={formData.expiry}
                        onChange={handleChange}
                        placeholder="MM/AA"
                        className={`w-full px-4 py-3 border ${errors.expiry ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none`}
                    />
                    {errors.expiry && <p className="text-red-500 text-xs mt-1">{errors.expiry}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        CVV
                    </label>
                    <input
                        type="text"
                        name="cvv"
                        value={formData.cvv}
                        onChange={handleChange}
                        placeholder="123"
                        className={`w-full px-4 py-3 border ${errors.cvv ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none`}
                    />
                    {errors.cvv && <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>}
                </div>
            </div>

            {/* Parcelas */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Parcelas
                </label>
                <select
                    name="installments"
                    value={formData.installments}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                    {installmentOptions.map(opt => (
                        <option key={opt.number} value={opt.number}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Botão de Pagamento */}
            <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Processando...
                    </>
                ) : (
                    <>
                        <Lock size={20} />
                        Pagar {formatPrice(installmentOptions[formData.installments - 1]?.total || amount)}
                    </>
                )}
            </button>

            {/* Selo de Segurança */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Lock size={14} />
                <span>Pagamento seguro via iPag</span>
            </div>
        </form>
    )
}
