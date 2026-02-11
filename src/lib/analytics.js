// Analytics & Tracking Integration
// Google Analytics, Google Ads, Facebook Pixel

class Analytics {
    constructor() {
        this.config = {
            googleAnalyticsId: null,
            googleAdsId: null,
            facebookPixelId: null,
            enabled: false
        }
        this.initialized = false
    }

    // Initialize tracking scripts
    async init() {
        if (this.initialized) return

        try {
            // Fetch tracking IDs from database via API
            const response = await import('../services/api').then(m => m.default.get('/app-settings', {
                params: { keys: ['google_analytics_id', 'google_ads_id', 'facebook_pixel_id', 'enable_tracking'] }
            }))
            const data = response.data

            if (!data) return

            data.forEach(setting => {
                if (setting.key === 'google_analytics_id') this.config.googleAnalyticsId = setting.value
                if (setting.key === 'google_ads_id') this.config.googleAdsId = setting.value
                if (setting.key === 'facebook_pixel_id') this.config.facebookPixelId = setting.value
                if (setting.key === 'enable_tracking') this.config.enabled = setting.value === 'true' || setting.value === true
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
        window.fbq('track', 'PageView')
        console.log('Facebook Pixel initialized:', pixelId)
    }

    // Track custom event
    trackEvent(eventName, params = {}) {
        if (!this.initialized || !this.config.enabled) return

        // Google Analytics
        if (window.gtag) {
            window.gtag('event', eventName, params)
        }

        // Facebook Pixel
        if (window.fbq) {
            window.fbq('track', eventName, params)
        }

        console.log('Event tracked:', eventName, params)
    }

    // E-commerce Events

    // User signs up
    trackSignUp(method = 'email') {
        this.trackEvent('sign_up', { method })
    }

    // User logs in
    trackLogin(method = 'email') {
        this.trackEvent('login', { method })
    }

    // User views a product
    trackViewItem(product) {
        this.trackEvent('view_item', {
            currency: 'BRL',
            value: product.tablePrice,
            items: [{
                item_id: product.id,
                item_name: product.name,
                price: product.tablePrice
            }]
        })
    }

    // User adds item to cart
    trackAddToCart(product, quantity = 1) {
        this.trackEvent('add_to_cart', {
            currency: 'BRL',
            value: product.tablePrice * quantity,
            items: [{
                item_id: product.id,
                item_name: product.name,
                quantity: quantity,
                price: product.tablePrice
            }]
        })
    }

    // User removes item from cart
    trackRemoveFromCart(product, quantity = 1) {
        this.trackEvent('remove_from_cart', {
            currency: 'BRL',
            value: product.tablePrice * quantity,
            items: [{
                item_id: product.id,
                item_name: product.name,
                quantity: quantity,
                price: product.tablePrice
            }]
        })
    }

    // User begins checkout
    trackBeginCheckout(cart, total) {
        this.trackEvent('begin_checkout', {
            currency: 'BRL',
            value: total,
            items: cart.map(item => ({
                item_id: item.id,
                item_name: item.name,
                quantity: item.quantity,
                price: item.tablePrice
            }))
        })
    }

    // User adds shipping info
    trackAddShippingInfo(cart, total, shippingTier = 'free') {
        this.trackEvent('add_shipping_info', {
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
        this.trackEvent('add_payment_info', {
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
    }

    // User completes purchase
    trackPurchase(orderId, cart, total, paymentMethod) {
        this.trackEvent('purchase', {
            transaction_id: orderId,
            currency: 'BRL',
            value: total,
            tax: 0,
            shipping: 0,
            payment_method: paymentMethod,
            items: cart.map(item => ({
                item_id: item.id,
                item_name: item.name,
                quantity: item.quantity,
                price: item.tablePrice
            }))
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

        // Facebook Pixel Purchase
        if (window.fbq) {
            window.fbq('track', 'Purchase', {
                value: total,
                currency: 'BRL',
                content_ids: cart.map(i => i.id),
                content_type: 'product',
                num_items: cart.reduce((sum, i) => sum + i.quantity, 0)
            })
        }
    }
}

// Export singleton instance
export const analytics = new Analytics()

// Initialize on load
if (typeof window !== 'undefined') {
    analytics.init()
}
