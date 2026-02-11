import axios from 'axios'
import { lerDescriptografado } from '../lib/utils'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://revenda.pelg.com.br',
    headers: {
        'Content-Type': 'application/json'
    }
})

// Interceptor: adicionar token JWT em todas as requisicoes
api.interceptors.request.use((config) => {
    const authData = lerDescriptografado('auth_revenda')
    if (authData?.token) {
        config.headers.Authorization = `Bearer ${authData.token}`
    }
    return config
}, (error) => {
    return Promise.reject(error)
})

// Interceptor: tratar respostas de erro (401 = token expirado)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            // Token expirado ou invalido - limpar dados e redirecionar
            localStorage.removeItem('auth_revenda')
            if (window.location.pathname !== '/login') {
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default api
