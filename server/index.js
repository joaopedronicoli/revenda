const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');
const ipagService = require('./ipagService');
const woocommerceService = require('./woocommerceService');
const emailService = require('./emailService');
const { updateSchema } = require('./setup_db');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));

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

// Creditar comissao de indicacao
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
        const { rows } = await db.query('SELECT * FROM products WHERE active = true ORDER BY sort_order ASC, id ASC');
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
        const { rows } = await db.query('SELECT * FROM products ORDER BY sort_order ASC, id ASC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar produtos' });
    }
});

// Admin: create product
app.post('/admin/products', authenticateToken, requireAdmin, async (req, res) => {
    const { name, description, table_price, image, reference_url, sku, woo_product_id, active, sort_order, special_discount } = req.body;
    try {
        const { rows } = await db.query(
            `INSERT INTO products (name, description, table_price, image, reference_url, sku, woo_product_id, active, sort_order, special_discount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [name, description, table_price, image || null, reference_url || null, sku || null, woo_product_id || null, active !== false, sort_order || 0, special_discount || null]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar produto' });
    }
});

// Admin: update product
app.put('/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { name, description, table_price, image, reference_url, sku, woo_product_id, active, sort_order, special_discount } = req.body;
    try {
        const { rows } = await db.query(
            `UPDATE products SET name = $1, description = $2, table_price = $3, image = $4, reference_url = $5, sku = $6, woo_product_id = $7, active = $8, sort_order = $9, special_discount = $10, updated_at = NOW()
             WHERE id = $11 RETURNING *`,
            [name, description, table_price, image || null, reference_url || null, sku || null, woo_product_id || null, active !== false, sort_order || 0, special_discount || null, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Produto nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar produto' });
    }
});

// Admin: delete product
app.delete('/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        if (rowCount === 0) return res.status(404).json({ message: 'Produto nao encontrado' });
        res.json({ message: 'Produto excluido' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao excluir produto' });
    }
});

// =============================================
// KITS ROUTES
// =============================================

app.get('/kits', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM kits WHERE active = true ORDER BY price ASC');
        res.json(rows);
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
            "SELECT id, order_number, total, status, created_at FROM orders WHERE user_id = $1 AND status IN ('completed','processing','paid') ORDER BY created_at DESC LIMIT $2 OFFSET $3",
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
        let query = 'SELECT o.*, a.nickname as address_nickname, a.street as address_street, a.city as address_city, a.state as address_state FROM orders o LEFT JOIN addresses a ON o.address_id = a.id WHERE o.user_id = $1';
        const params = [req.user.id];

        if (status) {
            query += ' AND o.status = $2';
            params.push(status);
        }

        query += ' ORDER BY o.created_at DESC';

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar pedidos' });
    }
});

app.get('/orders/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT o.*, a.* FROM orders o LEFT JOIN addresses a ON o.address_id = a.id WHERE o.id = $1 AND o.user_id = $2',
            [req.params.id, req.user.id]
        );

        if (rows.length === 0) return res.status(404).json({ message: 'Pedido nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar pedido' });
    }
});

app.post('/orders', authenticateToken, async (req, res) => {
    const { order_number, details, payment_method, installments, total, address_id, kit_id, commission_credit } = req.body;

    try {
        // Buscar status do usuario
        const { rows: userRows } = await db.query(
            'SELECT first_order_completed, has_purchased_kit, commission_balance, role FROM users WHERE id = $1',
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

        // Buscar kit se necessario
        let kitData = null;
        let finalTotal = productTotal;
        if (kit_id) {
            const { rows: kitRows } = await db.query('SELECT * FROM kits WHERE id = $1 AND active = true', [kit_id]);
            if (kitRows.length === 0) return res.status(400).json({ message: 'Kit nao encontrado' });
            kitData = kitRows[0];
            finalTotal += parseFloat(kitData.price);
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

        const { rows } = await db.query(
            `INSERT INTO orders (user_id, order_number, details, payment_method, installments, total, address_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [req.user.id, order_number, JSON.stringify(enrichedDetails), payment_method, installments || 1, finalTotal, address_id]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar pedido' });
    }
});

app.put('/orders/:id', authenticateToken, async (req, res) => {
    const { status, tracking_code, tracking_url, ipag_transaction_id, ipag_status, woocommerce_order_id, woocommerce_order_number } = req.body;

    try {
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (status !== undefined) { paramCount++; updates.push(`status = $${paramCount}`); values.push(status); }
        if (tracking_code !== undefined) { paramCount++; updates.push(`tracking_code = $${paramCount}`); values.push(tracking_code); }
        if (tracking_url !== undefined) { paramCount++; updates.push(`tracking_url = $${paramCount}`); values.push(tracking_url); }
        if (ipag_transaction_id !== undefined) { paramCount++; updates.push(`ipag_transaction_id = $${paramCount}`); values.push(ipag_transaction_id); }
        if (ipag_status !== undefined) { paramCount++; updates.push(`ipag_status = $${paramCount}`); values.push(ipag_status); }
        if (woocommerce_order_id !== undefined) { paramCount++; updates.push(`woocommerce_order_id = $${paramCount}`); values.push(woocommerce_order_id); }
        if (woocommerce_order_number !== undefined) { paramCount++; updates.push(`woocommerce_order_number = $${paramCount}`); values.push(woocommerce_order_number); }

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

        // Se status mudou para paid/completed, processar logica pos-pagamento
        if (status && ['paid', 'completed', 'processing'].includes(status)) {
            const order = rows[0];
            const orderTotal = parseFloat(order.total) || 0;

            // Atualizar totais do usuario
            await db.query(
                `UPDATE users SET
                    last_purchase_date = NOW(),
                    total_accumulated = total_accumulated + $1,
                    quarter_accumulated = quarter_accumulated + $1,
                    first_order_completed = true,
                    has_purchased_kit = CASE WHEN has_purchased_kit = false AND (details->>'kit') IS NOT NULL THEN true ELSE has_purchased_kit END,
                    kit_type = CASE WHEN has_purchased_kit = false AND (details->'kit'->>'slug') IS NOT NULL THEN details->'kit'->>'slug' ELSE kit_type END,
                    kit_purchased_at = CASE WHEN has_purchased_kit = false AND (details->>'kit') IS NOT NULL THEN NOW() ELSE kit_purchased_at END
                 WHERE id = $2`,
                [orderTotal, order.user_id]
            );

            // Creditar comissao de indicacao
            await creditReferralCommission(order.id, order.user_id, orderTotal);

            // Ativar indicacao se for primeiro pedido
            await db.query(
                "UPDATE referrals SET status = 'active', activated_at = NOW() WHERE referred_id = $1 AND status = 'pending'",
                [order.user_id]
            );

            // Recalcular nivel
            await recalculateUserLevel(order.user_id);

            // Checar conquistas
            await checkAndGrantAchievements(order.user_id);

            // Award points for purchase
            const purchasePoints = Math.floor(orderTotal / 10); // 1 ponto a cada R$10
            if (purchasePoints > 0) {
                await db.query('UPDATE users SET points = points + $1 WHERE id = $2', [purchasePoints, order.user_id]);
                await db.query(
                    'INSERT INTO points_ledger (user_id, points, type, description, reference_id) VALUES ($1, $2, $3, $4, $5)',
                    [order.user_id, purchasePoints, 'purchase', 'Pontos por compra', String(order.id)]
                );
            }
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
// PAYMENTS (iPag)
// =============================================

app.post('/payments/process', authenticateToken, async (req, res) => {
    const { paymentMethod, amount, orderId, cardData, customer, installments } = req.body;

    try {
        let result;

        if (paymentMethod === 'pix') {
            result = await ipagService.generatePix({ amount, orderId, customer });
        } else {
            result = await ipagService.processCardPayment({ amount, orderId, cardData, customer, installments });
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
            return res.json(rows[0]);
        }

        const { rows } = await db.query(
            `INSERT INTO abandoned_carts (user_id, items, total, item_count, status) VALUES ($1, $2, $3, $4, 'abandoned') RETURNING *`,
            [req.user.id, JSON.stringify(cartItems), cartTotal, cartItemCount]
        );

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
        const [usersCount, ordersCount, pendingApprovals, recentOrders, levelStats] = await Promise.all([
            db.query('SELECT COUNT(*) as total FROM users'),
            db.query('SELECT COUNT(*) as total FROM orders'),
            db.query("SELECT COUNT(*) as total FROM users WHERE approval_status = 'pending'"),
            db.query('SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 10'),
            db.query("SELECT level, COUNT(*) as cnt FROM users WHERE approval_status = 'approved' GROUP BY level")
        ]);

        const levelDistribution = {};
        levelStats.rows.forEach(r => { levelDistribution[r.level || 'bronze'] = parseInt(r.cnt); });

        res.json({
            totalUsers: parseInt(usersCount.rows[0].total),
            totalOrders: parseInt(ordersCount.rows[0].total),
            pendingApprovals: parseInt(pendingApprovals.rows[0].total),
            recentOrders: recentOrders.rows,
            levelDistribution
        });
    } catch (err) {
        // Fallback if level column doesn't exist yet
        if (err.message && err.message.includes('does not exist')) {
            try {
                const [usersCount, ordersCount, pendingApprovals, recentOrders] = await Promise.all([
                    db.query('SELECT COUNT(*) as total FROM users'),
                    db.query('SELECT COUNT(*) as total FROM orders'),
                    db.query("SELECT COUNT(*) as total FROM users WHERE approval_status = 'pending'"),
                    db.query('SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 10')
                ]);
                return res.json({
                    totalUsers: parseInt(usersCount.rows[0].total),
                    totalOrders: parseInt(ordersCount.rows[0].total),
                    pendingApprovals: parseInt(pendingApprovals.rows[0].total),
                    recentOrders: recentOrders.rows,
                    levelDistribution: {}
                });
            } catch (fallbackErr) {
                console.error(fallbackErr);
            }
        }
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
    }
});

app.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { filter, level } = req.query;
        let query = 'SELECT id, name, email, role, telefone, document_type, cpf, cnpj, company_name, profession, approval_status, approved_by, approved_at, rejection_reason, created_at, level, total_accumulated, last_purchase_date, commission_balance, has_purchased_kit, first_order_completed, points, affiliate_type, affiliate_status FROM users';
        const params = [];
        const conditions = [];

        if (filter && filter !== 'all') {
            params.push(filter);
            conditions.push(`approval_status = $${params.length}`);
        }

        if (level && level !== 'all') {
            params.push(level);
            conditions.push(`level = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC';

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
            `SELECT id, name, email, telefone, affiliate_type, affiliate_status, affiliate_level, affiliate_sales_count, commission_balance, referral_code, created_at
             FROM users WHERE affiliate_type IS NOT NULL ORDER BY created_at DESC`
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
        res.json(rows[0]);
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
    const { type, url, active } = req.body;
    try {
        const { rows } = await db.query(
            'INSERT INTO webhook_configurations (type, url, active) VALUES ($1, $2, $3) RETURNING *',
            [type, url, active !== false]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar webhook' });
    }
});

app.put('/admin/webhook-configurations/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { type, url, active } = req.body;
    try {
        const { rows } = await db.query(
            'UPDATE webhook_configurations SET type = $1, url = $2, active = $3 WHERE id = $4 RETURNING *',
            [type, url, active, req.params.id]
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

        const lineItems = (details.items || [])
            .filter(item => item.woo_product_id)
            .map(item => ({
                product_id: item.woo_product_id,
                quantity: item.quantity,
                price: (item.tablePrice || item.price || 0).toString()
            }));

        if (lineItems.length === 0) {
            return res.status(400).json({ error: 'Nenhum produto mapeado para WooCommerce' });
        }

        const wcOrderData = {
            status: 'pending',
            billing: {
                first_name: details.user_name || 'Cliente',
                last_name: '',
                email: details.user_email || req.user.email,
                phone: details.user_whatsapp || '',
                address_1: order.street || '',
                address_2: order.complement || '',
                city: order.city || '',
                state: order.state || '',
                postcode: order.cep || '',
                country: 'BR'
            },
            shipping: {
                first_name: details.user_name || 'Cliente',
                last_name: '',
                address_1: order.street || '',
                address_2: order.complement || '',
                city: order.city || '',
                state: order.state || '',
                postcode: order.cep || '',
                country: 'BR'
            },
            line_items: lineItems,
            customer_note: `Pedido do App de Revenda: ${order.order_number}`,
            shipping_lines: [{ method_id: 'free_shipping', method_title: 'Frete Gratis', total: '0.00' }],
            meta_data: [
                { key: '_revenda_app_order_id', value: String(orderId) },
                { key: '_revenda_app_order_number', value: order.order_number || '' },
                { key: '_payment_method_title', value: order.payment_method || 'Nao informado' },
                { key: '_billing_number', value: order.number || '' },
                { key: '_billing_neighborhood', value: order.neighborhood || '' },
                { key: '_billing_cpf', value: details.user_cpf || '' }
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
// WEBHOOKS
// =============================================

app.post('/webhooks/ipag', async (req, res) => {
    try {
        console.log('iPag Webhook received:', JSON.stringify(req.body));
        const { id, status, order_id } = req.body;

        if (order_id) {
            await db.query(
                'UPDATE orders SET ipag_status = $1, ipag_transaction_id = $2, updated_at = NOW() WHERE order_number = $3',
                [status, id, order_id]
            );
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

        if (id) {
            await db.query(
                'UPDATE orders SET status = $1, woocommerce_order_id = $2, woocommerce_order_number = $3, updated_at = NOW() WHERE woocommerce_order_id = $2',
                [status, String(id), String(number)]
            );
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Erro ao processar webhook WooCommerce:', err.message);
        res.sendStatus(500);
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
