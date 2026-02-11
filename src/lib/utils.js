import CryptoJS from 'crypto-js'

const SECRET_KEY = import.meta.env.VITE_STORAGE_SECRET_KEY || 'patriciaelias2025'

/**
 * Salva dados criptografados no localStorage
 */
export const salvarCriptografado = (chave, dados) => {
    try {
        const stringDados = JSON.stringify(dados)
        const criptografado = CryptoJS.AES.encrypt(stringDados, SECRET_KEY).toString()
        localStorage.setItem(chave, criptografado)
    } catch (e) {
        console.error('Erro ao salvar dados criptografados:', e)
    }
}

/**
 * Le e descriptografa dados do localStorage
 */
export const lerDescriptografado = (chave) => {
    const criptografado = localStorage.getItem(chave)
    if (!criptografado) return null

    try {
        const bytes = CryptoJS.AES.decrypt(criptografado, SECRET_KEY)
        const textoDescriptografado = bytes.toString(CryptoJS.enc.Utf8)
        if (!textoDescriptografado) return null
        return JSON.parse(textoDescriptografado)
    } catch (e) {
        console.error('Erro ao descriptografar dados do localStorage:', e)
        return null
    }
}

/**
 * Remove um item do localStorage
 */
export const removerDados = (chave) => {
    localStorage.removeItem(chave)
}
