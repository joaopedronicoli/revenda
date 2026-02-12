import { create } from 'zustand'
import api from '../services/api'

// Load cart from localStorage on initialization
const loadCartFromStorage = () => {
    try {
        const stored = localStorage.getItem('revendedor-cart')
        if (!stored) return []
        const parsed = JSON.parse(stored)
        // Sanitize: filter out items without valid tablePrice
        return Array.isArray(parsed)
            ? parsed.filter(item => item && typeof item.id !== 'undefined' && !isNaN(parseFloat(item.tablePrice)))
            : []
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
                items: cart,
                total: summary.totalWithDiscount,
                item_count: summary.itemCount
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

    // Dynamic discount from user level (set by AuthContext)
    userDiscount: 0.30,
    setUserDiscount: (discount) => set({ userDiscount: discount }),

    // Kit selection for first order
    selectedKit: null,
    setSelectedKit: (kit) => set({ selectedKit: kit }),

    // First order flag (set by AuthContext)
    isFirstOrder: true,
    setIsFirstOrder: (value) => set({ isFirstOrder: value }),

    // Commission credit to apply
    commissionCredit: 0,
    setCommissionCredit: (value) => set({ commissionCredit: value }),

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
        return set({ cart: [], selectedKit: null, commissionCredit: 0 })
    },

    // Computed values with Complex Logic
    getSummary: () => {
        const { cart, userDiscount, selectedKit, isFirstOrder, commissionCredit } = get()

        // Safe number helper - ensures we never get NaN
        const safeNum = (val) => {
            const n = parseFloat(val)
            return isNaN(n) ? 0 : n
        }

        // Constants
        const MODELAT_ID = 8
        const TEST_PRODUCT_ID = 999 // Produto de teste - sem desconto
        const DISCOUNT_MODELAT = 0.70 // 70% OFF
        const PIX_DISCOUNT_RATE = 0.03 // 3% desconto PIX

        // Minimum order values
        const MIN_ORDER_FIRST = 897
        const MIN_ORDER_RECURRING = 600
        const minimumOrder = isFirstOrder ? MIN_ORDER_FIRST : MIN_ORDER_RECURRING

        // Use dynamic discount from user level (default 0.30 if not set)
        const currentStandardDiscount = safeNum(userDiscount) || 0.30

        // 1. Calculate Table Total (products only, no kit)
        const totalTable = cart.reduce((acc, item) => acc + (safeNum(item.tablePrice) * safeNum(item.quantity)), 0)

        // 2. Calculate Total with Discount
        let totalWithDiscount = 0

        cart.forEach(item => {
            const price = safeNum(item.tablePrice)
            const qty = safeNum(item.quantity)

            if (item.id === TEST_PRODUCT_ID) {
                // Produto teste: sem desconto
                totalWithDiscount += price * qty
            } else if (item.id === MODELAT_ID) {
                totalWithDiscount += (price * (1 - DISCOUNT_MODELAT)) * qty
            } else {
                totalWithDiscount += (price * (1 - currentStandardDiscount)) * qty
            }
        })

        // Product total (before kit)
        const productTotal = totalWithDiscount

        // 3. Add kit price if selected (first order only)
        const kitPrice = (isFirstOrder && selectedKit) ? safeNum(selectedKit.price) : 0
        totalWithDiscount += kitPrice

        // 4. Apply commission credit
        const appliedCredit = Math.min(safeNum(commissionCredit), totalWithDiscount)
        totalWithDiscount -= appliedCredit

        // Ensure total never goes negative
        totalWithDiscount = Math.max(0, totalWithDiscount)

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

        // 7. Check minimum order (based on product total only, without kit)
        const meetsMinimum = productTotal >= minimumOrder
        const remainingToMinimum = Math.max(0, minimumOrder - productTotal)

        return {
            totalTable,
            totalWithDiscount,
            totalWithPix,
            pixDiscount,
            productTotal,
            kitPrice,
            appliedCredit,
            itemCount: cart.reduce((acc, item) => acc + safeNum(item.quantity), 0),
            discountStandard: currentStandardDiscount,
            discountModelat: DISCOUNT_MODELAT,
            maxInstallments,
            minimumOrder,
            meetsMinimum,
            remainingToMinimum,
            isFirstOrder
        }
    }
}))
