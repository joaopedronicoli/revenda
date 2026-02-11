import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import api from '../services/api'
import centralApi from '../services/centralApi'
import { salvarCriptografado, lerDescriptografado, removerDados } from '../lib/utils'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

const AUTH_KEY = 'auth_revenda'

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [roleLoading, setRoleLoading] = useState(false)

    // Restore session from encrypted localStorage
    useEffect(() => {
        const restoreSession = async () => {
            const authData = lerDescriptografado(AUTH_KEY)
            if (authData?.token && authData?.user) {
                try {
                    // Validate token by calling /auth/me
                    const response = await centralApi.get('/auth/me')
                    setUser(response.data)
                } catch (err) {
                    // Token expired or invalid
                    console.error('Sessao expirada:', err)
                    removerDados(AUTH_KEY)
                    setUser(null)
                }
            }
            setLoading(false)
        }
        restoreSession()
    }, [])

    const login = async (email, password) => {
        const response = await centralApi.post('/auth/login', { email, password })
        const { token, user: userData } = response.data

        salvarCriptografado(AUTH_KEY, { token, user: userData })
        setUser(userData)
        return { user: userData }
    }

    const register = async (email, password, metadata) => {
        const { name, whatsapp, documentType, cpf, cnpj, companyName, profession, professionOther,
            cep, street, number, complement, neighborhood, city, state } = metadata

        const response = await centralApi.post('/revenda/auth/register', {
            name,
            email,
            password,
            phone: whatsapp,
            documentType,
            cpf,
            cnpj,
            companyName,
            profession,
            professionOther,
            address: cep ? { cep, street, number, complement, neighborhood, city, state } : null
        })

        const { token, user: userData } = response.data

        salvarCriptografado(AUTH_KEY, { token, user: userData })
        setUser(userData)
        return { user: userData }
    }

    const loginWithGoogle = async (accessToken) => {
        const response = await centralApi.post('/revenda/auth/google', { accessToken })
        const { token, user: userData } = response.data

        salvarCriptografado(AUTH_KEY, { token, user: userData })
        setUser(userData)
        return { user: userData }
    }

    const requestOTP = async (email, sendVia = 'whatsapp') => {
        const response = await centralApi.post('/auth/magic-link', { email, sendVia })
        return response.data
    }

    const verifyOTP = async (email, otp) => {
        const response = await centralApi.post('/auth/verify-otp', { email, otp })
        const { token, user: userData } = response.data

        salvarCriptografado(AUTH_KEY, { token, user: userData })
        setUser(userData)
        return { user: userData }
    }

    const forgotPassword = async (email, sendVia = 'whatsapp') => {
        const response = await centralApi.post('/auth/forgot-password', { email, sendVia })
        return response.data
    }

    const resetPassword = async (token, newPassword) => {
        const response = await centralApi.post('/auth/reset-password', { token, newPassword })
        return response.data
    }

    const logout = () => {
        removerDados(AUTH_KEY)
        setUser(null)
    }

    const refreshUser = async () => {
        setRoleLoading(true)
        try {
            const response = await centralApi.get('/auth/me')
            setUser(response.data)
        } catch (err) {
            console.error('Erro ao atualizar usuario:', err)
        } finally {
            setRoleLoading(false)
        }
    }

    // Computed properties
    const userRole = user?.role || 'client'
    const approvalStatus = user?.approval_status || 'approved'
    const isAdmin = useMemo(() => userRole === 'administrator', [userRole])
    const isManager = useMemo(() => userRole === 'manager', [userRole])
    const canAccessAdmin = useMemo(() => ['administrator', 'manager'].includes(userRole), [userRole])
    const isApproved = useMemo(() => approvalStatus === 'approved', [approvalStatus])

    // Aliases for backward compatibility
    const refreshRole = refreshUser
    const refreshApprovalStatus = refreshUser

    return (
        <AuthContext.Provider value={{
            user,
            userRole,
            approvalStatus,
            isAdmin,
            isManager,
            canAccessAdmin,
            isApproved,
            login,
            register,
            loginWithGoogle,
            requestOTP,
            verifyOTP,
            forgotPassword,
            resetPassword,
            logout,
            loading,
            roleLoading,
            refreshRole,
            refreshApprovalStatus,
            refreshUser
        }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
