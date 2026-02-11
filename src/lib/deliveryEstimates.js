/**
 * Calcula o prazo de entrega baseado no estado (UF)
 * @param {string} state - Sigla do estado (ex: 'SP', 'RJ')
 * @returns {object} - { days: string, isFreeShipping: boolean }
 */
export function getDeliveryEstimate(state) {
    if (!state) {
        return { days: '3 a 20 dias úteis', isFreeShipping: true }
    }

    const uf = state.toUpperCase()

    // São Paulo
    if (uf === 'SP') {
        return { days: '1 a 7 dias úteis', isFreeShipping: false }
    }

    // Região Sudeste/Sul (exceto SP) + Centro-Oeste (exceto MT e MS)
    if (['DF', 'ES', 'GO', 'MG', 'PR', 'RJ', 'RS', 'SC'].includes(uf)) {
        return { days: '3 a 7 dias úteis', isFreeShipping: false }
    }

    // Nordeste + MS + RO + TO
    if (['AL', 'CE', 'MA', 'MS', 'PE', 'RN', 'RO', 'SE', 'TO', 'BA'].includes(uf)) {
        return { days: '5 a 14 dias úteis', isFreeShipping: true }
    }

    // Norte (exceto AM, AP, RR)
    if (['AC', 'MT', 'PB', 'PI', 'PA'].includes(uf)) {
        return { days: '7 a 19 dias úteis', isFreeShipping: true }
    }

    // Amazonas e Amapá
    if (['AM', 'AP'].includes(uf)) {
        return { days: '7 a 20 dias úteis', isFreeShipping: true }
    }

    // Roraima
    if (uf === 'RR') {
        return { days: '9 a 20 dias úteis', isFreeShipping: false }
    }

    // Fallback
    return { days: '3 a 20 dias úteis', isFreeShipping: true }
}

/**
 * Calcula a data estimada de entrega
 * @param {string} state - Sigla do estado
 * @param {number} businessDays - Número de dias úteis (usar o máximo do range)
 * @returns {string} - Data formatada
 */
export function getEstimatedDeliveryDate(state) {
    const { days } = getDeliveryEstimate(state)

    // Extrair o número máximo de dias do range (ex: "7 a 19 dias úteis" -> 19)
    const maxDays = parseInt(days.split(' a ')[1] || days.split(' ')[0])

    const today = new Date()
    let businessDaysAdded = 0
    let currentDate = new Date(today)

    // Adicionar dias úteis (pular sábados e domingos)
    while (businessDaysAdded < maxDays) {
        currentDate.setDate(currentDate.getDate() + 1)
        const dayOfWeek = currentDate.getDay()

        // Se não for sábado (6) nem domingo (0), conta como dia útil
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            businessDaysAdded++
        }
    }

    return currentDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    })
}
