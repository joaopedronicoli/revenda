// Analytics & Tracking Integration
// Google Analytics 4, Google Ads, Facebook Pixel, Meta CAPI

class Analytics {
    constructor() {
        this.config = {
            googleAnalyticsId: null,
            googleAdsId: null,
            facebookPixelId: null,
            capiEnabled: false,
            enabled: false
        }
        this.eventsConfig = null
        this.initialized = false
    }

    // Initialize tracking scripts
    async init() {
        if (this.initialized) return

        try {
            // Fetch tracking IDs from database via API
            const response = await import('../services/api').then(m => m.default.get('/app-settings', {
                params: { keys: ['google_analytics_id', 'google_ads_id', 'facebook_pixel_id', 'enable_tracking', 'tracking_events_config', 'meta_capi_enabled'] }
            }))
            const data = response.data

            if (!data) return

            data.forEach(setting => {
                if (setting.key === 'google_analytics_id') this.config.googleAnalyticsId = setting.value
                if (setting.key === 'google_ads_id') this.config.googleAdsId = setting.value
                if (setting.key === 'facebook_pixel_id') this.config.facebookPixelId = setting.value
                if (setting.key === 'enable_tracking') this.config.enabled = setting.value === 'true' || setting.value === true
                if (setting.key === 'meta_capi_enabled') this.config.capiEnabled = setting.value === 'true' || setting.value === true
                if (setting.key === 'tracking_events_config') {
                    try { this.eventsConfig = JSON.parse(setting.value) } catch { /* ignore */ }
                }
            })

            if (!this.config.enabled) {
                console.log('Analytics disabled in settings')
                return
            }

            // Initialize Google Analytics
            if (this.config.googleAnalyticsId && this.config.googleAnalyticsId !== '""' && this.config.googleAnalyticsId !== '') {
                this.initGoogleAnalytics(this.config.googleAnalyticsId)
            }

            // Initialize Google Ads
            if (this.config.googleAdsId && this.config.googleAdsId !== '""' && this.config.googleAdsId !== '') {
                this.initGoogleAds(this.config.googleAdsId)
            }

            // Initialize Facebook Pixel
            if (this.config.facebookPixelId && this.config.facebookPixelId !== '""' && this.config.facebookPixelId !== '') {
                this.initFacebookPixel(this.config.facebookPixelId)
            }

            this.initialized = true
            console.log('Analytics initialized:', this.config)
        } catch (error) {
            console.error('Error initializing analytics:', error)
        }
    }

    initGoogleAnalytics(measurementId) {
        // Google Analytics 4
        const script = document.createElement('script')
        script.async = true
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
        document.head.appendChild(script)

        window.dataLayer = window.dataLayer || []
        function gtag() { window.dataLayer.push(arguments) }
        window.gtag = gtag
        gtag('js', new Date())
        gtag('config', measurementId)
        console.log('Google Analytics initialized:', measurementId)
    }

