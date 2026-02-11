import axios from 'axios'
import { lerDescriptografado } from '../lib/utils'

// API do central-pelg (somente para autenticacao)
const centralApi = axios.create({
    baseURL: import.meta.env.VITE_CENTRAL_API_URL || 'https://central.pelg.com.br',
    headers: {
        'Content-Type': 'application/json'
    }
})

// Interceptor: adicionar token JWT em todas as requisicoes
centralApi.interceptors.request.use((config) => {
    const authData = lerDescriptografado('auth_revenda')
    if (authData?.token) {
        config.headers.Authorization = `Bearer ${authData.token}`
    }
    return config
}, (error) => {
    return Promise.reject(error)
})

// Interceptor: tratar respostas de erro (401 = token expirado)
centralApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('auth_revenda')
            if (window.location.pathname !== '/login') {
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default centralApi
