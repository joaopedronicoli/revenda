import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAddresses, createAddress, updateAddress, deleteAddress } from '../lib/database'
import { Plus, Edit2, Trash2, MapPin, Check, X } from 'lucide-react'

export default function AddressManager() {
    const { user } = useAuth()
    const [addresses, setAddresses] = useState([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [loadingCep, setLoadingCep] = useState(false)

    const [formData, setFormData] = useState({
        nickname: '',
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        is_default: false
    })

    useEffect(() => {
        loadAddresses()
    }, [])

    const loadAddresses = async () => {
        try {
            setLoading(true)
            const data = await getAddresses(user.id)
            setAddresses(data)
        } catch (error) {
            console.error('Error loading addresses:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchAddressFromCep = async (cep) => {
        const cleanCep = cep.replace(/\D/g, '')
        if (cleanCep.length !== 8) return

        setLoadingCep(true)
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
            const data = await response.json()

            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    street: data.logradouro,
                    neighborhood: data.bairro,
                    city: data.localidade,
                    state: data.uf
                }))
            }
        } catch (error) {
            console.error('Error fetching CEP:', error)
        } finally {
            setLoadingCep(false)
        }
    }

    const formatCep = (value) => {
        const digits = value.replace(/\D/g, '').slice(0, 8)
        if (digits.length > 5) {
            return `${digits.slice(0, 5)}-${digits.slice(5)}`
        }
        return digits
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target

        if (name === 'cep') {
            const formatted = formatCep(value)
            setFormData(prev => ({ ...prev, cep: formatted }))
            const digits = formatted.replace(/\D/g, '')
            if (digits.length === 8) {
                fetchAddressFromCep(digits)
            }
            return
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleCepBlur = () => {
        const digits = formData.cep.replace(/\D/g, '')
        if (digits.length === 8 && !formData.street) {
            fetchAddressFromCep(digits)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (editing) {
                await updateAddress(editing, user.id, formData)
            } else {
                await createAddress(user.id, formData)
            }
            await loadAddresses()
            resetForm()
        } catch (error) {
            console.error('Error saving address:', error)
        }
    }

    const handleEdit = (address) => {
        setEditing(address.id)
        setFormData(address)
        setShowForm(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este endereço?')) return
        try {
            await deleteAddress(id, user.id)
            await loadAddresses()
        } catch (error) {
            console.error('Error deleting address:', error)
        }
    }

    const resetForm = () => {
        setFormData({
            nickname: '',
            cep: '',
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: '',
            is_default: false
        })
        setEditing(null)
        setShowForm(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Add Button */}
            {!showForm && (
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                    <Plus size={20} />
                    Adicionar Novo Endereço
                </button>
            )}

            {/* Form */}
            {showForm && (
                <div className="bg-white rounded-xl p-6 border border-slate-200">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-slate-900">
                            {editing ? 'Editar Endereço' : 'Novo Endereço'}
                        </h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Apelido do Endereço *
                            </label>
                            <input
                                type="text"
                                name="nickname"
                                value={formData.nickname}
                                onChange={handleChange}
                                required
                                placeholder="Ex: Casa, Trabalho, Clínica..."
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">CEP *</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    name="cep"
                                    value={formData.cep}
                                    onChange={handleChange}
                                    onBlur={handleCepBlur}
                                    required
                                    maxLength={9}
                                    placeholder="00000-000"
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => fetchAddressFromCep(formData.cep)}
                                    disabled={loadingCep || formData.cep.replace(/\D/g, '').length !== 8}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                                >
                                    {loadingCep ? 'Buscando...' : 'Buscar'}
                                </button>
                            </div>
                            {loadingCep && <p className="text-xs text-primary mt-1">Buscando endereço pelo CEP...</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rua *</label>
                                <input
                                    type="text"
                                    name="street"
                                    value={formData.street}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Número *</label>
                                <input
                                    type="text"
                                    name="number"
                                    value={formData.number}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
                            <input
                                type="text"
                                name="complement"
                                value={formData.complement}
                                onChange={handleChange}
                                placeholder="Apto, Bloco, etc."
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Bairro *</label>
                                <input
                                    type="text"
                                    name="neighborhood"
                                    value={formData.neighborhood}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Cidade *</label>
                                <input
                                    type="text"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Estado *</label>
                            <input
                                type="text"
                                name="state"
                                value={formData.state}
                                onChange={handleChange}
                                required
                                maxLength={2}
                                placeholder="SP"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                name="is_default"
                                checked={formData.is_default}
                                onChange={handleChange}
                                className="w-4 h-4"
                            />
                            <label className="text-sm text-slate-700">
                                Definir como endereço padrão
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                            >
                                {editing ? 'Salvar Alterações' : 'Adicionar Endereço'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Address List */}
            {addresses.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                    <MapPin className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Nenhum endereço cadastrado
                    </h3>
                    <p className="text-slate-600">
                        Adicione um endereço para facilitar seus pedidos.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {addresses.map(address => (
                        <div
                            key={address.id}
                            className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold text-slate-900">{address.nickname}</h3>
                                        {address.is_default && (
                                            <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full flex items-center gap-1">
                                                <Check size={12} />
                                                Padrão
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-600 text-sm">
                                        {address.street}, {address.number}
                                        {address.complement && ` - ${address.complement}`}
                                        <br />
                                        {address.neighborhood}, {address.city} - {address.state}
                                        <br />
                                        CEP: {address.cep}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(address)}
                                        className="p-2 text-slate-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(address.id)}
                                        className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
