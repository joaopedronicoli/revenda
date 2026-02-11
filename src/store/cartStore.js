import { create } from 'zustand'
import api from '../services/api'

// Load cart from localStorage on initialization
const loadCartFromStorage = () => {
    try {
        const stored = localStorage.getItem('revendedor-cart')
        return stored ? JSON.parse(stored) : []
    } catch (error) {
        console.error('Error loading cart from localStorage:', error)
        return []
    }
}

// Save cart to localStorage
const saveCartToStorage = (cart) => {
    try {
        localStorage.setItem('revendedor-cart', JSON.stringify(cart))
    } catch (error) {
        console.error('Error saving cart to localStorage:', error)
    }
}

// Debounce helper
let trackingTimeout = null
const TRACKING_DEBOUNCE_MS = 5000 // 5 seconds

// Track cart activity for abandoned cart detection
const trackCartActivity = async (cart, getSummary) => {
    // Clear any pending tracking
    if (trackingTimeout) {
        clearTimeout(trackingTimeout)
    }

    // Debounce the tracking to avoid too many requests
    trackingTimeout = setTimeout(async () => {
        try {
            if (cart.length === 0) return

            const summary = getSummary()

            // Upsert cart activity via API
            await api.post('/abandoned-carts', {
                cart_data: { items: cart },
                total: summary.totalWithDiscount,
                item_count: summary.itemCount,
                status: 'active'
            })
        } catch (err) {
            // Silently fail - this is not critical
            console.error('Cart tracking error:', err)
        }
    }, TRACKING_DEBOUNCE_MS)
}

// Clear cart tracking when cart is emptied or order is placed
const clearCartTracking = async () => {
    try {
        await api.delete('/abandoned-carts')
    } catch (err) {
        console.error('Error clearing cart tracking:', err)
    }
}

export const useCartStore = create((set, get) => ({
    cart: loadCartFromStorage(),
    addToCart: (product) => set((state) => {
        const existing = state.cart.find((item) => item.id === product.id)
        let newCart
        if (existing) {
            newCart = state.cart.map((item) =>
                item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            )
        } else {
            newCart = [...state.cart, { ...product, quantity: 1 }]
        }
        saveCartToStorage(newCart)
        trackCartActivity(newCart, get().getSummary)
        return { cart: newCart }
    }),
    removeFromCart: (productId) => set((state) => {
        const newCart = state.cart.filter((item) => item.id !== productId)
        saveCartToStorage(newCart)
        if (newCart.length > 0) {
            trackCartActivity(newCart, get().getSummary)
        } else {
            clearCartTracking()
        }
        return { cart: newCart }
    }),
    updateQuantity: (productId, quantity) => set((state) => {
        let newCart
        if (quantity <= 0) {
            newCart = state.cart.filter((item) => item.id !== productId)
        } else {
            newCart = state.cart.map((item) =>
                item.id === productId ? { ...item, quantity } : item
            )
        }
        saveCartToStorage(newCart)
        if (newCart.length > 0) {
            trackCartActivity(newCart, get().getSummary)
        } else {
            clearCartTracking()
        }
        return { cart: newCart }
    }),
    clearCart: () => {
        saveCartToStorage([])
        clearCartTracking()
        return set({ cart: [] })
    },

    // Computed values with Complex Logic
    getSummary: () => {
        const { cart } = get()

        // Constants
        const MODELAT_ID = 8
        const TEST_PRODUCT_ID = 999 // Produto de teste - sem desconto
        const DISCOUNT_MODELAT = 0.70 // 70% OFF
        const DISCOUNT_STANDARD_BASE = 0.30 // 30% OFF
        const DISCOUNT_STANDARD_HIGH = 0.35 // 35% OFF
        const HIGH_TICKET_THRESHOLD = 10000
        const PIX_DISCOUNT_RATE = 0.03 // 3% desconto PIX

        // 1. Calculate Table Total
        const totalTable = cart.reduce((acc, item) => acc + (item.tablePrice * item.quantity), 0)

        // 2. Calculate Preliminary Total (to check High Ticket threshold)
        let preliminaryTotal = 0
        cart.forEach(item => {
            if (item.id === TEST_PRODUCT_ID) {
                // Produto teste: sem desconto
                preliminaryTotal += item.tablePrice * item.quantity
            } else if (item.id === MODELAT_ID) {
                preliminaryTotal += (item.tablePrice * (1 - DISCOUNT_MODELAT)) * item.quantity
            } else {
                preliminaryTotal += (item.tablePrice * (1 - DISCOUNT_STANDARD_BASE)) * item.quantity
            }
        })

        // 3. Determine if High Ticket
        const isHighTicket = preliminaryTotal > HIGH_TICKET_THRESHOLD

        // 4. Calculate Final Total with correct rates
        let totalWithDiscount = 0
        const currentStandardDiscount = isHighTicket ? DISCOUNT_STANDARD_HIGH : DISCOUNT_STANDARD_BASE

        cart.forEach(item => {
            if (item.id === TEST_PRODUCT_ID) {
                // Produto teste: sem desconto
                totalWithDiscount += item.tablePrice * item.quantity
            } else if (item.id === MODELAT_ID) {
                totalWithDiscount += (item.tablePrice * (1 - DISCOUNT_MODELAT)) * item.quantity
            } else {
                totalWithDiscount += (item.tablePrice * (1 - currentStandardDiscount)) * item.quantity
            }
        })

        // 5. Payment Calculations
        const pixDiscount = totalWithDiscount * PIX_DISCOUNT_RATE
        const totalWithPix = totalWithDiscount - pixDiscount

        // 6. Installment limits based on total
        const getMaxInstallments = (total) => {
            if (total >= 10000) return 6
            if (total >= 5000) return 5
            return 3
        }
        const maxInstallments = getMaxInstallments(totalWithDiscount)

        // 7. Check if close to unlocking 35% discount
        const remainingToUnlock35 = Math.max(0, HIGH_TICKET_THRESHOLD - preliminaryTotal)
        const isCloseToUnlock = remainingToUnlock35 > 0 && remainingToUnlock35 <= 2000

        return {
            totalTable,
            totalWithDiscount,
            totalWithPix,
            pixDiscount,
            itemCount: cart.reduce((acc, item) => acc + item.quantity, 0),
            isHighTicket,
            discountStandard: currentStandardDiscount,
            discountModelat: DISCOUNT_MODELAT,
            maxInstallments,
            remainingToUnlock35,
            isCloseToUnlock
        }
    }
}))
