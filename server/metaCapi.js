const crypto = require('crypto');
const axios = require('axios');

/**
 * Meta Conversions API (CAPI) Service
 * Sends server-side events to Meta for better tracking & deduplication
 */

function hashSHA256(value) {
    if (!value) return null;
    const normalized = String(value).trim().toLowerCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Send event to Meta Conversions API
 * @param {string} pixelId - Meta Pixel ID
 * @param {string} accessToken - Meta access token
 * @param {string} eventName - Event name (e.g. 'Purchase', 'AddToCart')
 * @param {object} eventData - Custom data (value, currency, content_ids, etc.)
 * @param {object} userData - User data (email, phone, fbc, fbp, ip, userAgent)
 * @param {string} sourceUrl - Event source URL
 * @param {string} [eventId] - Optional event ID for deduplication with Pixel
 */
async function sendMetaEvent(pixelId, accessToken, eventName, eventData, userData, sourceUrl, eventId) {
    if (!pixelId || !accessToken) {
        console.warn('Meta CAPI: missing pixelId or accessToken, skipping');
        return null;
    }

    const dedupId = eventId || `${eventName}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const hashedUserData = {};

    if (userData.email) {
        hashedUserData.em = [hashSHA256(userData.email)];
    }
    if (userData.phone) {
        hashedUserData.ph = [hashSHA256(userData.phone)];
    }
    if (userData.firstName) {
        hashedUserData.fn = [hashSHA256(userData.firstName)];
    }
    if (userData.lastName) {
        hashedUserData.ln = [hashSHA256(userData.lastName)];
    }
    if (userData.ip) {
        hashedUserData.client_ip_address = userData.ip;
    }
    if (userData.userAgent) {
        hashedUserData.client_user_agent = userData.userAgent;
    }
    if (userData.fbc) {
        hashedUserData.fbc = userData.fbc;
    }
    if (userData.fbp) {
        hashedUserData.fbp = userData.fbp;
    }

    const payload = {
        data: [{
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: dedupId,
            event_source_url: sourceUrl || '',
            action_source: 'website',
            user_data: hashedUserData,
            custom_data: eventData || {}
        }],
        access_token: accessToken
    };

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${pixelId}/events`,
            payload,
            { timeout: 10000 }
        );
        console.log(`Meta CAPI: ${eventName} sent successfully (event_id: ${dedupId})`);
        return response.data;
    } catch (err) {
        console.error(`Meta CAPI error for ${eventName}:`, err.response?.data || err.message);
        return null;
    }
}

module.exports = { sendMetaEvent, hashSHA256 };
