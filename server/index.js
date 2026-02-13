const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const ipagService = require('./ipagService');
const woocommerceService = require('./woocommerceService');
const emailService = require('./emailService');
const billingService = require('./billingService');
const gatewayRouter = require('./gateways/gatewayRouter');
const blingService = require('./blingService');
const { updateSchema } = require('./setup_db');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({
    limit: '15mb',
    verify: (req, res, buf) => {
        if (req.originalUrl === '/webhooks/gateway/stripe') {
            req.rawBody = buf;
        }
    }
}));

// Static files para notas fiscais
const notasDir = path.join(__dirname, 'uploads', 'notas');
if (!fs.existsSync(notasDir)) {
    fs.mkdirSync(notasDir, { recursive: true });
}
app.use('/uploads/notas', express.static(notasDir));

// =============================================
// CONSTANTES DE NIVEL
// =============================================

const LEVEL_CONFIG = {
    bronze:  { discount: 0.30, name: 'Bronze', minAccumulated: 0 },
    prata:   { discount: 0.35, name: 'Prata', minAccumulated: 5000 },
    ouro:    { discount: 0.40, name: 'Ouro', minAccumulated: 10000 }
};

const AFFILIATE_CONFIG = {
    influencer_pro: {
        name: 'Influencer Pro',
        fee: 0,
        commissions: { pe_products: 0.12, store: 0.08, courses: 0.20 }
    },
    renda_extra: {
        name: 'Renda Extra',
        fee: 97,
        commissions: { pe_products: 0.125, store: 0.20, courses: 0.20 }
    },
    gratuito: {
        name: 'Gratuito',
        fee: 0,
        commissions: { pe_products: 0.125, store: 0.20, courses: 0.20 }
    }
};

const AFFILIATE_LEVELS = {
    conhecedor: { name: 'Conhecedor', minSales: 0, bonus: 0 },
    to_gostando: { name: 'To Gostando', minSales: 10, bonus: 0 },
    associado: { name: 'Associado', minSales: 30, bonus: 0.025 }
};

const MIN_ORDER_FIRST = 897;
const MIN_ORDER_RECURRING = 600;
const INACTIVITY_DAYS = 90;

// =============================================
// MIDDLEWARE — JWT + Auto-criar usuario local
// =============================================

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let { rows } = await db.query(
            'SELECT * FROM users WHERE central_user_id = $1',
            [decoded.id]
        );

        if (rows.length === 0) {
            const result = await db.query(
                `INSERT INTO users (central_user_id, email, name, role)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (central_user_id) DO UPDATE SET email = $2
                 RETURNING *`,
                [decoded.id, decoded.email, decoded.email.split('@')[0], decoded.role || 'client']
            );
            rows = result.rows;
        }

        const localUser = rows[0];
        req.user = {
            id: localUser.id,
            centralId: decoded.id,
            email: localUser.email,
            role: localUser.role
        };

        next();
    } catch (err) {
        return res.sendStatus(403);
    }
};

const requireAdmin = async (req, res, next) => {
    try {
        const { rows } = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
        if (rows.length === 0) return res.sendStatus(404);
        if (!['administrator', 'admin', 'manager'].includes(rows[0].role)) {
            return res.status(403).json({ message: 'Acesso restrito a administradores' });
        }
        req.userRole = rows[0].role;
        next();
    } catch (err) {
        res.sendStatus(500);
    }
};

// =============================================
// HELPERS
// =============================================

// Gera codigo de indicacao unico
function generateReferralCode(name) {
    const cleanName = (name || 'USER').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PE-${cleanName}${rand}`;
}

// Recalcula nivel do usuario apos evento
async function recalculateUserLevel(userId) {
    const { rows } = await db.query(
        'SELECT id, level, total_accumulated, quarter_accumulated FROM users WHERE id = $1',
        [userId]
    );
    if (rows.length === 0) return;
    const user = rows[0];

    // Contar indicacoes ativas
    const refResult = await db.query(
        "SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = $1 AND status = 'active'",
        [userId]
    );
    const activeReferrals = parseInt(refResult.rows[0].cnt);

    let newLevel = 'bronze';
    const accumulated = parseFloat(user.total_accumulated) || 0;
    const quarterAcc = parseFloat(user.quarter_accumulated) || 0;

    // Ouro: R$10k/trimestre OU 6 indicacoes
    if (quarterAcc >= 10000 || activeReferrals >= 6) {
        newLevel = 'ouro';
    }
    // Prata: R$5k acumulado OU 3 indicacoes
    else if (accumulated >= 5000 || activeReferrals >= 3) {
        newLevel = 'prata';
    }

    if (newLevel !== user.level) {
        await db.query(
            'UPDATE users SET level = $1, level_updated_at = NOW() WHERE id = $2',
            [newLevel, userId]
        );
        await db.query(
            'INSERT INTO level_history (user_id, old_level, new_level, reason, changed_by) VALUES ($1, $2, $3, $4, $5)',
            [userId, user.level, newLevel, 'Recalculo automatico', 'system']
        );

        // Grant level achievements
        if (newLevel === 'prata') await grantAchievement(userId, 'level_prata');
        if (newLevel === 'ouro') await grantAchievement(userId, 'level_ouro');
    }

    return newLevel;
}

// Checa e concede conquistas
async function checkAndGrantAchievements(userId) {
    const { rows: userRows } = await db.query(
        'SELECT total_accumulated, points FROM users WHERE id = $1',
        [userId]
    );
    if (userRows.length === 0) return;
    const user = userRows[0];

    // Count orders
    const orderResult = await db.query(
        "SELECT COUNT(*) as cnt FROM orders WHERE user_id = $1 AND status IN ('completed','processing','paid')",
        [userId]
    );
    const orderCount = parseInt(orderResult.rows[0].cnt);

    // Count referrals
    const refResult = await db.query(
        "SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = $1 AND status = 'active'",
        [userId]
    );
    const refCount = parseInt(refResult.rows[0].cnt);

    const accumulated = parseFloat(user.total_accumulated) || 0;

    // Sales achievements
    if (orderCount >= 1) await grantAchievement(userId, 'first_sale');
    if (orderCount >= 5) await grantAchievement(userId, 'sales_5');
    if (orderCount >= 10) await grantAchievement(userId, 'sales_10');
    if (orderCount >= 25) await grantAchievement(userId, 'sales_25');
    if (orderCount >= 50) await grantAchievement(userId, 'sales_50');

    // Revenue achievements
    if (accumulated >= 5000) await grantAchievement(userId, 'revenue_5k');
    if (accumulated >= 10000) await grantAchievement(userId, 'revenue_10k');
    if (accumulated >= 25000) await grantAchievement(userId, 'revenue_25k');
    if (accumulated >= 50000) await grantAchievement(userId, 'revenue_50k');

    // Referral achievements
    if (refCount >= 1) await grantAchievement(userId, 'referral_1');
    if (refCount >= 3) await grantAchievement(userId, 'referral_3');
    if (refCount >= 5) await grantAchievement(userId, 'referral_5');
    if (refCount >= 10) await grantAchievement(userId, 'referral_10');
}

async function grantAchievement(userId, slug) {
    try {
        const { rows: achRows } = await db.query('SELECT id, points_reward FROM achievements WHERE slug = $1', [slug]);
        if (achRows.length === 0) return;
        const achievement = achRows[0];

        // Check if already earned
        const { rows: existing } = await db.query(
            'SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
            [userId, achievement.id]
        );
        if (existing.length > 0) return;

        // Grant
        await db.query(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
            [userId, achievement.id]
        );

        // Award points
        if (achievement.points_reward > 0) {
            await db.query(
                'UPDATE users SET points = points + $1 WHERE id = $2',
                [achievement.points_reward, userId]
            );
            await db.query(
                'INSERT INTO points_ledger (user_id, points, type, description, reference_id) VALUES ($1, $2, $3, $4, $5)',
                [userId, achievement.points_reward, 'achievement', `Conquista: ${slug}`, String(achievement.id)]
            );
        }
    } catch (e) {
        // Unique constraint violation = already earned, ignore
    }
}

// Criar ou atualizar pedido no WooCommerce com dados atualizados
async function createOrUpdateWCOrder(orderId) {
    const { rows } = await db.query(
        `SELECT o.*, a.street, a.number AS addr_number, a.complement, a.neighborhood, a.city, a.state, a.cep
         FROM orders o LEFT JOIN addresses a ON o.address_id = a.id
         WHERE o.id = $1`,
        [orderId]
    );
    if (rows.length === 0) throw new Error('Pedido nao encontrado');
    const order = rows[0];
    const details = order.details || {};

    // Buscar dados do usuario
    const { rows: userRows } = await db.query(
        'SELECT name, email, telefone, cpf, cnpj, document_type FROM users WHERE id = $1',
        [order.user_id]
    );
    const userData = userRows[0] || {};

    // Buscar woo_product_id e special_discount para todos os itens
    const allItems = details.items || [];
    const discountStandard = details.summary?.discountStandard || 0.30;
    const TEST_PRODUCT_ID = 999;

    for (const item of allItems) {
        if (item.id) {
            const { rows: pRows } = await db.query('SELECT woo_product_id, special_discount FROM products WHERE id = $1', [item.id]);
            if (pRows.length > 0) {
                if (!item.woo_product_id && pRows[0].woo_product_id) item.woo_product_id = pRows[0].woo_product_id;
                item.special_discount = pRows[0].special_discount ? parseFloat(pRows[0].special_discount) : null;
            }
        }
    }

    const lineItems = allItems
        .filter(item => item.woo_product_id)
        .map(item => {
            const qty = item.quantity || 1;
            const tablePrice = parseFloat(item.tablePrice || item.price || 0);
            const subtotalValue = tablePrice * qty;

            // Calcular desconto: special_discount do produto, ou desconto padrao do nivel
            let discount = discountStandard;
            if (item.special_discount != null) discount = item.special_discount;
            if (item.id === TEST_PRODUCT_ID) discount = 0;

            const totalValue = tablePrice * (1 - discount) * qty;

            return {
                product_id: item.woo_product_id,
                quantity: qty,
                subtotal: subtotalValue.toFixed(2),
                total: totalValue.toFixed(2)
            };
        });

    // Fee lines para kit, credito de comissao e cupom
    const feeLines = [];
    if (details.kit && details.summary?.kitPrice > 0) {
        feeLines.push({ name: `Kit Inicial - ${details.kit.name}`, total: parseFloat(details.summary.kitPrice).toFixed(2) });
    }
    if (details.commission_credit_applied > 0) {
        feeLines.push({ name: 'Credito de Comissao', total: (-parseFloat(details.commission_credit_applied)).toFixed(2) });
    }
    if (details.coupon_code && parseFloat(details.coupon_discount || 0) > 0) {
        feeLines.push({ name: `Cupom ${details.coupon_code}`, total: (-parseFloat(details.coupon_discount)).toFixed(2) });
    }

    // Resolver empresa faturadora
    let billingCompanyName = '';
    try {
        if (order.billing_company_id) {
            const { rows: bcRows } = await db.query('SELECT name FROM billing_companies WHERE id = $1', [order.billing_company_id]);
            if (bcRows.length > 0) billingCompanyName = bcRows[0].name;
        } else if (order.state) {
            const resolved = await billingService.resolveForState(order.state);
            if (resolved) billingCompanyName = resolved.billingCompanyName || '';
        }
    } catch (e) { /* ignora */ }

    const userName = userData.name || details.user_name || 'Cliente';
    const nameParts = userName.trim().split(' ');
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || '';
    const userPhone = userData.telefone || details.user_whatsapp || '';
    const userCpf = userData.cpf || details.user_cpf || '';
    const userEmail = userData.email || details.user_email || '';

    const paymentMethodLabel = order.payment_method === 'pix' ? 'PIX' : order.payment_method === 'credit_card' ? 'Cartao de Credito' : order.payment_method || 'Nao informado';
    const gatewayLabel = order.gateway_type ? ` (${order.gateway_type})` : '';

    const orderNotes = [
        'Pedido realizado pela Central de Revendas.',
        `Metodo de pagamento: ${paymentMethodLabel}${gatewayLabel}.`,
        billingCompanyName ? `Empresa faturadora: ${billingCompanyName}.` : '',
        details.coupon_code ? `Cupom: ${details.coupon_code} (desconto: R$ ${parseFloat(details.coupon_discount || 0).toFixed(2)}).` : ''
    ].filter(Boolean).join('\n');

    const wcOrderData = {
        status: 'processing',
        billing: {
            first_name: firstName,
            last_name: lastName,
            email: userEmail,
            phone: userPhone,
            address_1: order.street || '',
            address_2: order.complement || '',
            neighborhood: order.neighborhood || '',
            number: order.addr_number || '',
            city: order.city || '',
            state: order.state || '',
            postcode: order.cep || '',
            country: 'BR'
        },
        shipping: {
            first_name: firstName,
            last_name: lastName,
            address_1: order.street || '',
            address_2: order.complement || '',
            neighborhood: order.neighborhood || '',
            number: order.addr_number || '',
            city: order.city || '',
            state: order.state || '',
            postcode: order.cep || '',
            country: 'BR'
        },
        line_items: lineItems,
        fee_lines: feeLines.length > 0 ? feeLines : undefined,
        shipping_lines: [{ method_id: 'free_shipping', method_title: 'Frete Gratis', total: '0.00' }],
        meta_data: [
            { key: '_revenda_app_order_id', value: String(order.id) },
            { key: '_payment_method_title', value: paymentMethodLabel },
            { key: '_billing_number', value: order.addr_number || '' },
            { key: '_billing_neighborhood', value: order.neighborhood || '' },
            { key: '_billing_cpf', value: userCpf },
            { key: '_billing_cnpj', value: userData.cnpj || '' },
            { key: '_billing_cellphone', value: userPhone },
            { key: '_billing_persontype', value: userData.document_type === 'cnpj' ? '2' : '1' },
            { key: 'pe_channel', value: 'revenda' },
            { key: 'pe_landing', value: 'central-revendas' },
            { key: 'pe_referrer', value: 'central-revendas' },
            { key: '_utm_source', value: 'revenda' },
            { key: '_utm_medium', value: 'app' },
            { key: '_utm_campaign', value: 'central-revendas' },
            { key: '_billing_company', value: billingCompanyName },
            { key: '_shipping_number', value: order.addr_number || '' },
            { key: '_shipping_neighborhood', value: order.neighborhood || '' }
        ]
    };

    if (lineItems.length === 0) {
        console.warn(`[WC Order] Order ${orderId}: nenhum item com woo_product_id, nao criando no WC`);
        return null;
    }

    // Se ja tem WC order, atualizar. Senao, criar novo.
    let wcOrder;
    if (order.woocommerce_order_id) {
        wcOrder = await woocommerceService.updateOrder(order.woocommerce_order_id, wcOrderData);
        console.log(`[WC Order] Updated #${wcOrder.number || order.woocommerce_order_id} for local order ${orderId} (line_items: ${lineItems.length})`);
    } else {
        wcOrder = await woocommerceService.createOrder(wcOrderData);
        // Salvar referencia WC no pedido local
        await db.query(
            `UPDATE orders SET order_number = $1, woocommerce_order_id = $2, woocommerce_order_number = $3,
             tracking_url = $4, updated_at = NOW() WHERE id = $5`,
            [String(wcOrder.number), String(wcOrder.id), String(wcOrder.number),
             `https://patriciaelias.com.br/rastreio-de-pedido/?pedido=${wcOrder.number}`,
             orderId]
        );
        console.log(`[WC Order] Created #${wcOrder.number} for local order ${orderId} (line_items: ${lineItems.length})`);
    }

    // Adicionar notas como nota privada do pedido (nao como nota do cliente)
    if (orderNotes) {
        try {
            await woocommerceService.addOrderNote(wcOrder.id, orderNotes, false);
        } catch (noteErr) {
            console.warn(`[WC Order] Erro ao adicionar nota privada ao pedido #${wcOrder.number}:`, noteErr.message);
        }
    }

    return wcOrder;
}

// Creditar comissao de indicacao
// Logica pos-pagamento reutilizavel (chamada por PUT /orders, POST /orders/:id/sync e webhook iPag)
async function processPostPaymentLogic(orderId, userId, orderTotal, orderDetails) {
    try {
        // Atualizar totais do usuario
        await db.query(
            `UPDATE users SET
                last_purchase_date = NOW(),
                total_accumulated = total_accumulated + $1,
                quarter_accumulated = quarter_accumulated + $1,
                first_order_completed = true,
                has_purchased_kit = CASE WHEN has_purchased_kit = false AND $3::jsonb->>'kit' IS NOT NULL THEN true ELSE has_purchased_kit END,
                kit_type = CASE WHEN has_purchased_kit = false AND $3::jsonb->'kit'->>'slug' IS NOT NULL THEN $3::jsonb->'kit'->>'slug' ELSE kit_type END,
                kit_purchased_at = CASE WHEN has_purchased_kit = false AND $3::jsonb->>'kit' IS NOT NULL THEN NOW() ELSE kit_purchased_at END
             WHERE id = $2`,
            [orderTotal, userId, JSON.stringify(orderDetails || {})]
        );

        // Creditar comissao de indicacao
        await creditReferralCommission(orderId, userId, orderTotal);

        // Ativar indicacao se for primeiro pedido
        const activatedRef = await db.query(
            "UPDATE referrals SET status = 'active', activated_at = NOW() WHERE referred_id = $1 AND status = 'pending' RETURNING referrer_id",
            [userId]
        );

        // Email: notificar referrer sobre nova indicacao ativa
        if (activatedRef.rows.length > 0) {
            try {
                const refId = activatedRef.rows[0].referrer_id;
                const { rows: refUser } = await db.query('SELECT email, name FROM users WHERE id = $1', [refId]);
                const { rows: buyerUser } = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
                if (refUser.length > 0) {
                    emailService.sendNewReferralEmail(refUser[0].email, refUser[0].name, buyerUser[0]?.name || 'novo usuario').catch(() => {});
                }
            } catch (e) { /* fire-and-forget */ }
        }

        // Coupon integration: se pedido tem cupom, creditar comissao ao afiliado do cupom
        try {
            const couponCode = orderDetails?.coupon_code;
            if (couponCode) {
                const { rows: couponRows } = await db.query(
                    "SELECT id, affiliate_user_id, discount_type, discount_value FROM affiliate_coupons WHERE code = $1 AND active = true",
                    [couponCode]
                );
                if (couponRows.length > 0) {
                    const coupon = couponRows[0];
                    await db.query('UPDATE affiliate_coupons SET current_uses = current_uses + 1 WHERE id = $1', [coupon.id]);
                    const couponCommission = orderTotal * 0.05;
                    if (couponCommission > 0 && coupon.affiliate_user_id) {
                        await db.query(
                            `INSERT INTO commissions (user_id, source_user_id, order_id, type, amount, rate, status, credited_at)
                             VALUES ($1, $2, $3, 'coupon', $4, 0.05, 'credited', NOW())`,
                            [coupon.affiliate_user_id, userId, orderId, couponCommission]
                        );
                        await db.query(
                            'UPDATE users SET commission_balance = commission_balance + $1 WHERE id = $2',
                            [couponCommission, coupon.affiliate_user_id]
                        );
                    }
                }
            }
        } catch (e) { console.error('Erro ao processar cupom:', e); }

        // Recalcular nivel
        await recalculateUserLevel(userId);

        // Checar conquistas
        await checkAndGrantAchievements(userId);

        // Award points for purchase
        const purchasePoints = Math.floor(orderTotal / 10);
        if (purchasePoints > 0) {
            await db.query('UPDATE users SET points = points + $1 WHERE id = $2', [purchasePoints, userId]);
            await db.query(
                'INSERT INTO points_ledger (user_id, points, type, description, reference_id) VALUES ($1, $2, $3, $4, $5)',
                [userId, purchasePoints, 'purchase', 'Pontos por compra', String(orderId)]
            );
        }

        // Disparar webhook order_paid
        dispatchWebhooks('order_paid', { order_id: orderId, user_id: userId, total: orderTotal, details: orderDetails }).catch(() => {});

        // Criar/atualizar pedido no WooCommerce com dados finais (apos pagamento confirmado)
        try {
            await createOrUpdateWCOrder(orderId);
        } catch (wcErr) {
            console.error(`[WC Order] Erro ao criar/atualizar WC order para pedido ${orderId}:`, wcErr.message);
        }
    } catch (e) {
        console.error('Erro em processPostPaymentLogic:', e);
    }
}

// Disparar webhooks para um evento (fire-and-forget)
async function dispatchWebhooks(eventType, payload) {
    try {
        const { rows: webhooks } = await db.query(
            'SELECT * FROM webhook_configurations WHERE active = true AND $1 = ANY(events)',
            [eventType]
        );
        if (webhooks.length === 0) return;

        const promises = webhooks.map(async (wh) => {
            try {
                const response = await axios.post(wh.url, {
                    event: eventType,
                    timestamp: new Date().toISOString(),
                    data: payload
                }, { timeout: 10000 });
                await db.query(
                    'UPDATE webhook_configurations SET last_triggered_at = NOW(), last_status_code = $1, last_error = NULL WHERE id = $2',
                    [response.status, wh.id]
                );
            } catch (err) {
                const statusCode = err.response?.status || null;
                const errorMsg = err.message || 'Erro desconhecido';
                await db.query(
                    'UPDATE webhook_configurations SET last_triggered_at = NOW(), last_status_code = $1, last_error = $2 WHERE id = $3',
                    [statusCode, errorMsg, wh.id]
                ).catch(() => {});
            }
        });
        await Promise.allSettled(promises);
    } catch (e) {
        console.error('Erro ao disparar webhooks:', e);
    }
}

async function creditReferralCommission(orderId, buyerUserId, orderTotal) {
    const { rows } = await db.query('SELECT referred_by FROM users WHERE id = $1', [buyerUserId]);
    if (rows.length === 0 || !rows[0].referred_by) return;

    const referrerId = rows[0].referred_by;

    // Check if first order of this buyer
    const orderCountResult = await db.query(
        "SELECT COUNT(*) as cnt FROM orders WHERE user_id = $1 AND status IN ('completed','processing','paid')",
        [buyerUserId]
    );
    const orderCount = parseInt(orderCountResult.rows[0].cnt);

    // 5% first order, 1% recurring
    const rate = orderCount <= 1 ? 0.05 : 0.01;
    const amount = orderTotal * rate;

    if (amount <= 0) return;

    // Create commission
    await db.query(
        `INSERT INTO commissions (user_id, source_user_id, order_id, type, amount, rate, status, credited_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'credited', NOW())`,
        [referrerId, buyerUserId, orderId, 'referral', amount, rate]
    );

    // Credit balance
    await db.query(
        'UPDATE users SET commission_balance = commission_balance + $1 WHERE id = $2',
        [amount, referrerId]
    );

    // Email: notificar afiliado sobre comissao
    try {
        const { rows: referrerRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [referrerId]);
        if (referrerRows.length > 0) {
            emailService.sendCommissionEarnedEmail(referrerRows[0].email, referrerRows[0].name, amount, orderId).catch(() => {});
        }
    } catch (e) { /* fire-and-forget */ }

    // Award points for commission
    await db.query(
        'INSERT INTO points_ledger (user_id, points, type, description, reference_id) VALUES ($1, $2, $3, $4, $5)',
        [referrerId, Math.floor(amount), 'commission', `Comissao de indicacao`, String(orderId)]
    );
    await db.query('UPDATE users SET points = points + $1 WHERE id = $2', [Math.floor(amount), referrerId]);
}

// =============================================
// ROTA DE TESTE
// =============================================

app.get('/', (req, res) => {
    res.json({ message: 'Revenda Pelg API Running' });
});

// =============================================
// SYNC — Sincronizar dados do usuario com central
// =============================================

