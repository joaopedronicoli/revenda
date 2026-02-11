import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import api from '../services/api'

export default function VerifyEmail() {
    const [searchParams] = useSearchParams()
    const [status, setStatus] = useState('loading') // loading, success, error
    const [message, setMessage] = useState('')

    useEffect(() => {
        const token = searchParams.get('token')
        if (!token) {
            setStatus('error')
            setMessage('Token de verificacao nao encontrado.')
            return
        }

        const verify = async () => {
            try {
                const response = await api.post('/auth/verify-email', { token })
                setStatus('success')
                setMessage(response.data.message || 'Email verificado com sucesso!')
            } catch (err) {
                setStatus('error')
                setMessage(err.response?.data?.message || 'Erro ao verificar email. O link pode ter expirado.')
            }
        }

        verify()
    }, [searchParams])

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-primary mb-2">
                        Patricia Elias
                    </h1>
                    <p className="text-slate-500 font-medium">Verificacao de Email</p>
                </div>

                {status === 'loading' && (
                    <div className="py-8">
                        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-slate-600">Verificando seu email...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="py-8">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-green-700 mb-2">Email Verificado!</h2>
                        <p className="text-slate-600 mb-6">{message}</p>
                        <Link
                            to="/login"
                            className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg transition-all shadow-lg shadow-primary/20"
                        >
                            Ir para o Login
                        </Link>
                    </div>
                )}

                {status === 'error' && (
                    <div className="py-8">
                        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-red-700 mb-2">Erro na Verificacao</h2>
                        <p className="text-slate-600 mb-6">{message}</p>
                        <Link
                            to="/login"
                            className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg transition-all shadow-lg shadow-primary/20"
                        >
                            Ir para o Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
