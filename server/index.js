const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');
const ipagService = require('./ipagService');
const woocommerceService = require('./woocommerceService');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// =============================================
// MIDDLEWARE — JWT + Auto-criar usuario local
// =============================================

// Valida o JWT (mesmo JWT_SECRET do central-pelg)
// e auto-cria o usuario no banco revenda_pelg se nao existir
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Buscar usuario local pelo central_user_id
        let { rows } = await db.query(
            'SELECT * FROM users WHERE central_user_id = $1',
            [decoded.id]
        );

        if (rows.length === 0) {
            // Auto-criar usuario local a partir dos dados do JWT
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
        if (!['administrator', 'manager'].includes(rows[0].role)) {
            return res.status(403).json({ message: 'Acesso restrito a administradores' });
        }
        req.userRole = rows[0].role;
        next();
    } catch (err) {
        res.sendStatus(500);
    }
};

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

app.put('/users/me', authenticateToken, async (req, res) => {
    const { name, telefone, foto } = req.body;

    try {
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (name !== undefined) { paramCount++; updates.push(`name = $${paramCount}`); values.push(name); }
        if (telefone !== undefined) { paramCount++; updates.push(`telefone = $${paramCount}`); values.push(telefone); }
        if (foto !== undefined) { paramCount++; updates.push(`foto = $${paramCount}`); values.push(foto); }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Nenhum campo para atualizar' });
        }

        paramCount++;
        updates.push(`updated_at = NOW()`);
        values.push(req.user.id);

        const { rows } = await db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, role, telefone, foto, approval_status`,
            values
        );

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao atualizar perfil' });
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
    const { order_number, details, payment_method, installments, total, address_id } = req.body;

    try {
        const { rows } = await db.query(
            `INSERT INTO orders (user_id, order_number, details, payment_method, installments, total, address_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [req.user.id, order_number, JSON.stringify(details), payment_method, installments || 1, total, address_id]
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
    const { items } = req.body;

    try {
        const { rows: existing } = await db.query(
            'SELECT id FROM abandoned_carts WHERE user_id = $1',
            [req.user.id]
        );

        if (existing.length > 0) {
            const { rows } = await db.query(
                'UPDATE abandoned_carts SET items = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
                [JSON.stringify(items), req.user.id]
            );
            return res.json(rows[0]);
        }

        const { rows } = await db.query(
            'INSERT INTO abandoned_carts (user_id, items) VALUES ($1, $2) RETURNING *',
            [req.user.id, JSON.stringify(items)]
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
// ADMIN ROUTES
// =============================================

app.get('/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [usersCount, ordersCount, pendingApprovals, recentOrders] = await Promise.all([
            db.query('SELECT COUNT(*) as total FROM users'),
            db.query('SELECT COUNT(*) as total FROM orders'),
            db.query("SELECT COUNT(*) as total FROM users WHERE approval_status = 'pending'"),
            db.query('SELECT o.*, u.name as user_name, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 10')
        ]);

        res.json({
            totalUsers: parseInt(usersCount.rows[0].total),
            totalOrders: parseInt(ordersCount.rows[0].total),
            pendingApprovals: parseInt(pendingApprovals.rows[0].total),
            recentOrders: recentOrders.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
    }
});

app.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, name, email, role, telefone, document_type, cpf, cnpj, company_name, profession, approval_status, approved_by, approved_at, rejection_reason, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao listar usuarios' });
    }
});

app.get('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, name, email, role, telefone, foto, document_type, cpf, cnpj, company_name, profession, profession_other, approval_status, approved_by, approved_at, rejection_reason, created_at FROM users WHERE id = $1',
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Usuario nao encontrado' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar usuario' });
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
        const { rows } = await db.query(
            'SELECT ac.*, u.name as user_name, u.email as user_email, u.telefone FROM abandoned_carts ac JOIN users u ON ac.user_id = u.id ORDER BY ac.updated_at DESC'
        );
        res.json(rows);
    } catch (err) {
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
        res.json({ message: 'Recuperacao enviada' });
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

        // Buscar pedido local
        const { rows } = await db.query(
            `SELECT o.*, a.street, a.number, a.complement, a.neighborhood, a.city, a.state, a.cep
             FROM orders o LEFT JOIN addresses a ON o.address_id = a.id
             WHERE o.id = $1 AND o.user_id = $2`,
            [orderId, req.user.id]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Pedido nao encontrado' });
        const order = rows[0];
        const details = order.details || {};

        // Mapear produtos
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

        // Criar pedido no WooCommerce
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

        // Salvar IDs do WooCommerce no pedido local
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
// START SERVER
// =============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Revenda API rodando na porta ${PORT}`);
});