app.post('/users/sync', authenticateToken, async (req, res) => {
    const { name, telefone, foto, document_type, cpf, cnpj, company_name,
            profession, profession_other, approval_status, role } = req.body;

    try {
        const { rows } = await db.query(
            `UPDATE users SET
                name = COALESCE($1, name),
                telefone = COALESCE($2, telefone),
                foto = COALESCE($3, foto),
                document_type = COALESCE($4, document_type),
                cpf = COALESCE($5, cpf),
                cnpj = COALESCE($6, cnpj),
                company_name = COALESCE($7, company_name),
                profession = COALESCE($8, profession),
                profession_other = COALESCE($9, profession_other),
                approval_status = COALESCE($10, approval_status),
                role = COALESCE($11, role),
                updated_at = NOW()
             WHERE id = $12 RETURNING *`,
            [name, telefone, foto, document_type, cpf, cnpj, company_name,
             profession, profession_other, approval_status, role, req.user.id]
        );

        // Disparar webhook user_registered
        const u = rows[0];
        dispatchWebhooks('user_registered', { user_id: u.id, name: u.name, email: u.email, telefone: u.telefone }).catch(() => {});

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao sincronizar usuario' });
    }
});

// =============================================
// USER PROFILE ROUTES
// =============================================

app.get('/users/me', authenticateToken, async (req, res) => {
    try {
        // Try full query with new columns first
        try {
            const { rows } = await db.query(
                `SELECT id, name, email, role, telefone, foto, document_type, cpf, cnpj, company_name, profession, approval_status, rejection_reason, created_at,
                 level, commission_balance, referral_code, has_purchased_kit, first_order_completed, points, total_accumulated,
                 affiliate_type, affiliate_status, affiliate_level, affiliate_sales_count, email_verified
                 FROM users WHERE id = $1`,
                [req.user.id]
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });
            return res.json(rows[0]);
        } catch (queryErr) {
            // Fallback: columns may not exist yet (setup_db not run)
            console.warn('Full user query failed, using basic columns:', queryErr.message);
            const { rows } = await db.query(
                `SELECT id, name, email, role, telefone, foto, document_type, cpf, cnpj, company_name, profession, approval_status, rejection_reason, created_at
                 FROM users WHERE id = $1`,
                [req.user.id]
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });
            // Add defaults for missing columns
            const user = rows[0];
            user.level = 'bronze';
            user.commission_balance = 0;
            user.referral_code = null;
            user.has_purchased_kit = false;
            user.first_order_completed = false;
            user.points = 0;
            user.total_accumulated = 0;
            user.affiliate_type = null;
            user.affiliate_status = null;
            user.affiliate_level = null;
            user.affiliate_sales_count = 0;
            user.email_verified = true;
            return res.json(user);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar usuario' });
    }
});

app.get('/users/me/level', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT level, total_accumulated, quarter_accumulated, last_purchase_date, level_updated_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });

        const user = rows[0];
        const currentLevel = user.level || 'bronze';
        const config = LEVEL_CONFIG[currentLevel];

        let nextLevel = null;
        let progressPercent = 100;
        let amountToNext = 0;

        if (currentLevel === 'bronze') {
            nextLevel = 'prata';
            amountToNext = Math.max(0, 5000 - (parseFloat(user.total_accumulated) || 0));
            progressPercent = Math.min(100, ((parseFloat(user.total_accumulated) || 0) / 5000) * 100);
        } else if (currentLevel === 'prata') {
            nextLevel = 'ouro';
            amountToNext = Math.max(0, 10000 - (parseFloat(user.quarter_accumulated) || 0));
            progressPercent = Math.min(100, ((parseFloat(user.quarter_accumulated) || 0) / 10000) * 100);
        }

        let daysUntilDowngrade = null;
        if (user.last_purchase_date) {
            const lastPurchase = new Date(user.last_purchase_date);
            const deadline = new Date(lastPurchase.getTime() + INACTIVITY_DAYS * 24 * 60 * 60 * 1000);
            daysUntilDowngrade = Math.max(0, Math.ceil((deadline - new Date()) / (24 * 60 * 60 * 1000)));
        }

        res.json({
            level: currentLevel,
            levelName: config.name,
            discount: config.discount,
            totalAccumulated: parseFloat(user.total_accumulated) || 0,
            quarterAccumulated: parseFloat(user.quarter_accumulated) || 0,
            nextLevel,
            nextLevelName: nextLevel ? LEVEL_CONFIG[nextLevel].name : null,
            amountToNext,
            progressPercent,
            daysUntilDowngrade,
            lastPurchaseDate: user.last_purchase_date
        });
    } catch (err) {
        // Columns may not exist yet
        if (err.message && err.message.includes('does not exist')) {
            return res.json({
                level: 'bronze',
                levelName: 'Bronze',
                discount: 0.30,
                totalAccumulated: 0,
                quarterAccumulated: 0,
                nextLevel: 'prata',
                nextLevelName: 'Prata',
                amountToNext: 5000,
                progressPercent: 0,
                daysUntilDowngrade: null,
                lastPurchaseDate: null
            });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar nivel' });
    }
});

app.get('/users/me/kit-status', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT has_purchased_kit, kit_type, kit_purchased_at, first_order_completed FROM users WHERE id = $1',
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.json({ has_purchased_kit: false, kit_type: null, kit_purchased_at: null, first_order_completed: false });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar status do kit' });
    }
});

app.post('/users/me/request-approval', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            "UPDATE users SET approval_status = 'pending', rejection_reason = NULL, updated_at = NOW() WHERE id = $1 AND approval_status IN ('rejected', 'suspended') RETURNING id, approval_status",
            [req.user.id]
        );
        if (rows.length === 0) return res.status(400).json({ message: 'Nao e possivel solicitar aprovacao' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao solicitar aprovacao' });
    }
});

app.put('/users/me', authenticateToken, async (req, res) => {
    const { name, telefone, foto, document_type, cpf, cnpj, company_name, profession, profession_other } = req.body;

    try {
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (name !== undefined) { paramCount++; updates.push(`name = $${paramCount}`); values.push(name); }
        if (telefone !== undefined) { paramCount++; updates.push(`telefone = $${paramCount}`); values.push(telefone); }
        if (foto !== undefined) { paramCount++; updates.push(`foto = $${paramCount}`); values.push(foto); }
        if (document_type !== undefined) { paramCount++; updates.push(`document_type = $${paramCount}`); values.push(document_type); }
        if (cpf !== undefined) { paramCount++; updates.push(`cpf = $${paramCount}`); values.push(cpf); }
        if (cnpj !== undefined) { paramCount++; updates.push(`cnpj = $${paramCount}`); values.push(cnpj); }
        if (company_name !== undefined) { paramCount++; updates.push(`company_name = $${paramCount}`); values.push(company_name); }
        if (profession !== undefined) { paramCount++; updates.push(`profession = $${paramCount}`); values.push(profession); }
        if (profession_other !== undefined) { paramCount++; updates.push(`profession_other = $${paramCount}`); values.push(profession_other); }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Nenhum campo para atualizar' });
        }

        paramCount++;
        updates.push(`updated_at = NOW()`);
        values.push(req.user.id);

        const { rows } = await db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, role, telefone, foto, document_type, cpf, cnpj, company_name, profession, profession_other, approval_status`,
            values
        );

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar perfil' });
    }
});

// DELETE account (self)
app.delete('/users/me', authenticateToken, async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const uid = req.user.id;
        // Remove FK references that don't CASCADE
        await client.query('UPDATE orders SET user_id = NULL WHERE user_id = $1', [uid]);
        await client.query('UPDATE commissions SET source_user_id = NULL WHERE source_user_id = $1', [uid]);
        await client.query('UPDATE users SET referred_by = NULL WHERE referred_by = $1', [uid]);
        // Delete user (CASCADE handles addresses, verification_codes, abandoned_carts, referrals, commissions, level_history, etc.)
        await client.query('DELETE FROM users WHERE id = $1', [uid]);
        await client.query('COMMIT');
        res.json({ message: 'Conta excluida com sucesso' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Erro ao excluir conta' });
    } finally {
        client.release();
    }
});

// =============================================
// PRODUCTS ROUTES
// =============================================

// Public: list active products
app.get('/products', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM products WHERE active = true ORDER BY sort_order ASC, name ASC');
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.json([]);
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar produtos' });
    }
});

// Admin: list all products
app.get('/admin/products', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM products ORDER BY active DESC, sort_order ASC, name ASC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar produtos' });
    }
});

// Admin: update product (editable fields: description, active, sort_order, special_discount, is_kit)
app.put('/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { description, active, sort_order, special_discount, is_kit } = req.body;
    try {
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (description !== undefined) { paramCount++; updates.push(`description = $${paramCount}`); values.push(description); }
        if (active !== undefined) { paramCount++; updates.push(`active = $${paramCount}`); values.push(active); }
        if (sort_order !== undefined) { paramCount++; updates.push(`sort_order = $${paramCount}`); values.push(parseInt(sort_order) || 0); }
        if (special_discount !== undefined) { paramCount++; updates.push(`special_discount = $${paramCount}`); values.push(special_discount ? parseFloat(special_discount) : null); }
        if (is_kit !== undefined) { paramCount++; updates.push(`is_kit = $${paramCount}`); values.push(is_kit); }

        if (updates.length === 0) return res.status(400).json({ message: 'Nenhum campo para atualizar' });

        updates.push(`updated_at = NOW()`);
        paramCount++;
        values.push(req.params.id);

        const { rows } = await db.query(
            `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Produto nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar produto' });
    }
});

// Admin: toggle kit status
app.put('/admin/products/:id/toggle-kit', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(
            `UPDATE products SET is_kit = NOT COALESCE(is_kit, false), updated_at = NOW() WHERE id = $1 RETURNING *`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Produto nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao alternar kit' });
    }
});

// Admin: list WooCommerce products
app.get('/admin/woocommerce/products', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const wcProducts = await woocommerceService.listProducts({ status: 'publish' });
        const simplified = wcProducts.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            regular_price: p.regular_price,
            stock_quantity: p.stock_quantity,
            stock_status: p.stock_status,
            sku: p.sku,
            image: p.images?.[0]?.src || null,
            permalink: p.permalink
        }));
        res.json(simplified);
    } catch (err) {
        console.error('Erro ao listar produtos WC:', err.message);
        res.status(500).json({ message: 'Erro ao buscar produtos do WooCommerce' });
    }
});

// Helper: strip HTML tags and decode entities
function stripHtml(html) {
    if (!html) return '';
    let text = html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&[a-zA-Z]+;/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Truncate at ~200 chars, cutting only at . or !
    if (text.length > 200) {
        const cutRegion = text.substring(0, 250);
        const lastDot = cutRegion.lastIndexOf('. ');
        const lastExcl = cutRegion.lastIndexOf('! ');
        const lastBreak = Math.max(lastDot, lastExcl);
        if (lastBreak > 80) {
            text = text.substring(0, lastBreak + 1).trim();
        } else {
            // No sentence end found — cut at last space before 200
            const lastSpace = text.lastIndexOf(' ', 200);
            text = text.substring(0, lastSpace > 50 ? lastSpace : 200).trim();
        }
    }

    return text;
}

// Admin: sync WooCommerce products to local DB
app.post('/admin/woocommerce/sync-products', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const wcProducts = await woocommerceService.listProducts({ status: 'publish', per_page: 100 });
        let imported = 0;
        let updated = 0;
        let skipped = 0;

        for (const wcp of wcProducts) {
            // Only import products with stock_status = 'instock'
            if (wcp.stock_status !== 'instock') {
                skipped++;
                continue;
            }

            const { rows: existing } = await db.query(
                'SELECT id, is_kit FROM products WHERE woo_product_id = $1',
                [wcp.id]
            );

            const image = wcp.images?.[0]?.src || null;
            const price = parseFloat(wcp.price) || parseFloat(wcp.regular_price) || 0;
            const description = stripHtml(wcp.short_description) || stripHtml(wcp.description) || '';

            // Auto-detect kit by category or tag containing "kit" (case-insensitive)
            const categories = (wcp.categories || []).map(c => c.name?.toLowerCase() || '');
            const tags = (wcp.tags || []).map(t => t.name?.toLowerCase() || '');
            const isKit = categories.some(c => c.includes('kit')) || tags.some(t => t.includes('kit'));

            if (existing.length > 0) {
                // Preserve manually-set is_kit unless auto-detected as kit
                // Do NOT overwrite description — it may have been manually edited
                const keepKit = existing[0].is_kit || isKit;
                await db.query(
                    `UPDATE products SET name = $1, table_price = $2, image = $3,
                     sku = $4, reference_url = $5, is_kit = $6, updated_at = NOW() WHERE woo_product_id = $7`,
                    [wcp.name, price, image, wcp.sku || null, wcp.permalink || null, keepKit, wcp.id]
                );
                updated++;
            } else {
                await db.query(
                    `INSERT INTO products (name, description, table_price, image, reference_url, sku, woo_product_id, active, sort_order, is_kit)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, true, 0, $8)`,
                    [wcp.name, description, price, image, wcp.permalink || null, wcp.sku || null, wcp.id, isKit]
                );
                imported++;
            }
        }

        res.json({ success: true, imported, updated, skipped, total: wcProducts.length });
    } catch (err) {
        console.error('Erro ao sincronizar produtos WC:', err.message);
        res.status(500).json({ message: 'Erro ao sincronizar produtos' });
    }
});

// Admin: sync stock from Bling
app.post('/admin/bling/sync-stock', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get Bling access token
        const { rows: intRows } = await db.query(
            "SELECT credentials FROM integrations WHERE integration_type = 'bling' AND active = true"
        );
        if (intRows.length === 0) {
            return res.status(400).json({ message: 'Integracao Bling nao configurada' });
        }
        let accessToken = intRows[0].credentials?.access_token;
        if (!accessToken) {
            return res.status(400).json({ message: 'Bling nao autorizado. Autorize primeiro nas Conexoes.' });
        }

        // Check if token is expired and refresh if needed
        const expiresAt = intRows[0].credentials?.token_expires_at ? new Date(intRows[0].credentials.token_expires_at) : null;
        if (expiresAt && expiresAt.getTime() < Date.now()) {
            accessToken = await refreshBlingToken('bling');
        }

        // Get all local products with SKU
        const { rows: localProducts } = await db.query('SELECT id, sku FROM products WHERE sku IS NOT NULL AND sku != \'\'');
        if (localProducts.length === 0) {
            return res.json({ success: true, updated: 0, message: 'Nenhum produto com SKU para sincronizar' });
        }

        // Build local SKU -> product ID map
        const skuMap = {};
        for (const p of localProducts) {
            skuMap[p.sku] = p.id;
        }

        // Fetch ALL products from Bling with pagination
        let allBlingProducts = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const resp = await axios.get('https://www.bling.com.br/Api/v3/produtos', {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                params: { pagina: page, limite: 100 }
            });

            const blingProducts = resp.data?.data || [];
            allBlingProducts = allBlingProducts.concat(blingProducts);

            hasMore = blingProducts.length === 100;
            page++;

            if (page > 50) break; // Safety limit
        }

        // Match by SKU (codigo in Bling) and update stock
        let updatedCount = 0;

        for (const bp of allBlingProducts) {
            const codigo = bp.codigo || '';
            if (codigo && skuMap[codigo] !== undefined) {
                const stock = bp.estoque?.saldoVirtualTotal || 0;
                await db.query('UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2', [stock, skuMap[codigo]]);
                updatedCount++;
            }
        }

        res.json({ success: true, updated: updatedCount, blingTotal: allBlingProducts.length, total: localProducts.length });
    } catch (err) {
        console.error('Erro ao sincronizar estoque Bling:', err.message);
        res.status(500).json({ message: 'Erro ao sincronizar estoque do Bling' });
    }
});

// =============================================
// KITS ROUTES
// =============================================

app.get('/kits', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM products WHERE active = true AND is_kit = true ORDER BY name ASC');
        // Map to KitSelector-compatible format
        const kits = rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.sku || p.name.toLowerCase().replace(/\s+/g, '-'),
            price: parseFloat(p.table_price),
            description: p.description,
            features: p.kit_features || [],
            image: p.image,
            woo_product_id: p.woo_product_id
        }));
        res.json(kits);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.json([]);
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar kits' });
    }
});

// =============================================
// REFERRAL ROUTES (Public)
// =============================================

app.get('/referral/validate/:code', async (req, res) => {
    try {
        const { rows } = await db.query(
            "SELECT id, name, referral_code FROM users WHERE referral_code = $1 AND approval_status = 'approved'",
            [req.params.code.toUpperCase()]
        );
        if (rows.length === 0) return res.status(404).json({ valid: false, message: 'Codigo invalido' });
        res.json({ valid: true, referrerName: rows[0].name });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.status(404).json({ valid: false, message: 'Codigo invalido' });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao validar codigo' });
    }
});

// =============================================
// REFERRAL TRACKING (Public)
// =============================================

// Track visit from referral link
app.post('/referral/track-visit', async (req, res) => {
    try {
        const { referralCode, pageUrl } = req.body;
        if (!referralCode) return res.status(400).json({ message: 'referralCode obrigatorio' });

        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
        const userAgent = req.headers['user-agent'] || '';

        // Deduplicate: ignore same IP + code within 24h
        const { rows: recent } = await db.query(
            `SELECT id FROM affiliate_visits WHERE referral_code = $1 AND ip_address = $2 AND created_at > NOW() - INTERVAL '24 hours'`,
            [referralCode.toUpperCase(), ip]
        );
        if (recent.length > 0) return res.json({ tracked: false, reason: 'duplicate' });

        // Find affiliate user
        const { rows: affRows } = await db.query('SELECT id FROM users WHERE referral_code = $1', [referralCode.toUpperCase()]);
        const affiliateUserId = affRows.length > 0 ? affRows[0].id : null;

        await db.query(
            'INSERT INTO affiliate_visits (affiliate_user_id, referral_code, ip_address, user_agent, page_url) VALUES ($1, $2, $3, $4, $5)',
            [affiliateUserId, referralCode.toUpperCase(), ip, userAgent, pageUrl || '']
        );
        res.json({ tracked: true });
    } catch (err) {
        console.error('Erro ao rastrear visita:', err);
        res.json({ tracked: false });
    }
});

// Mark visit as converted when user registers
app.post('/referral/mark-conversion', async (req, res) => {
    try {
        const { referralCode, referredUserId } = req.body;
        if (!referralCode) return res.json({ converted: false });

        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

        await db.query(
            `UPDATE affiliate_visits SET converted = true, referred_user_id = $1
             WHERE referral_code = $2 AND ip_address = $3 AND converted = false
             ORDER BY created_at DESC LIMIT 1`,
            [referredUserId || null, referralCode.toUpperCase(), ip]
        );
        res.json({ converted: true });
    } catch (err) {
        console.error('Erro ao marcar conversao:', err);
        res.json({ converted: false });
    }
});

// =============================================
// REFERRAL ROUTES (Authenticated)
// =============================================

app.get('/users/me/referral-code', authenticateToken, async (req, res) => {
    try {
        let { rows } = await db.query('SELECT referral_code, name FROM users WHERE id = $1', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });

        let code = rows[0].referral_code;
        if (!code) {
            code = generateReferralCode(rows[0].name);
            // Ensure uniqueness
            let attempts = 0;
            while (attempts < 5) {
                try {
                    await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, req.user.id]);
                    break;
                } catch (e) {
                    code = generateReferralCode(rows[0].name);
                    attempts++;
                }
            }
        }

        res.json({ referralCode: code });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.json({ referralCode: null });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao gerar codigo de indicacao' });
    }
});

app.get('/users/me/referrals', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT r.*, u.name as referred_name, u.email as referred_email, u.created_at as referred_since
             FROM referrals r JOIN users u ON r.referred_id = u.id
             WHERE r.referrer_id = $1 ORDER BY r.created_at DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        // Table may not exist yet if setup_db hasn't been run
        if (err.message && err.message.includes('does not exist')) {
            return res.json([]);
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar indicacoes' });
    }
});

app.get('/users/me/commissions', authenticateToken, async (req, res) => {
    try {
        const { rows: commissions } = await db.query(
            `SELECT c.*, u.name as source_name
             FROM commissions c LEFT JOIN users u ON c.source_user_id = u.id
             WHERE c.user_id = $1 ORDER BY c.created_at DESC`,
            [req.user.id]
        );

        const { rows: balanceRows } = await db.query(
            'SELECT commission_balance FROM users WHERE id = $1',
            [req.user.id]
        );

        res.json({
            balance: parseFloat(balanceRows[0]?.commission_balance) || 0,
            commissions
        });
    } catch (err) {
        // Tables/columns may not exist yet if setup_db hasn't been run
        if (err.message && err.message.includes('does not exist')) {
            return res.json({ balance: 0, commissions: [] });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar comissoes' });
    }
});

app.post('/users/me/commissions/apply', authenticateToken, async (req, res) => {
    const { amount } = req.body;

    try {
        const { rows } = await db.query('SELECT commission_balance FROM users WHERE id = $1', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });

        const balance = parseFloat(rows[0].commission_balance) || 0;
        if (amount > balance) {
            return res.status(400).json({ message: 'Saldo insuficiente' });
        }

        await db.query(
            'UPDATE users SET commission_balance = commission_balance - $1 WHERE id = $2',
            [amount, req.user.id]
        );

        res.json({ applied: amount, newBalance: balance - amount });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.status(400).json({ message: 'Saldo insuficiente' });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao aplicar credito' });
    }
});

// =============================================
// ACHIEVEMENTS & POINTS ROUTES
// =============================================

app.get('/users/me/achievements', authenticateToken, async (req, res) => {
    try {
        const { rows: all } = await db.query('SELECT * FROM achievements ORDER BY category, threshold_value');
        const { rows: earned } = await db.query(
            'SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = $1',
            [req.user.id]
        );
        const earnedMap = {};
        earned.forEach(e => { earnedMap[e.achievement_id] = e.earned_at; });

        const achievements = all.map(a => ({
            ...a,
            earned: !!earnedMap[a.id],
            earned_at: earnedMap[a.id] || null
        }));

        res.json(achievements);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.json([]);
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar conquistas' });
    }
});

app.get('/users/me/points', authenticateToken, async (req, res) => {
    try {
        const { rows: userRows } = await db.query('SELECT points FROM users WHERE id = $1', [req.user.id]);
        const { rows: ledger } = await db.query(
            'SELECT * FROM points_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );
        res.json({
            total: userRows[0]?.points || 0,
            history: ledger
        });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.json({ total: 0, history: [] });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar pontos' });
    }
});

// =============================================
// RANKINGS ROUTES
// =============================================

app.get('/rankings/top-sellers', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT u.id, u.name, u.level, COUNT(o.id) as order_count, SUM(o.total) as total_sales
            FROM users u
            JOIN orders o ON o.user_id = u.id AND o.status IN ('completed','processing','paid')
            AND o.created_at >= date_trunc('month', CURRENT_DATE)
            GROUP BY u.id, u.name, u.level
            ORDER BY total_sales DESC
            LIMIT 20
        `);
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar ranking' });
    }
});

app.get('/rankings/top-referrers', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT u.id, u.name, u.level, COUNT(r.id) as referral_count
            FROM users u
            JOIN referrals r ON r.referrer_id = u.id AND r.status = 'active'
            AND r.activated_at >= date_trunc('quarter', CURRENT_DATE)
            GROUP BY u.id, u.name, u.level
            ORDER BY referral_count DESC
            LIMIT 20
        `);
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar ranking' });
    }
});

