const db = require('./db');

async function resolveForState(state) {
    if (!state) {
        return await getDefaultCompanyWithGateways();
    }

    const upperState = state.toUpperCase();

    // Buscar empresa cujo array states contem o estado
    const { rows } = await db.query(
        `SELECT * FROM billing_companies WHERE active = true AND $1 = ANY(states) LIMIT 1`,
        [upperState]
    );

    if (rows.length > 0) {
        return await getCompanyWithGateways(rows[0]);
    }

    // Fallback: empresa padrao
    return await getDefaultCompanyWithGateways();
}

async function getDefaultCompanyWithGateways() {
    const { rows } = await db.query(
        `SELECT * FROM billing_companies WHERE active = true AND is_default = true LIMIT 1`
    );

    if (rows.length > 0) {
        return await getCompanyWithGateways(rows[0]);
    }

    // Nenhuma empresa configurada — retornar null (usara fallback iPag .env)
    return null;
}

async function getCompanyWithGateways(company) {
    const { rows: gateways } = await db.query(
        `SELECT * FROM payment_gateways WHERE billing_company_id = $1 AND active = true ORDER BY priority DESC`,
        [company.id]
    );

    // Coletar todos os metodos disponiveis
    const allMethods = new Set();
    gateways.forEach(gw => {
        (gw.supported_methods || []).forEach(m => allMethods.add(m));
    });

    // Determinar gateway para cada metodo
    const gatewayForCreditCard = gateways.find(gw => (gw.supported_methods || []).includes('credit_card')) || null;
    const gatewayForPix = gateways.find(gw => (gw.supported_methods || []).includes('pix')) || null;

    return {
        billingCompanyId: company.id,
        billingCompanyName: company.name,
        cnpj: company.cnpj,
        availableMethods: Array.from(allMethods),
        gatewayForCreditCard: gatewayForCreditCard ? {
            id: gatewayForCreditCard.id,
            type: gatewayForCreditCard.gateway_type,
            publicKey: getPublicKey(gatewayForCreditCard)
        } : null,
        gatewayForPix: gatewayForPix ? {
            id: gatewayForPix.id,
            type: gatewayForPix.gateway_type
        } : null,
        gateways
    };
}

function getPublicKey(gateway) {
    const creds = gateway.credentials || {};
    if (gateway.gateway_type === 'mercadopago') return creds.public_key || null;
    if (gateway.gateway_type === 'stripe') return creds.publishable_key || null;
    return null;
}

async function selectGateway(billingCompanyId, paymentMethod) {
    const { rows } = await db.query(
        `SELECT * FROM payment_gateways
         WHERE billing_company_id = $1 AND active = true AND $2 = ANY(supported_methods)
         ORDER BY priority DESC LIMIT 1`,
        [billingCompanyId, paymentMethod]
    );

    return rows.length > 0 ? rows[0] : null;
}

async function getGatewayById(gatewayId) {
    const { rows } = await db.query('SELECT * FROM payment_gateways WHERE id = $1', [gatewayId]);
    return rows.length > 0 ? rows[0] : null;
}

module.exports = { resolveForState, selectGateway, getGatewayById };
