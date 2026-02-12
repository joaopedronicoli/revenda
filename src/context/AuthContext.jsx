import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import api from '../services/api'
import centralApi from '../services/centralApi'
import { salvarCriptografado, lerDescriptografado, removerDados } from '../lib/utils'
import { useCartStore } from '../store/cartStore'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

const AUTH_KEY = 'auth_revenda'

const LEVEL_DISCOUNTS = {
    bronze: 0.30,
    prata: 0.35,
    ouro: 0.40
}

// Sync central-pelg user data to revenda local DB (fire-and-forget)
const syncCentralToLocal = async (centralUser) => {
    try {
        await api.post('/users/sync', {
            name: centralUser.name,
            telefone: centralUser.telefone,
            foto: centralUser.foto,
            document_type: centralUser.document_type,
            cpf: centralUser.cpf,
            cnpj: centralUser.cnpj,
            company_name: centralUser.company_name,
            profession: centralUser.profession,
            profession_other: centralUser.profession_other,
        })
    } catch (err) {
        console.warn('Erro ao sincronizar dados com revenda local:', err.message)
    }
}

// Buscar dados locais (approval_status + level data) do backend da revenda
const fetchLocalUser = async (token) => {
    try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const response = await api.get('/users/me', headers ? { headers } : undefined)
        return response.data
    } catch (err) {
        console.warn('Erro ao buscar dados locais:', err.message)
        return null
    }
}