app.get('/rankings/top-engagement', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT u.id, u.name, u.level, u.points
            FROM users u
            WHERE u.points > 0
            ORDER BY u.points DESC
            LIMIT 20
        `);
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar ranking' });
    }
});

// =============================================
// RESELLER DASHBOARD ROUTES
// =============================================

app.get('/users/me/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const [userResult, ordersResult, monthResult, commissionsResult, referralsResult, achievementsResult] = await Promise.all([
            db.query('SELECT level, points, commission_balance, total_accumulated, referral_code FROM users WHERE id = $1', [userId]),
            db.query("SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as total FROM orders WHERE user_id = $1 AND status IN ('completed','processing','paid')", [userId]),
            db.query("SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as total FROM orders WHERE user_id = $1 AND status IN ('completed','processing','paid') AND created_at >= date_trunc('month', CURRENT_DATE)", [userId]),
            db.query("SELECT COALESCE(SUM(amount),0) as total FROM commissions WHERE user_id = $1 AND status = 'credited'", [userId]),
            db.query("SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = $1 AND status = 'active'", [userId]),
            db.query('SELECT COUNT(*) as cnt FROM user_achievements WHERE user_id = $1', [userId])
        ]);

        const user = userResult.rows[0];
        res.json({
            level: user.level,
            levelDiscount: LEVEL_CONFIG[user.level || 'bronze'].discount,
            points: user.points,
            commissionBalance: parseFloat(user.commission_balance) || 0,
            totalAccumulated: parseFloat(user.total_accumulated) || 0,
            referralCode: user.referral_code,
            totalOrders: parseInt(ordersResult.rows[0].cnt),
            totalSales: parseFloat(ordersResult.rows[0].total),
            monthOrders: parseInt(monthResult.rows[0].cnt),
            monthSales: parseFloat(monthResult.rows[0].total),
            totalCommissions: parseFloat(commissionsResult.rows[0].total),
            activeReferrals: parseInt(referralsResult.rows[0].cnt),
            achievementsEarned: parseInt(achievementsResult.rows[0].cnt)
        });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.json({
                level: 'bronze', levelDiscount: 0.30, points: 0, commissionBalance: 0,
                totalAccumulated: 0, referralCode: null, totalOrders: 0, totalSales: 0,
                monthOrders: 0, monthSales: 0, totalCommissions: 0, activeReferrals: 0, achievementsEarned: 0
            });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar dashboard' });
    }
});

app.get('/users/me/sales-history', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const { rows } = await db.query(
            "SELECT id, order_number, total, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            [req.user.id, Number(limit), offset]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar historico' });
    }
});

app.get('/users/me/commission-history', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const { rows } = await db.query(
            `SELECT c.*, u.name as source_name FROM commissions c LEFT JOIN users u ON c.source_user_id = u.id
             WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`,
            [req.user.id, Number(limit), offset]
        );
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar historico de comissoes' });
    }
});

// =============================================
// AFFILIATE ROUTES
// =============================================

app.post('/affiliate/register', authenticateToken, async (req, res) => {
    const { type } = req.body; // influencer_pro, renda_extra, gratuito

    if (!AFFILIATE_CONFIG[type]) {
        return res.status(400).json({ message: 'Tipo de afiliado invalido' });
    }

    try {
        const { rows } = await db.query('SELECT affiliate_status FROM users WHERE id = $1', [req.user.id]);
        if (rows[0]?.affiliate_status === 'active') {
            return res.status(400).json({ message: 'Voce ja e um afiliado ativo' });
        }

        await db.query(
            `UPDATE users SET affiliate_type = $1, affiliate_status = 'active', affiliate_level = 'conhecedor', affiliate_sales_count = 0, updated_at = NOW() WHERE id = $2`,
            [type, req.user.id]
        );

        // Generate referral code if doesn't exist
        const codeResult = await db.query('SELECT referral_code, name FROM users WHERE id = $1', [req.user.id]);
        if (!codeResult.rows[0].referral_code) {
            const code = generateReferralCode(codeResult.rows[0].name);
            await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, req.user.id]);
        }

        res.json({ message: 'Afiliado registrado com sucesso', type });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.status(500).json({ message: 'Sistema de afiliados ainda nao configurado. Execute setup_db primeiro.' });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao registrar afiliado' });
    }
});

app.get('/affiliate/me', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT affiliate_type, affiliate_status, affiliate_level, affiliate_sales_count, referral_code, commission_balance FROM users WHERE id = $1',
            [req.user.id]
        );
        if (rows.length === 0 || !rows[0].affiliate_type) {
            return res.status(404).json({ message: 'Nao e afiliado' });
        }

        const user = rows[0];
        const config = AFFILIATE_CONFIG[user.affiliate_type] || {};
        const levelConfig = AFFILIATE_LEVELS[user.affiliate_level] || AFFILIATE_LEVELS.conhecedor;

        res.json({
            ...user,
            typeName: config.name,
            commissions: config.commissions,
            levelName: levelConfig.name,
            bonus: levelConfig.bonus,
            nextLevel: user.affiliate_level === 'conhecedor' ? 'to_gostando' : user.affiliate_level === 'to_gostando' ? 'associado' : null
        });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.status(404).json({ message: 'Nao e afiliado' });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar perfil afiliado' });
    }
});

app.get('/affiliate/dashboard', authenticateToken, async (req, res) => {
    try {
        const { rows: userRows } = await db.query(
            'SELECT affiliate_type, affiliate_level, affiliate_sales_count, commission_balance, referral_code FROM users WHERE id = $1',
            [req.user.id]
        );
        if (!userRows[0]?.affiliate_type) return res.status(404).json({ message: 'Nao e afiliado' });

        const [commissionsResult, referralsResult, monthResult] = await Promise.all([
            db.query("SELECT COALESCE(SUM(amount),0) as total FROM commissions WHERE user_id = $1 AND type = 'affiliate'", [req.user.id]),
            db.query("SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = $1 AND status = 'active'", [req.user.id]),
            db.query("SELECT COALESCE(SUM(amount),0) as total FROM commissions WHERE user_id = $1 AND type = 'affiliate' AND created_at >= date_trunc('month', CURRENT_DATE)", [req.user.id])
        ]);

        res.json({
            ...userRows[0],
            totalCommissions: parseFloat(commissionsResult.rows[0].total),
            monthCommissions: parseFloat(monthResult.rows[0].total),
            activeReferrals: parseInt(referralsResult.rows[0].cnt)
        });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.status(404).json({ message: 'Nao e afiliado' });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar dashboard afiliado' });
    }
});

// =============================================
// ADDRESSES ROUTES
// =============================================

app.get('/addresses', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar enderecos' });
    }
});

app.post('/addresses', authenticateToken, async (req, res) => {
    const { nickname, cep, street, number, complement, neighborhood, city, state, is_default } = req.body;

    try {
        if (is_default) {
            await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
        }

        const { rows } = await db.query(
            `INSERT INTO addresses (user_id, nickname, cep, street, number, complement, neighborhood, city, state, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [req.user.id, nickname, cep, street, number, complement || '', neighborhood, city, state, is_default || false]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar endereco' });
    }
});

app.put('/addresses/:id', authenticateToken, async (req, res) => {
    const { nickname, cep, street, number, complement, neighborhood, city, state, is_default } = req.body;

    try {
        if (is_default) {
            await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
        }

        const { rows } = await db.query(
            `UPDATE addresses SET nickname = $1, cep = $2, street = $3, number = $4, complement = $5, neighborhood = $6, city = $7, state = $8, is_default = $9, updated_at = NOW()
             WHERE id = $10 AND user_id = $11 RETURNING *`,
            [nickname, cep, street, number, complement || '', neighborhood, city, state, is_default || false, req.params.id, req.user.id]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Endereco nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar endereco' });
    }
});

app.delete('/addresses/:id', authenticateToken, async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM addresses WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (rowCount === 0) return res.status(404).json({ message: 'Endereco nao encontrado' });
        res.json({ message: 'Endereco removido' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao remover endereco' });
    }
});

// =============================================
// ORDERS ROUTES
// =============================================

app.get('/orders', authenticateToken, async (req, res) => {
    try {
        const { status } = req.query;
        let query = `SELECT o.*,
            a.nickname as addr_nickname, a.street as addr_street, a.number as addr_number,
            a.complement as addr_complement, a.neighborhood as addr_neighborhood,
            a.city as addr_city, a.state as addr_state, a.cep as addr_cep
            FROM orders o LEFT JOIN addresses a ON o.address_id = a.id WHERE o.user_id = $1`;
        const params = [req.user.id];

        if (status) {
            query += ' AND o.status = $2';
            params.push(status);
        }

        query += ' ORDER BY o.created_at DESC';

        const { rows } = await db.query(query, params);

        // Montar objeto addresses para cada pedido
        const ordersWithAddress = rows.map(row => {
            const { addr_nickname, addr_street, addr_number, addr_complement, addr_neighborhood, addr_city, addr_state, addr_cep, ...order } = row;
            if (addr_street) {
                order.addresses = {
                    nickname: addr_nickname,
                    street: addr_street,
                    number: addr_number,
                    complement: addr_complement,
                    neighborhood: addr_neighborhood,
                    city: addr_city,
                    state: addr_state,
                    cep: addr_cep
                };
            }
            return order;
        });

        res.json(ordersWithAddress);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar pedidos' });
    }
});

app.get('/orders/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT o.*,
                a.nickname as addr_nickname, a.street as addr_street, a.number as addr_number,
                a.complement as addr_complement, a.neighborhood as addr_neighborhood,
                a.city as addr_city, a.state as addr_state, a.cep as addr_cep
             FROM orders o LEFT JOIN addresses a ON o.address_id = a.id
             WHERE o.id = $1 AND o.user_id = $2`,
            [req.params.id, req.user.id]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Pedido nao encontrado' });

        const { addr_nickname, addr_street, addr_number, addr_complement, addr_neighborhood, addr_city, addr_state, addr_cep, ...order } = rows[0];
        if (addr_street) {
            order.addresses = {
                nickname: addr_nickname,
                street: addr_street,
                number: addr_number,
                complement: addr_complement,
                neighborhood: addr_neighborhood,
                city: addr_city,
                state: addr_state,
                cep: addr_cep
            };
        }
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar pedido' });
    }
});

app.post('/orders', authenticateToken, async (req, res) => {
    const { order_number, details, payment_method, installments, total, address_id, kit_id, commission_credit } = req.body;

    try {
        // Buscar dados completos do usuario
        const { rows: userRows } = await db.query(
            'SELECT first_order_completed, has_purchased_kit, commission_balance, role, name, email, telefone, cpf, cnpj, document_type FROM users WHERE id = $1',
            [req.user.id]
        );
        const userStatus = userRows[0];
        const isFirstOrder = !userStatus.first_order_completed;
        const isAdmin = ['administrator', 'admin', 'manager'].includes(userStatus.role);

        // Validar kit obrigatorio para primeiro pedido (admin bypassa)
        if (!isAdmin && isFirstOrder && !kit_id) {
            return res.status(400).json({ message: 'Kit obrigatorio para o primeiro pedido' });
        }
        if (!isAdmin && !isFirstOrder && kit_id) {
            return res.status(400).json({ message: 'Kit disponivel apenas no primeiro pedido' });
        }

        // Validar pedido minimo - admin bypassa
        const productTotal = parseFloat(total) || 0;
        if (!isAdmin) {
            const minOrder = isFirstOrder ? MIN_ORDER_FIRST : MIN_ORDER_RECURRING;
            if (productTotal < minOrder) {
                return res.status(400).json({ message: `Pedido minimo de R$${minOrder} em produtos` });
            }
        }

        // Buscar kit se necessario (kits agora ficam na tabela products com is_kit = true)
        let kitData = null;
        let finalTotal = productTotal;
        if (kit_id) {
            const { rows: kitRows } = await db.query('SELECT * FROM products WHERE id = $1 AND is_kit = true AND active = true', [kit_id]);
            if (kitRows.length === 0) {
                // Fallback: tentar na tabela kits antiga
                const { rows: oldKitRows } = await db.query('SELECT * FROM kits WHERE id = $1 AND active = true', [kit_id]);
                if (oldKitRows.length === 0) return res.status(400).json({ message: 'Kit nao encontrado' });
                kitData = { id: oldKitRows[0].id, name: oldKitRows[0].name, slug: oldKitRows[0].slug, price: parseFloat(oldKitRows[0].price) };
            } else {
                kitData = { id: kitRows[0].id, name: kitRows[0].name, slug: kitRows[0].sku || kitRows[0].name, price: parseFloat(kitRows[0].table_price) };
            }
            finalTotal += kitData.price;
        }

        // Aplicar credito de comissao
        let creditApplied = 0;
        if (commission_credit && commission_credit > 0) {
            const balance = parseFloat(userStatus.commission_balance) || 0;
            creditApplied = Math.min(commission_credit, balance, finalTotal);
            if (creditApplied > 0) {
                finalTotal -= creditApplied;
                await db.query(
                    'UPDATE users SET commission_balance = commission_balance - $1 WHERE id = $2',
                    [creditApplied, req.user.id]
                );
            }
        }

        // Gravar pedido com kit e credito nos details
        const enrichedDetails = {
            ...details,
            kit: kitData ? { id: kitData.id, name: kitData.name, slug: kitData.slug, price: kitData.price } : null,
            commission_credit_applied: creditApplied
        };

        // Usar order_number temporario, sera substituido pelo numero WC
        const tempOrderNumber = order_number || `TEMP-${Date.now()}`;

        const { rows } = await db.query(
            `INSERT INTO orders (user_id, order_number, details, payment_method, installments, total, address_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [req.user.id, tempOrderNumber, JSON.stringify(enrichedDetails), payment_method, installments || 1, finalTotal, address_id]
        );

        const newOrder = rows[0];

        // Disparar webhook order_created
        dispatchWebhooks('order_created', { order_id: newOrder.id, order_number: newOrder.order_number, total: newOrder.total, user_id: newOrder.user_id, details: newOrder.details }).catch(() => {});

        // WC order sera criado somente apos pagamento confirmado (via createOrUpdateWCOrder)
        res.status(201).json(newOrder);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar pedido' });
    }
});

app.put('/orders/:id', authenticateToken, async (req, res) => {
    const { status, tracking_code, tracking_url, ipag_transaction_id, ipag_status, woocommerce_order_id, woocommerce_order_number, total, coupon_code, coupon_discount, address_id } = req.body;

    try {
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (status !== undefined) { paramCount++; updates.push(`status = $${paramCount}`); values.push(status); }
        if (total !== undefined) { paramCount++; updates.push(`total = $${paramCount}`); values.push(total); }
        if (address_id !== undefined) { paramCount++; updates.push(`address_id = $${paramCount}`); values.push(address_id); }
        if (tracking_code !== undefined) { paramCount++; updates.push(`tracking_code = $${paramCount}`); values.push(tracking_code); }
        if (tracking_url !== undefined) { paramCount++; updates.push(`tracking_url = $${paramCount}`); values.push(tracking_url); }
        if (ipag_transaction_id !== undefined) { paramCount++; updates.push(`ipag_transaction_id = $${paramCount}`); values.push(ipag_transaction_id); }
        if (ipag_status !== undefined) { paramCount++; updates.push(`ipag_status = $${paramCount}`); values.push(ipag_status); }
        if (woocommerce_order_id !== undefined) { paramCount++; updates.push(`woocommerce_order_id = $${paramCount}`); values.push(woocommerce_order_id); }
        if (woocommerce_order_number !== undefined) { paramCount++; updates.push(`woocommerce_order_number = $${paramCount}`); values.push(woocommerce_order_number); }
        if (coupon_code !== undefined) {
            paramCount++;
            updates.push(`details = jsonb_set(COALESCE(details, '{}')::jsonb, '{coupon_code}', $${paramCount}::jsonb)`);
            values.push(JSON.stringify(coupon_code));
        }
        if (coupon_discount !== undefined) {
            paramCount++;
            updates.push(`details = jsonb_set(COALESCE(details, '{}')::jsonb, '{coupon_discount}', $${paramCount}::jsonb)`);
            values.push(JSON.stringify(coupon_discount));
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = NOW()');
        paramCount++;
        values.push(req.params.id);
        paramCount++;
        values.push(req.user.id);

        const { rows } = await db.query(
            `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramCount - 1} AND user_id = $${paramCount} RETURNING *`,
            values
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Pedido nao encontrado' });

        // Se status mudou para paid/completed, processar logica pos-pagamento + criar WC order
        if (status && ['paid', 'completed', 'processing'].includes(status)) {
            const order = rows[0];
            const orderTotal = parseFloat(order.total) || 0;
            await processPostPaymentLogic(order.id, order.user_id, orderTotal, order.details);
            // WC order ja e criado/atualizado dentro de processPostPaymentLogic
        }

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar pedido' });
    }
});

app.delete('/orders/pending-orphans', authenticateToken, async (req, res) => {
    try {
        const { rowCount } = await db.query(
            "DELETE FROM orders WHERE user_id = $1 AND status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'",
            [req.user.id]
        );
        res.json({ message: `${rowCount} pedidos pendentes removidos` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao limpar pedidos' });
    }
});

// =============================================
// SYNC iPag payment status
// =============================================

app.post('/orders/:id/sync', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Pedido nao encontrado' });
        const order = rows[0];

        const txnId = order.gateway_transaction_id || order.ipag_transaction_id;
        if (!txnId) {
            return res.json({ synced: false, order });
        }

        let paymentStatus;

        // Usar gateway configurado se disponivel, senao fallback iPag
        if (order.payment_gateway_id && order.gateway_type) {
            const gw = await billingService.getGatewayById(order.payment_gateway_id);
            if (gw) {
                const gwService = gatewayRouter.getGateway(gw.gateway_type);
                if (gwService) {
                    paymentStatus = await gwService.verifyPaymentStatus(txnId, gw.credentials);
                }
            }
        }

        if (!paymentStatus) {
            // Fallback iPag
            paymentStatus = await ipagService.verifyPaymentStatus(txnId);
        }

        const statusLabel = paymentStatus.ipag_status || paymentStatus.gateway_status || paymentStatus.status;
        console.log(`Sync order ${order.id}: status = ${statusLabel}, isPaid = ${paymentStatus.status === 'paid'}`);

        // Atualizar status
        await db.query(
            'UPDATE orders SET ipag_status = $1, gateway_status = $1, updated_at = NOW() WHERE id = $2',
            [statusLabel, order.id]
        );

        // Se pago e pedido ainda pending ou failed -> marcar como paid + processar pos-pagamento
        if (paymentStatus.status === 'paid' && (order.status === 'pending' || order.status === 'failed')) {
            await db.query(
                "UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1",
                [order.id]
            );

            const orderTotal = parseFloat(order.total) || 0;
            await processPostPaymentLogic(order.id, order.user_id, orderTotal, order.details);
            // WC order ja e criado/atualizado dentro de processPostPaymentLogic

            const { rows: updated } = await db.query('SELECT * FROM orders WHERE id = $1', [order.id]);
            return res.json({ synced: true, paid: true, order: updated[0] });
        }

        // Se falho e pedido ainda pending -> marcar como failed
        if (paymentStatus.status === 'failed' && order.status === 'pending') {
            await db.query(
                "UPDATE orders SET status = 'failed', updated_at = NOW() WHERE id = $1",
                [order.id]
            );
            console.log(`Sync: pedido ${order.id} marcado como failed`);

            if (order.woocommerce_order_id) {
                woocommerceService.updateOrderStatus(order.woocommerce_order_id, 'failed').catch(() => {});
            }
        }

        const { rows: updated } = await db.query('SELECT * FROM orders WHERE id = $1', [order.id]);
        res.json({ synced: true, paid: false, order: updated[0] });
    } catch (err) {
        console.error('Erro ao sincronizar pedido:', err);
        res.status(500).json({ message: 'Erro ao sincronizar pedido' });
    }
});

// Retry payment — reset failed order back to pending
app.put('/orders/:id/retry-payment', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            "SELECT * FROM orders WHERE id = $1 AND user_id = $2 AND status = 'failed'",
            [req.params.id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Pedido nao encontrado ou nao elegivel para nova tentativa' });
        }

        await db.query(
            "UPDATE orders SET status = 'pending', updated_at = NOW() WHERE id = $1",
            [req.params.id]
        );

        // Sync WC
        if (rows[0].woocommerce_order_id) {
            woocommerceService.updateOrderStatus(rows[0].woocommerce_order_id, 'pending').catch(() => {});
        }

        console.log(`Retry payment: pedido ${req.params.id} resetado para pending`);
        const { rows: updated } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
        res.json(updated[0]);
    } catch (err) {
        console.error('Erro ao resetar pedido para retry:', err.message);
        res.status(500).json({ message: 'Erro ao processar nova tentativa' });
    }
});

// =============================================
// PAYMENTS (iPag)
// =============================================

