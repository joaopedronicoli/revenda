const axios = require('axios');

const BASE_URL = `${process.env.WC_URL || 'https://patriciaelias.com.br'}/wp-json/wc/v3`;
const AUTH = {
    username: process.env.WC_CONSUMER_KEY,
    password: process.env.WC_CONSUMER_SECRET,
};

const woo = axios.create({
    baseURL: BASE_URL,
    auth: AUTH,
    timeout: 15000,
});

async function createOrder(orderData) {
    const { data } = await woo.post('/orders', orderData);
    return data;
}

async function updateOrderStatus(orderId, status) {
    const { data } = await woo.put(`/orders/${orderId}`, { status });
    return data;
}

async function getOrder(orderId) {
    const { data } = await woo.get(`/orders/${orderId}`);
    return data;
}

async function addOrderNote(orderId, note, isCustomerNote = false) {
    const { data } = await woo.post(`/orders/${orderId}/notes`, {
        note,
        customer_note: isCustomerNote
    });
    return data;
}

module.exports = { createOrder, updateOrderStatus, getOrder, addOrderNote };