// Merge local user fields into full user
const mergeLocalUser = (fullUser, localUser) => {
    if (!localUser) return fullUser

    const merged = {
        ...fullUser,
        role: localUser.role || fullUser.role,
        approval_status: localUser.approval_status,
        rejection_reason: localUser.rejection_reason,
        level: localUser.level || 'bronze',
        commission_balance: parseFloat(localUser.commission_balance) || 0,
        referral_code: localUser.referral_code,
        has_purchased_kit: localUser.has_purchased_kit,
        first_order_completed: localUser.first_order_completed,
        points: localUser.points || 0,
        total_accumulated: parseFloat(localUser.total_accumulated) || 0,
        affiliate_type: localUser.affiliate_type,
        affiliate_status: localUser.affiliate_status,
        email_verified: localUser.email_verified !== undefined ? localUser.email_verified : true,
        document_type: localUser.document_type || fullUser.document_type,
        cpf: localUser.cpf || fullUser.cpf,
        cnpj: localUser.cnpj || fullUser.cnpj,
        company_name: localUser.company_name || fullUser.company_name,
        profession: localUser.profession || fullUser.profession,
        telefone: localUser.telefone || fullUser.telefone,
    }

    // Set cart store discount based on user level
    const discount = LEVEL_DISCOUNTS[merged.level] || 0.30
    useCartStore.getState().setUserDiscount(discount)
    useCartStore.getState().setIsFirstOrder(!merged.first_order_completed)

    return merged
}

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
                    const fullUser = response.data
                    // Sync central data to local DB (fire-and-forget)
                    syncCentralToLocal(fullUser)
                    // Buscar dados locais (approval_status + level) da revenda
                    const localUser = await fetchLocalUser(authData.token)
                    const mergedUser = mergeLocalUser(fullUser, localUser)
                    setUser(mergedUser)
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
        let token = null

        // 1. Tentar login via WordPress (patriciaelias.com.br)
        try {
            const wpResponse = await fetch('https://patriciaelias.com.br/wp-json/jwt-auth/v1/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ username: email, password }),
            })

            const wpData = await wpResponse.json()

            if (wpResponse.ok && wpData?.token) {
                // 2. Trocar token WordPress por JWT local no central-pelg
                const response = await centralApi.post('/auth/wordpress-token', {
                    email: wpData.user_email,
                    name: wpData.user_display_name,
                    wpToken: wpData.token
                })

                token = response.data.token
            }
        } catch (wpErr) {
            console.warn('WordPress login falhou, tentando login local:', wpErr.message)
        }

        // 3. Fallback: login local no central-pelg
        if (!token) {
            const response = await centralApi.post('/auth/login', { email, password })
            token = response.data.token
        }

        // 4. Salvar token e buscar dados completos do usuario via /auth/me
        salvarCriptografado(AUTH_KEY, { token, user: {} })
        const meResponse = await centralApi.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        })
        const fullUser = meResponse.data

        // 5. Sync central data to local DB (fire-and-forget)
        syncCentralToLocal(fullUser)

        // 6. Buscar dados locais (approval_status + level) da revenda
        const localUser = await fetchLocalUser(token)
        const mergedUser = mergeLocalUser(fullUser, localUser)

        salvarCriptografado(AUTH_KEY, { token, user: mergedUser })
        setUser(mergedUser)
        return { user: mergedUser }
    }

    const register = async (email, password, metadata) => {
        const { name, whatsapp, documentType, cpf, cnpj, companyName, profession, professionOther,
            cep, street, number, complement, neighborhood, city, state, referralCode } = metadata

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
            referralCode,
            address: cep ? { cep, street, number, complement, neighborhood, city, state } : null
        })

        const { token } = response.data

        salvarCriptografado(AUTH_KEY, { token, user: {} })
        const meResponse = await centralApi.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        })
        const fullUser = meResponse.data

        // Sync central data to local DB (fire-and-forget)
        syncCentralToLocal(fullUser)

        const localUser = await fetchLocalUser(token)
        const mergedUser = mergeLocalUser(fullUser, localUser)

        salvarCriptografado(AUTH_KEY, { token, user: mergedUser })
        setUser(mergedUser)

        // Salvar endereco do cadastro na revenda local
        if (cep && street && city && state) {
            try {
                await api.post('/addresses', {
                    nickname: 'Principal',
                    cep,
                    street,
                    number: number || 'S/N',
                    complement: complement || '',
                    neighborhood: neighborhood || '',
                    city,
                    state,
                    is_default: true
                })
            } catch (addrErr) {
                console.warn('Erro ao salvar endereco do cadastro:', addrErr.message)
            }
        }

        // Enviar email de verificacao apos registro
        try {
            await api.post('/auth/send-verification', { email })
        } catch (verifyErr) {
            console.warn('Erro ao enviar email de verificacao:', verifyErr.message)
        }

        return { user: mergedUser }
    }

    const loginWithGoogle = async (accessToken) => {
        const response = await centralApi.post('/revenda/auth/google', { accessToken })
        const { token } = response.data

        salvarCriptografado(AUTH_KEY, { token, user: {} })
        const meResponse = await centralApi.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        })
        const fullUser = meResponse.data

        // Sync central data to local DB (fire-and-forget)
        syncCentralToLocal(fullUser)

        const localUser = await fetchLocalUser(token)
        const mergedUser = mergeLocalUser(fullUser, localUser)

        salvarCriptografado(AUTH_KEY, { token, user: mergedUser })
        setUser(mergedUser)
        return { user: mergedUser }
    }

    const requestOTP = async (email, sendVia = 'whatsapp') => {
        if (sendVia === 'email') {
            // Email OTP via revenda backend
            const response = await api.post('/auth/request-otp', { email })
            return response.data
        }
        // WhatsApp OTP via central-pelg (existente)
        const response = await centralApi.post('/auth/magic-link', { email, sendVia })
        return response.data
    }

    const verifyOTP = async (email, otp, sendVia = 'whatsapp') => {
        let token
        if (sendVia === 'email') {
            // Verificar OTP via revenda backend
            const response = await api.post('/auth/verify-otp', { email, otp })
            token = response.data.token
        } else {
            // Verificar OTP via central-pelg (existente)
            const response = await centralApi.post('/auth/verify-otp', { email, otp })
            token = response.data.token
        }

        salvarCriptografado(AUTH_KEY, { token, user: {} })
        const meResponse = await centralApi.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        })
        const fullUser = meResponse.data

        // Sync central data to local DB (fire-and-forget)
        syncCentralToLocal(fullUser)

        const localUser = await fetchLocalUser(token)
        const mergedUser = mergeLocalUser(fullUser, localUser)

        salvarCriptografado(AUTH_KEY, { token, user: mergedUser })
        setUser(mergedUser)
        return { user: mergedUser }
    }

    const forgotPassword = async (email, sendVia = 'whatsapp') => {
        if (sendVia === 'email') {
            // Reset por email via revenda backend
            const response = await api.post('/auth/forgot-password', { email })
            return response.data
        }
        // Reset por WhatsApp via central-pelg (existente)
        const response = await centralApi.post('/auth/forgot-password', { email, sendVia })
        return response.data
    }

    const resetPassword = async (token, newPassword) => {
        // Decodificar payload do JWT para saber qual backend gerou o token
        try {
            const payload = JSON.parse(atob(token.split('.')[1]))
            if (payload.type === 'password-reset') {
                // Token gerado pela revenda (email) → chamar revenda
                const response = await api.post('/auth/reset-password', { token, newPassword })
                return response.data
            }
        } catch (e) {
            // Se falhar decode, tenta central-pelg
        }
        // Token gerado pelo central-pelg (whatsapp) ou fallback → chamar central-pelg
        const response = await centralApi.post('/auth/reset-password', { token, newPassword })
        return response.data
    }

    const resendVerificationEmail = async () => {
        if (!user?.email) throw new Error('Email nao encontrado')
        const response = await api.post('/auth/send-verification', { email: user.email })
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
            const fullUser = response.data
            // Sync central data to local DB (fire-and-forget)
            syncCentralToLocal(fullUser)
            const localUser = await fetchLocalUser()
            const mergedUser = mergeLocalUser(fullUser, localUser)
            setUser(mergedUser)
        } catch (err) {
            console.error('Erro ao atualizar usuario:', err)
        } finally {
            setRoleLoading(false)
        }
    }

    // Computed properties
    const userRole = user?.role || 'client'
    const approvalStatus = user?.approval_status || 'approved'
    const isAdmin = useMemo(() => ['administrator', 'admin'].includes(userRole), [userRole])
    const isManager = useMemo(() => userRole === 'manager', [userRole])
    const canAccessAdmin = useMemo(() => ['administrator', 'admin', 'manager'].includes(userRole), [userRole])
    const isApproved = useMemo(() => approvalStatus === 'approved', [approvalStatus])
    const isEmailVerified = useMemo(() => user?.email_verified !== false, [user?.email_verified])
    const isProfileComplete = useMemo(() => !!user?.document_type, [user?.document_type])

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
            isEmailVerified,
            isProfileComplete,
            login,
            register,
            loginWithGoogle,
            requestOTP,
            verifyOTP,
            forgotPassword,
            resetPassword,
            resendVerificationEmail,
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