app.post('/payments/process', authenticateToken, async (req, res) => {
    const { paymentMethod, amount, orderId, cardData, customer, installments, state, billingCompanyId } = req.body;

    try {
        let result;
        let usedGateway = null;
        let usedBillingCompanyId = billingCompanyId || null;

        // Tentar resolver gateway via billing company
        let gateway = null;
        if (billingCompanyId) {
            gateway = await billingService.selectGateway(billingCompanyId, paymentMethod);
        }

        // Se nao achou gateway por billing company, tentar pelo state do pedido
        if (!gateway && orderId) {
            try {
                const { rows: orderRows } = await db.query(
                    'SELECT o.address_id, a.state FROM orders o LEFT JOIN addresses a ON a.id = o.address_id WHERE o.id = $1',
                    [orderId]
                );
                if (orderRows.length > 0 && orderRows[0].state) {
                    const resolved = await billingService.resolveForState(orderRows[0].state);
                    if (resolved) {
                        usedBillingCompanyId = resolved.billingCompanyId;
                        gateway = await billingService.selectGateway(resolved.billingCompanyId, paymentMethod);
                    }
                }
            } catch (e) {
                console.warn('Erro ao resolver billing company:', e.message);
            }
        }

        if (gateway) {
            // Usar gateway configurado
            const gwService = gatewayRouter.getGateway(gateway.gateway_type);
            if (!gwService) throw new Error(`Gateway ${gateway.gateway_type} nao suportado`);

            usedGateway = gateway;
            console.log(`[Payment] Order ${orderId}: gateway=${gateway.gateway_type} (id=${gateway.id}), method=${paymentMethod}, billingCompanyId=${usedBillingCompanyId}`);

            if (paymentMethod === 'pix') {
                result = await gwService.generatePix({ amount, orderId, customer, credentials: gateway.credentials });
            } else {
                result = await gwService.processCardPayment({ amount, orderId, cardData, customer, installments, credentials: gateway.credentials });
            }
        } else {
            // Fallback: iPag via .env
            console.log(`[Payment] Order ${orderId}: FALLBACK iPag (.env), billingCompanyId=${billingCompanyId}, method=${paymentMethod}`);
            if (paymentMethod === 'pix') {
                result = await ipagService.generatePix({ amount, orderId, customer });
            } else {
                result = await ipagService.processCardPayment({ amount, orderId, cardData, customer, installments });
            }
        }

        // Salvar info do gateway no pedido
        if (orderId) {
            const txnId = result.transaction_id || result.pix?.transaction_id;
            await db.query(
                `UPDATE orders SET
                    billing_company_id = COALESCE($1, billing_company_id),
                    payment_gateway_id = COALESCE($2, payment_gateway_id),
                    gateway_type = COALESCE($3, gateway_type),
                    gateway_transaction_id = COALESCE($4, gateway_transaction_id),
                    gateway_status = COALESCE($5, gateway_status),
                    ipag_transaction_id = COALESCE($4, ipag_transaction_id),
                    ipag_status = COALESCE($5, ipag_status),
                    payment_method = $6,
                    updated_at = NOW()
                WHERE id = $7`,
                [
                    usedBillingCompanyId,
                    usedGateway?.id || null,
                    usedGateway?.gateway_type || 'ipag',
                    txnId,
                    result.status || result.ipag_status,
                    paymentMethod,
                    orderId
                ]
            );

            const resultStatus = (result.status || '').toString().toLowerCase();

            // Tratar pagamento aprovado imediatamente (cartao de credito)
            if (resultStatus === 'approved' || resultStatus === 'paid' || resultStatus === 'captured') {
                const { rows: orderRows } = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
                const order = orderRows[0];
                if (order && order.status === 'pending') {
                    await db.query(
                        "UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1",
                        [orderId]
                    );
                    console.log(`Payment process: pedido ${orderId} marcado como paid (status: ${resultStatus})`);
                    const orderTotal = parseFloat(order.total) || 0;
                    await processPostPaymentLogic(orderId, order.user_id, orderTotal, order.details);
                }
            }

            // Tratar pagamento recusado/falho
            if (resultStatus === 'failed' || resultStatus === 'declined' || resultStatus === 'recusado') {
                await db.query(
                    "UPDATE orders SET status = 'failed', updated_at = NOW() WHERE id = $1",
                    [orderId]
                );
                console.log(`Payment process: pedido ${orderId} marcado como failed (status: ${resultStatus})`);

                const orderCheck = await db.query('SELECT woocommerce_order_id FROM orders WHERE id = $1', [orderId]);
                if (orderCheck.rows[0]?.woocommerce_order_id) {
                    woocommerceService.updateOrderStatus(orderCheck.rows[0].woocommerce_order_id, 'failed').catch(() => {});
                }
            }
        }

        res.json(result);
    } catch (err) {
        console.error('Erro ao processar pagamento:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// =============================================
// VERIFICATION CODES
// =============================================

app.post('/verification-codes', authenticateToken, async (req, res) => {
    const { type, new_value } = req.body;

    try {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        const { rows } = await db.query(
            `INSERT INTO verification_codes (user_id, code, type, new_value, expires_at)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, code`,
            [req.user.id, code, type, new_value, expiresAt.toISOString()]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao gerar codigo' });
    }
});

app.post('/verification-codes/verify', authenticateToken, async (req, res) => {
    const { code, type } = req.body;

    try {
        const { rows } = await db.query(
            `SELECT * FROM verification_codes
             WHERE user_id = $1 AND code = $2 AND type = $3 AND used = false AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [req.user.id, code, type]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Codigo invalido ou expirado' });
        }

        await db.query('UPDATE verification_codes SET used = true WHERE id = $1', [rows[0].id]);

        res.json({ new_value: rows[0].new_value });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao verificar codigo' });
    }
});

// =============================================
// ABANDONED CARTS
// =============================================

app.get('/abandoned-carts', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM abandoned_carts WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
            [req.user.id]
        );
        res.json(rows[0] || null);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar carrinho' });
    }
});

app.post('/abandoned-carts', authenticateToken, async (req, res) => {
    const { items, cart_data, total, item_count } = req.body;
    // Support both formats: items directly or cart_data.items
    const cartItems = items || cart_data?.items || [];
    const cartTotal = total || 0;
    const cartItemCount = item_count || cartItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

    try {
        const { rows: existing } = await db.query(
            'SELECT id FROM abandoned_carts WHERE user_id = $1',
            [req.user.id]
        );

        if (existing.length > 0) {
            const { rows } = await db.query(
                `UPDATE abandoned_carts SET items = $1, total = $2, item_count = $3, status = 'abandoned', updated_at = NOW() WHERE user_id = $4 RETURNING *`,
                [JSON.stringify(cartItems), cartTotal, cartItemCount, req.user.id]
            );
            dispatchWebhooks('cart_abandoned', { cart_id: rows[0].id, user_id: req.user.id, total: cartTotal, item_count: cartItemCount, items: cartItems }).catch(() => {});
            return res.json(rows[0]);
        }

        const { rows } = await db.query(
            `INSERT INTO abandoned_carts (user_id, items, total, item_count, status) VALUES ($1, $2, $3, $4, 'abandoned') RETURNING *`,
            [req.user.id, JSON.stringify(cartItems), cartTotal, cartItemCount]
        );

        dispatchWebhooks('cart_abandoned', { cart_id: rows[0].id, user_id: req.user.id, total: cartTotal, item_count: cartItemCount, items: cartItems }).catch(() => {});
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao salvar carrinho' });
    }
});

app.delete('/abandoned-carts', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM abandoned_carts WHERE user_id = $1', [req.user.id]);
        res.json({ message: 'Carrinho removido' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao remover carrinho' });
    }
});

// =============================================
// APP SETTINGS (public read)
// =============================================

app.get('/app-settings', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM app_settings ORDER BY key');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar configuracoes' });
    }
});

// =============================================
// CRON ROUTES (Protegidos por secret)
// =============================================

app.post('/cron/check-levels', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) return res.sendStatus(403);

    try {
        // Downgrade por inatividade (90 dias sem compra)
        const { rows: inactiveUsers } = await db.query(`
            SELECT id, level, last_purchase_date FROM users
            WHERE level != 'bronze'
            AND last_purchase_date < NOW() - INTERVAL '${INACTIVITY_DAYS} days'
        `);

        for (const user of inactiveUsers) {
            let newLevel;
            if (user.level === 'ouro') newLevel = 'prata';
            else if (user.level === 'prata') newLevel = 'bronze';
            else continue;

            await db.query('UPDATE users SET level = $1, level_updated_at = NOW() WHERE id = $2', [newLevel, user.id]);
            await db.query(
                'INSERT INTO level_history (user_id, old_level, new_level, reason, changed_by) VALUES ($1, $2, $3, $4, $5)',
                [user.id, user.level, newLevel, `Inatividade: ${INACTIVITY_DAYS} dias sem compra`, 'cron']
            );
        }

        // Suspender bronzes inativos
        await db.query(`
            UPDATE users SET approval_status = 'suspended'
            WHERE level = 'bronze' AND approval_status = 'approved'
            AND last_purchase_date IS NOT NULL
            AND last_purchase_date < NOW() - INTERVAL '${INACTIVITY_DAYS} days'
        `);

        // Check for upgrades
        const { rows: allUsers } = await db.query("SELECT id FROM users WHERE approval_status = 'approved'");
        for (const u of allUsers) {
            await recalculateUserLevel(u.id);
        }

        res.json({ processed: inactiveUsers.length, totalChecked: allUsers.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro no cron de niveis' });
    }
});

app.post('/cron/check-referral-activity', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) return res.sendStatus(403);

    try {
        // Inativar indicacoes cujo indicado nao comprou em 90 dias
        const { rowCount } = await db.query(`
            UPDATE referrals SET status = 'inactive'
            WHERE status = 'active'
            AND referred_id IN (
                SELECT id FROM users WHERE last_purchase_date < NOW() - INTERVAL '${INACTIVITY_DAYS} days'
            )
        `);

        res.json({ inactivated: rowCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro no cron de indicacoes' });
    }
});

// =============================================
// ADMIN ROUTES
// =============================================

app.get('/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { dateRange, customStartDate, customEndDate } = req.query;

        // Build date filter based on dateRange param
        const now = new Date();
        let dateFilterSQL = '';
        let dateFilterParams = [];
        let paramOffset = 0;

        if (dateRange === 'today') {
            paramOffset = 1;
            dateFilterSQL = ` AND o.created_at >= $${paramOffset}::date`;
            dateFilterParams = [now.toISOString().split('T')[0]];
        } else if (dateRange === 'week') {
            const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
            paramOffset = 1;
            dateFilterSQL = ` AND o.created_at >= $${paramOffset}`;
            dateFilterParams = [weekAgo.toISOString()];
        } else if (dateRange === 'month' || !dateRange) {
            const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);
            paramOffset = 1;
            dateFilterSQL = ` AND o.created_at >= $${paramOffset}`;
            dateFilterParams = [monthAgo.toISOString()];
        } else if (dateRange === '90days') {
            const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
            paramOffset = 1;
            dateFilterSQL = ` AND o.created_at >= $${paramOffset}`;
            dateFilterParams = [d90.toISOString()];
        } else if (dateRange === 'year') {
            const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            paramOffset = 1;
            dateFilterSQL = ` AND o.created_at >= $${paramOffset}`;
            dateFilterParams = [yearAgo.toISOString()];
        } else if (dateRange === 'custom' && customStartDate && customEndDate) {
            paramOffset = 2;
            dateFilterSQL = ` AND o.created_at >= $1::date AND o.created_at <= $2::date + INTERVAL '1 day'`;
            dateFilterParams = [customStartDate, customEndDate];
        }
        // dateRange === 'all' -> no filter

        // Sales metrics
        const todayStr = now.toISOString().split('T')[0];
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

        const [salesResult, ordersResult, usersResult, abandonedResult, levelStats, recentOrdersResult, salesChartResult, topCustomersResult, crmResult] = await Promise.all([
            // Sales: today, week, month, total
            db.query(`
                SELECT
                    COALESCE(SUM(CASE WHEN created_at >= $1::date THEN total::numeric ELSE 0 END), 0) as today,
                    COALESCE(SUM(CASE WHEN created_at >= $2 THEN total::numeric ELSE 0 END), 0) as week,
                    COALESCE(SUM(CASE WHEN created_at >= $3 THEN total::numeric ELSE 0 END), 0) as month,
                    COALESCE(SUM(total::numeric), 0) as total
                FROM orders WHERE status IN ('paid', 'shipped', 'delivered')
            `, [todayStr, weekAgo.toISOString(), monthAgo.toISOString()]),

            // Orders by status (with date filter)
            db.query(`
                SELECT status, COUNT(*) as cnt
                FROM orders WHERE 1=1 ${dateFilterSQL}
                GROUP BY status
            `, dateFilterParams),

            // Users
            db.query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved,
                    COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_this_month
                FROM users
            `, [monthAgo.toISOString()]),

            // Abandoned carts
            db.query(`
                SELECT COUNT(*) as count, COALESCE(SUM(estimated_total::numeric), 0) as value
                FROM abandoned_carts WHERE recovered = false
            `).catch(() => ({ rows: [{ count: 0, value: 0 }] })),

            // Level distribution
            db.query("SELECT level, COUNT(*) as cnt FROM users WHERE approval_status = 'approved' GROUP BY level")
                .catch(() => ({ rows: [] })),

            // Recent orders
            db.query(`
                SELECT o.id, o.order_number, o.total, o.status, o.created_at, u.name as user_name, u.email as user_email
                FROM orders o JOIN users u ON o.user_id = u.id
                ORDER BY o.created_at DESC LIMIT 10
            `),

            // Sales chart (last 7 days)
            db.query(`
                SELECT DATE(created_at) as day, COALESCE(SUM(total::numeric), 0) as vendas
                FROM orders
                WHERE status IN ('paid', 'shipped', 'delivered') AND created_at >= $1
                GROUP BY DATE(created_at)
                ORDER BY day
            `, [weekAgo.toISOString()]),

            // Top 10 customers
            db.query(`
                SELECT o.user_id, u.name, u.email, u.telefone as whatsapp,
                    SUM(o.total::numeric) as "totalSpent",
                    COUNT(*) as "orderCount",
                    MIN(o.created_at) as "firstPurchase",
                    MAX(o.created_at) as "lastPurchase"
                FROM orders o JOIN users u ON o.user_id = u.id
                WHERE o.status IN ('paid', 'shipped', 'delivered')
                GROUP BY o.user_id, u.name, u.email, u.telefone
                ORDER BY "totalSpent" DESC LIMIT 10
            `),

            // CRM: avg ticket, conversion rate, repeat customers, LTV
            db.query(`
                SELECT
                    COALESCE(AVG(total::numeric), 0) as avg_ticket,
                    (SELECT COUNT(DISTINCT user_id) FROM orders WHERE status IN ('paid', 'shipped', 'delivered')) as buyers,
                    (SELECT COUNT(*) FROM users WHERE approval_status = 'approved') as approved_users,
                    (SELECT COUNT(*) FROM (SELECT user_id FROM orders WHERE status IN ('paid', 'shipped', 'delivered') GROUP BY user_id HAVING COUNT(*) >= 2) sub) as repeat_customers,
                    COALESCE((SELECT AVG(user_total) FROM (SELECT SUM(total::numeric) as user_total FROM orders WHERE status IN ('paid', 'shipped', 'delivered') GROUP BY user_id) sub2), 0) as ltv
                FROM orders WHERE status IN ('paid', 'shipped', 'delivered')
            `)
        ]);

        // Process orders by status
        const ordersByStatus = { pending: 0, paid: 0, shipped: 0, delivered: 0, total: 0 };
        ordersResult.rows.forEach(r => {
            const s = r.status;
            if (ordersByStatus.hasOwnProperty(s)) ordersByStatus[s] = parseInt(r.cnt);
            ordersByStatus.total += parseInt(r.cnt);
        });

        // Process level distribution
        const levelDistribution = { bronze: 0, prata: 0, ouro: 0 };
        levelStats.rows.forEach(r => { levelDistribution[r.level || 'bronze'] = parseInt(r.cnt); });

        // Process sales chart
        const salesChart = salesChartResult.rows.map(r => ({
            name: new Date(r.day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            vendas: parseFloat(r.vendas)
        }));

        // Process CRM
        const crmRow = crmResult.rows[0] || {};
        const approvedUsers = parseInt(crmRow.approved_users) || 1;
        const buyers = parseInt(crmRow.buyers) || 0;

        res.json({
            sales: {
                today: parseFloat(salesResult.rows[0].today),
                week: parseFloat(salesResult.rows[0].week),
                month: parseFloat(salesResult.rows[0].month),
                total: parseFloat(salesResult.rows[0].total)
            },
            orders: ordersByStatus,
            users: {
                total: parseInt(usersResult.rows[0].total),
                pending: parseInt(usersResult.rows[0].pending),
                approved: parseInt(usersResult.rows[0].approved),
                newThisMonth: parseInt(usersResult.rows[0].new_this_month)
            },
            abandonedCarts: {
                count: parseInt(abandonedResult.rows[0].count) || 0,
                value: parseFloat(abandonedResult.rows[0].value) || 0
            },
            crm: {
                avgTicket: parseFloat(crmRow.avg_ticket) || 0,
                conversionRate: approvedUsers > 0 ? (buyers / approvedUsers) * 100 : 0,
                repeatCustomers: parseInt(crmRow.repeat_customers) || 0,
                lifetimeValue: parseFloat(crmRow.ltv) || 0
            },
            levelDistribution,
            recentOrders: recentOrdersResult.rows,
            salesChart,
            topCustomers: topCustomersResult.rows
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
    }
});

app.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { filter, level } = req.query;
        let query = `SELECT u.id, u.name, u.email, u.role, u.telefone, u.document_type, u.cpf, u.cnpj, u.company_name, u.profession, u.approval_status, u.approved_by, u.approved_at, u.rejection_reason, u.created_at, u.level, u.total_accumulated, u.last_purchase_date, u.commission_balance, u.has_purchased_kit, u.first_order_completed, u.points, u.affiliate_type, u.affiliate_status, u.referred_by, ref.referral_code as referrer_code, ref.name as referrer_name FROM users u LEFT JOIN users ref ON u.referred_by = ref.id`;
        const params = [];
        const conditions = [];

        if (filter && filter !== 'all') {
            params.push(filter);
            conditions.push(`u.approval_status = $${params.length}`);
        }

        if (level && level !== 'all') {
            params.push(level);
            conditions.push(`u.level = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY u.created_at DESC';

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        // Fallback if new columns don't exist
        if (err.message && err.message.includes('does not exist')) {
            try {
                let query = 'SELECT id, name, email, role, telefone, document_type, cpf, cnpj, company_name, profession, approval_status, approved_by, approved_at, rejection_reason, created_at FROM users';
                const params = [];
                const conditions = [];
                const { filter } = req.query;
                if (filter && filter !== 'all') {
                    params.push(filter);
                    conditions.push(`approval_status = $${params.length}`);
                }
                if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
                query += ' ORDER BY created_at DESC';
                const { rows } = await db.query(query, params);
                return res.json(rows);
            } catch (fallbackErr) {
                console.error(fallbackErr);
            }
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao listar usuarios' });
    }
});

app.get('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, name, email, role, telefone, foto, document_type, cpf, cnpj, company_name, profession, profession_other, approval_status, approved_by, approved_at, rejection_reason, created_at, level, total_accumulated, last_purchase_date, commission_balance, has_purchased_kit, first_order_completed, points, referral_code, referred_by, affiliate_type, affiliate_status, affiliate_level FROM users WHERE id = $1',
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            try {
                const { rows } = await db.query(
                    'SELECT id, name, email, role, telefone, foto, document_type, cpf, cnpj, company_name, profession, profession_other, approval_status, approved_by, approved_at, rejection_reason, created_at FROM users WHERE id = $1',
                    [req.params.id]
                );
                if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });
                return res.json(rows[0]);
            } catch (fallbackErr) {
                console.error(fallbackErr);
            }
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar usuario' });
    }
});

// Admin: Create user manually
app.post('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    const { name, email, telefone, role, approval_status, affiliate_type } = req.body;

    if (!name || !email) {
        return res.status(400).json({ message: 'Nome e email sao obrigatorios' });
    }

    try {
        // Check if email already exists
        const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email ja cadastrado' });
        }

        // Generate a unique central_user_id for admin-created users
        const centralId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 10000);

        let query = `INSERT INTO users (central_user_id, name, email, telefone, role, approval_status`;
        let values = [centralId, name, email, telefone || null, role || 'client', approval_status || 'approved'];
        let placeholders = '$1, $2, $3, $4, $5, $6';
        let paramCount = 6;

        if (affiliate_type) {
            paramCount++;
            query += `, affiliate_type, affiliate_status`;
            placeholders += `, $${paramCount}, 'active'`;
            values.push(affiliate_type);
        }

        // Gerar referral_code automaticamente se aprovado
        const finalStatus = approval_status || 'approved';
        if (finalStatus === 'approved') {
            paramCount++;
            query += `, referral_code`;
            const code = generateReferralCode(name);
            placeholders += `, $${paramCount}`;
            values.push(code);
        }

        query += `) VALUES (${placeholders}) RETURNING *`;

        const { rows } = await db.query(query, values);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar usuario' });
    }
});

app.put('/admin/users/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    const { status, rejection_reason } = req.body;

    try {
        const approver = await db.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
        const approverEmail = approver.rows[0]?.email || 'admin';

        const updates = [
            'approval_status = $1',
            'approved_by = $2',
            'approved_at = NOW()',
            'updated_at = NOW()'
        ];
        const values = [status, approverEmail];

        if (status === 'rejected' && rejection_reason) {
            updates.push('rejection_reason = $3');
            values.push(rejection_reason);
            values.push(req.params.id);
            await db.query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = $4 RETURNING id, name, email, approval_status`,
                values
            );
        } else {
            values.push(req.params.id);
            const { rows } = await db.query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = $3 RETURNING id, name, email, approval_status`,
                values
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });

            // Enviar email de aprovacao e gerar referral_code
            if (status === 'approved') {
                emailService.sendApprovalEmail(rows[0].email, rows[0].name).catch(e =>
                    console.warn('Erro ao enviar email de aprovacao:', e.message)
                );
                try {
                    const code = generateReferralCode(rows[0].name);
                    let attempts = 0;
                    let saved = false;
                    let finalCode = code;
                    while (attempts < 5 && !saved) {
                        try {
                            await db.query('UPDATE users SET referral_code = $1 WHERE id = $2 AND (referral_code IS NULL OR referral_code = \'\')', [finalCode, req.params.id]);
                            saved = true;
                        } catch (e) {
                            finalCode = generateReferralCode(rows[0].name);
                            attempts++;
                        }
                    }
                } catch (e) {
                    console.warn('Erro ao gerar referral_code na aprovacao:', e.message);
                }
            }

            res.json(rows[0]);
            return;
        }

        const { rows } = await db.query(
            'SELECT id, name, email, approval_status FROM users WHERE id = $1',
            [req.params.id]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar aprovacao' });
    }
});

app.put('/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
    const { role } = req.body;

    if (!['client', 'manager', 'administrator'].includes(role)) {
        return res.status(400).json({ message: 'Role invalido' });
    }

    try {
        const { rows } = await db.query(
            'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role',
            [role, req.params.id]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao alterar role' });
    }
});

// Admin: Override de nivel
app.put('/admin/users/:id/level', authenticateToken, requireAdmin, async (req, res) => {
    const { level } = req.body;
    if (!LEVEL_CONFIG[level]) {
        return res.status(400).json({ message: 'Nivel invalido' });
    }

    try {
        const { rows: currentRows } = await db.query('SELECT level FROM users WHERE id = $1', [req.params.id]);
        if (currentRows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });
        const oldLevel = currentRows[0].level;

        await db.query(
            'UPDATE users SET level = $1, level_updated_at = NOW(), updated_at = NOW() WHERE id = $2',
            [level, req.params.id]
        );

        const approver = await db.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
        await db.query(
            'INSERT INTO level_history (user_id, old_level, new_level, reason, changed_by) VALUES ($1, $2, $3, $4, $5)',
            [req.params.id, oldLevel, level, 'Override manual pelo admin', approver.rows[0]?.email || 'admin']
        );

        // Grant level achievements
        if (level === 'prata') await grantAchievement(parseInt(req.params.id), 'level_prata');
        if (level === 'ouro') await grantAchievement(parseInt(req.params.id), 'level_ouro');

        res.json({ message: 'Nivel atualizado', oldLevel, newLevel: level });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.status(500).json({ message: 'Execute setup_db para habilitar o sistema de niveis' });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao alterar nivel' });
    }
});

// Admin: Vincular afiliado (referrer) a um usuario
app.put('/admin/users/:id/referrer', authenticateToken, requireAdmin, async (req, res) => {
    const { referral_code } = req.body;
    const userId = parseInt(req.params.id);

    if (!referral_code || !referral_code.trim()) {
        return res.status(400).json({ message: 'Codigo de afiliado e obrigatorio' });
    }

    try {
        // Buscar o referrer pelo codigo
        const { rows: referrerRows } = await db.query(
            'SELECT id, name, referral_code FROM users WHERE referral_code = $1',
            [referral_code.trim().toUpperCase()]
        );

        if (referrerRows.length === 0) {
            return res.status(404).json({ message: 'Codigo de afiliado nao encontrado' });
        }

        const referrer = referrerRows[0];

        // Nao pode vincular a si mesmo
        if (referrer.id === userId) {
            return res.status(400).json({ message: 'Usuario nao pode ser indicado por si mesmo' });
        }

        // Verificar se o usuario ja tem um referrer
        const { rows: userRows } = await db.query('SELECT referred_by FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'Usuario nao encontrado' });
        }

        // Atualizar referred_by
        await db.query(
            'UPDATE users SET referred_by = $1, updated_at = NOW() WHERE id = $2',
            [referrer.id, userId]
        );

        // Criar ou atualizar entrada na tabela referrals
        const { rows: existingRef } = await db.query(
            'SELECT id FROM referrals WHERE referred_id = $1',
            [userId]
        );

        if (existingRef.length > 0) {
            await db.query(
                'UPDATE referrals SET referrer_id = $1, status = $2 WHERE referred_id = $3',
                [referrer.id, 'active', userId]
            );
        } else {
            await db.query(
                'INSERT INTO referrals (referrer_id, referred_id, status, created_at) VALUES ($1, $2, $3, NOW())',
                [referrer.id, userId, 'active']
            );
        }

        res.json({
            message: 'Afiliado vinculado com sucesso',
            referrer_code: referrer.referral_code,
            referrer_name: referrer.name
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao vincular afiliado' });
    }
});

// Admin: Historico de nivel
app.get('/admin/level-history/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM level_history WHERE user_id = $1 ORDER BY created_at DESC',
            [req.params.userId]
        );
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar historico de nivel' });
    }
});

// Admin: Gestao de afiliados
app.get('/admin/affiliates', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT u.id, u.name, u.email, u.telefone, u.affiliate_type, u.affiliate_status, u.affiliate_level, u.affiliate_sales_count, u.commission_balance, u.referral_code, u.created_at,
             (SELECT COUNT(*) FROM affiliate_visits WHERE affiliate_user_id = u.id) as total_clicks
             FROM users u WHERE u.affiliate_type IS NOT NULL ORDER BY u.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao listar afiliados' });
    }
});

app.put('/admin/affiliates/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        await db.query(
            'UPDATE users SET affiliate_status = $1, updated_at = NOW() WHERE id = $2',
            [status, req.params.id]
        );
        res.json({ message: 'Status atualizado' });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
            return res.status(500).json({ message: 'Execute setup_db para habilitar afiliados' });
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar afiliado' });
    }
});

// Delete affiliate (remove affiliate status, keep user)
app.delete('/admin/affiliates/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db.query(
            'UPDATE users SET affiliate_type = NULL, affiliate_status = NULL, affiliate_level = NULL, updated_at = NOW() WHERE id = $1',
            [req.params.id]
        );
        res.json({ message: 'Afiliado removido' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao remover afiliado' });
    }
});

// Add existing user as affiliate
app.post('/admin/affiliates/add-existing', authenticateToken, requireAdmin, async (req, res) => {
    const { email, affiliate_type } = req.body;
    if (!email || !affiliate_type) {
        return res.status(400).json({ message: 'Email e tipo de afiliado sao obrigatorios' });
    }
    try {
        const { rows } = await db.query('SELECT id, name, email, affiliate_type, referral_code FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario nao encontrado com esse email' });
        }
        const user = rows[0];
        if (user.affiliate_type) {
            return res.status(400).json({ message: 'Este usuario ja e afiliado' });
        }
        // Generate referral code if user doesn't have one
        let referralCode = user.referral_code;
        if (!referralCode) {
            referralCode = generateReferralCode(user.name);
        }
        const { rows: updated } = await db.query(
            `UPDATE users SET affiliate_type = $1, affiliate_status = 'active', referral_code = COALESCE(referral_code, $2), updated_at = NOW()
             WHERE id = $3 RETURNING id, name, email, telefone, affiliate_type, affiliate_status, affiliate_level, affiliate_sales_count, commission_balance, referral_code`,
            [affiliate_type, referralCode, user.id]
        );
        res.json(updated[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao adicionar afiliado' });
    }
});

app.get('/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let whereConditions = [];
        let queryParams = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            whereConditions.push(`o.status = $${paramCount}`);
            queryParams.push(status);
        }

        if (search) {
            paramCount++;
            whereConditions.push(`(u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR o.order_number ILIKE $${paramCount})`);
            queryParams.push(`%${search}%`);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        const countQuery = `SELECT COUNT(*) as total FROM orders o JOIN users u ON o.user_id = u.id ${whereClause}`;
        const { rows: countRows } = await db.query(countQuery, queryParams);
        const totalItems = parseInt(countRows[0].total);

        paramCount++;
        queryParams.push(Number(limit));
        paramCount++;
        queryParams.push(offset);

        const dataQuery = `
            SELECT o.*, u.name as user_name, u.email as user_email
            FROM orders o JOIN users u ON o.user_id = u.id
            ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}
        `;

        const { rows } = await db.query(dataQuery, queryParams);

        res.json({
            data: rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalItems,
                totalPages: Math.ceil(totalItems / Number(limit))
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao listar pedidos' });
    }
});

app.put('/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { status, tracking_code, tracking_url } = req.body;

    try {
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (status !== undefined) { paramCount++; updates.push(`status = $${paramCount}`); values.push(status); }
        if (tracking_code !== undefined) { paramCount++; updates.push(`tracking_code = $${paramCount}`); values.push(tracking_code); }
        if (tracking_url !== undefined) { paramCount++; updates.push(`tracking_url = $${paramCount}`); values.push(tracking_url); }

        updates.push('updated_at = NOW()');
        paramCount++;
        values.push(req.params.id);

        const { rows } = await db.query(
            `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Pedido nao encontrado' });

        // Disparar webhooks conforme status
        const updatedOrder = rows[0];
        if (status === 'shipped') {
            dispatchWebhooks('order_shipped', { order_id: updatedOrder.id, order_number: updatedOrder.order_number, tracking_code: updatedOrder.tracking_code, tracking_url: updatedOrder.tracking_url }).catch(() => {});
        } else if (status === 'delivered') {
            dispatchWebhooks('order_delivered', { order_id: updatedOrder.id, order_number: updatedOrder.order_number }).catch(() => {});
        } else if (status === 'canceled') {
            dispatchWebhooks('order_canceled', { order_id: updatedOrder.id, order_number: updatedOrder.order_number, total: updatedOrder.total }).catch(() => {});
        }

        res.json(updatedOrder);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar pedido' });
    }
});

app.delete('/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ message: 'Pedido nao encontrado' });
        res.json({ message: 'Pedido removido' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao remover pedido' });
    }
});

app.get('/admin/abandoned-carts', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT ac.*, u.name as user_name, u.email as user_email, u.telefone FROM abandoned_carts ac JOIN users u ON ac.user_id = u.id';
        const params = [];

        if (status && status !== 'all') {
            params.push(status);
            query += ` WHERE ac.status = $1`;
        }

        query += ' ORDER BY ac.updated_at DESC';

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        // Fallback if status column doesn't exist
        if (err.message && err.message.includes('does not exist')) {
            try {
                const { rows } = await db.query(
                    'SELECT ac.*, u.name as user_name, u.email as user_email, u.telefone FROM abandoned_carts ac JOIN users u ON ac.user_id = u.id ORDER BY ac.updated_at DESC'
                );
                return res.json(rows);
            } catch (e) { /* ignore */ }
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar carrinhos abandonados' });
    }
});

app.post('/admin/abandoned-carts/:id/recover', authenticateToken, requireAdmin, async (req, res) => {
    const { type, recovery_link } = req.body;
    try {
        const { rows } = await db.query(
            'SELECT ac.*, u.name as user_name, u.email as user_email, u.telefone FROM abandoned_carts ac JOIN users u ON ac.user_id = u.id WHERE ac.id = $1',
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Carrinho nao encontrado' });

        const cart = rows[0];
        const frontendUrl = process.env.FRONTEND_URL || 'https://revenda.pelg.com.br';
        const link = recovery_link || `${frontendUrl}/?recover=${cart.id}`;

        // Parse items for email content
        let items = cart.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch { items = []; }
        }
        if (!Array.isArray(items)) items = [];

        if (type === 'email') {
            if (!cart.user_email) {
                return res.status(400).json({ message: 'Usuario nao possui email cadastrado' });
            }
            const result = await emailService.sendCartRecoveryEmail(
                cart.user_email,
                cart.user_name,
                link,
                items
            );
            if (!result.success) {
                return res.status(500).json({ message: 'Erro ao enviar email: ' + (result.error || 'desconhecido') });
            }
            await db.query('UPDATE abandoned_carts SET recovery_email_sent = true, updated_at = NOW() WHERE id = $1', [req.params.id]);
        } else if (type === 'whatsapp') {
            // WhatsApp: mark as sent (actual sending depends on WhatsApp integration being configured)
            await db.query('UPDATE abandoned_carts SET recovery_whatsapp_sent = true, updated_at = NOW() WHERE id = $1', [req.params.id]);
        }

        res.json({ message: 'Recuperacao enviada', cart: cart });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao recuperar carrinho' });
    }
});

// Webhook configurations
app.get('/admin/webhook-configurations', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM webhook_configurations ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar webhooks' });
    }
});

