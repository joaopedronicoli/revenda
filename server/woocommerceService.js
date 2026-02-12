const axios = require('axios');
const db = require('./db');

async function getWooClient() {
    // 1. Tentar ler credenciais do DB
    try {
        const { rows } = await db.query(
            "SELECT credentials FROM integrations WHERE integration_type = 'woocommerce' AND active = true"
        );
        if (rows.length > 0) {
            const creds = rows[0].credentials || {};
            if (creds.wc_url && creds.wc_consumer_key && creds.wc_consumer_secret) {
                return axios.create({
                    baseURL: `${creds.wc_url}/wp-json/wc/v3`,
                    auth: { username: creds.wc_consumer_key, password: creds.wc_consumer_secret },
                    timeout: 15000,
                });
            }
        }
    } catch (err) {
        // DB nao disponivel, usar fallback
    }

    // 2. Fallback para .env
    const BASE_URL = `${process.env.WC_URL || 'https://patriciaelias.com.br'}/wp-json/wc/v3`;
    return axios.create({
        baseURL: BASE_URL,
        auth: { username: process.env.WC_CONSUMER_KEY, password: process.env.WC_CONSUMER_SECRET },
        timeout: 15000,
    });
}

async function createOrder(orderData) {
    const woo = await getWooClient();
    const { data } = await woo.post('/orders', orderData);
    return data;
}

async function updateOrderStatus(orderId, status) {
    const woo = await getWooClient();
    const { data } = await woo.put(`/orders/${orderId}`, { status });
    return data;
}

async function getOrder(orderId) {
    const woo = await getWooClient();
    const { data } = await woo.get(`/orders/${orderId}`);
    return data;
}

async function addOrderNote(orderId, note, isCustomerNote = false) {
    const woo = await getWooClient();
    const { data } = await woo.post(`/orders/${orderId}/notes`, {
        note,
        customer_note: isCustomerNote
    });
    return data;
}

async function listProducts(params = {}) {
    const woo = await getWooClient();
    const { data } = await woo.get('/products', { params: { per_page: 100, ...params } });
    return data;
}

module.exports = { createOrder, updateOrderStatus, getOrder, addOrderNote, listProducts };
