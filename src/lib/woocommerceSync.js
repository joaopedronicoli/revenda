import api from '../services/api'
import { appToWcStatus } from './statusMapping'

/**
 * Create order in WooCommerce via backend proxy
 * @param {string} orderId - Order ID
 * @returns {object} WooCommerce order data
 */
export async function createWooCommerceOrder(orderId) {
    try {
        const { data } = await api.post('/woocommerce/create-order', { orderId })

        console.log(`✅ WooCommerce order created: #${data.woocommerce_order_number} (ID: ${data.woocommerce_order_id})`)

        return data
    } catch (error) {
        console.error('Error creating WooCommerce order:', error.response?.data || error.message)

        // Log error via API for debugging
        await api.put(`/orders/${orderId}`, {
            woocommerce_sync_error: error.response?.data?.error || error.message,
            woocommerce_sync_attempted_at: new Date().toISOString()
        }).catch(() => {})

        throw error
    }
}

/**
 * Update WooCommerce order status when payment is confirmed
 * @param {string} orderId - Order ID
 * @param {string} newStatus - New status (app format)
 */
export async function updateWooCommerceOrderStatus(orderId, newStatus) {
    try {
        const wcStatus = appToWcStatus(newStatus)

        await api.put('/woocommerce/update-status', {
            orderId,
            status: wcStatus
        })

        console.log(`✅ WooCommerce order status updated to: ${wcStatus}`)
    } catch (error) {
        console.error('Error updating WooCommerce order status:', error.response?.data || error.message)
        // Don't throw - status sync is not critical
    }
}