app.post('/admin/webhook-configurations', authenticateToken, requireAdmin, async (req, res) => {
    const { name, url, events, active } = req.body;
    if (!url) return res.status(400).json({ message: 'URL e obrigatoria' });
    try {
        const { rows } = await db.query(
            'INSERT INTO webhook_configurations (name, url, events, active) VALUES ($1, $2, $3, $4) RETURNING *',
            [name || null, url, events || [], active !== false]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar webhook' });
    }
});

app.put('/admin/webhook-configurations/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { name, url, events, active } = req.body;
    try {
        const { rows } = await db.query(
            'UPDATE webhook_configurations SET name = $1, url = $2, events = $3, active = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [name || null, url, events || [], active, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Webhook nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar webhook' });
    }
});

app.delete('/admin/webhook-configurations/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM webhook_configurations WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ message: 'Webhook nao encontrado' });
        res.json({ message: 'Webhook removido' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao remover webhook' });
    }
});

// Testar webhook individual
app.post('/admin/webhook-configurations/:id/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM webhook_configurations WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Webhook nao encontrado' });
        const wh = rows[0];
        const testPayload = {
            event: 'test',
            timestamp: new Date().toISOString(),
            data: { message: 'Teste de webhook', source: 'admin-panel' }
        };
        const response = await axios.post(wh.url, testPayload, { timeout: 10000 });
        await db.query(
            'UPDATE webhook_configurations SET last_triggered_at = NOW(), last_status_code = $1, last_error = NULL WHERE id = $2',
            [response.status, wh.id]
        );
        res.json({ success: true, message: `Webhook respondeu com status ${response.status}` });
    } catch (err) {
        const statusCode = err.response?.status || null;
        const errorMsg = err.message || 'Erro desconhecido';
        try {
            await db.query(
                'UPDATE webhook_configurations SET last_triggered_at = NOW(), last_status_code = $1, last_error = $2 WHERE id = $3',
                [statusCode, errorMsg, req.params.id]
            );
        } catch (_) {}
        res.json({ success: false, message: `Erro: ${errorMsg}${statusCode ? ` (status ${statusCode})` : ''}` });
    }
});

// Tipos de eventos disponiveis para webhooks
app.get('/admin/webhook-event-types', authenticateToken, requireAdmin, (req, res) => {
    res.json([
        { value: 'order_created', label: 'Pedido Criado' },
        { value: 'order_paid', label: 'Pedido Pago' },
        { value: 'order_shipped', label: 'Pedido Enviado' },
        { value: 'order_delivered', label: 'Pedido Entregue' },
        { value: 'order_canceled', label: 'Pedido Cancelado' },
        { value: 'cart_abandoned', label: 'Carrinho Abandonado' },
        { value: 'user_registered', label: 'Usuario Cadastrado' }
    ]);
});

// Recovery templates
app.get('/admin/recovery-templates', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM recovery_templates ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar templates' });
    }
});

app.post('/admin/recovery-templates', authenticateToken, requireAdmin, async (req, res) => {
    const { name, subject, template, type } = req.body;
    try {
        const { rows } = await db.query(
            'INSERT INTO recovery_templates (name, subject, template, type) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, subject, template, type]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar template' });
    }
});

app.put('/admin/recovery-templates/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { name, subject, template, type } = req.body;
    try {
        const { rows } = await db.query(
            'UPDATE recovery_templates SET name = $1, subject = $2, template = $3, type = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [name, subject, template, type, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Template nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar template' });
    }
});

app.delete('/admin/recovery-templates/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM recovery_templates WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ message: 'Template nao encontrado' });
        res.json({ message: 'Template removido' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao remover template' });
    }
});

// App settings (admin)
app.get('/admin/app-settings', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM app_settings ORDER BY key');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar configuracoes' });
    }
});

app.put('/admin/app-settings', authenticateToken, requireAdmin, async (req, res) => {
    const { settings } = req.body;

    try {
        for (const setting of settings) {
            await db.query(
                `INSERT INTO app_settings (key, value, description, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (key) DO UPDATE SET value = $2, description = $3, updated_at = NOW()`,
                [setting.key, setting.value, setting.description]
            );
        }

        const { rows } = await db.query('SELECT * FROM app_settings ORDER BY key');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar configuracoes' });
    }
});

// =============================================
// WEBHOOKS (External)
// =============================================

// =============================================
// WOOCOMMERCE — Proxy para patriciaelias.com.br
// =============================================

