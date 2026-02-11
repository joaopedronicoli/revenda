/**
 * Status mapping between App and WooCommerce
 */

// App → WooCommerce
export const APP_TO_WC_STATUS = {
    'cancelled': 'cancelled',
    'pending': 'pending',
    'paid': 'processing',
    'processing': 'processing',
    'on-hold': 'on-hold',
    'completed': 'completed',
    'refunded': 'refunded',
    'failed': 'failed',
    'clinica': 'clinica',
    'preparing': 'estoque',
    'returned': 'devolvido',
    'delivery-issue': 'entrega',
    'incorrect-data': 'incorretos',
    'preparing-shipment': 'separacao',
    'pickup': 'retirar',
    'payment-received': 'recebido',
    'shipped': 'enviado',
    'draft': 'checkout-draft'
}

// WooCommerce → App
export const WC_TO_APP_STATUS = {
    'cancelled': 'cancelled',
    'pending': 'pending',
    'processing': 'paid',
    'on-hold': 'on-hold',
    'completed': 'completed',
    'refunded': 'refunded',
    'failed': 'failed',
    'clinica': 'clinica',
    'estoque': 'preparing',
    'devolvido': 'returned',
    'entrega': 'delivery-issue',
    'incorretos': 'incorrect-data',
    'separacao': 'preparing-shipment',
    'retirar': 'pickup',
    'recebido': 'payment-received',
    'enviado': 'shipped',
    'checkout-draft': 'draft'
}

/**
 * Convert app status to WooCommerce status
 */
export function appToWcStatus(appStatus) {
    return APP_TO_WC_STATUS[appStatus] || 'pending'
}

/**
 * Convert WooCommerce status to app status
 */
export function wcToAppStatus(wcStatus) {
    return WC_TO_APP_STATUS[wcStatus] || 'pending'
}

/**
 * Status display configuration for app
 */
export const STATUS_CONFIG = {
    'cancelled': { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
    'pending': { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
    'paid': { label: 'Pago', color: 'bg-green-100 text-green-800' },
    'processing': { label: 'Processando', color: 'bg-blue-100 text-blue-800' },
    'on-hold': { label: 'Aguardando', color: 'bg-orange-100 text-orange-800' },
    'completed': { label: 'Concluído', color: 'bg-green-100 text-green-800' },
    'refunded': { label: 'Reembolsado', color: 'bg-purple-100 text-purple-800' },
    'failed': { label: 'Malsucedido', color: 'bg-red-100 text-red-800' },
    'clinica': { label: 'Clínica', color: 'bg-teal-100 text-teal-800' },
    'preparing': { label: 'Em Separação', color: 'bg-blue-100 text-blue-800' },
    'returned': { label: 'Devolvido', color: 'bg-gray-100 text-gray-800' },
    'delivery-issue': { label: 'Ocorrência', color: 'bg-orange-100 text-orange-800' },
    'incorrect-data': { label: 'Dados Incorretos', color: 'bg-red-100 text-red-800' },
    'preparing-shipment': { label: 'Preparando para Envio', color: 'bg-blue-100 text-blue-800' },
    'pickup': { label: 'Retirar na Loja', color: 'bg-indigo-100 text-indigo-800' },
    'payment-received': { label: 'Pagamento Recebido', color: 'bg-green-100 text-green-800' },
    'shipped': { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
    'draft': { label: 'Rascunho', color: 'bg-gray-100 text-gray-800' }
}
