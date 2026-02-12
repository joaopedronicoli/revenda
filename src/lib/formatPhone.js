/**
 * Format Brazilian phone number as user types
 * Mobile: (XX) XXXXX-XXXX | Landline: (XX) XXXX-XXXX
 */
export function formatPhone(value) {
    const digits = (value || '').replace(/\D/g, '').slice(0, 11)
    if (digits.length === 0) return ''
    if (digits.length <= 2) return `(${digits}`
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