app.post('/woocommerce/create-order', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ error: 'orderId obrigatorio' });

        const { rows } = await db.query(
            `SELECT o.*, a.street, a.number, a.complement, a.neighborhood, a.city, a.state, a.cep
             FROM orders o LEFT JOIN addresses a ON o.address_id = a.id
             WHERE o.id = $1 AND o.user_id = $2`,
            [orderId, req.user.id]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Pedido nao encontrado' });
        const order = rows[0];
        const details = order.details || {};

        // Buscar dados completos do usuario
        const { rows: userRows2 } = await db.query(
            'SELECT name, email, telefone, cpf, cnpj, document_type FROM users WHERE id = $1',
            [req.user.id]
        );
        const userData = userRows2[0] || {};

        // Buscar woo_product_id da tabela products para itens que nao tiverem
        const allItems2 = details.items || [];
        for (const item of allItems2) {
            if (!item.woo_product_id && item.id) {
                const { rows: pRows } = await db.query('SELECT woo_product_id FROM products WHERE id = $1', [item.id]);
                if (pRows.length > 0 && pRows[0].woo_product_id) {
                    item.woo_product_id = pRows[0].woo_product_id;
                }
            }
        }

        const lineItems = allItems2
            .filter(item => item.woo_product_id)
            .map(item => ({
                product_id: item.woo_product_id,
                quantity: item.quantity,
                total: ((item.tablePrice || item.price || 0) * (item.quantity || 1)).toFixed(2),
                subtotal: ((item.tablePrice || item.price || 0) * (item.quantity || 1)).toFixed(2)
            }));

        if (lineItems.length === 0) {
            return res.status(400).json({ error: 'Nenhum produto mapeado para WooCommerce' });
        }

        // Resolver empresa faturadora
        let billingCompanyName2 = '';
        try {
            if (order.state) {
                const resolved = await billingService.resolveForState(order.state);
                if (resolved) billingCompanyName2 = resolved.billingCompanyName || '';
            }
        } catch (e) { /* ignora */ }

        const userName2 = userData.name || details.user_name || 'Cliente';
        const nameParts2 = userName2.trim().split(' ');
        const firstName2 = nameParts2[0] || 'Cliente';
        const lastName2 = nameParts2.slice(1).join(' ') || '';
        const userPhone2 = userData.telefone || details.user_whatsapp || '';
        const userCpf2 = userData.cpf || details.user_cpf || '';
        const userEmail2 = userData.email || details.user_email || '';

        const paymentMethodLabel = order.payment_method === 'pix' ? 'PIX' : order.payment_method === 'credit_card' ? 'Cartao de Credito' : order.payment_method || 'Nao informado';
        const orderNotes2 = [
            'Pedido realizado pela Central de Revendas.',
            `Metodo de pagamento: ${paymentMethodLabel}.`,
            billingCompanyName2 ? `Empresa faturadora: ${billingCompanyName2}.` : ''
        ].filter(Boolean).join('\n');

        const wcOrderData = {
            status: 'pending',
            billing: {
                first_name: firstName2,
                last_name: lastName2,
                email: userEmail2,
                phone: userPhone2,
                address_1: `${order.street || ''}${order.number ? ', ' + order.number : ''}`,
                address_2: [order.complement, order.neighborhood].filter(Boolean).join(' - '),
                city: order.city || '',
                state: order.state || '',
                postcode: order.cep || '',
                country: 'BR'
            },
            shipping: {
                first_name: firstName2,
                last_name: lastName2,
                address_1: `${order.street || ''}${order.number ? ', ' + order.number : ''}`,
                address_2: [order.complement, order.neighborhood].filter(Boolean).join(' - '),
                city: order.city || '',
                state: order.state || '',
                postcode: order.cep || '',
                country: 'BR'
            },
            line_items: lineItems,
            customer_note: orderNotes2,
            shipping_lines: [{ method_id: 'free_shipping', method_title: 'Frete Gratis', total: '0.00' }],
            meta_data: [
                { key: '_revenda_app_order_id', value: String(orderId) },
                { key: '_revenda_app_order_number', value: order.order_number || '' },
                { key: '_payment_method_title', value: paymentMethodLabel },
                { key: '_billing_number', value: order.number || '' },
                { key: '_billing_neighborhood', value: order.neighborhood || '' },
                { key: '_billing_cpf', value: userCpf2 },
                { key: '_billing_cnpj', value: userData.cnpj || '' },
                { key: '_billing_cellphone', value: userPhone2 },
                { key: '_billing_persontype', value: userData.document_type === 'cnpj' ? '2' : '1' },
                { key: 'pe_channel', value: 'revenda' },
                { key: 'pe_landing', value: 'central-revendas' },
                { key: 'pe_referrer', value: 'central-revendas' },
                { key: '_utm_source', value: 'revenda' },
                { key: '_utm_medium', value: 'app' },
                { key: '_utm_campaign', value: 'central-revendas' },
                { key: '_billing_company', value: billingCompanyName2 }
            ]
        };

        const wcOrder = await woocommerceService.createOrder(wcOrderData);

        await db.query(
            `UPDATE orders SET woocommerce_order_id = $1, woocommerce_order_number = $2,
             tracking_url = $3, updated_at = NOW() WHERE id = $4`,
            [String(wcOrder.id), String(wcOrder.number),
             `https://patriciaelias.com.br/rastreio-de-pedido/?pedido=${wcOrder.number}`,
             orderId]
        );

        res.json({
            success: true,
            woocommerce_order_id: wcOrder.id,
            woocommerce_order_number: wcOrder.number
        });
    } catch (err) {
        console.error('Erro ao criar pedido WooCommerce:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/woocommerce/update-status', authenticateToken, async (req, res) => {
    try {
        const { orderId, status } = req.body;

        const { rows } = await db.query('SELECT woocommerce_order_id FROM orders WHERE id = $1', [orderId]);
        if (rows.length === 0 || !rows[0].woocommerce_order_id) {
            return res.status(404).json({ error: 'Pedido sem WooCommerce ID' });
        }

        await woocommerceService.updateOrderStatus(rows[0].woocommerce_order_id, status);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao atualizar status WooCommerce:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// PAYMENTS - Available Methods (gateway-aware)
// =============================================

app.get('/payments/available-methods', authenticateToken, async (req, res) => {
    try {
        const { address_id, state: queryState } = req.query;
        let state = queryState;

        if (address_id && !state) {
            const { rows } = await db.query('SELECT state FROM addresses WHERE id = $1', [address_id]);
            if (rows.length > 0) state = rows[0].state;
        }

        const resolved = await billingService.resolveForState(state);

        if (!resolved) {
            // Nenhuma empresa configurada — retornar fallback iPag
            return res.json({
                availableMethods: ['credit_card', 'pix'],
                billingCompanyName: null,
                gatewayForCreditCard: { type: 'ipag', publicKey: null },
                gatewayForPix: { type: 'ipag' },
                useFallback: true
            });
        }

        res.json({
            availableMethods: resolved.availableMethods,
            billingCompanyId: resolved.billingCompanyId,
            billingCompanyName: resolved.billingCompanyName,
            gatewayForCreditCard: resolved.gatewayForCreditCard,
            gatewayForPix: resolved.gatewayForPix,
            useFallback: false
        });
    } catch (err) {
        console.error('Erro ao buscar metodos disponiveis:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// ADMIN - Billing Companies CRUD
// =============================================

app.get('/admin/billing-companies', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM billing_companies ORDER BY id');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/admin/billing-companies', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, cnpj, razao_social, states, is_default } = req.body;
        if (!name || !cnpj || !states || states.length === 0) {
            return res.status(400).json({ error: 'name, cnpj e states sao obrigatorios' });
        }

        // Se is_default, desmarcar outras
        if (is_default) {
            await db.query('UPDATE billing_companies SET is_default = false');
        }

        const { rows } = await db.query(
            `INSERT INTO billing_companies (name, cnpj, razao_social, states, is_default)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, cnpj, razao_social || null, states, is_default || false]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/admin/billing-companies/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, cnpj, razao_social, states, is_default, active } = req.body;

        if (is_default) {
            await db.query('UPDATE billing_companies SET is_default = false WHERE id != $1', [req.params.id]);
        }

        const { rows } = await db.query(
            `UPDATE billing_companies SET
                name = COALESCE($1, name),
                cnpj = COALESCE($2, cnpj),
                razao_social = COALESCE($3, razao_social),
                states = COALESCE($4, states),
                is_default = COALESCE($5, is_default),
                active = COALESCE($6, active),
                updated_at = NOW()
             WHERE id = $7 RETURNING *`,
            [name, cnpj, razao_social, states, is_default, active, req.params.id]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Empresa nao encontrada' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/admin/billing-companies/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM billing_companies WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// ADMIN - Payment Gateways CRUD
// =============================================

app.get('/admin/payment-gateways', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT pg.*, bc.name as company_name
             FROM payment_gateways pg
             JOIN billing_companies bc ON bc.id = pg.billing_company_id
             ORDER BY pg.billing_company_id, pg.priority DESC`
        );

        // Mascarar credenciais sensiveis
        const masked = rows.map(gw => {
            const creds = { ...gw.credentials };
            for (const key of Object.keys(creds)) {
                if (typeof creds[key] === 'string' && creds[key].length > 8) {
                    creds[key] = '****' + creds[key].slice(-4);
                }
            }
            // Para mercadopago OAuth: expor status de conexao, esconder tokens internos
            if (gw.gateway_type === 'mercadopago') {
                creds.oauth_connected = !!gw.credentials?.access_token;
                delete creds.access_token;
                delete creds.refresh_token;
                delete creds.token_expires_at;
                delete creds.oauth_state;
                delete creds.code_verifier;
                delete creds.mp_user_id;
            }
            return { ...gw, credentials_masked: creds, credentials: undefined };
        });

        res.json(masked);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/admin/payment-gateways', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { billing_company_id, gateway_type, display_name, credentials, supported_methods, priority, sandbox } = req.body;

        if (!billing_company_id || !gateway_type || !credentials) {
            return res.status(400).json({ error: 'billing_company_id, gateway_type e credentials sao obrigatorios' });
        }

        const gwInfo = gatewayRouter.getGatewayInfo(gateway_type);
        if (!gwInfo) return res.status(400).json({ error: `Gateway type "${gateway_type}" nao suportado` });

        const methods = supported_methods || gwInfo.supportedMethods;

        const { rows } = await db.query(
            `INSERT INTO payment_gateways (billing_company_id, gateway_type, display_name, credentials, supported_methods, priority, sandbox)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [billing_company_id, gateway_type, display_name || gwInfo.name, credentials, methods, priority || 0, sandbox || false]
        );

        res.status(201).json({ ...rows[0], credentials: undefined });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Ja existe um gateway deste tipo para esta empresa' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.put('/admin/payment-gateways/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { display_name, credentials, supported_methods, priority, active, sandbox } = req.body;

        // Se credentials vier com valores mascarados (****), manter os antigos
        let finalCredentials = credentials;
        if (credentials) {
            const { rows: existing } = await db.query('SELECT credentials FROM payment_gateways WHERE id = $1', [req.params.id]);
            if (existing.length > 0) {
                const oldCreds = existing[0].credentials || {};
                finalCredentials = { ...oldCreds };
                for (const [key, value] of Object.entries(credentials)) {
                    if (typeof value === 'string' && !value.startsWith('****')) {
                        finalCredentials[key] = value;
                    }
                }
            }
        }

        const { rows } = await db.query(
            `UPDATE payment_gateways SET
                display_name = COALESCE($1, display_name),
                credentials = COALESCE($2, credentials),
                supported_methods = COALESCE($3, supported_methods),
                priority = COALESCE($4, priority),
                active = COALESCE($5, active),
                sandbox = COALESCE($6, sandbox),
                updated_at = NOW()
             WHERE id = $7 RETURNING *`,
            [display_name, finalCredentials ? JSON.stringify(finalCredentials) : null, supported_methods, priority, active, sandbox, req.params.id]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Gateway nao encontrado' });
        res.json({ ...rows[0], credentials: undefined });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/admin/payment-gateways/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM payment_gateways WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/admin/payment-gateways/:id/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM payment_gateways WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Gateway nao encontrado' });

        const gw = rows[0];
        const gwService = gatewayRouter.getGateway(gw.gateway_type);
        if (!gwService || !gwService.testConnection) {
            return res.json({ success: false, message: 'Gateway nao suporta teste de conexao' });
        }

        const result = await gwService.testConnection(gw.credentials);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/admin/gateway-types', authenticateToken, requireAdmin, async (req, res) => {
    res.json(gatewayRouter.GATEWAY_INFO);
});

// =============================================
// MERCADO PAGO OAuth2 — authorize, callback, refresh
// =============================================

const MP_REDIRECT_URI = `${process.env.FRONTEND_URL || 'https://revenda.pelg.com.br'}/admin/payment-gateways/mercadopago/callback`;

// Iniciar autorizacao OAuth do Mercado Pago
app.get('/admin/payment-gateways/:id/mercadopago/authorize', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM payment_gateways WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Gateway nao encontrado' });

        const gw = rows[0];
        if (gw.gateway_type !== 'mercadopago') {
            return res.status(400).json({ error: 'Este gateway nao e do tipo Mercado Pago' });
        }

        const appId = gw.credentials?.app_id;
        if (!appId) {
            return res.status(400).json({ error: 'Application ID nao configurado neste gateway' });
        }

        // Gerar state CSRF
        const csrfToken = crypto.randomBytes(16).toString('hex');
        const state = `${gw.id}:${csrfToken}`;

        // PKCE: gerar code_verifier e code_challenge
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

        // Salvar state e code_verifier no gateway
        const updatedCredentials = { ...gw.credentials, oauth_state: state, code_verifier: codeVerifier };
        await db.query(
            'UPDATE payment_gateways SET credentials = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(updatedCredentials), gw.id]
        );

        const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${appId}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;

        res.json({ authUrl });
    } catch (err) {
        console.error('Erro ao gerar URL de autorizacao MP:', err);
        res.status(500).json({ error: 'Erro ao gerar URL de autorizacao' });
    }
});

// Callback do OAuth do Mercado Pago (rota publica — redirect do MP)
app.get('/admin/payment-gateways/mercadopago/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2 style="color:#dc2626">Erro na autorizacao do Mercado Pago</h2>
            <p>${String(error).replace(/</g, '&lt;')}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
            </body></html>
        `);
    }

    if (!code || !state) {
        return res.status(400).send('Codigo de autorizacao ou state nao fornecido');
    }

    try {
        // Extrair gatewayId do state
        const [gatewayId] = String(state).split(':');
        if (!gatewayId) return res.status(400).send('State invalido');

        const { rows } = await db.query('SELECT * FROM payment_gateways WHERE id = $1', [gatewayId]);
        if (rows.length === 0) return res.status(404).send('Gateway nao encontrado');

        const gw = rows[0];

        // Validar CSRF state
        if (gw.credentials?.oauth_state !== state) {
            return res.status(400).send('State CSRF invalido');
        }

        // Trocar code por tokens (com PKCE code_verifier)
        const tokenResponse = await axios.post('https://api.mercadopago.com/oauth/token', {
            client_id: gw.credentials.app_id,
            client_secret: gw.credentials.app_secret,
            code: code,
            redirect_uri: MP_REDIRECT_URI,
            grant_type: 'authorization_code',
            code_verifier: gw.credentials.code_verifier
        });

        const { access_token, refresh_token, expires_in, public_key, user_id } = tokenResponse.data;

        // Salvar tokens no credentials JSONB
        const updatedCredentials = {
            ...gw.credentials,
            access_token,
            refresh_token,
            public_key: public_key || gw.credentials.public_key,
            mp_user_id: user_id,
            token_expires_at: new Date(Date.now() + (expires_in * 1000)).toISOString()
        };
        delete updatedCredentials.oauth_state;
        delete updatedCredentials.code_verifier;

        await db.query(
            'UPDATE payment_gateways SET credentials = $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(updatedCredentials), gw.id]
        );

        console.log(`[MP OAuth] Conectado com sucesso para gateway ${gw.id}`);

        res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2 style="color:#16a34a">Mercado Pago conectado com sucesso!</h2>
            <p>Voce pode fechar esta janela.</p>
            <script>
                window.opener && window.opener.postMessage('mercadopago-oauth-success', '*');
                setTimeout(() => window.close(), 2000);
            </script>
            </body></html>
        `);
    } catch (err) {
        console.error('[MP OAuth] Erro no callback:', err.response?.data || err.message);
        const errorMsg = String(err.response?.data?.message || err.message).replace(/</g, '&lt;');
        res.status(500).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2 style="color:#dc2626">Erro ao conectar Mercado Pago</h2>
            <p>${errorMsg}</p>
            <script>setTimeout(() => window.close(), 5000);</script>
            </body></html>
        `);
    }
});

// Refresh token do Mercado Pago
async function refreshMercadoPagoToken(gatewayId) {
    const { rows } = await db.query('SELECT * FROM payment_gateways WHERE id = $1', [gatewayId]);
    if (rows.length === 0) throw new Error('Gateway nao encontrado');

    const gw = rows[0];
    if (!gw.credentials?.refresh_token) throw new Error('Refresh token nao disponivel');

    const tokenResponse = await axios.post('https://api.mercadopago.com/oauth/token', {
        client_id: gw.credentials.app_id,
        client_secret: gw.credentials.app_secret,
        grant_type: 'refresh_token',
        refresh_token: gw.credentials.refresh_token
    });

    const { access_token, refresh_token, expires_in, public_key } = tokenResponse.data;

    const updatedCredentials = {
        ...gw.credentials,
        access_token,
        refresh_token: refresh_token || gw.credentials.refresh_token,
        public_key: public_key || gw.credentials.public_key,
        token_expires_at: new Date(Date.now() + (expires_in * 1000)).toISOString()
    };

    await db.query(
        'UPDATE payment_gateways SET credentials = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(updatedCredentials), gatewayId]
    );

    console.log(`[MP AutoRefresh] Token renovado para gateway ${gatewayId}`);
}

// Auto-refresh dos tokens do Mercado Pago (a cada 30 minutos)
async function autoRefreshMercadoPagoTokens() {
    try {
        const { rows } = await db.query(
            "SELECT id, credentials FROM payment_gateways WHERE gateway_type = 'mercadopago' AND active = true"
        );

        for (const gw of rows) {
            if (!gw.credentials?.access_token || !gw.credentials?.token_expires_at) continue;

            const expiresAt = new Date(gw.credentials.token_expires_at);
            const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

            if (expiresAt < oneHourFromNow) {
                try {
                    console.log(`[MP AutoRefresh] Token do gateway ${gw.id} expira em breve, renovando...`);
                    await refreshMercadoPagoToken(gw.id);
                } catch (err) {
                    console.error(`[MP AutoRefresh] Erro gateway ${gw.id}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error('[MP AutoRefresh] Erro geral:', err.message);
    }
}

setInterval(autoRefreshMercadoPagoTokens, 30 * 60 * 1000);
setTimeout(autoRefreshMercadoPagoTokens, 15000);

// =============================================
// ADMIN - Integracoes (Conexoes externas)
// =============================================

const INTEGRATION_TYPES = {
    woocommerce: {
        name: 'WooCommerce',
        description: 'Sincronizacao com loja WooCommerce',
        testable: true,
        credentialFields: [
            { key: 'wc_url', label: 'URL da Loja', type: 'text', placeholder: 'https://sualoja.com.br' },
            { key: 'wc_consumer_key', label: 'Consumer Key', type: 'password' },
            { key: 'wc_consumer_secret', label: 'Consumer Secret', type: 'password' }
        ]
    },
    smtp: {
        name: 'SMTP / Email',
        description: 'Configuracao de envio de emails via SMTP',
        testable: true,
        credentialFields: [
            { key: 'smtp_address', label: 'Servidor SMTP', type: 'text', placeholder: 'smtp.hostinger.com' },
            { key: 'smtp_port', label: 'Porta', type: 'text', placeholder: '587' },
            { key: 'smtp_username', label: 'Usuario (email)', type: 'text', placeholder: 'email@seudominio.com' },
            { key: 'smtp_password', label: 'Senha', type: 'password' }
        ]
    },
    bling: {
        name: 'Bling ERP',
        description: 'Integracao com Bling via OAuth2',
        testable: true,
        oauth: true,
        credentialFields: [
            { key: 'client_id', label: 'Client ID', type: 'text' },
            { key: 'client_secret', label: 'Client Secret', type: 'password' }
        ]
    },
    meta: {
        name: 'Meta / Facebook',
        description: 'WhatsApp, Pixel e API de Conversoes via OAuth2',
        testable: true,
        oauth: true,
        credentialFields: [
            { key: 'app_id', label: 'App ID', type: 'text' },
            { key: 'app_secret', label: 'App Secret', type: 'password' }
        ]
    }
};

// Helper: mascarar credenciais
function maskCredentials(creds) {
    const masked = {};
    const hideKeys = ['oauth_state', 'token_expires_at', 'pixel_name']; // campos internos que nao devem aparecer
    for (const [key, value] of Object.entries(creds || {})) {
        if (hideKeys.includes(key)) continue;
        if (typeof value === 'string' && value.length > 8) {
            masked[key] = '****' + value.slice(-4);
        } else if (typeof value === 'string' && value.length > 0) {
            masked[key] = '****';
        } else {
            masked[key] = value;
        }
    }
    return masked;
}

// GET /admin/integration-types — config dos tipos
app.get('/admin/integration-types', authenticateToken, requireAdmin, async (req, res) => {
    res.json(INTEGRATION_TYPES);
});

// GET /admin/integrations — listar todas (credenciais mascaradas)
app.get('/admin/integrations', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM integrations ORDER BY integration_type');
        const masked = rows.map(row => {
            const item = {
                ...row,
                credentials_masked: maskCredentials(row.credentials),
                credentials: undefined
            };
            // Incluir status OAuth para integracoes com oauth: true
            const typeInfo = INTEGRATION_TYPES[row.integration_type];
            if (typeInfo?.oauth) {
                const creds = row.credentials || {};
                item.oauth = true;
                if (creds.access_token) {
                    const expiresAt = creds.token_expires_at ? new Date(creds.token_expires_at) : null;
                    const now = new Date();
                    item.oauth_status = {
                        authorized: true,
                        token_expires_at: creds.token_expires_at || null,
                        expired: expiresAt ? expiresAt <= now : false
                    };
                    // Incluir pixel_id para meta
                    if (row.integration_type === 'meta') {
                        item.oauth_status.pixel_id = creds.pixel_id || null;
                        item.oauth_status.pixel_name = creds.pixel_name || null;
                    }
                } else {
                    item.oauth_status = { authorized: false };
                }
            }
            return item;
        });
        res.json(masked);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /admin/integrations — UPSERT (criar ou atualizar)
app.post('/admin/integrations', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { integration_type, credentials, active } = req.body;

        if (!integration_type || !credentials) {
            return res.status(400).json({ error: 'integration_type e credentials sao obrigatorios' });
        }

        const typeInfo = INTEGRATION_TYPES[integration_type];
        if (!typeInfo) return res.status(400).json({ error: `Tipo "${integration_type}" nao suportado` });

        const { rows } = await db.query(
            `INSERT INTO integrations (integration_type, display_name, description, credentials, active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (integration_type) DO UPDATE SET
                credentials = $4,
                active = $5,
                updated_at = NOW()
             RETURNING *`,
            [integration_type, typeInfo.name, typeInfo.description, JSON.stringify(credentials), active !== false]
        );

        res.status(201).json({ ...rows[0], credentials: undefined, credentials_masked: maskCredentials(rows[0].credentials) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /admin/integrations/:type — atualizar credenciais/active (smart merge)
app.put('/admin/integrations/:type', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { credentials, active } = req.body;

        let finalCredentials = credentials;
        if (credentials) {
            const { rows: existing } = await db.query(
                'SELECT credentials FROM integrations WHERE integration_type = $1', [req.params.type]
            );
            if (existing.length > 0) {
                const oldCreds = existing[0].credentials || {};
                finalCredentials = { ...oldCreds };
                for (const [key, value] of Object.entries(credentials)) {
                    if (typeof value === 'string' && !value.startsWith('****')) {
                        finalCredentials[key] = value;
                    }
                }
            }
        }

        const { rows } = await db.query(
            `UPDATE integrations SET
                credentials = COALESCE($1, credentials),
                active = COALESCE($2, active),
                updated_at = NOW()
             WHERE integration_type = $3 RETURNING *`,
            [finalCredentials ? JSON.stringify(finalCredentials) : null, active, req.params.type]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Integracao nao encontrada' });
        res.json({ ...rows[0], credentials: undefined, credentials_masked: maskCredentials(rows[0].credentials) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /admin/integrations/:type — remover integracao
app.delete('/admin/integrations/:type', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM integrations WHERE integration_type = $1', [req.params.type]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// BLING OAuth2 — authorize, callback, refresh
// =============================================

const BLING_REDIRECT_URI = `${process.env.FRONTEND_URL || 'https://revenda.pelg.com.br'}/admin/integrations/bling/callback`;

// Helper: refresh token do Bling e salvar no DB
async function refreshBlingToken(integrationType) {
    const { rows } = await db.query(
        'SELECT credentials FROM integrations WHERE integration_type = $1', [integrationType]
    );
    if (rows.length === 0) throw new Error('Integracao Bling nao encontrada');
    const creds = rows[0].credentials || {};
    if (!creds.refresh_token || !creds.client_id || !creds.client_secret) {
        throw new Error('Credenciais incompletas para refresh');
    }

    const basicAuth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
    const resp = await axios.post('https://www.bling.com.br/Api/v3/oauth/token',
        new URLSearchParams({ grant_type: 'refresh_token', refresh_token: creds.refresh_token }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` } }
    );

    const { access_token, refresh_token, expires_in } = resp.data;
    const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();

    await db.query(
        `UPDATE integrations SET credentials = credentials || $1, updated_at = NOW() WHERE integration_type = $2`,
        [JSON.stringify({ access_token, refresh_token, token_expires_at: tokenExpiresAt }), integrationType]
    );

    return access_token;
}

// Auto-refresh: renova token do Bling automaticamente quando falta 1h para expirar
async function autRefreshBlingToken() {
    try {
        const { rows } = await db.query(
            "SELECT credentials FROM integrations WHERE integration_type = 'bling' AND active = true"
        );
        if (rows.length === 0) return;

        const creds = rows[0].credentials || {};
        if (!creds.access_token || !creds.refresh_token) return;

        const expiresAt = creds.token_expires_at ? new Date(creds.token_expires_at) : null;
        if (!expiresAt) return;

        const now = new Date();
        const msUntilExpiry = expiresAt.getTime() - now.getTime();
        const oneHour = 60 * 60 * 1000;

        // Renova se falta menos de 1 hora para expirar (ou ja expirou)
        if (msUntilExpiry < oneHour) {
            console.log(`[AutoRefresh Bling] Token expira em ${Math.round(msUntilExpiry / 60000)}min, renovando...`);
            await refreshBlingToken('bling');
            console.log('[AutoRefresh Bling] Token renovado com sucesso!');
        }
    } catch (err) {
        console.error('[AutoRefresh Bling] Erro ao renovar token:', err.message);
    }
}

// Rodar auto-refresh a cada 30 minutos
setInterval(autRefreshBlingToken, 30 * 60 * 1000);
// Rodar uma vez no boot (com delay de 10s para o banco estar pronto)
setTimeout(autRefreshBlingToken, 10000);

// Auto-refresh tokens Bling por empresa faturadora (a cada 30min)
setInterval(() => blingService.autoRefreshAllBlingCompanyTokens(), 30 * 60 * 1000);
setTimeout(() => blingService.autoRefreshAllBlingCompanyTokens(), 12000);

// GET /admin/integrations/bling/authorize — gerar URL OAuth
app.get('/admin/integrations/bling/authorize', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT credentials FROM integrations WHERE integration_type = 'bling'");
        if (rows.length === 0) return res.status(400).json({ error: 'Configure o Client ID e Client Secret primeiro' });

        const creds = rows[0].credentials || {};
        if (!creds.client_id) return res.status(400).json({ error: 'Client ID nao configurado' });

        // Gerar state CSRF
        const state = crypto.randomBytes(16).toString('hex');
        await db.query(
            `UPDATE integrations SET credentials = credentials || $1, updated_at = NOW() WHERE integration_type = 'bling'`,
            [JSON.stringify({ oauth_state: state })]
        );

        const url = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${encodeURIComponent(creds.client_id)}&state=${state}&redirect_uri=${encodeURIComponent(BLING_REDIRECT_URI)}`;
        res.json({ url });
    } catch (err) {
        console.error('Erro ao gerar URL Bling OAuth:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /admin/integrations/bling/callback — receber code do Bling
app.get('/admin/integrations/bling/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.status(400).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h1 style="color:#dc2626">Erro na autorizacao Bling</h1>
            <p>${String(error).replace(/</g, '&lt;')}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
            </body></html>
        `);
    }

    if (!code) {
        return res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Codigo de autorizacao nao fornecido</h1></body></html>');
    }

    try {
        // Validar state CSRF
        const { rows } = await db.query("SELECT credentials FROM integrations WHERE integration_type = 'bling'");
        if (rows.length === 0) throw new Error('Integracao Bling nao encontrada');

        const creds = rows[0].credentials || {};
        if (creds.oauth_state && state !== creds.oauth_state) {
            return res.status(400).send(`
                <html><body style="font-family:sans-serif;text-align:center;padding:60px">
                <h1 style="color:#dc2626">Erro: state invalido</h1>
                <p>Possivel tentativa de CSRF. Tente autorizar novamente.</p>
                </body></html>
            `);
        }

        if (!creds.client_id || !creds.client_secret) throw new Error('Client ID e Client Secret nao configurados');

        // Trocar code por tokens
        const basicAuth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
        const tokenResp = await axios.post('https://www.bling.com.br/Api/v3/oauth/token',
            new URLSearchParams({ grant_type: 'authorization_code', code }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` } }
        );

        const { access_token, refresh_token, expires_in } = tokenResp.data;
        const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();

        // Salvar tokens e limpar oauth_state
        await db.query(
            `UPDATE integrations SET credentials = (credentials - 'oauth_state') || $1, updated_at = NOW() WHERE integration_type = 'bling'`,
            [JSON.stringify({ access_token, refresh_token, token_expires_at: tokenExpiresAt })]
        );

        res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h1 style="color:#16a34a">Bling autorizado com sucesso!</h1>
            <p>Pode fechar esta aba. A pagina de conexoes sera atualizada automaticamente.</p>
            <script>
                if (window.opener) { window.opener.postMessage('bling-oauth-success', '*'); }
                setTimeout(() => window.close(), 3000);
            </script>
            </body></html>
        `);
    } catch (err) {
        console.error('Erro callback Bling OAuth:', err.message);
        res.status(500).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h1 style="color:#dc2626">Erro ao conectar Bling</h1>
            <p>${String(err.message).replace(/</g, '&lt;')}</p>
            </body></html>
        `);
    }
});

// =============================================
// BLING POR EMPRESA FATURADORA — OAuth, Webhook, CRUD
// =============================================

// PUT /admin/billing-companies/:id/bling — salvar client_id e client_secret
app.put('/admin/billing-companies/:id/bling', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { client_id, client_secret } = req.body;
        if (!client_id || !client_secret) return res.status(400).json({ error: 'client_id e client_secret sao obrigatorios' });

        await db.query(
            `UPDATE billing_companies SET bling_credentials = COALESCE(bling_credentials, '{}') || $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify({ client_id, client_secret }), req.params.id]
        );
        res.json({ success: true, message: 'Credenciais Bling salvas' });
    } catch (err) {
        console.error('Erro ao salvar credenciais Bling:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /admin/billing-companies/:id/bling — status da conexao
app.get('/admin/billing-companies/:id/bling', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT bling_credentials FROM billing_companies WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Empresa nao encontrada' });

        const creds = rows[0].bling_credentials || {};
        const hasCredentials = !!(creds.client_id && creds.client_secret);
        const isConnected = !!(creds.access_token && creds.refresh_token);
        const expiresAt = creds.token_expires_at ? new Date(creds.token_expires_at) : null;
        const isExpiring = expiresAt ? (expiresAt.getTime() - Date.now() < 60 * 60 * 1000) : false;

        res.json({
            has_credentials: hasCredentials,
            connected: isConnected,
            expires_at: creds.token_expires_at || null,
            is_expiring: isExpiring,
            client_id: creds.client_id || ''
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /admin/billing-companies/:id/bling/test — testar conexao
app.post('/admin/billing-companies/:id/bling/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const accessToken = await blingService.getBlingToken(parseInt(req.params.id));
        const resp = await axios.get('https://www.bling.com.br/Api/v3/contatos?limite=1', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        res.json({ success: true, message: 'Bling conectado com sucesso!' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// GET /admin/billing-companies/:id/bling/authorize — gerar URL OAuth
app.get('/admin/billing-companies/:id/bling/authorize', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const companyId = req.params.id;
        const { rows } = await db.query('SELECT bling_credentials FROM billing_companies WHERE id = $1', [companyId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Empresa nao encontrada' });

        const creds = rows[0].bling_credentials || {};
        if (!creds.client_id) return res.status(400).json({ error: 'Client ID nao configurado' });

        const state = crypto.randomBytes(16).toString('hex');
        await db.query(
            `UPDATE billing_companies SET bling_credentials = bling_credentials || $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify({ oauth_state: state }), companyId]
        );

        const redirectUri = `${process.env.API_URL || process.env.FRONTEND_URL || 'https://revenda.pelg.com.br'}/admin/billing-companies/${companyId}/bling/callback`;
        const url = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${encodeURIComponent(creds.client_id)}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        res.json({ url });
    } catch (err) {
        console.error('Erro ao gerar URL Bling OAuth (empresa):', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /admin/billing-companies/:id/bling/callback — receber code do Bling
app.get('/admin/billing-companies/:id/bling/callback', async (req, res) => {
    const companyId = req.params.id;
    const { code, state, error } = req.query;

    if (error) {
        return res.status(400).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h1 style="color:#dc2626">Erro na autorizacao Bling</h1>
            <p>${String(error).replace(/</g, '&lt;')}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
            </body></html>
        `);
    }

    if (!code) {
        return res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Codigo de autorizacao nao fornecido</h1></body></html>');
    }

    try {
        const { rows } = await db.query('SELECT bling_credentials FROM billing_companies WHERE id = $1', [companyId]);
        if (rows.length === 0) throw new Error('Empresa faturadora nao encontrada');

        const creds = rows[0].bling_credentials || {};
        if (creds.oauth_state && state !== creds.oauth_state) {
            return res.status(400).send(`
                <html><body style="font-family:sans-serif;text-align:center;padding:60px">
                <h1 style="color:#dc2626">Erro: state invalido</h1>
                <p>Possivel tentativa de CSRF. Tente autorizar novamente.</p>
                </body></html>
            `);
        }

        if (!creds.client_id || !creds.client_secret) throw new Error('Client ID e Client Secret nao configurados');

        const basicAuth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
        const redirectUri = `${process.env.API_URL || process.env.FRONTEND_URL || 'https://revenda.pelg.com.br'}/admin/billing-companies/${companyId}/bling/callback`;

        const tokenResp = await axios.post('https://www.bling.com.br/Api/v3/oauth/token',
            new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` } }
        );

        const { access_token, refresh_token, expires_in } = tokenResp.data;
        const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();

        await db.query(
            `UPDATE billing_companies SET bling_credentials = (bling_credentials - 'oauth_state') || $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify({ access_token, refresh_token, token_expires_at: tokenExpiresAt }), companyId]
        );

        res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h1 style="color:#16a34a">Bling autorizado com sucesso!</h1>
            <p>Pode fechar esta aba.</p>
            <script>
                if (window.opener) { window.opener.postMessage('bling-company-oauth-success', '*'); }
                setTimeout(() => window.close(), 3000);
            </script>
            </body></html>
        `);
    } catch (err) {
        console.error('Erro callback Bling OAuth (empresa):', err.message);
        res.status(500).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h1 style="color:#dc2626">Erro ao conectar Bling</h1>
            <p>${String(err.message).replace(/</g, '&lt;')}</p>
            </body></html>
        `);
    }
});

// POST /webhooks/bling/:billingCompanyId — webhook do Bling (publico)
app.post('/webhooks/bling/:billingCompanyId', async (req, res) => {
    const { billingCompanyId } = req.params;
    console.log(`[Bling Webhook] Recebido para empresa ${billingCompanyId}:`, JSON.stringify(req.body));

    try {
        const payload = req.body;
        const blingOrderId = payload?.data?.id;
        if (!blingOrderId) {
            console.warn('[Bling Webhook] Payload sem data.id, ignorando');
            return res.sendStatus(200);
        }

        // Get Bling token for this company
        const accessToken = await blingService.getBlingToken(parseInt(billingCompanyId));

        // Fetch order details from Bling
        const blingOrder = await blingService.fetchBlingOrderDetails(accessToken, blingOrderId);
        if (!blingOrder) {
            console.warn(`[Bling Webhook] Pedido Bling ${blingOrderId} nao encontrado na API`);
            return res.sendStatus(200);
        }

        const numeroPedidoLoja = blingOrder.numeroPedidoLoja || blingOrder.numero;
        if (!numeroPedidoLoja) {
            console.warn('[Bling Webhook] Pedido Bling sem numeroPedidoLoja');
            return res.sendStatus(200);
        }

        // Match local order by woocommerce_order_number
        const { rows: localOrders } = await db.query(
            'SELECT * FROM orders WHERE woocommerce_order_number = $1',
            [String(numeroPedidoLoja)]
        );
        if (localOrders.length === 0) {
            console.warn(`[Bling Webhook] Pedido local nao encontrado para numeroPedidoLoja=${numeroPedidoLoja}`);
            return res.sendStatus(200);
        }

        const localOrder = localOrders[0];
        const updates = { bling_order_id: String(blingOrderId) };

        // Extract tracking info
        const transporte = blingOrder.transporte || {};
        const volumes = transporte.volumes || [];
        if (volumes.length > 0 && volumes[0].codigoRastreamento) {
            updates.tracking_code = volumes[0].codigoRastreamento;

            // Build tracking URL
            const code = updates.tracking_code;
            if (code.match(/^[A-Z]{2}\d+[A-Z]{2}$/)) {
                updates.tracking_url = `https://www.linkcorreios.com.br/?id=${code}`;
            }
        }

        // Extract carrier
        const transportador = transporte.transportador || transporte.nomeTransportador;
        if (transportador) {
            updates.carrier = typeof transportador === 'object' ? transportador.nome : String(transportador);
        }

        // Extract NF info
        const notaFiscal = blingOrder.notaFiscal || (blingOrder.notas && blingOrder.notas.length > 0 ? blingOrder.notas[0] : null);
        if (notaFiscal) {
            const nfId = notaFiscal.id;
            if (nfId) {
                try {
                    const nfDetails = await blingService.fetchBlingNfe(accessToken, nfId);
                    if (nfDetails) {
                        updates.nota_fiscal_number = nfDetails.numero || notaFiscal.numero;
                        updates.nota_fiscal_serie = nfDetails.serie || notaFiscal.serie;

                        // Download DANFE PDF
                        const pdfLink = nfDetails.linkDanfe || nfDetails.xml?.linkDanfe;
                        if (pdfLink) {
                            try {
                                const savedPath = await blingService.downloadAndSaveDanfe(pdfLink, localOrder.id, accessToken);
                                updates.nota_fiscal_pdf_url = savedPath;
                            } catch (dlErr) {
                                console.error(`[Bling Webhook] Erro ao baixar DANFE:`, dlErr.message);
                            }
                        }
                    }
                } catch (nfErr) {
                    console.error(`[Bling Webhook] Erro ao buscar NF ${nfId}:`, nfErr.message);
                    // Fallback: use info from the order itself
                    updates.nota_fiscal_number = notaFiscal.numero;
                    updates.nota_fiscal_serie = notaFiscal.serie;
                }
            } else {
                updates.nota_fiscal_number = notaFiscal.numero;
                updates.nota_fiscal_serie = notaFiscal.serie;
            }
        }

        // Determine status update
        const situacao = blingOrder.situacao?.valor || blingOrder.situacao?.id;
        if (situacao) {
            const situacaoLower = String(situacao).toLowerCase();
            if (situacaoLower.includes('enviado') || situacaoLower.includes('shipped') || situacaoLower === '9') {
                if (!['shipped', 'delivered'].includes(localOrder.status)) {
                    updates.status = 'shipped';
                }
            } else if (situacaoLower.includes('entregue') || situacaoLower.includes('delivered') || situacaoLower === '10') {
                updates.status = 'delivered';
            }
        }

        // Build UPDATE query
        const setClauses = [];
        const values = [];
        let paramIdx = 1;
        for (const [key, val] of Object.entries(updates)) {
            if (val !== undefined && val !== null) {
                setClauses.push(`${key} = $${paramIdx}`);
                values.push(val);
                paramIdx++;
            }
        }

        if (setClauses.length > 0) {
            setClauses.push(`updated_at = NOW()`);
            values.push(localOrder.id);
            await db.query(
                `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
                values
            );
            console.log(`[Bling Webhook] Pedido ${localOrder.id} atualizado:`, JSON.stringify(updates));
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('[Bling Webhook] Erro:', err.message);
        res.sendStatus(200); // Always return 200 to avoid retries from Bling
    }
});

// =============================================
// META OAuth2 — authorize, callback, pixels
// =============================================

const META_REDIRECT_URI = `${process.env.FRONTEND_URL || 'https://revenda.pelg.com.br'}/admin/integrations/meta/callback`;
const META_SCOPES = 'ads_management,whatsapp_business_messaging,business_management';

// GET /admin/integrations/meta/authorize — gerar URL OAuth Meta
app.get('/admin/integrations/meta/authorize', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT credentials FROM integrations WHERE integration_type = 'meta'");
        if (rows.length === 0) return res.status(400).json({ error: 'Configure o App ID e App Secret primeiro' });

        const creds = rows[0].credentials || {};
        if (!creds.app_id) return res.status(400).json({ error: 'App ID nao configurado' });

        // Gerar state CSRF
        const state = crypto.randomBytes(16).toString('hex');
        await db.query(
            `UPDATE integrations SET credentials = credentials || $1, updated_at = NOW() WHERE integration_type = 'meta'`,
            [JSON.stringify({ oauth_state: state })]
        );

        const url = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${encodeURIComponent(creds.app_id)}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&state=${state}&scope=${encodeURIComponent(META_SCOPES)}`;
        res.json({ url });
    } catch (err) {
        console.error('Erro ao gerar URL Meta OAuth:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /admin/integrations/meta/callback — receber code do Meta
app.get('/admin/integrations/meta/callback', async (req, res) => {
    const { code, state, error_reason } = req.query;

    if (error_reason) {
        return res.status(400).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h1 style="color:#dc2626">Erro na autorizacao Meta</h1>
            <p>${String(error_reason).replace(/</g, '&lt;')}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
            </body></html>
        `);
    }

    if (!code) {
        return res.status(400).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Codigo de autorizacao nao fornecido</h1></body></html>');
    }

    try {
        // Validar state CSRF
        const { rows } = await db.query("SELECT credentials FROM integrations WHERE integration_type = 'meta'");
        if (rows.length === 0) throw new Error('Integracao Meta nao encontrada');

        const creds = rows[0].credentials || {};
        if (creds.oauth_state && state !== creds.oauth_state) {
            return res.status(400).send(`
                <html><body style="font-family:sans-serif;text-align:center;padding:60px">
                <h1 style="color:#dc2626">Erro: state invalido</h1>
                <p>Possivel tentativa de CSRF. Tente autorizar novamente.</p>
                </body></html>
            `);
        }

        if (!creds.app_id || !creds.app_secret) throw new Error('App ID e App Secret nao configurados');

        // 1. Trocar code por short-lived token
        const shortResp = await axios.get('https://graph.facebook.com/v22.0/oauth/access_token', {
            params: {
                client_id: creds.app_id,
                client_secret: creds.app_secret,
                redirect_uri: META_REDIRECT_URI,
                code
            },
            timeout: 15000
        });

        const shortToken = shortResp.data.access_token;

        // 2. Trocar short-lived por long-lived token (60 dias)
        const longResp = await axios.get('https://graph.facebook.com/v22.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: creds.app_id,
                client_secret: creds.app_secret,
                fb_exchange_token: shortToken
            },
            timeout: 15000
        });

        const longToken = longResp.data.access_token;
        const expiresIn = longResp.data.expires_in || 5184000; // 60 dias padrao
        const tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();

        // Salvar long-lived token e limpar oauth_state
        await db.query(
            `UPDATE integrations SET credentials = (credentials - 'oauth_state') || $1, updated_at = NOW() WHERE integration_type = 'meta'`,
            [JSON.stringify({ access_token: longToken, token_expires_at: tokenExpiresAt })]
        );

        res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h1 style="color:#16a34a">Meta autorizado com sucesso!</h1>
            <p>Pode fechar esta aba. A pagina de conexoes sera atualizada automaticamente.</p>
            <script>
                if (window.opener) { window.opener.postMessage('meta-oauth-success', '*'); }
                setTimeout(() => window.close(), 3000);
            </script>
            </body></html>
        `);
    } catch (err) {
        console.error('Erro callback Meta OAuth:', err.response?.data || err.message);
        res.status(500).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h1 style="color:#dc2626">Erro ao conectar Meta</h1>
            <p>${String(err.response?.data?.error?.message || err.message).replace(/</g, '&lt;')}</p>
            </body></html>
        `);
    }
});

// GET /admin/integrations/meta/pixels — listar pixels disponiveis
app.get('/admin/integrations/meta/pixels', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT credentials FROM integrations WHERE integration_type = 'meta'");
        if (rows.length === 0) return res.status(400).json({ error: 'Meta nao configurado' });

        const creds = rows[0].credentials || {};
        if (!creds.access_token) return res.status(400).json({ error: 'Meta nao autorizado. Autorize primeiro.' });

        // Buscar ad accounts
        const accountsResp = await axios.get('https://graph.facebook.com/v22.0/me/adaccounts', {
            params: { fields: 'id,name,account_id', access_token: creds.access_token, limit: 100 },
            timeout: 15000
        });

        const adAccounts = accountsResp.data?.data || [];
        const pixels = [];

        // Para cada ad account, buscar pixels
        for (const account of adAccounts) {
            try {
                const pixelsResp = await axios.get(`https://graph.facebook.com/v22.0/${account.id}/adspixels`, {
                    params: { fields: 'id,name', access_token: creds.access_token },
                    timeout: 10000
                });
                const accountPixels = pixelsResp.data?.data || [];
                for (const pixel of accountPixels) {
                    pixels.push({
                        id: pixel.id,
                        name: pixel.name,
                        ad_account_name: account.name || account.account_id
                    });
                }
            } catch (pixelErr) {
                // Ignorar ad accounts sem permissao de pixel
                console.warn(`Nao foi possivel buscar pixels da conta ${account.id}:`, pixelErr.response?.data?.error?.message || pixelErr.message);
            }
        }

        res.json(pixels);
    } catch (err) {
        console.error('Erro ao listar pixels Meta:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.error?.message || err.message });
    }
});

// PUT /admin/integrations/meta/pixel — salvar pixel selecionado
app.put('/admin/integrations/meta/pixel', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { pixel_id, pixel_name, dataset_id } = req.body;
        if (!pixel_id) return res.status(400).json({ error: 'pixel_id e obrigatorio' });

        const update = { pixel_id, pixel_name: pixel_name || null };
        if (dataset_id !== undefined) update.dataset_id = dataset_id;

        await db.query(
            `UPDATE integrations SET credentials = credentials || $1, updated_at = NOW() WHERE integration_type = 'meta'`,
            [JSON.stringify(update)]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao salvar pixel Meta:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /admin/integrations/:type/test — testar conexao
app.post('/admin/integrations/:type/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM integrations WHERE integration_type = $1', [req.params.type]);
        if (rows.length === 0) return res.status(404).json({ error: 'Integracao nao encontrada' });

        const integration = rows[0];
        const creds = integration.credentials || {};
        let testResult = { success: false, message: 'Tipo nao testavel' };

        switch (req.params.type) {
            case 'woocommerce': {
                const url = creds.wc_url;
                if (!url) { testResult = { success: false, message: 'URL da loja nao configurada' }; break; }
                const resp = await axios.get(`${url}/wp-json/wc/v3/system_status`, {
                    auth: { username: creds.wc_consumer_key, password: creds.wc_consumer_secret },
                    timeout: 10000
                });
                testResult = { success: true, message: `Conectado! WooCommerce ${resp.data?.environment?.version || ''}` };
                break;
            }
            case 'smtp': {
                const nodemailer = require('nodemailer');
                const transport = nodemailer.createTransport({
                    host: creds.smtp_address,
                    port: Number(creds.smtp_port) || 587,
                    secure: false,
                    auth: { user: creds.smtp_username, pass: creds.smtp_password },
                    tls: { rejectUnauthorized: false }
                });
                await transport.verify();
                testResult = { success: true, message: `SMTP conectado (${creds.smtp_address}:${creds.smtp_port || 587})` };
                break;
            }
            case 'bling': {
                let accessToken = creds.access_token;
                if (!accessToken) {
                    testResult = { success: false, message: 'Bling nao autorizado. Clique em "Autorizar no Bling".' };
                    break;
                }
                // Refresh automatico se expirado
                if (creds.token_expires_at && new Date(creds.token_expires_at) < new Date()) {
                    try {
                        accessToken = await refreshBlingToken(req.params.type);
                    } catch (refreshErr) {
                        testResult = { success: false, message: 'Token expirado e refresh falhou. Reautorize.' };
                        break;
                    }
                }
                const resp = await axios.get('https://www.bling.com.br/Api/v3/contatos?limite=1', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    timeout: 10000
                });
                testResult = { success: true, message: 'Bling conectado via OAuth2!' };
                break;
            }
            case 'meta': {
                if (!creds.access_token) {
                    testResult = { success: false, message: 'Meta nao autorizado. Clique em "Autorizar no Meta".' };
                    break;
                }
                if (!creds.pixel_id) {
                    testResult = { success: false, message: 'Pixel nao selecionado. Selecione um pixel.' };
                    break;
                }
                const metaResp = await axios.get(`https://graph.facebook.com/v22.0/${creds.pixel_id}`, {
                    params: { access_token: creds.access_token },
                    timeout: 10000
                });
                testResult = { success: true, message: `Pixel "${metaResp.data?.name || creds.pixel_id}" conectado via OAuth2!` };
                break;
            }
        }

        // Salvar resultado do teste
        await db.query(
            'UPDATE integrations SET last_tested_at = NOW(), last_test_result = $1 WHERE integration_type = $2',
            [JSON.stringify(testResult), req.params.type]
        );

        res.json(testResult);
    } catch (err) {
        const failResult = { success: false, message: err.message };
        await db.query(
            'UPDATE integrations SET last_tested_at = NOW(), last_test_result = $1 WHERE integration_type = $2',
            [JSON.stringify(failResult), req.params.type]
        ).catch(() => {});
        res.json(failResult);
    }
});

// =============================================
// WEBHOOKS
// =============================================

// Legacy iPag webhook (redirect to new)
app.post('/webhooks/ipag', async (req, res) => {
    try {
        console.log('iPag Webhook received:', JSON.stringify(req.body));
        console.log('iPag Webhook query params:', JSON.stringify(req.query));

        const { id, status, order_id } = req.body;
        // O orderId pode vir no query param (configurado no url_retorno do iPag)
        const fallbackOrderId = req.query.id;

        // Detectar se pagamento aprovado
        const statusStr = (status || '').toString().toLowerCase();
        const isPaid = statusStr === 'approved' || statusStr === 'capturado' || statusStr === 'sucesso' ||
            statusStr.includes('aprovad') || statusStr.includes('captur') ||
            statusStr === '5' || statusStr === '8';

        // Tentar encontrar o pedido por order_number (campo 'pedido' do iPag) ou por id direto
        let order = null;
        if (order_id) {
            const { rows } = await db.query('SELECT * FROM orders WHERE order_number = $1', [order_id]);
            if (rows.length > 0) order = rows[0];
        }
        if (!order && fallbackOrderId) {
            const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [fallbackOrderId]);
            if (rows.length > 0) order = rows[0];
        }

        if (!order) {
            console.warn('iPag Webhook: pedido nao encontrado. order_id:', order_id, 'fallback:', fallbackOrderId);
            return res.sendStatus(200);
        }

        // Atualizar ipag_status e ipag_transaction_id
        await db.query(
            'UPDATE orders SET ipag_status = $1, ipag_transaction_id = COALESCE($2, ipag_transaction_id), updated_at = NOW() WHERE id = $3',
            [status, id, order.id]
        );

        // Se pago e pedido ainda pending -> marcar como paid + pos-pagamento
        if (isPaid && order.status === 'pending') {
            await db.query(
                "UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1",
                [order.id]
            );
            console.log(`iPag Webhook: pedido ${order.id} marcado como paid`);

            const orderTotal = parseFloat(order.total) || 0;
            await processPostPaymentLogic(order.id, order.user_id, orderTotal, order.details);
            // WC order ja e criado/atualizado dentro de processPostPaymentLogic
        }

        // Detectar pagamento recusado/falho
        const isFailed = statusStr === 'recusado' || statusStr === 'failed' ||
            statusStr === 'declined' || statusStr === '7';

        if (isFailed && (order.status === 'pending' || order.status === 'failed')) {
            await db.query(
                "UPDATE orders SET status = 'failed', updated_at = NOW() WHERE id = $1",
                [order.id]
            );
            console.log(`iPag Webhook: pedido ${order.id} marcado como failed (status: ${statusStr})`);

            if (order.woocommerce_order_id) {
                woocommerceService.updateOrderStatus(order.woocommerce_order_id, 'failed').catch((e) => {
                    console.error('Erro ao sincronizar WC failed via webhook:', e.message);
                });
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Erro ao processar webhook iPag:', err.message);
        res.sendStatus(500);
    }
});

app.post('/webhooks/woocommerce', async (req, res) => {
    try {
        console.log('WooCommerce Webhook received:', JSON.stringify(req.body));
        const { id, number, status } = req.body;
        if (!id) return res.sendStatus(200);

        // Mapear status WC -> status revenda
        const STATUS_MAP = {
            'pending': 'pending',
            'processing': 'paid',
            'on-hold': 'pending',
            'completed': 'completed',
            'cancelled': 'canceled',
            'refunded': 'canceled',
            'failed': 'failed'
        };
        const mappedStatus = STATUS_MAP[status] || status;

        // Buscar pedido pelo woocommerce_order_id
        const { rows } = await db.query(
            'SELECT * FROM orders WHERE woocommerce_order_id = $1',
            [String(id)]
        );

        if (rows.length === 0) {
            console.warn(`WC Webhook: pedido nao encontrado para woocommerce_order_id=${id}`);
            return res.sendStatus(200);
        }
        const order = rows[0];

        // Atualizar status
        await db.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            [mappedStatus, order.id]
        );
        console.log(`WC Webhook: pedido ${order.id} status ${order.status} -> ${mappedStatus} (WC status: ${status})`);

        // Se mudou para paid e antes era pending, rodar processPostPaymentLogic
        if (mappedStatus === 'paid' && order.status === 'pending') {
            const orderTotal = parseFloat(order.total) || 0;
            await processPostPaymentLogic(order.id, order.user_id, orderTotal, order.details);
            console.log(`WC Webhook: pos-pagamento executado para pedido ${order.id}`);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Erro ao processar webhook WooCommerce:', err.message);
        res.sendStatus(500);
    }
});

// =============================================
// GATEWAY-SPECIFIC WEBHOOKS
// =============================================

app.post('/webhooks/gateway/ipag', async (req, res) => {
    try {
        console.log('iPag Gateway Webhook received:', JSON.stringify(req.body));
        const ipagGateway = require('./gateways/ipagGateway');
        const parsed = ipagGateway.parseWebhook(req);
        console.log('iPag Gateway Webhook parsed:', JSON.stringify(parsed));

        // Buscar pedido: primeiro por ID interno (campo pedido do iPag), depois por order_number
        let order = null;
        if (parsed.orderId) {
            const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [parsed.orderId]);
            if (rows.length > 0) order = rows[0];
        }
        if (!order && parsed.orderNumber) {
            const { rows } = await db.query('SELECT * FROM orders WHERE order_number = $1', [parsed.orderNumber]);
            if (rows.length > 0) order = rows[0];
        }

        if (!order) {
            console.warn('iPag Gateway Webhook: pedido nao encontrado. orderId:', parsed.orderId, 'orderNumber:', parsed.orderNumber);
            return res.sendStatus(200);
        }

        await db.query(
            'UPDATE orders SET ipag_status = $1, gateway_status = $1, ipag_transaction_id = COALESCE($2, ipag_transaction_id), gateway_transaction_id = COALESCE($2, gateway_transaction_id), updated_at = NOW() WHERE id = $3',
            [parsed.status, parsed.transactionId, order.id]
        );

        if (parsed.isPaid && order.status === 'pending') {
            await db.query("UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1", [order.id]);
            console.log(`iPag Gateway Webhook: pedido ${order.id} marcado como paid (status: ${parsed.status})`);
            const orderTotal = parseFloat(order.total) || 0;
            await processPostPaymentLogic(order.id, order.user_id, orderTotal, order.details);
        }

        // Detectar pagamento recusado/falho
        const parsedStatusStr = (parsed.status || '').toString().toLowerCase();
        const isGwFailed = parsedStatusStr === 'recusado' || parsedStatusStr === 'failed' ||
            parsedStatusStr === 'declined' || parsedStatusStr === '7';

        if (isGwFailed && (order.status === 'pending' || order.status === 'failed')) {
            await db.query("UPDATE orders SET status = 'failed', updated_at = NOW() WHERE id = $1", [order.id]);
            console.log(`iPag Gateway Webhook: pedido ${order.id} marcado como failed (status: ${parsedStatusStr})`);

            if (order.woocommerce_order_id) {
                woocommerceService.updateOrderStatus(order.woocommerce_order_id, 'failed').catch((e) => {
                    console.error('Erro ao sincronizar WC failed via gateway webhook:', e.message);
                });
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Erro webhook gateway/ipag:', err.message);
        res.sendStatus(500);
    }
});

app.post('/webhooks/gateway/mercadopago', async (req, res) => {
    try {
        console.log('Mercado Pago Webhook received:', JSON.stringify(req.body));
        const mpGateway = require('./gateways/mercadopagoGateway');
        const parsed = mpGateway.parseWebhook(req);

        if (!parsed || !parsed.transactionId) {
            return res.sendStatus(200);
        }

        // Buscar pedido pela gateway_transaction_id
        const { rows: orderRows } = await db.query(
            "SELECT o.*, pg.credentials FROM orders o LEFT JOIN payment_gateways pg ON pg.id = o.payment_gateway_id WHERE o.gateway_transaction_id = $1 OR o.ipag_transaction_id = $1",
            [parsed.transactionId]
        );

        let order = orderRows[0];

        // Se needsFetch, buscar status completo da API do MP
        if (parsed.needsFetch && order) {
            const creds = order.credentials || {};
            if (creds.access_token) {
                const status = await mpGateway.verifyPaymentStatus(parsed.transactionId, creds);
                const isPaid = status.status === 'paid';

                await db.query(
                    'UPDATE orders SET gateway_status = $1, ipag_status = $1, updated_at = NOW() WHERE id = $2',
                    [status.gateway_status || status.status, order.id]
                );

                if (isPaid && order.status === 'pending') {
                    await db.query("UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1", [order.id]);
                    const orderTotal = parseFloat(order.total) || 0;
                    await processPostPaymentLogic(order.id, order.user_id, orderTotal, order.details);
                }
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Erro webhook gateway/mercadopago:', err.message);
        res.sendStatus(200);
    }
});

app.post('/webhooks/gateway/stripe', async (req, res) => {
    try {
        console.log('Stripe Webhook received');

        // Buscar credenciais Stripe de qualquer gateway ativo
        const { rows: gwRows } = await db.query(
            "SELECT credentials FROM payment_gateways WHERE gateway_type = 'stripe' AND active = true LIMIT 1"
        );

        if (gwRows.length === 0) return res.sendStatus(200);

        const stripeGateway = require('./gateways/stripeGateway');
        const parsed = stripeGateway.parseWebhook(req, gwRows[0].credentials);

        if (!parsed) return res.sendStatus(200);

        // Buscar pedido
        let order = null;
        if (parsed.orderId) {
            const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [parsed.orderId]);
            if (rows.length > 0) order = rows[0];
        }
        if (!order && parsed.transactionId) {
            const { rows } = await db.query('SELECT * FROM orders WHERE gateway_transaction_id = $1', [parsed.transactionId]);
            if (rows.length > 0) order = rows[0];
        }

        if (!order) return res.sendStatus(200);

        await db.query(
            'UPDATE orders SET gateway_status = $1, ipag_status = $1, updated_at = NOW() WHERE id = $2',
            [parsed.status, order.id]
        );

        if (parsed.isPaid && order.status === 'pending') {
            await db.query("UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1", [order.id]);
            const orderTotal = parseFloat(order.total) || 0;
            await processPostPaymentLogic(order.id, order.user_id, orderTotal, order.details);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Erro webhook gateway/stripe:', err.message);
        res.sendStatus(200);
    }
});

// =============================================
// AUTH ROUTES (Email verification, Reset, OTP)
// Rotas publicas — sem authenticateToken
// =============================================

// 1. Enviar email de verificacao
app.post('/auth/send-verification', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email obrigatorio' });

    try {
        const { rows } = await db.query(
            'SELECT id, name, email_verified FROM users WHERE email = $1',
            [email]
        );
        if (rows.length === 0) {
            return res.json({ message: 'Se o email existir, voce recebera o link de verificacao.' });
        }

        const user = rows[0];
        if (user.email_verified) {
            return res.json({ message: 'Email ja verificado.' });
        }

        const token = jwt.sign(
            { userId: user.id, email, type: 'email-verification' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        await db.query(
            `UPDATE users SET email_verification_token = $1, email_verification_expires = NOW() + INTERVAL '24 hours' WHERE id = $2`,
            [token, user.id]
        );

        const result = await emailService.sendVerificationEmail(email, user.name || 'Cliente', token);
        if (!result.success) {
            console.error('Erro ao enviar email de verificacao:', result.error);
        }

        res.json({ message: 'Se o email existir, voce recebera o link de verificacao.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao processar solicitacao' });
    }
});

// 2. Verificar email (via token do link)
app.post('/auth/verify-email', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token obrigatorio' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'email-verification') {
            return res.status(400).json({ message: 'Token invalido' });
        }

        const { rows } = await db.query(
            'SELECT id FROM users WHERE id = $1 AND email_verification_token = $2 AND email_verification_expires > NOW()',
            [decoded.userId, token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Token expirado ou invalido' });
        }

        await db.query(
            'UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1',
            [decoded.userId]
        );

        res.json({ message: 'Email verificado com sucesso!' });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(400).json({ message: 'Token expirado' });
        }
        console.error(err);
        res.status(400).json({ message: 'Token invalido' });
    }
});

// 3. Esqueci minha senha (por email)
app.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email obrigatorio' });

    try {
        const { rows } = await db.query(
            'SELECT id, name, central_user_id FROM users WHERE email = $1',
            [email]
        );

        if (rows.length === 0) {
            return res.json({ message: 'Se o email existir, voce recebera as instrucoes.' });
        }

        const user = rows[0];

        const token = jwt.sign(
            { userId: user.id, centralUserId: user.central_user_id, email, type: 'password-reset' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        await db.query(
            `UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour' WHERE id = $2`,
            [token, user.id]
        );

        const result = await emailService.sendPasswordResetEmail(email, user.name || 'Cliente', token);
        if (!result.success) {
            console.error('Erro ao enviar email de reset:', result.error);
        }

        res.json({ message: 'Se o email existir, voce recebera as instrucoes.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao processar solicitacao' });
    }
});

// 4. Resetar senha com token (chama central-pelg para trocar a senha)
app.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token e nova senha sao obrigatorios' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Aceitar tokens gerados pela revenda (password-reset) ou pelo central-pelg (reset)
        if (decoded.type !== 'password-reset' && decoded.type !== 'reset') {
            return res.status(400).json({ message: 'Token invalido' });
        }

        // Compatibilidade: revenda usa userId, central-pelg usa id
        const tokenUserId = decoded.userId || decoded.id;
        const tokenEmail = decoded.email;

        const { rows } = await db.query(
            'SELECT id, email FROM users WHERE (id = $1 OR central_user_id = $1) AND reset_token = $2 AND reset_token_expires > NOW()',
            [tokenUserId, token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Token expirado ou invalido' });
        }

        const user = rows[0];

        // Chamar central-pelg para trocar a senha
        const centralApiUrl = process.env.CENTRAL_API_URL || 'https://central.pelg.com.br';
        const axios = require('axios');

        console.log(`[reset-password] Chamando central-pelg para email=${tokenEmail}, url=${centralApiUrl}/internal/change-password`);

        const response = await axios.post(`${centralApiUrl}/internal/change-password`, {
            email: tokenEmail,
            newPassword
        }, {
            headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY },
            timeout: 10000
        });

        if (!response.data.success) {
            console.error('[reset-password] Central retornou erro:', response.data);
            return res.status(500).json({ message: 'Erro ao alterar senha no servidor central' });
        }

        // Limpar token de reset
        await db.query(
            'UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1',
            [user.id]
        );

        res.json({ message: 'Senha alterada com sucesso!' });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(400).json({ message: 'Token expirado' });
        }
        console.error('[reset-password] Erro:', err.message);
        if (err.response) {
            console.error('[reset-password] Response status:', err.response.status, 'data:', err.response.data);
        }
        res.status(500).json({ message: 'Erro ao resetar senha' });
    }
});

// 5. Solicitar OTP por email
app.post('/auth/request-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email obrigatorio' });

    try {
        const { rows } = await db.query(
            'SELECT id, central_user_id FROM users WHERE email = $1',
            [email]
        );

        if (rows.length === 0) {
            return res.json({ message: 'Se o email existir, voce recebera o codigo.' });
        }

        const user = rows[0];

        // Gerar OTP de 6 digitos
        const otpCode = String(Math.floor(100000 + Math.random() * 900000));

        await db.query(
            `UPDATE users SET otp_code = $1, otp_expires = NOW() + INTERVAL '15 minutes' WHERE id = $2`,
            [otpCode, user.id]
        );

        const result = await emailService.sendOTPEmail(email, otpCode);
        if (!result.success) {
            console.error('Erro ao enviar OTP por email:', result.error);
            return res.status(500).json({ message: 'Erro ao enviar email.' });
        }

        res.json({ message: 'Se o email existir, voce recebera o codigo.', requiresOTP: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao processar solicitacao' });
    }
});

// 6. Verificar OTP e autenticar
app.post('/auth/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ message: 'Email e codigo sao obrigatorios' });
    }

    try {
        const { rows } = await db.query(
            'SELECT id, central_user_id, email, role FROM users WHERE email = $1 AND otp_code = $2 AND otp_expires > NOW()',
            [email, otp]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Codigo invalido ou expirado' });
        }

        const user = rows[0];

        // Limpar OTP apos uso
        await db.query(
            'UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE id = $1',
            [user.id]
        );

        // Emitir JWT com central_user_id como id (compativel com o middleware authenticateToken)
        const accessToken = jwt.sign(
            { id: user.central_user_id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token: accessToken,
            user: { id: user.central_user_id, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao verificar codigo' });
    }
});

// =============================================
// AFFILIATE CLICK STATS
// =============================================

app.get('/affiliate/click-stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { rows: totalRows } = await db.query(
            'SELECT COUNT(*) as total FROM affiliate_visits WHERE affiliate_user_id = $1', [userId]
        );
        const { rows: uniqueRows } = await db.query(
            'SELECT COUNT(DISTINCT ip_address) as total FROM affiliate_visits WHERE affiliate_user_id = $1', [userId]
        );
        const { rows: convRows } = await db.query(
            'SELECT COUNT(*) as total FROM affiliate_visits WHERE affiliate_user_id = $1 AND converted = true', [userId]
        );
        const totalClicks = parseInt(totalRows[0].total);
        const uniqueClicks = parseInt(uniqueRows[0].total);
        const conversions = parseInt(convRows[0].total);
        const conversionRate = totalClicks > 0 ? ((conversions / totalClicks) * 100).toFixed(1) : '0.0';

        res.json({ totalClicks, uniqueClicks, conversions, conversionRate });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json({ totalClicks: 0, uniqueClicks: 0, conversions: 0, conversionRate: '0.0' });
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar estatisticas de cliques' });
    }
});

// =============================================
// PAYOUT SYSTEM
// =============================================

// User: Request payout
app.post('/affiliate/payouts/request', authenticateToken, async (req, res) => {
    try {
        const { amount, pixKey } = req.body;
        const userId = req.user.id;

        if (!amount || !pixKey) return res.status(400).json({ message: 'Valor e chave PIX sao obrigatorios' });

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ message: 'Valor invalido' });

        // Check min payout
        const { rows: settingsRows } = await db.query("SELECT value FROM app_settings WHERE key = 'min_payout_amount'");
        const minPayout = settingsRows.length > 0 ? parseFloat(settingsRows[0].value) : 50;
        if (parsedAmount < minPayout) return res.status(400).json({ message: `Valor minimo para saque: R$ ${minPayout.toFixed(2)}` });

        // Check balance
        const { rows: userRows } = await db.query('SELECT commission_balance FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });
        const balance = parseFloat(userRows[0].commission_balance) || 0;
        if (balance < parsedAmount) return res.status(400).json({ message: `Saldo insuficiente. Seu saldo: R$ ${balance.toFixed(2)}` });

        // Check pending payout
        const { rows: pendingRows } = await db.query(
            "SELECT id FROM payouts WHERE user_id = $1 AND status = 'pending'", [userId]
        );
        if (pendingRows.length > 0) return res.status(400).json({ message: 'Voce ja tem um saque pendente. Aguarde o processamento.' });

        // Deduct balance and create payout
        await db.query('UPDATE users SET commission_balance = commission_balance - $1 WHERE id = $2', [parsedAmount, userId]);
        const { rows: payoutRows } = await db.query(
            'INSERT INTO payouts (user_id, amount, pix_key, method) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, parsedAmount, pixKey, 'pix']
        );

        res.json(payoutRows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao solicitar saque' });
    }
});

// User: Payout history
app.get('/affiliate/payouts/history', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM payouts WHERE user_id = $1 ORDER BY requested_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar historico de saques' });
    }
});

// Admin: List all payouts
app.get('/admin/payouts', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let query = `SELECT p.*, u.name as user_name, u.email as user_email
                     FROM payouts p JOIN users u ON p.user_id = u.id`;
        const params = [];
        if (status) {
            query += ' WHERE p.status = $1';
            params.push(status);
        }
        query += ' ORDER BY p.requested_at DESC';
        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao listar saques' });
    }
});

// Admin: Process payout (approve/reject/pay)
app.put('/admin/payouts/:id/process', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { action, notes } = req.body;
        const payoutId = req.params.id;

        const { rows: payoutRows } = await db.query('SELECT * FROM payouts WHERE id = $1', [payoutId]);
        if (payoutRows.length === 0) return res.status(404).json({ message: 'Saque nao encontrado' });

        const payout = payoutRows[0];
        const { rows: userRows } = await db.query('SELECT email, name FROM users WHERE id = $1', [payout.user_id]);
        const userEmail = userRows[0]?.email;
        const userName = userRows[0]?.name;

        if (action === 'approve') {
            await db.query(
                "UPDATE payouts SET status = 'approved', admin_notes = $1, processed_at = NOW(), processed_by = $2 WHERE id = $3",
                [notes || null, req.user.id, payoutId]
            );
            if (userEmail) emailService.sendPayoutApprovedEmail(userEmail, userName, payout.amount).catch(() => {});
        } else if (action === 'reject') {
            // Refund balance
            await db.query('UPDATE users SET commission_balance = commission_balance + $1 WHERE id = $2', [payout.amount, payout.user_id]);
            await db.query(
                "UPDATE payouts SET status = 'rejected', admin_notes = $1, processed_at = NOW(), processed_by = $2 WHERE id = $3",
                [notes || null, req.user.id, payoutId]
            );
            if (userEmail) emailService.sendPayoutRejectedEmail(userEmail, userName, notes).catch(() => {});
        } else if (action === 'pay') {
            await db.query(
                "UPDATE payouts SET status = 'paid', admin_notes = $1, processed_at = NOW(), processed_by = $2 WHERE id = $3",
                [notes || null, req.user.id, payoutId]
            );
            if (userEmail) emailService.sendPayoutPaidEmail(userEmail, userName, payout.amount).catch(() => {});
        } else {
            return res.status(400).json({ message: 'Acao invalida. Use: approve, reject ou pay' });
        }

        const { rows: updated } = await db.query('SELECT * FROM payouts WHERE id = $1', [payoutId]);
        res.json(updated[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao processar saque' });
    }
});

// =============================================
// CREATIVES (Materials)
// =============================================

// Admin: List all creatives
app.get('/admin/creatives', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM affiliate_creatives ORDER BY sort_order ASC, created_at DESC');
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao listar criativos' });
    }
});

// Admin: Create creative
app.post('/admin/creatives', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, type, fileUrl, dimensions, active, sortOrder } = req.body;
        if (!title || !fileUrl) return res.status(400).json({ message: 'Titulo e URL do arquivo sao obrigatorios' });

        const { rows } = await db.query(
            'INSERT INTO affiliate_creatives (title, description, type, file_url, dimensions, active, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [title, description || null, type || 'image', fileUrl, dimensions || null, active !== false, sortOrder || 0]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar criativo' });
    }
});

