import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Loader2, ChevronRight, Check, MapPin, Eye, EyeOff, UserPlus } from 'lucide-react'
import api from '../services/api'

export default function Register() {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [step, setStep] = useState(1)
    const [loadingCep, setLoadingCep] = useState(false)
    const [loadingCnpj, setLoadingCnpj] = useState(false)
    const [documentError, setDocumentError] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [referralValid, setReferralValid] = useState(null)
    const [referralLoading, setReferralLoading] = useState(false)

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        countryCode: '+55',
        whatsapp: '',
        email: '',
        password: '',
        confirmPassword: '',
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        uf: '',
        documentType: 'cpf',
        cpf: '',
        profession: '',
        professionOther: '',
        cnpj: '',
        companyName: '',
        referralCode: '',
        survey: {
            alreadySells: '',
            currentProducts: '',
            whereToSell: '',
            hasClients: '',
            canRecurring: '',
            motivation: '',
            firstSaleStrategy: '',
            termsAccepted: false
        }
    })

    // Load referral code from URL param
    useEffect(() => {
        const ref = searchParams.get('ref')
        if (ref) {
            setFormData(prev => ({ ...prev, referralCode: ref }))
            validateReferralCode(ref)
            // Track visit from referral link
            api.post('/referral/track-visit', { referralCode: ref, pageUrl: window.location.href }).catch(() => {})
        }
    }, [searchParams])

    const validateReferralCode = async (code) => {
        if (!code || code.length < 3) {
            setReferralValid(null)
            return
        }
        setReferralLoading(true)
        try {
            const { data } = await api.get(`/referral/validate/${code}`)
            setReferralValid(data.valid)
        } catch {
            setReferralValid(false)
        } finally {
            setReferralLoading(false)
        }
    }

    // Fetch address from CEP
    const fetchAddressFromCep = async (cep) => {
        const cleanCep = cep.replace(/\D/g, '')
        if (cleanCep.length !== 8) return

        setLoadingCep(true)
        setError('') // Clear previous errors
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
            const data = await response.json()

            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    street: data.logradouro || '',
                    neighborhood: data.bairro || '',
                    city: data.localidade || '',
                    uf: data.uf || ''
                }))
            } else {
                setError('CEP não encontrado')
            }
        } catch (err) {
            setError('Erro ao buscar CEP')
        } finally {
            setLoadingCep(false)
        }
    }

    // Mask helpers
    const maskPhone = (value) => {
        const cleaned = value.replace(/\D/g, '')
        // Format: (DDD) 9XXXX-XXXX
        if (cleaned.length <= 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim()
        }
        return cleaned.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim()
    }

    const maskCep = (value) => {
        const cleaned = value.replace(/\D/g, '')
        return cleaned.replace(/(\d{5})(\d{0,3})/, '$1-$2').trim()
    }

    const maskCpf = (value) => {
        const cleaned = value.replace(/\D/g, '')
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').trim()
    }

    const maskCnpj = (value) => {
        const cleaned = value.replace(/\D/g, '')
        return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5').trim()
    }

    // CPF validation
    const validateCpf = (cpf) => {
        const cleaned = cpf.replace(/\D/g, '')
        if (cleaned.length !== 11) return false

        // Check for known invalid CPFs
        if (/^(\d)\1{10}$/.test(cleaned)) return false

        // Validate checksum
        let sum = 0
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cleaned.charAt(i)) * (10 - i)
        }
        let digit = 11 - (sum % 11)
        if (digit >= 10) digit = 0
        if (digit !== parseInt(cleaned.charAt(9))) return false

        sum = 0
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cleaned.charAt(i)) * (11 - i)
        }
        digit = 11 - (sum % 11)
        if (digit >= 10) digit = 0
        if (digit !== parseInt(cleaned.charAt(10))) return false

        return true
    }

    // Fetch company data from CNPJ using BrasilAPI (supports CORS)
    const fetchCnpjData = async (cnpj) => {
        const cleaned = cnpj.replace(/\D/g, '')
        if (cleaned.length !== 14) return

        setLoadingCnpj(true)
        setDocumentError('')

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`)

            if (!response.ok) {
                setDocumentError('CNPJ não encontrado')
                setFormData(prev => ({ ...prev, companyName: '' }))
                return
            }

            const data = await response.json()
            setFormData(prev => ({ ...prev, companyName: data.razao_social || data.nome_fantasia }))
        } catch (err) {
            setDocumentError('Erro ao buscar CNPJ. Verifique o número digitado.')
            setFormData(prev => ({ ...prev, companyName: '' }))
        } finally {
            setLoadingCnpj(false)
        }
    }

    // Get full international phone number for storage
    const getInternationalPhone = () => {
        const cleaned = formData.whatsapp.replace(/\D/g, '')
        return `${formData.countryCode}${cleaned}` // Returns +55DDD9XXXXXXXX
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        if (name.startsWith('survey.')) {
            const field = name.split('.')[1]
            setFormData(prev => ({
                ...prev,
                survey: { ...prev.survey, [field]: type === 'checkbox' ? checked : value }
            }))
        } else {
            let finalValue = value

            // Apply masks
            if (name === 'whatsapp') finalValue = maskPhone(value)
            if (name === 'cep') finalValue = maskCep(value)
            if (name === 'cpf') finalValue = maskCpf(value)
            if (name === 'cnpj') finalValue = maskCnpj(value)

            setFormData(prev => ({ ...prev, [name]: finalValue }))

            // Auto-fetch address when CEP is complete
            if (name === 'cep' && finalValue.replace(/\D/g, '').length === 8) {
                fetchAddressFromCep(finalValue)
            }

            // Auto-fetch company data when CNPJ is complete
            if (name === 'cnpj' && finalValue.replace(/\D/g, '').length === 14) {
                fetchCnpjData(finalValue)
            }

            // Validate CPF when complete
            if (name === 'cpf' && finalValue.replace(/\D/g, '').length === 11) {
                setDocumentError('')
                if (!validateCpf(finalValue)) {
                    setDocumentError('CPF inválido')
                }
            }
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const registrationData = {
                name: formData.name,
                whatsapp: getInternationalPhone(),
                cep: formData.cep,
                street: formData.street,
                number: formData.number,
                complement: formData.complement,
                neighborhood: formData.neighborhood,
                city: formData.city,
                state: formData.uf,
                documentType: formData.documentType,
                cpf: formData.cpf,
                profession: formData.profession,
                professionOther: formData.professionOther,
                cnpj: formData.cnpj,
                companyName: formData.companyName,
                referralCode: formData.referralCode || undefined
            }

            const { user } = await register(formData.email, formData.password, registrationData)

            // Mark conversion if referral code was used
            if (formData.referralCode) {
                api.post('/referral/mark-conversion', { referralCode: formData.referralCode, referredUserId: user?.id }).catch(() => {})
            }

            navigate('/login', { state: { showVerificationMessage: true } })
        } catch (err) {
            setError(err.response?.data?.message || err.message)
        } finally {
            setLoading(false)
        }
    }

    const nextStep = () => {
        setError('') // Clear errors when moving forward
        setDocumentError('') // Clear document errors too
        setStep(prev => prev + 1)
    }

    const prevStep = () => {
        setError('') // Clear errors when moving backward
        setDocumentError('') // Clear document errors too
        setStep(prev => prev - 1)
    }

    // Full address for map
    const fullAddress = formData.number && formData.street
        ? `${formData.street}, ${formData.number}, ${formData.neighborhood}, ${formData.city} - ${formData.uf}, ${formData.cep}`
        : ''

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8 font-sans">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 sm:px-8 py-6 text-center border-b-2 border-primary">
                    <h2 className="text-2xl font-bold text-primary">Cadastro de Revendedor</h2>
                    <p className="text-slate-600 text-sm mt-1">Junte-se ao time Patrícia Elias</p>
                </div>


                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-4 py-6 border-b border-slate-200 bg-white">
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm ${step >= s
                                ? 'bg-primary text-white ring-2 ring-primary/20'
                                : 'bg-slate-100 text-slate-400'
                                }`}>
                                {step > s ? <Check size={18} /> : s}
                            </div>
                            {s < 4 && <div className={`w-16 h-1 rounded-full transition-all ${step > s ? 'bg-primary' : 'bg-slate-200'}`} />}
                        </div>
                    ))}
                </div>

                <div className="p-4 sm:p-8">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* STEP 1: PERSONAL DATA */}
                        {step === 1 && (
                            <div className="space-y-4 animate-fadeIn">
                                <h3 className="text-lg font-semibold text-primary mb-4">Dados Pessoais</h3>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                                    <input
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                                        placeholder="Seu nome completo"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Telefone
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            name="countryCode"
                                            value={formData.countryCode}
                                            onChange={handleChange}
                                            className="w-28 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                                        >
                                            <option value="+55">🇧🇷 +55</option>
                                            <option value="+1">🇺🇸 +1</option>
                                            <option value="+351">🇵🇹 +351</option>
                                        </select>
                                        <input
                                            name="whatsapp"
                                            required
                                            value={formData.whatsapp}
                                            onChange={handleChange}
                                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                            placeholder="(11) 99999-9999"
                                            maxLength={15}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Formato: {formData.countryCode} (DDD) 9XXXX-XXXX</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <input
                                        name="email"
                                        required
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            required
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                            placeholder="Mínimo 6 caracteres"
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha</label>
                                    <div className="relative">
                                        <input
                                            name="confirmPassword"
                                            required
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                            placeholder="Digite a senha novamente"
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                        <p className="text-xs text-red-500 mt-1">As senhas não coincidem</p>
                                    )}
                                    {formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 6 && (
                                        <p className="text-xs text-green-600 mt-1">As senhas coincidem</p>
                                    )}
                                </div>

                                {/* Referral Code */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Codigo de Indicacao (opcional)
                                    </label>
                                    <div className="relative">
                                        <input
                                            name="referralCode"
                                            value={formData.referralCode}
                                            onChange={(e) => {
                                                handleChange(e)
                                                if (e.target.value.length >= 3) {
                                                    validateReferralCode(e.target.value)
                                                } else {
                                                    setReferralValid(null)
                                                }
                                            }}
                                            className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                            placeholder="PE-NOME1234"
                                        />
                                        {referralLoading && (
                                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                                        )}
                                        {!referralLoading && referralValid === true && (
                                            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                                        )}
                                    </div>
                                    {referralValid === true && (
                                        <p className="text-xs text-green-600 mt-1">Codigo valido! Voce recebera beneficios de indicacao.</p>
                                    )}
                                    {referralValid === false && formData.referralCode && (
                                        <p className="text-xs text-red-500 mt-1">Codigo de indicacao invalido</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 2: ADDRESS */}
                        {step === 2 && (
                            <div className="space-y-4 animate-fadeIn">
                                <h3 className="text-lg font-semibold text-primary mb-4">Endereço de Atuação</h3>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                                    <input
                                        name="cep"
                                        required
                                        value={formData.cep}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                        placeholder="00000-000"
                                        maxLength={9}
                                    />
                                    {loadingCep && <p className="text-xs text-primary mt-1">Buscando endereço...</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Rua</label>
                                    <input
                                        name="street"
                                        required
                                        value={formData.street}
                                        onChange={handleChange}
                                        readOnly={!!formData.street}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-slate-50"
                                        placeholder="Aguardando CEP..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                                        <input
                                            name="number"
                                            required
                                            value={formData.number}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                            placeholder="123"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
                                        <input
                                            name="complement"
                                            value={formData.complement}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                            placeholder="Apto, Sala..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
                                    <input
                                        name="neighborhood"
                                        required
                                        value={formData.neighborhood}
                                        onChange={handleChange}
                                        readOnly={!!formData.neighborhood}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-slate-50"
                                        placeholder="Aguardando CEP..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                                        <input
                                            name="city"
                                            required
                                            value={formData.city}
                                            onChange={handleChange}
                                            readOnly={!!formData.city}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-slate-50"
                                            placeholder="Aguardando CEP..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Estado (UF)</label>
                                        <input
                                            name="uf"
                                            required
                                            value={formData.uf}
                                            onChange={handleChange}
                                            readOnly={!!formData.uf}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-slate-50"
                                            placeholder="UF"
                                            maxLength={2}
                                        />
                                    </div>
                                </div>

                                {/* Visual Map Feedback */}
                                {fullAddress && (
                                    <div className="mt-6 rounded-xl overflow-hidden shadow-md border border-slate-200">
                                        <div className="bg-primary/5 px-3 py-2 flex items-center gap-2 text-sm text-primary border-b border-primary/10">
                                            <MapPin size={16} />
                                            <span className="font-medium">Localização</span>
                                        </div>
                                        <iframe
                                            width="100%"
                                            height="200"
                                            frameBorder="0"
                                            scrolling="no"
                                            marginHeight="0"
                                            marginWidth="0"
                                            src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                                        ></iframe>
                                        <div className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                            {fullAddress}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 3: DOCUMENT (CNPJ/CPF) */}
                        {step === 3 && (
                            <div className="space-y-6 animate-fadeIn">
                                <h3 className="text-lg font-semibold text-primary mb-4">Documento</h3>

                                {/* Document Type Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-3">Tipo de Documento</label>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="radio"
                                                name="documentType"
                                                value="cpf"
                                                checked={formData.documentType === 'cpf'}
                                                onChange={handleChange}
                                                className="w-4 h-4 text-primary"
                                            />
                                            <span className="font-medium">CPF (Pessoa Física)</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="radio"
                                                name="documentType"
                                                value="cnpj"
                                                checked={formData.documentType === 'cnpj'}
                                                onChange={handleChange}
                                                className="w-4 h-4 text-primary"
                                            />
                                            <span className="font-medium">CNPJ (Pessoa Jurídica)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* CPF Input */}
                                {formData.documentType === 'cpf' && (
                                    <div className="space-y-4 animate-fadeIn">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                                            <input
                                                name="cpf"
                                                required
                                                value={formData.cpf}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                                placeholder="000.000.000-00"
                                                maxLength={14}
                                            />
                                            {documentError && (
                                                <p className="text-xs text-red-500 mt-1">{documentError}</p>
                                            )}
                                            <p className="text-xs text-slate-500 mt-1">
                                                O CPF deve estar cadastrado no nome de {formData.name || 'você'}
                                            </p>
                                        </div>

                                        {/* Profession field for CPF */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Profissão</label>
                                            <select
                                                name="profession"
                                                required
                                                value={formData.profession}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                                            >
                                                <option value="">Selecione sua profissão</option>
                                                <option value="Esteticista">Esteticista</option>
                                                <option value="Dermatologista">Dermatologista</option>
                                                <option value="Cosmetóloga">Cosmetóloga</option>
                                                <option value="Maquiador(a)">Maquiador(a)</option>
                                                <option value="Cabeleireiro(a)">Cabeleireiro(a)</option>
                                                <option value="Manicure/Pedicure">Manicure/Pedicure</option>
                                                <option value="Vendedor(a)">Vendedor(a)</option>
                                                <option value="Empresário(a)">Empresário(a)</option>
                                                <option value="Influenciador(a)">Influenciador(a)</option>
                                                <option value="Outra">Outra</option>
                                            </select>
                                        </div>

                                        {/* Conditional field: Show only if "Outra" is selected */}
                                        {formData.profession === 'Outra' && (
                                            <div className="animate-fadeIn">
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Qual sua profissão?</label>
                                                <input
                                                    name="professionOther"
                                                    required
                                                    value={formData.professionOther}
                                                    onChange={handleChange}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                                    placeholder="Digite sua profissão"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* CNPJ Input */}
                                {formData.documentType === 'cnpj' && (
                                    <div className="space-y-4 animate-fadeIn">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                                            <input
                                                name="cnpj"
                                                required
                                                value={formData.cnpj}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                                placeholder="00.000.000/0000-00"
                                                maxLength={18}
                                            />
                                            {loadingCnpj && <p className="text-xs text-primary mt-1">Buscando empresa...</p>}
                                            {documentError && (
                                                <p className="text-xs text-red-500 mt-1">{documentError}</p>
                                            )}
                                        </div>

                                        {/* Company Name (Auto-filled) */}
                                        {formData.companyName && (
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social</label>
                                                <input
                                                    value={formData.companyName}
                                                    readOnly
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                                                />
                                                <p className="text-xs text-green-600 mt-1">✓ Empresa encontrada</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setStep(2)}
                                        className="flex-1 px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (formData.documentType === 'cpf' && !validateCpf(formData.cpf)) {
                                                setDocumentError('CPF inválido')
                                                return
                                            }
                                            if (formData.documentType === 'cnpj' && !formData.companyName) {
                                                setDocumentError('Aguarde o carregamento dos dados da empresa')
                                                return
                                            }
                                            setStep(4)
                                        }}
                                        className="flex-1 px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        Próximo <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: SURVEY */}
                        {step === 4 && (
                            <div className="space-y-4 animate-fadeIn">
                                <h3 className="text-lg font-semibold text-primary mb-4">Perfil do Revendedor</h3>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Você já vende produtos de beleza/estética hoje?</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm"><input type="radio" name="survey.alreadySells" value="Sim" onChange={handleChange} required /> Sim</label>
                                        <label className="flex items-center gap-2 text-sm"><input type="radio" name="survey.alreadySells" value="Não" onChange={handleChange} required /> Não</label>
                                    </div>
                                </div>

                                {/* Conditional field: Show only if user answered "Sim" */}
                                {formData.survey.alreadySells === 'Sim' && (
                                    <div className="animate-fadeIn">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Quais produtos você vende atualmente?</label>
                                        <input
                                            name="survey.currentProducts"
                                            required
                                            onChange={handleChange}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-primary"
                                            placeholder="Ex: Cosméticos, Maquiagem, Skincare..."
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Onde pretende vender?</label>
                                    <input
                                        name="survey.whereToSell"
                                        required
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="Ex: Clínica, Redes Sociais, Porta a porta..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tem clientes ativos?</label>
                                        <select name="survey.hasClients" onChange={handleChange} className="w-full border rounded-lg p-2" required>
                                            <option value="">Selecione</option>
                                            <option value="Sim">Sim</option>
                                            <option value="Não">Não</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Compra recorrente?</label>
                                        <select name="survey.canRecurring" onChange={handleChange} className="w-full border rounded-lg p-2" required>
                                            <option value="">Selecione</option>
                                            <option value="Sim">Sim</option>
                                            <option value="Não">Talvez</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">O que motivou a revenda?</label>
                                    <textarea name="survey.motivation" onChange={handleChange} className="w-full border rounded-lg p-2 h-20" required></textarea>
                                </div>

                                <div className="flex items-start gap-2 pt-2">
                                    <input type="checkbox" name="survey.termsAccepted" required onChange={handleChange} className="mt-1" />
                                    <span className="text-sm text-slate-600">
                                        Declaro estar de acordo com o pedido mínimo e a política de preços da marca.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="mt-8 flex justify-between gap-4">
                            {step > 1 ? (
                                <button
                                    type="button"
                                    onClick={prevStep}
                                    className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Voltar
                                </button>
                            ) : (
                                <Link to="/login" className="px-6 py-2.5 text-slate-500 hover:text-primary transition-colors">
                                    Já tenho conta
                                </Link>
                            )}

                            {step < 3 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (step === 1 && formData.password !== formData.confirmPassword) {
                                            setError('As senhas não coincidem')
                                            return
                                        }
                                        if (step === 1 && formData.password.length < 6) {
                                            setError('A senha deve ter no mínimo 6 caracteres')
                                            return
                                        }
                                        nextStep()
                                    }}
                                    disabled={
                                        (step === 1 && (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || !formData.whatsapp || formData.password !== formData.confirmPassword)) ||
                                        (step === 2 && (!formData.cep || !formData.street || !formData.number || !formData.city))
                                    }
                                    className="bg-primary hover:bg-primary/90 text-white px-8 py-2.5 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ml-auto transition-colors"
                                >
                                    Próximo <ChevronRight size={18} />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading || !formData.survey.termsAccepted}
                                    className="bg-secondary hover:bg-secondary/90 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg shadow-secondary/20 flex items-center gap-2 ml-auto disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {loading && <Loader2 className="animate-spin" size={18} />}
                                    Finalizar Cadastro
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
