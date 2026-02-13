const ipagGateway = require('./ipagGateway');
const mercadopagoGateway = require('./mercadopagoGateway');
const stripeGateway = require('./stripeGateway');

const gateways = {
    ipag: ipagGateway,
    mercadopago: mercadopagoGateway,
    stripe: stripeGateway
};

function getGateway(type) {
    return gateways[type] || null;
}

function getAvailableTypes() {
    return Object.keys(gateways);
}

const GATEWAY_INFO = {
    ipag: {
        name: 'iPag/Rede',
        supportedMethods: ['credit_card', 'pix'],
        credentialFields: [
            { key: 'api_url', label: 'API URL', type: 'text', default: 'https://api.ipag.com.br/service' },
            { key: 'api_id', label: 'API ID', type: 'text' },
            { key: 'api_key', label: 'API Key', type: 'password' }
        ]
    },
    mercadopago: {
        name: 'Mercado Pago',
        supportedMethods: ['credit_card', 'pix'],
        oauth: true,
        credentialFields: [
            { key: 'app_id', label: 'Client ID', type: 'text' },
            { key: 'app_secret', label: 'Client Secret', type: 'password' }
        ]
    },
    stripe: {
        name: 'Stripe',
        supportedMethods: ['credit_card'],
        credentialFields: [
            { key: 'secret_key', label: 'Secret Key', type: 'password' },
            { key: 'publishable_key', label: 'Publishable Key', type: 'text' },
            { key: 'webhook_secret', label: 'Webhook Secret', type: 'password' }
        ]
    }
};

function getGatewayInfo(type) {
    return GATEWAY_INFO[type] || null;
}

module.exports = { getGateway, getAvailableTypes, getGatewayInfo, GATEWAY_INFO };