// Admin: Update creative
app.put('/admin/creatives/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, type, fileUrl, dimensions, active, sortOrder } = req.body;
        const { rows } = await db.query(
            `UPDATE affiliate_creatives SET
                title = COALESCE($1, title), description = COALESCE($2, description),
                type = COALESCE($3, type), file_url = COALESCE($4, file_url),
                dimensions = COALESCE($5, dimensions), active = COALESCE($6, active),
                sort_order = COALESCE($7, sort_order)
             WHERE id = $8 RETURNING *`,
            [title, description, type, fileUrl, dimensions, active, sortOrder, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Criativo nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar criativo' });
    }
});

// Admin: Delete creative
app.delete('/admin/creatives/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM affiliate_creatives WHERE id = $1', [req.params.id]);
        res.json({ message: 'Criativo removido' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao remover criativo' });
    }
});

// Affiliate: List active creatives
app.get('/affiliate/creatives', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM affiliate_creatives WHERE active = true ORDER BY sort_order ASC, created_at DESC');
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao listar materiais' });
    }
});

// =============================================
// AFFILIATE REPORTS (Admin)
// =============================================

app.get('/admin/affiliate-reports', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate, affiliateId } = req.query;

        let dateFilter = '';
        const params = [];
        let paramIdx = 0;

        if (startDate) {
            paramIdx++;
            dateFilter += ` AND av.created_at >= $${paramIdx}`;
            params.push(startDate);
        }
        if (endDate) {
            paramIdx++;
            dateFilter += ` AND av.created_at <= $${paramIdx}::date + INTERVAL '1 day'`;
            params.push(endDate);
        }

        let affiliateFilter = '';
        if (affiliateId) {
            paramIdx++;
            affiliateFilter = ` AND u.id = $${paramIdx}`;
            params.push(affiliateId);
        }

        const query = `
            SELECT u.id, u.name, u.email,
                COALESCE((SELECT COUNT(*) FROM affiliate_visits av WHERE av.affiliate_user_id = u.id ${dateFilter}), 0) as clicks,
                COALESCE((SELECT COUNT(*) FROM affiliate_visits av WHERE av.affiliate_user_id = u.id AND av.converted = true ${dateFilter}), 0) as conversions,
                COALESCE((SELECT SUM(c.amount) FROM commissions c WHERE c.user_id = u.id AND c.status = 'credited' ${dateFilter ? dateFilter.replace(/av\./g, 'c.') : ''}), 0) as total_commissions,
                COALESCE((SELECT SUM(p.amount) FROM payouts p WHERE p.user_id = u.id AND p.status = 'paid' ${dateFilter ? dateFilter.replace(/av\./g, 'p.') : ''}), 0) as total_payouts
            FROM users u
            WHERE u.affiliate_type IS NOT NULL ${affiliateFilter}
            ORDER BY total_commissions DESC
        `;

        const { rows } = await db.query(query, params);

        // Summary
        const summary = {
            totalCommissions: rows.reduce((sum, r) => sum + parseFloat(r.total_commissions), 0),
            totalPayouts: rows.reduce((sum, r) => sum + parseFloat(r.total_payouts), 0),
            totalClicks: rows.reduce((sum, r) => sum + parseInt(r.clicks), 0),
            totalConversions: rows.reduce((sum, r) => sum + parseInt(r.conversions), 0)
        };
        summary.conversionRate = summary.totalClicks > 0 ? ((summary.totalConversions / summary.totalClicks) * 100).toFixed(1) : '0.0';

        res.json({ summary, affiliates: rows });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json({ summary: { totalCommissions: 0, totalPayouts: 0, totalClicks: 0, totalConversions: 0, conversionRate: '0.0' }, affiliates: [] });
        console.error(err);
        res.status(500).json({ message: 'Erro ao gerar relatorio' });
    }
});

