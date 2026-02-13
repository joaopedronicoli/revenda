const TRACKING_KEYS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid', 'yclid', 'srctid'
]

const INTERNAL_KEYS = ['pe_landing', 'pe_referrer', 'pe_channel', 'pe_timestamp']

const ALL_KEYS = [...TRACKING_KEYS, ...INTERNAL_KEYS]

const STORAGE_PREFIX = 'pe_'
const EXPIRATION_DAYS = 90

function classifyChannel(params, referrer) {
    // Paid Google (click IDs)
    if (params.gclid || params.gbraid || params.wbraid) return 'paid_google'

    // Paid Social (click IDs)
    if (params.fbclid || params.ttclid) return 'paid_social'

    // Microsoft Ads
    if (params.msclkid) return 'paid_microsoft'

    // UTM-based classification
    if (params.utm_medium === 'email' || params.utm_source === 'newsletter') return 'email'
    if (params.utm_medium === 'cpc' || params.utm_medium === 'ppc' || params.utm_medium === 'paid') return 'paid_google'

    // Referrer-based classification
    if (referrer) {
        try {
            const refHost = new URL(referrer).hostname.toLowerCase()
            if (refHost.includes('google') && !params.gclid) return 'organic_google'
            if (refHost.includes('bing') || refHost.includes('yahoo') || refHost.includes('duckduckgo')) return 'organic'
            if (refHost.includes('facebook') || refHost.includes('instagram') || refHost.includes('tiktok') || refHost.includes('twitter') || refHost.includes('linkedin')) return 'organic_social'
            // External referral (not same domain)
            if (!refHost.includes(window.location.hostname)) return 'referral'
        } catch {
            // Invalid referrer URL
        }
    }

    return 'direct'
}

function isExpired() {
    const timestamp = localStorage.getItem(STORAGE_PREFIX + 'pe_timestamp')
    if (!timestamp) return true
    const saved = new Date(parseInt(timestamp))
    const now = new Date()
    const diffDays = (now - saved) / (1000 * 60 * 60 * 24)
    return diffDays > EXPIRATION_DAYS
}

export function initTracking() {
    // If data exists and is not expired, don't overwrite (first_touch model)
    const existingChannel = localStorage.getItem(STORAGE_PREFIX + 'pe_channel')
    if (existingChannel && !isExpired()) return

    // If expired, clear all old data first
    if (existingChannel && isExpired()) {
        clearTracking()
    }

    const params = new URLSearchParams(window.location.search)
    const referrer = document.referrer || ''

    // Collect UTM and click ID params from URL
    const collected = {}
    let hasUtmOrClickId = false

    for (const key of TRACKING_KEYS) {
        const value = params.get(key)
        if (value) {
            collected[key] = value
            hasUtmOrClickId = true
        }
    }

    // Only save if there are UTMs/click IDs, or if there's no existing data at all
    if (!hasUtmOrClickId && existingChannel) return

    // Save UTM params
    for (const [key, value] of Object.entries(collected)) {
        localStorage.setItem(STORAGE_PREFIX + key, value)
    }

    // Save landing page and referrer
    localStorage.setItem(STORAGE_PREFIX + 'pe_landing', window.location.href)
    localStorage.setItem(STORAGE_PREFIX + 'pe_referrer', referrer || 'direct')

    // Classify and save channel
    const channel = classifyChannel(collected, referrer)
    localStorage.setItem(STORAGE_PREFIX + 'pe_channel', channel)

    // Save timestamp
    localStorage.setItem(STORAGE_PREFIX + 'pe_timestamp', String(Date.now()))
}

export function getTrackingData() {
    const data = {}
    for (const key of ALL_KEYS) {
        const value = localStorage.getItem(STORAGE_PREFIX + key)
        if (value && key !== 'pe_timestamp') {
            data[key] = value
        }
    }
    // Return null if no tracking data (avoid sending empty object)
    return Object.keys(data).length > 0 ? data : null
}

export function clearTracking() {
    for (const key of ALL_KEYS) {
        localStorage.removeItem(STORAGE_PREFIX + key)
    }
}
