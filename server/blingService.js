const axios = require('axios');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const BLING_API = 'https://www.bling.com.br/Api/v3';

/**
 * Get a valid Bling access token for a billing company.
 * Refreshes automatically if expired.
 */
async function getBlingToken(billingCompanyId) {
    const { rows } = await db.query(
        'SELECT bling_credentials FROM billing_companies WHERE id = $1',
        [billingCompanyId]
    );
    if (rows.length === 0) throw new Error('Empresa faturadora nao encontrada');

    const creds = rows[0].bling_credentials || {};
    if (!creds.access_token) throw new Error('Bling nao autorizado para esta empresa');

    // Check if token is expired (or expires in < 5 min)
    const expiresAt = creds.token_expires_at ? new Date(creds.token_expires_at) : null;
    if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
        return await refreshBlingCompanyToken(billingCompanyId);
    }

    return creds.access_token;
}

/**
 * Refresh the Bling OAuth token for a billing company and save new tokens.
 */
async function refreshBlingCompanyToken(billingCompanyId) {
    const { rows } = await db.query(
        'SELECT bling_credentials FROM billing_companies WHERE id = $1',
        [billingCompanyId]
    );
    if (rows.length === 0) throw new Error('Empresa faturadora nao encontrada');

    const creds = rows[0].bling_credentials || {};
    if (!creds.refresh_token || !creds.client_id || !creds.client_secret) {
        throw new Error('Credenciais Bling incompletas para refresh');
    }

    const basicAuth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
    const resp = await axios.post(`${BLING_API}/oauth/token`,
        new URLSearchParams({ grant_type: 'refresh_token', refresh_token: creds.refresh_token }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` } }
    );

    const { access_token, refresh_token, expires_in } = resp.data;
    const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();

    await db.query(
        `UPDATE billing_companies SET bling_credentials = bling_credentials || $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify({ access_token, refresh_token, token_expires_at: tokenExpiresAt }), billingCompanyId]
    );

    return access_token;
}

/**
 * Fetch a Bling order by numeroPedidoLoja (woocommerce_order_number).
 */
async function fetchBlingOrderByPedidoLoja(accessToken, numeroPedidoLoja) {
    const resp = await axios.get(`${BLING_API}/pedidos/vendas`, {
        params: { numeroPedidoLoja: numeroPedidoLoja },
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const pedidos = resp.data?.data || [];
    return pedidos.length > 0 ? pedidos[0] : null;
}

/**
 * Fetch full details of a Bling order by its Bling ID.
 */
async function fetchBlingOrderDetails(accessToken, blingOrderId) {
    const resp = await axios.get(`${BLING_API}/pedidos/vendas/${blingOrderId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    return resp.data?.data || null;
}

/**
 * Fetch NF-e details from Bling by NF-e ID.
 */
async function fetchBlingNfe(accessToken, nfeId) {
    const resp = await axios.get(`${BLING_API}/nfe/${nfeId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    return resp.data?.data || null;
}

/**
 * Download a DANFE PDF from Bling and save it locally.
 * Returns the relative URL path for serving.
 */
async function downloadAndSaveDanfe(pdfUrl, orderId, accessToken) {
    // Sanitizar orderId para prevenir path traversal
    const safeOrderId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeOrderId || safeOrderId !== String(orderId)) {
        throw new Error('orderId contém caracteres inválidos');
    }

    const uploadsDir = path.join(__dirname, 'uploads', 'notas');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${safeOrderId}_danfe.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    // Verificar que o caminho final está dentro do diretório esperado
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(uploadsDir))) {
        throw new Error('Caminho de arquivo invalido');
    }

    const resp = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    });

    fs.writeFileSync(filePath, resp.data);
    return `/uploads/notas/${fileName}`;
}

/**
 * Auto-refresh tokens for all billing companies with Bling credentials configured.
 * Renews tokens that expire in less than 1 hour.
 */
async function autoRefreshAllBlingCompanyTokens() {
    try {
        const { rows } = await db.query(
            "SELECT id, bling_credentials FROM billing_companies WHERE bling_credentials IS NOT NULL AND bling_credentials != '{}'"
        );

        for (const row of rows) {
            const creds = row.bling_credentials || {};
            if (!creds.access_token || !creds.refresh_token) continue;

            const expiresAt = creds.token_expires_at ? new Date(creds.token_expires_at) : null;
            if (!expiresAt) continue;

            const msUntilExpiry = expiresAt.getTime() - Date.now();
            const oneHour = 60 * 60 * 1000;

            if (msUntilExpiry < oneHour) {
                try {
                    console.log(`[AutoRefresh Bling Company ${row.id}] Token expira em ${Math.round(msUntilExpiry / 60000)}min, renovando...`);
                    await refreshBlingCompanyToken(row.id);
                    console.log(`[AutoRefresh Bling Company ${row.id}] Token renovado com sucesso!`);
                } catch (err) {
                    console.error(`[AutoRefresh Bling Company ${row.id}] Erro:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error('[AutoRefresh Bling Companies] Erro geral:', err.message);
    }
}

module.exports = {
    getBlingToken,
    refreshBlingCompanyToken,
    fetchBlingOrderByPedidoLoja,
    fetchBlingOrderDetails,
    fetchBlingNfe,
    downloadAndSaveDanfe,
    autoRefreshAllBlingCompanyTokens
};
