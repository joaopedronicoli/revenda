import { wooCommerceClient } from './woocommerceClient'
import { getWooCommerceProductId } from './productMapping'
import { appToWcStatus } from './statusMapping'
import api from '../services/api'

/**
 * Create order in WooCommerce after payment confirmation
 * @param {string} orderId - Order ID
 * @returns {object} WooCommerce order data
 */
export async function createWooCommerceOrder(orderId) {
    try {
        // 1. Get order from API
        const { data: order } = await api.get(`/orders/${orderId}?include=addresses`)

        if (!order) throw new Error('Order not found')

        // 2. Map products to WooCommerce IDs
        const lineItems = order.details.items.map(item => {
            const productId = getWooCommerceProductId(item.name)

            if (!productId) {
                console.warn(`Product not mapped: ${item.name}`)
            }

            return {
                product_id: productId,
                quantity: item.quantity,
                price: item.tablePrice.toString()
            }
        }).filter(item => item.product_id) // Remove unmapped products

        if (lineItems.length === 0) {
            throw new Error('No valid products to create WooCommerce order')
        }

        // 3. Prepare WooCommerce order data
        const wcOrderData = {
            status: 'pending', // Will update to 'processing' after payment confirmation
            billing: {
                first_name: order.details.user_name || 'Cliente',
                last_name: '',
                email: order.details.user_email,
                phone: order.details.user_whatsapp || '',
                address_1: order.addresses?.street || '',
                address_2: order.addresses?.complement || '',
                city: order.addresses?.city || '',
                state: order.addresses?.state || '',
                postcode: order.addresses?.cep || '',
                country: 'BR'
            },
            shipping: {
                first_name: order.details.user_name || 'Cliente',
                last_name: '',
                address_1: order.addresses?.street || '',
                address_2: order.addresses?.complement || '',
                city: order.addresses?.city || '',
                state: order.addresses?.state || '',
                postcode: order.addresses?.cep || '',
                country: 'BR'
            },
            line_items: lineItems,
            customer_note: `Pedido do App de Revenda: ${order.order_number}`,
            shipping_lines: [
                {
                    method_id: 'free_shipping',
                    method_title: 'Frete Grátis',
                    total: '0.00'
                }
            ],
            meta_data: [
                {
                    key: '_revenda_app_order_id',
                    value: orderId
                },
                {
                    key: '_revenda_app_order_number',
                    value: order.order_number
                },
                {
                    key: '_payment_method_title',
                    value: order.payment_method || 'Não informado'
                },
                // Brazilian Market on WooCommerce - Billing fields
                {
                    key: '_billing_number',
                    value: order.addresses?.number || ''
                },
                {
                    key: '_billing_neighborhood',
                    value: order.addresses?.neighborhood || ''
                },
                {
                    key: '_billing_cpf',
                    value: order.details.user_cpf || ''
                },
                {
                    key: '_billing_birthdate',
                    value: order.details.user_birthdate || ''
                },
                {
                    key: '_billing_gender',
                    value: order.details.user_gender || ''
                },
                {
                    key: '_billing_persontype',
                    value: order.details.user_cpf ? '1' : '2' // 1 = Pessoa Física, 2 = Pessoa Jurídica
                },
                // Brazilian Market on WooCommerce - Shipping fields
                {
                    key: '_shipping_number',
                    value: order.addresses?.number || ''
                },
                {
                    key: '_shipping_neighborhood',
                    value: order.addresses?.neighborhood || ''
                }
            ]
        }

        // 4. Create order in WooCommerce
        const wcOrder = await wooCommerceClient.createOrder(wcOrderData)

        // 5. Save WooCommerce order ID via API
        await api.put(`/orders/${orderId}`, {
            woocommerce_order_id: wcOrder.id,
            woocommerce_order_number: wcOrder.number,
            tracking_url: `https://patriciaelias.com.br/rastreio-de-pedido/?pedido=${wcOrder.number}`
        })

        console.log(`✅ WooCommerce order created: #${wcOrder.number} (ID: ${wcOrder.id})`)

        return wcOrder
    } catch (error) {
        console.error('Error creating WooCommerce order:', error)

        // Log error via API for debugging
        await api.put(`/orders/${orderId}`, {
            woocommerce_sync_error: error.message,
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
        // Get WooCommerce order ID via API
        const { data: order } = await api.get(`/orders/${orderId}`)

        if (!order?.woocommerce_order_id) {
            console.warn(`Order ${orderId} has no WooCommerce ID, skipping status update`)
            return
        }

        // Convert app status to WooCommerce status
        const wcStatus = appToWcStatus(newStatus)

        // Update in WooCommerce
        await wooCommerceClient.updateOrderStatus(order.woocommerce_order_id, wcStatus)

        console.log(`✅ WooCommerce order #${order.woocommerce_order_id} status updated to: ${wcStatus}`)
    } catch (error) {
        console.error('Error updating WooCommerce order status:', error)
        // Don't throw - status sync is not critical
    }
}
