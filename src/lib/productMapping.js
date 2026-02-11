/**
 * Product mapping between app and WooCommerce
 * Maps app product names/references to WooCommerce product IDs
 */

export const PRODUCT_MAPPING = {
    // Aloe Vera Gel de Babosa – 250ml
    'aloe vera gel de babosa 250ml': { id: 105884, sku: '0200' },
    'aloe vera gel de babosa': { id: 105884, sku: '0200' },
    'aloe vera gel 250ml': { id: 105884, sku: '0200' },
    'aloe vera gel': { id: 105884, sku: '0200' },
    'gel de babosa': { id: 105884, sku: '0200' },

    // Óleo de Rosa Mosqueta Puro – 20ml
    'oleo de rosa mosqueta puro 20ml': { id: 81120, sku: '0127' },
    'oleo de rosa mosqueta puro': { id: 81120, sku: '0127' },
    'oleo de rosa mosqueta': { id: 81120, sku: '0127' },
    'rosa mosqueta': { id: 81120, sku: '0127' },

    // Amazing Derme Sérum Creme Facial Anti idade – 50g
    'amazing derme serum creme facial anti idade 50g': { id: 260692, sku: '0256' },
    'amazing derme serum creme facial anti idade': { id: 260692, sku: '0256' },
    'amazing derme serum creme': { id: 260692, sku: '0256' },
    'amazing derme': { id: 260692, sku: '0256' },
    'serum creme amazing derme': { id: 260692, sku: '0256' },

    // Lumi 10 Niacinamida Sérum Iluminador Facial – 30ml
    'lumi 10 niacinamida serum iluminador facial 30ml': { id: 300081, sku: '0259' },
    'lumi 10 niacinamida serum iluminador facial': { id: 300081, sku: '0259' },
    'lumi 10 niacinamida serum': { id: 300081, sku: '0259' },
    'lumi 10 niacinamida': { id: 300081, sku: '0259' },
    'serum lumi 10': { id: 300081, sku: '0259' },

    // Purifique-C Sabonete Gel de Limpeza Facial – 120ml
    'purifiquec sabonete gel de limpeza facial 120ml': { id: 315653, sku: '0260' },
    'purifiquec sabonete gel de limpeza facial': { id: 315653, sku: '0260' },
    'purifiquec sabonete gel de limpeza': { id: 315653, sku: '0260' },
    'purifiquec sabonete gel': { id: 315653, sku: '0260' },
    'purifiquec': { id: 315653, sku: '0260' },
    'purifique c': { id: 315653, sku: '0260' },

    // Termaskin Tônico Facial e Água Termal – 120ml
    'termaskin tonico facial e agua termal 120ml': { id: 288498, sku: '0258' },
    'termaskin tonico facial e agua termal': { id: 288498, sku: '0258' },
    'termaskin tonico facial': { id: 288498, sku: '0258' },
    'termaskin': { id: 288498, sku: '0258' },

    // Hair Care FBC Tônico Capilar – 100ml
    'hair care fbc tonico capilar 100ml': { id: 260643, sku: '0255' },
    'hair care fbc tonico capilar': { id: 260643, sku: '0255' },
    'hair care fbc': { id: 260643, sku: '0255' },
    'tonico capilar fbc': { id: 260643, sku: '0255' },

    // Modelat – Máscara Lift Facial
    'modelat mascara lift facial': { id: 385615, sku: '0279' },
    'modelat mascara lift': { id: 385615, sku: '0279' },
    'modelat': { id: 385615, sku: '0279' },
    'mascara lift facial': { id: 385615, sku: '0279' }
}

// Mapeamento por SKU (fallback)
export const SKU_MAPPING = {
    '0200': { id: 105884, name: 'Aloe Vera Gel de Babosa – 250ml' },
    '0127': { id: 81120, name: 'Óleo de Rosa Mosqueta Puro – 20ml' },
    '0256': { id: 260692, name: 'Amazing Derme Sérum Creme Facial Anti idade – 50g' },
    '0259': { id: 300081, name: 'Lumi 10 Niacinamida Sérum Iluminador Facial – 30ml' },
    '0260': { id: 315653, name: 'Purifique-C Sabonete Gel de Limpeza Facial – 120ml' },
    '0258': { id: 288498, name: 'Termaskin Tônico Facial e Água Termal – 120ml' },
    '0255': { id: 260643, name: 'Hair Care FBC Tônico Capilar – 100ml' },
    '0279': { id: 385615, name: 'Modelat – Máscara Lift Facial' }
}

/**
 * Normalize product name for matching
 */
export function normalizeProductName(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s]/g, '') // Remove special chars (hyphens, dashes, etc)
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim()
}

/**
 * Get WooCommerce product ID from app product name
 */
export function getWooCommerceProductId(productName) {
    const normalized = normalizeProductName(productName)

    // Try exact match first
    let product = PRODUCT_MAPPING[normalized]

    // If not found, try partial matches (most specific first)
    if (!product) {
        const keys = Object.keys(PRODUCT_MAPPING).sort((a, b) => b.length - a.length)
        for (const key of keys) {
            if (normalized.includes(key) || key.includes(normalized)) {
                product = PRODUCT_MAPPING[key]
                console.log(`✅ Matched "${productName}" to "${key}"`)
                break
            }
        }
    }

    if (!product) {
        console.warn(`⚠️ Product not found in mapping: "${productName}" (normalized: "${normalized}")`)
        return null
    }

    return product.id
}

/**
 * Get WooCommerce SKU from app product name
 */
export function getWooCommerceSku(productName) {
    const normalized = normalizeProductName(productName)
    const product = PRODUCT_MAPPING[normalized]

    if (!product) {
        return null
    }

    return product.sku
}

/**
 * Get product by SKU (fallback method)
 */
export function getProductBySku(sku) {
    return SKU_MAPPING[sku] || null
}