// Admin: Export CSV
app.get('/admin/affiliate-reports/export', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate, affiliateId } = req.query;

        let dateFilter = '';
        const params = [];
        let paramIdx = 0;

        if (startDate) { paramIdx++; dateFilter += ` AND av.created_at >= $${paramIdx}`; params.push(startDate); }
        if (endDate) { paramIdx++; dateFilter += ` AND av.created_at <= $${paramIdx}::date + INTERVAL '1 day'`; params.push(endDate); }

        let affiliateFilter = '';
        if (affiliateId) { paramIdx++; affiliateFilter = ` AND u.id = $${paramIdx}`; params.push(affiliateId); }

        const query = `
            SELECT u.name, u.email,
                COALESCE((SELECT COUNT(*) FROM affiliate_visits av WHERE av.affiliate_user_id = u.id ${dateFilter}), 0) as clicks,
                COALESCE((SELECT COUNT(*) FROM affiliate_visits av WHERE av.affiliate_user_id = u.id AND av.converted = true ${dateFilter}), 0) as conversions,
                COALESCE((SELECT SUM(c.amount) FROM commissions c WHERE c.user_id = u.id AND c.status = 'credited' ${dateFilter ? dateFilter.replace(/av\./g, 'c.') : ''}), 0) as total_commissions,
                COALESCE((SELECT SUM(p.amount) FROM payouts p WHERE p.user_id = u.id AND p.status = 'paid' ${dateFilter ? dateFilter.replace(/av\./g, 'p.') : ''}), 0) as total_payouts
            FROM users u WHERE u.affiliate_type IS NOT NULL ${affiliateFilter}
            ORDER BY total_commissions DESC
        `;

        const { rows } = await db.query(query, params);

        let csv = 'Nome,Email,Cliques,Conversoes,Taxa Conversao,Comissoes,Payouts\n';
        rows.forEach(r => {
            const rate = parseInt(r.clicks) > 0 ? ((parseInt(r.conversions) / parseInt(r.clicks)) * 100).toFixed(1) : '0.0';
            csv += `"${r.name || ''}","${r.email}",${r.clicks},${r.conversions},${rate}%,${parseFloat(r.total_commissions).toFixed(2)},${parseFloat(r.total_payouts).toFixed(2)}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio-afiliados.csv');
        res.send(csv);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao exportar relatorio' });
    }
});

// =============================================
// COUPONS
// =============================================

// Admin: List coupons
app.get('/admin/coupons', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT c.*, u.name as affiliate_name, u.email as affiliate_email
             FROM affiliate_coupons c
             LEFT JOIN users u ON c.affiliate_user_id = u.id
             ORDER BY c.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json([]);
        console.error(err);
        res.status(500).json({ message: 'Erro ao listar cupons' });
    }
});

// Admin: Create coupon
app.post('/admin/coupons', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { affiliateUserId, code, discountType, discountValue, minOrderValue, maxUses, active, expiresAt } = req.body;
        if (!code || !discountValue) return res.status(400).json({ message: 'Codigo e valor do desconto sao obrigatorios' });

        const { rows } = await db.query(
            `INSERT INTO affiliate_coupons (affiliate_user_id, code, discount_type, discount_value, min_order_value, max_uses, active, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [affiliateUserId || null, code.toUpperCase(), discountType || 'percentage', discountValue, minOrderValue || 0, maxUses || null, active !== false, expiresAt || null]
        );
        res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'Ja existe um cupom com esse codigo' });
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar cupom' });
    }
});

// Admin: Update coupon
app.put('/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { code, discountType, discountValue, minOrderValue, maxUses, active, expiresAt } = req.body;
        const { rows } = await db.query(
            `UPDATE affiliate_coupons SET
                code = COALESCE($1, code), discount_type = COALESCE($2, discount_type),
                discount_value = COALESCE($3, discount_value), min_order_value = COALESCE($4, min_order_value),
                max_uses = $5, active = COALESCE($6, active), expires_at = $7
             WHERE id = $8 RETURNING *`,
            [code ? code.toUpperCase() : null, discountType, discountValue, minOrderValue, maxUses || null, active, expiresAt || null, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Cupom nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar cupom' });
    }
});

// Admin: Delete (deactivate) coupon
app.delete('/admin/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db.query('UPDATE affiliate_coupons SET active = false WHERE id = $1', [req.params.id]);
        res.json({ message: 'Cupom desativado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao desativar cupom' });
    }
});

// Affiliate: Get my coupon
app.get('/affiliate/my-coupon', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM affiliate_coupons WHERE affiliate_user_id = $1 AND active = true ORDER BY created_at DESC LIMIT 1',
            [req.user.id]
        );
        res.json(rows.length > 0 ? rows[0] : null);
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json(null);
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar cupom' });
    }
});

// Public/Auth: Validate coupon
app.post('/coupons/validate', async (req, res) => {
    try {
        const { code, orderTotal } = req.body;
        if (!code) return res.status(400).json({ valid: false, message: 'Codigo do cupom e obrigatorio' });

        const { rows } = await db.query(
            'SELECT * FROM affiliate_coupons WHERE code = $1 AND active = true',
            [code.toUpperCase()]
        );

        if (rows.length === 0) return res.json({ valid: false, message: 'Cupom invalido ou expirado' });

        const coupon = rows[0];

        // Check expiration
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return res.json({ valid: false, message: 'Cupom expirado' });
        }

        // Check max uses
        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
            return res.json({ valid: false, message: 'Cupom atingiu o limite de uso' });
        }

        // Check min order value
        const total = parseFloat(orderTotal) || 0;
        if (total < parseFloat(coupon.min_order_value)) {
            return res.json({ valid: false, message: `Pedido minimo: R$ ${parseFloat(coupon.min_order_value).toFixed(2)}` });
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.discount_type === 'percentage') {
            discountAmount = total * (parseFloat(coupon.discount_value) / 100);
        } else {
            discountAmount = parseFloat(coupon.discount_value);
        }
        discountAmount = Math.min(discountAmount, Math.max(total - 1, 0)); // Deixar minimo R$ 1,00

        res.json({
            valid: true,
            discountAmount: discountAmount.toFixed(2),
            discountType: coupon.discount_type,
            discountValue: coupon.discount_value,
            affiliateUserId: coupon.affiliate_user_id,
            couponId: coupon.id
        });
    } catch (err) {
        if (err.message && err.message.includes('does not exist')) return res.json({ valid: false, message: 'Sistema de cupons nao disponivel' });
        console.error(err);
        res.status(500).json({ valid: false, message: 'Erro ao validar cupom' });
    }
});

// =============================================
// START SERVER
// =============================================

const PORT = process.env.PORT || 3000;

// Roda setup do banco automaticamente ao iniciar, depois sobe o servidor
updateSchema()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Revenda API rodando na porta ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Erro no setup do banco, iniciando mesmo assim:', err.message);
        app.listen(PORT, () => {
            console.log(`Revenda API rodando na porta ${PORT} (sem setup completo)`);
        });
    });

// =============================================
// AUTO-CANCEL: pedidos pendentes apos 24h
// =============================================
setInterval(async () => {
    try {
        const { rows } = await db.query(
            "UPDATE orders SET status = 'canceled', updated_at = NOW() WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours' RETURNING id, woocommerce_order_id"
        );
        for (const order of rows) {
            if (order.woocommerce_order_id) {
                woocommerceService.updateOrderStatus(order.woocommerce_order_id, 'cancelled').catch(() => {});
            }
            dispatchWebhooks('order_canceled', { order_id: order.id, reason: 'auto_cancel_24h' }).catch(() => {});
        }
        if (rows.length > 0) {
            console.log(`Auto-cancelados ${rows.length} pedidos pendentes (24h)`);
        }
    } catch (e) {
        console.error('Erro auto-cancel:', e.message);
    }
}, 60 * 60 * 1000); // A cada 1 hora
