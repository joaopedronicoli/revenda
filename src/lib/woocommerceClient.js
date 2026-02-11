import axios from 'axios'

const WC_API_URL = 'https://patriciaelias.com.br/wp-json/wc/v3'
const WC_CONSUMER_KEY = 'ck_6375062b7847ac55fc3dec8f2ec53333b896ab2d'
const WC_CONSUMER_SECRET = 'cs_c0433d8016ef359179ab44fe63439812be7f1d56'

/**
 * WooCommerce API Client
 */
class WooCommerceClient {
    constructor() {
        this.client = axios.create({
            baseURL: WC_API_URL,
            timeout: 10000, // 10 second timeout to prevent hanging
            auth: {
                username: WC_CONSUMER_KEY,
                password: WC_CONSUMER_SECRET
            },
            headers: {
                'Content-Type': 'application/json'
            }
        })
    }

    /**
     * Create a new order in WooCommerce
     */
    async createOrder(orderData) {
        try {
            const response = await this.client.post('/orders', orderData)
            return response.data
        } catch (error) {
            console.error('WooCommerce createOrder error:', error.response?.data || error.message)
            throw new Error(`Failed to create WooCommerce order: ${error.response?.data?.message || error.message}`)
        }
    }

    /**
     * Update order status
     */
    async updateOrderStatus(orderId, status) {
        try {
            const response = await this.client.put(`/orders/${orderId}`, {
                status
            })
            return response.data
        } catch (error) {
            console.error('WooCommerce updateOrderStatus error:', error.response?.data || error.message)
            throw new Error(`Failed to update WooCommerce order: ${error.response?.data?.message || error.message}`)
        }
    }

    /**
     * Get order details
     */
    async getOrder(orderId) {
        try {
            const response = await this.client.get(`/orders/${orderId}`)
            return response.data
        } catch (error) {
            console.error('WooCommerce getOrder error:', error.response?.data || error.message)
            throw new Error(`Failed to get WooCommerce order: ${error.response?.data?.message || error.message}`)
        }
    }

    /**
     * Add note to order
     */
    async addOrderNote(orderId, note, isCustomerNote = false) {
        try {
            const response = await this.client.post(`/orders/${orderId}/notes`, {
                note,
                customer_note: isCustomerNote
            })
            return response.data
        } catch (error) {
            console.error('WooCommerce addOrderNote error:', error.response?.data || error.message)
            throw new Error(`Failed to add note to WooCommerce order: ${error.response?.data?.message || error.message}`)
        }
    }
}

// Export singleton instance
export const wooCommerceClient = new WooCommerceClient()