    initGoogleAds(conversionId) {
        // Google Ads Conversion Tracking
        const script = document.createElement('script')
        script.async = true
        script.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`
        document.head.appendChild(script)

        window.dataLayer = window.dataLayer || []
        function gtag() { window.dataLayer.push(arguments) }
        if (!window.gtag) window.gtag = gtag
        gtag('js', new Date())
        gtag('config', conversionId)
        console.log('Google Ads initialized:', conversionId)
    }

    initFacebookPixel(pixelId) {
        // Facebook Pixel
        !(function (f, b, e, v, n, t, s) {
            if (f.fbq) return
            n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
            }
            if (!f._fbq) f._fbq = n
            n.push = n
            n.loaded = !0
            n.version = '2.0'
            n.queue = []
            t = b.createElement(e)
            t.async = !0
            t.src = v
            s = b.getElementsByTagName(e)[0]
            s.parentNode.insertBefore(t, s)
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')

        window.fbq('init', pixelId)
        if (this.isEventEnabled('meta', 'PageView')) {
            window.fbq('track', 'PageView')
        }
        console.log('Facebook Pixel initialized:', pixelId)
    }

    // Check if a specific event is enabled for a platform
    isEventEnabled(platform, eventName) {
        if (!this.eventsConfig) return true // default: all enabled
        return this.eventsConfig[platform]?.[eventName] !== false
    }

    // Send event via Meta Conversions API (server-side)
    async sendCAPIEvent(eventName, eventData, userData) {
        if (!this.config.capiEnabled) return
        try {
            const api = (await import('../services/api')).default
            await api.post('/meta-capi/event', {
                event_name: eventName,
                event_data: eventData,
                user_data: userData || {},
                event_source_url: window.location.href
            })
        } catch (err) {
            console.warn('CAPI event failed:', err.message)
        }
    }

    // Get fbp and fbc cookies for CAPI dedup
    getMetaCookies() {
        const cookies = document.cookie.split(';').reduce((acc, c) => {
            const [key, val] = c.trim().split('=')
            if (key) acc[key] = val
            return acc
        }, {})
        return { fbp: cookies._fbp || null, fbc: cookies._fbc || null }
    }

    // Track GA4 event with enabled check
    trackGA(eventName, params) {
        if (window.gtag && this.isEventEnabled('google', eventName)) {
            window.gtag('event', eventName, params)
        }
    }

    // Track Meta Pixel event with enabled check
    trackMeta(eventName, params) {
        if (window.fbq && this.isEventEnabled('meta', eventName)) {
            window.fbq('track', eventName, params)
        }
    }

    // E-commerce Events

    // User signs up
    trackSignUp(method = 'email') {
        if (!this.initialized || !this.config.enabled) return
        this.trackGA('sign_up', { method })
        this.trackMeta('CompleteRegistration', { status: true })
    }

    // User logs in
    trackLogin(method = 'email') {
        if (!this.initialized || !this.config.enabled) return
        this.trackGA('login', { method })
        this.trackMeta('Lead', { content_name: 'login' })
    }

    // User views a product
    trackViewItem(product) {
        if (!this.initialized || !this.config.enabled) return

        // GA4: view_item
        this.trackGA('view_item', {
            currency: 'BRL',
            value: product.tablePrice,
            items: [{
                item_id: product.id,
                item_name: product.name,
                price: product.tablePrice
            }]
        })

        // Meta: ViewContent
        this.trackMeta('ViewContent', {
            content_ids: [product.id],
            content_name: product.name,
            content_type: 'product',
            value: product.tablePrice,
            currency: 'BRL'
        })
    }

    // User adds item to cart
    trackAddToCart(product, quantity = 1) {
        if (!this.initialized || !this.config.enabled) return

        const value = product.tablePrice * quantity

        // GA4: add_to_cart
        this.trackGA('add_to_cart', {
            currency: 'BRL',
            value,
            items: [{
                item_id: product.id,
                item_name: product.name,
                quantity,
                price: product.tablePrice
            }]
        })

        // Meta: AddToCart
        this.trackMeta('AddToCart', {
            content_ids: [product.id],
            content_name: product.name,
            content_type: 'product',
            value,
            currency: 'BRL'
        })

        // CAPI: AddToCart
        this.sendCAPIEvent('AddToCart', {
            content_ids: [String(product.id)],
            content_type: 'product',
            value,
            currency: 'BRL'
        }, this.getMetaCookies())
    }

    // User removes item from cart
    trackRemoveFromCart(product, quantity = 1) {
        if (!this.initialized || !this.config.enabled) return

        // GA4: remove_from_cart (Meta does not have this event)
        this.trackGA('remove_from_cart', {
            currency: 'BRL',
            value: product.tablePrice * quantity,
            items: [{
                item_id: product.id,
                item_name: product.name,
                quantity,
                price: product.tablePrice
            }]
        })
    }

    // User begins checkout
    trackBeginCheckout(cart, total) {
        if (!this.initialized || !this.config.enabled) return

        const items = cart.map(item => ({
            item_id: item.id,
            item_name: item.name,
            quantity: item.quantity,
            price: item.tablePrice
        }))

        // GA4: begin_checkout
        this.trackGA('begin_checkout', {
            currency: 'BRL',
            value: total,
            items
        })

        // Meta: InitiateCheckout
        this.trackMeta('InitiateCheckout', {
            content_ids: cart.map(i => i.id),
            content_type: 'product',
            value: total,
            currency: 'BRL',
            num_items: cart.reduce((sum, i) => sum + i.quantity, 0)
        })
    }

    // User adds shipping info
    trackAddShippingInfo(cart, total, shippingTier = 'free') {
        if (!this.initialized || !this.config.enabled) return

        // GA4: add_shipping_info
        this.trackGA('add_shipping_info', {
            currency: 'BRL',
            value: total,
            shipping_tier: shippingTier,
            items: cart.map(item => ({
                item_id: item.id,
                item_name: item.name,
                quantity: item.quantity,
                price: item.tablePrice
            }))
        })
    }

    // User adds payment info
    trackAddPaymentInfo(cart, total, paymentType) {
        if (!this.initialized || !this.config.enabled) return

        // GA4: add_payment_info
        this.trackGA('add_payment_info', {
            currency: 'BRL',
            value: total,
            payment_type: paymentType,
            items: cart.map(item => ({
                item_id: item.id,
                item_name: item.name,
                quantity: item.quantity,
                price: item.tablePrice
            }))
        })

        // Meta: AddPaymentInfo
        this.trackMeta('AddPaymentInfo', {
            content_ids: cart.map(i => i.id),
            content_type: 'product',
            value: total,
            currency: 'BRL'
        })
    }

    // User completes purchase
    trackPurchase(orderId, cart, total, paymentMethod) {
        if (!this.initialized || !this.config.enabled) return

        const items = cart.map(item => ({
            item_id: item.id,
            item_name: item.name,
            quantity: item.quantity,
            price: item.tablePrice
        }))

        // GA4: purchase
        this.trackGA('purchase', {
            transaction_id: orderId,
            currency: 'BRL',
            value: total,
            tax: 0,
            shipping: 0,
            payment_method: paymentMethod,
            items
        })

        // Google Ads Conversion
        if (window.gtag && this.config.googleAdsId) {
            window.gtag('event', 'conversion', {
                'send_to': `${this.config.googleAdsId}/purchase`,
                'value': total,
                'currency': 'BRL',
                'transaction_id': orderId
            })
        }

        // Meta: Purchase
        const metaPurchaseData = {
            value: total,
            currency: 'BRL',
            content_ids: cart.map(i => i.id),
            content_type: 'product',
            num_items: cart.reduce((sum, i) => sum + i.quantity, 0)
        }
        this.trackMeta('Purchase', metaPurchaseData)

        // CAPI: Purchase
        this.sendCAPIEvent('Purchase', {
            ...metaPurchaseData,
            content_ids: cart.map(i => String(i.id)),
            order_id: orderId
        }, this.getMetaCookies())
    }
}

// Export singleton instance
export const analytics = new Analytics()

// Initialize on load
if (typeof window !== 'undefined') {
    analytics.init()
}
