import api from '../services/api'
import centralApi from '../services/centralApi'

/**
 * ADDRESSES - Gerenciamento de enderecos
 */

export async function getAddresses() {
    const { data } = await api.get('/addresses')
    return data || []
}

export async function getDefaultAddress() {
    const { data } = await api.get('/addresses')
    return data?.find(a => a.is_default) || data?.[0] || null
}

export async function createAddress(userId, addressData) {
    const { data } = await api.post('/addresses', addressData)
    return data
}

export async function updateAddress(addressId, userId, addressData) {
    const { data } = await api.put(`/addresses/${addressId}`, addressData)
    return data
}

export async function deleteAddress(addressId) {
    await api.delete(`/addresses/${addressId}`)
}

/**
 * ORDERS - Gerenciamento de pedidos
 */

export async function getOrders(userId, status = null) {
    const params = status ? { status } : {}
    const { data } = await api.get('/orders', { params })
    return data || []
}

export async function createOrder(userId, orderData) {
    const { data } = await api.post('/orders', orderData)
    return data
}

export async function updateOrderStatus(orderId, status, trackingCode = null) {
    const updateData = { status }
    if (trackingCode) {
        updateData.tracking_code = trackingCode
    }
    const { data } = await api.put(`/orders/${orderId}`, updateData)
    return data
}

/**
 * VERIFICATION CODES - Codigos de verificacao
 */

export async function generateVerificationCode(userId, type, newValue) {
    const { data } = await api.post('/verification-codes', { type, new_value: newValue })
    return { code: data.code, id: data.id }
}

export async function verifyCode(userId, code, type) {
    const { data } = await api.post('/verification-codes/verify', { code, type })
    return data.new_value
}

/**
 * AVATAR - Upload e gerenciamento de foto de perfil
 * Note: For now, avatar is stored as a URL in the user profile.
 * A dedicated upload endpoint can be added later if needed.
 */

export async function uploadAvatar(userId, file) {
    // Convert to base64 data URL for simple storage
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async () => {
            try {
                const { data } = await api.put('/users/me', { foto: reader.result })
                resolve(data.foto)
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export async function getAvatarUrl(userId) {
    try {
        const { data } = await centralApi.get('/auth/me')
        return data.foto || null
    } catch {
        return null
    }
}

export async function deleteAvatar(userId) {
    await api.put('/users/me', { foto: null })
}

/**
 * Initialize database - no-op for Express backend
 */
export async function initializeDatabase() {
    // Database is initialized by the Express server via setup_db.js
    return
}
