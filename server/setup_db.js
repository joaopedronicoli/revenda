const db = require('./db');

const updateSchema = async () => {
  try {
    // Tabela de usuarios locais (sincronizada com central-pelg)
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        central_user_id INTEGER UNIQUE NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'client',
        telefone VARCHAR(20),
        foto TEXT,
        document_type VARCHAR(10),
        cpf VARCHAR(20),
        cnpj VARCHAR(20),
        company_name VARCHAR(255),
        profession VARCHAR(100),
        profession_other VARCHAR(255),
        approval_status VARCHAR(20) DEFAULT 'pending',
        approved_by VARCHAR(255),
        approved_at TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "users" verificada/criada com sucesso.');

    // =============================================
    // NOVAS COLUNAS - Programa de Revenda
    // =============================================
    const userColumns = [
      { name: 'level', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS level VARCHAR(20) DEFAULT 'bronze'" },
      { name: 'level_updated_at', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS level_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" },
      { name: 'last_purchase_date', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMP" },
      { name: 'total_accumulated', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS total_accumulated DECIMAL(12,2) DEFAULT 0" },
      { name: 'quarter_accumulated', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS quarter_accumulated DECIMAL(12,2) DEFAULT 0" },
      { name: 'quarter_start_date', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS quarter_start_date DATE" },
      { name: 'referral_code', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE" },
      { name: 'referred_by', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id)" },
      { name: 'commission_balance', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_balance DECIMAL(10,2) DEFAULT 0" },
      { name: 'has_purchased_kit', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS has_purchased_kit BOOLEAN DEFAULT false" },
      { name: 'kit_type', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS kit_type VARCHAR(50)" },
      { name: 'kit_purchased_at', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS kit_purchased_at TIMESTAMP" },
      { name: 'first_order_completed', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_order_completed BOOLEAN DEFAULT false" },
      { name: 'points', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0" },
      { name: 'affiliate_type', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_type VARCHAR(50)" },
      { name: 'affiliate_status', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_status VARCHAR(20)" },
      { name: 'affiliate_level', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_level VARCHAR(50)" },
      { name: 'affiliate_sales_count', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_sales_count INTEGER DEFAULT 0" },
      // Email verification & auth columns
      { name: 'email_verified', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false" },
      { name: 'email_verification_token', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT" },
      { name: 'email_verification_expires', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP" },
      { name: 'otp_code', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6)" },
      { name: 'otp_expires', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMP" },
      { name: 'reset_token', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT" },
      { name: 'reset_token_expires', sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP" },
    ];

    for (const col of userColumns) {
      try {
        await db.query(col.sql);
      } catch (e) {
        // Column may already exist, ignore
      }
    }
    console.log('Colunas do programa de revenda adicionadas em "users".');

    // Migrar starter -> bronze
    await db.query("UPDATE users SET level = 'bronze' WHERE level = 'starter'");
    await db.query("ALTER TABLE users ALTER COLUMN level SET DEFAULT 'bronze'");
    console.log('Nivel starter migrado para bronze.');

    // Enderecos
    await db.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        nickname VARCHAR(100),
        cep VARCHAR(10),
        street VARCHAR(255),
        number VARCHAR(20),
        complement VARCHAR(255),
        neighborhood VARCHAR(100),
        city VARCHAR(100),
        state VARCHAR(2),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "addresses" verificada/criada com sucesso.');

    // Pedidos
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        order_number VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        details JSONB,
        payment_method VARCHAR(50),
        installments INTEGER DEFAULT 1,
        total DECIMAL(10,2),
        address_id INTEGER REFERENCES addresses(id),
        ipag_transaction_id VARCHAR(255),
        ipag_status VARCHAR(50),
        woocommerce_order_id VARCHAR(50),
        woocommerce_order_number VARCHAR(50),
        tracking_code VARCHAR(100),
        tracking_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "orders" verificada/criada com sucesso.');

    // Codigos de verificacao
    await db.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(6) NOT NULL,
        type VARCHAR(20) NOT NULL,
        new_value TEXT,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "verification_codes" verificada/criada com sucesso.');

    // Carrinhos abandonados
    await db.query(`
      CREATE TABLE IF NOT EXISTS abandoned_carts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        items JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "abandoned_carts" verificada/criada com sucesso.');

    // Colunas extras de abandoned_carts
    const abandonedCartColumns = [
      { name: 'total', sql: "ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) DEFAULT 0" },
      { name: 'item_count', sql: "ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 0" },
      { name: 'status', sql: "ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'abandoned'" },
      { name: 'recovery_email_sent', sql: "ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_email_sent BOOLEAN DEFAULT false" },
      { name: 'recovery_whatsapp_sent', sql: "ALTER TABLE abandoned_carts ADD COLUMN IF NOT EXISTS recovery_whatsapp_sent BOOLEAN DEFAULT false" },
    ];
    for (const col of abandonedCartColumns) {
      try { await db.query(col.sql); } catch (e) { /* already exists */ }
    }
    console.log('Colunas extras de "abandoned_carts" verificadas.');

    // Configuracoes de webhook
    await db.query(`
      CREATE TABLE IF NOT EXISTS webhook_configurations (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "webhook_configurations" verificada/criada com sucesso.');

    // Templates de recuperacao
    await db.query(`
      CREATE TABLE IF NOT EXISTS recovery_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        template TEXT,
        type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "recovery_templates" verificada/criada com sucesso.');

    // Configuracoes do app
    await db.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "app_settings" verificada/criada com sucesso.');

    // =============================================
    // NOVAS TABELAS - Programa de Revenda
    // =============================================

    // Indicacoes (referrals)
    await db.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP
      );
    `);
    console.log('Tabela "referrals" verificada/criada com sucesso.');

    // Comissoes
    await db.query(`
      CREATE TABLE IF NOT EXISTS commissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        source_user_id INTEGER REFERENCES users(id),
        order_id INTEGER REFERENCES orders(id),
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        rate DECIMAL(5,4),
        status VARCHAR(20) DEFAULT 'pending',
        credited_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "commissions" verificada/criada com sucesso.');

    // Historico de niveis
    await db.query(`
      CREATE TABLE IF NOT EXISTS level_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        old_level VARCHAR(20),
        new_level VARCHAR(20) NOT NULL,
        reason TEXT,
        changed_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "level_history" verificada/criada com sucesso.');

    // Produtos
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        table_price DECIMAL(10,2) NOT NULL,
        image TEXT,
        reference_url TEXT,
        sku VARCHAR(50),
        woo_product_id INTEGER,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        special_discount DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "products" verificada/criada com sucesso.');

    // Adicionar coluna stock_quantity se nao existir
    try {
        await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0');
    } catch (e) { /* column may already exist */ }

    // Kits
    await db.query(`
      CREATE TABLE IF NOT EXISTS kits (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        product_ids INTEGER[] DEFAULT '{}',
        description TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "kits" verificada/criada com sucesso.');

    // Conquistas (achievements)
    await db.query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        category VARCHAR(50),
        threshold_value INTEGER DEFAULT 0,
        points_reward INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "achievements" verificada/criada com sucesso.');

    // Conquistas do usuario
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, achievement_id)
      );
    `);
    console.log('Tabela "user_achievements" verificada/criada com sucesso.');

    // Historico de pontos
    await db.query(`
      CREATE TABLE IF NOT EXISTS points_ledger (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        points INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        reference_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "points_ledger" verificada/criada com sucesso.');

    // Rastreamento de cliques de afiliados
    await db.query(`
      CREATE TABLE IF NOT EXISTS affiliate_visits (
        id SERIAL PRIMARY KEY,
        affiliate_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        referral_code VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        page_url TEXT,
        converted BOOLEAN DEFAULT false,
        referred_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "affiliate_visits" verificada/criada com sucesso.');

    // Saques de afiliados
    await db.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        method VARCHAR(20) DEFAULT 'pix',
        pix_key TEXT,
        bank_info JSONB,
        admin_notes TEXT,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log('Tabela "payouts" verificada/criada com sucesso.');

    // Materiais/criativos de afiliados
    await db.query(`
      CREATE TABLE IF NOT EXISTS affiliate_creatives (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) DEFAULT 'image',
        file_url TEXT NOT NULL,
        dimensions VARCHAR(50),
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "affiliate_creatives" verificada/criada com sucesso.');

    // Cupons de afiliados
    await db.query(`
      CREATE TABLE IF NOT EXISTS affiliate_coupons (
        id SERIAL PRIMARY KEY,
        affiliate_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(50) UNIQUE NOT NULL,
        discount_type VARCHAR(20) DEFAULT 'percentage',
        discount_value DECIMAL(10,2) NOT NULL,
        min_order_value DECIMAL(10,2) DEFAULT 0,
        max_uses INTEGER,
        current_uses INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "affiliate_coupons" verificada/criada com sucesso.');

    // Seed: valor minimo de saque
    await db.query(`
      INSERT INTO app_settings (key, value, description)
      VALUES ('min_payout_amount', '50', 'Valor minimo para solicitar saque (R$)')
      ON CONFLICT (key) DO NOTHING;
    `);

    // =============================================
    // SEEDS - Products
    // =============================================
    const productsCount = await db.query('SELECT COUNT(*) as cnt FROM products');
    if (parseInt(productsCount.rows[0].cnt) === 0) {
      await db.query(`
        INSERT INTO products (name, description, table_price, image, reference_url, sku, woo_product_id, sort_order, special_discount) VALUES
        ('Aloe Vera Gel de Babosa', 'Hidratacao profunda e calmante 250ml', 94.99, 'https://patriciaelias.com.br/wp-content/uploads/2020/08/800x800-aloe-vera1.webp', 'https://patriciaelias.com.br/produto/aloe-vera-gel-250ml/', '0200', 105884, 1, NULL),
        ('Amazing Derme Serum', 'Serum creme facial anti-idade 50g', 142.99, 'https://patriciaelias.com.br/wp-content/uploads/2023/04/800x800-amazing-derme-Novo-Frente.jpg', 'https://patriciaelias.com.br/produto/amazing-derme-serum-creme-facial-50g/', '0256', 260692, 2, NULL),
        ('Hair Care FBC Tonico', 'Tonico capilar fortalecedor 100ml', 143.99, 'https://patriciaelias.com.br/wp-content/uploads/2023/04/800x800-hair-care-fbc4.jpg', 'https://patriciaelias.com.br/produto/hair-care-fbc-tonico-capilar-100ml/', '0255', 260643, 3, NULL),
        ('Lumi 10 Niacinamida', 'Serum iluminador facial 30ml', 129.99, 'https://patriciaelias.com.br/wp-content/uploads/2024/01/800x800-Lumi-10-Niacinamida.jpg', 'https://patriciaelias.com.br/produto/lumi-10-niacinamida-serum-iluminador-facial-30ml/', '0259', 300081, 4, NULL),
        ('Oleo de Rosa Mosqueta Puro', 'Regenerador natural 20ml', 65.99, 'https://patriciaelias.com.br/wp-content/uploads/2023/11/800x800-rosa-mosqueta1.jpg', 'https://patriciaelias.com.br/produto/oleo-de-rosa-mosqueta-puro-20ml/', '0127', 81120, 5, NULL),
        ('Purifique-C Sabonete Gel', 'Limpeza facial com Vitamina C', 60.99, 'https://patriciaelias.com.br/wp-content/uploads/2024/06/800x800-purifique-c.jpg', 'https://patriciaelias.com.br/produto/purifique-c-sabonete-gel-de-limpeza-facial/', '0260', 315653, 6, NULL),
        ('Termaskin Tonico Facial', 'Agua termal remineralizante 120ml', 43.99, 'https://patriciaelias.com.br/wp-content/uploads/2023/10/800x800-termaskin1.jpg', 'https://patriciaelias.com.br/produto/termaskin-tonico-facial-e-agua-termal-120ml/', '0258', 288498, 7, NULL),
        ('Modelat Mascara Lift', 'Efeito lift facial imediato (Oferta Especial)', 159.99, 'https://patriciaelias.com.br/wp-content/uploads/2025/10/800x800-mascara-lift-facial12.webp', 'https://patriciaelias.com.br/produto/modelat-mascara-lift-facial/', '0279', 385615, 8, 0.70)
      `);
      console.log('Seed de products inserido com sucesso.');
    }

    // =============================================
    // SEEDS - Kits
    // =============================================
    const kitsCount = await db.query('SELECT COUNT(*) as cnt FROM kits');
    if (parseInt(kitsCount.rows[0].cnt) === 0) {
      await db.query(`
        INSERT INTO kits (name, slug, price, description) VALUES
        ('Kit Skincare', 'skincare', 229.00, 'Kit ideal para quem trabalha com skincare. Inclui produtos essenciais para demonstracao e revenda.'),
        ('Kit Tratamento', 'tratamento', 277.00, 'Kit completo de tratamento capilar e facial. Perfeito para profissionais de estetica.'),
        ('Kit Completo', 'completo', 377.00, 'Kit completo com todos os produtos da linha. A melhor opcao para comecar com tudo.')
      `);
      console.log('Seed de kits inserido com sucesso.');
    }

    // =============================================
    // SEEDS - Achievements
    // =============================================
    const achievementsCount = await db.query('SELECT COUNT(*) as cnt FROM achievements');
    if (parseInt(achievementsCount.rows[0].cnt) === 0) {
      await db.query(`
        INSERT INTO achievements (slug, name, description, icon, category, threshold_value, points_reward) VALUES
        ('first_sale', 'Primeira Venda', 'Realizou seu primeiro pedido', 'shopping-bag', 'sales', 1, 50),
        ('sales_5', '5 Vendas', 'Realizou 5 pedidos', 'trending-up', 'sales', 5, 100),
        ('sales_10', '10 Vendas', 'Realizou 10 pedidos', 'award', 'sales', 10, 200),
        ('sales_25', '25 Vendas', 'Realizou 25 pedidos', 'star', 'sales', 25, 500),
        ('sales_50', '50 Vendas', 'Realizou 50 pedidos', 'crown', 'sales', 50, 1000),
        ('revenue_5k', 'R$5 mil em Vendas', 'Acumulou R$5.000 em compras', 'dollar-sign', 'revenue', 5000, 150),
        ('revenue_10k', 'R$10 mil em Vendas', 'Acumulou R$10.000 em compras', 'dollar-sign', 'revenue', 10000, 300),
        ('revenue_25k', 'R$25 mil em Vendas', 'Acumulou R$25.000 em compras', 'dollar-sign', 'revenue', 25000, 750),
        ('revenue_50k', 'R$50 mil em Vendas', 'Acumulou R$50.000 em compras', 'dollar-sign', 'revenue', 50000, 1500),
        ('referral_1', 'Primeira Indicacao', 'Indicou sua primeira revendedora', 'user-plus', 'referral', 1, 75),
        ('referral_3', '3 Indicacoes', 'Indicou 3 revendedoras', 'users', 'referral', 3, 150),
        ('referral_5', '5 Indicacoes', 'Indicou 5 revendedoras', 'users', 'referral', 5, 300),
        ('referral_10', '10 Indicacoes', 'Indicou 10 revendedoras', 'users', 'referral', 10, 600),
        ('level_prata', 'Nivel Prata', 'Alcancou o nivel Prata', 'shield', 'level', 0, 200),
        ('level_ouro', 'Nivel Ouro', 'Alcancou o nivel Ouro', 'shield', 'level', 0, 500),
        ('streak_3', '3 Meses Consecutivos', 'Comprou 3 meses seguidos', 'flame', 'engagement', 3, 100),
        ('streak_6', '6 Meses Consecutivos', 'Comprou 6 meses seguidos', 'flame', 'engagement', 6, 300),
        ('kit_completo', 'Kit Completo', 'Adquiriu o Kit Completo', 'package', 'kit', 0, 50)
      `);
      console.log('Seed de achievements inserido com sucesso.');
    }

    // =============================================
    // MIGRACAO - Usuarios existentes com pedidos
    // =============================================
    await db.query(`
      UPDATE users SET first_order_completed = true, has_purchased_kit = true
      WHERE first_order_completed = false
      AND id IN (SELECT DISTINCT user_id FROM orders WHERE status IN ('completed','processing','paid'))
    `);
    console.log('Migracao de usuarios existentes concluida.');

    // Marcar usuarios existentes como email verificado (nao bloquear quem ja esta cadastrado)
    await db.query(`UPDATE users SET email_verified = true WHERE email_verified = false OR email_verified IS NULL`);
    console.log('Migracao email_verified para usuarios existentes concluida.');

    // =============================================
    // TABELA - Integracoes (conexoes externas)
    // =============================================

    await db.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id SERIAL PRIMARY KEY,
        integration_type VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        credentials JSONB NOT NULL DEFAULT '{}',
        active BOOLEAN DEFAULT true,
        last_tested_at TIMESTAMP,
        last_test_result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "integrations" verificada/criada com sucesso.');

    // =============================================
    // NOVAS TABELAS - Sistema de Gateways Multi-CNPJ
    // =============================================

    // Empresas faturadoras
    await db.query(`
      CREATE TABLE IF NOT EXISTS billing_companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        cnpj VARCHAR(20) NOT NULL,
        razao_social VARCHAR(255),
        states TEXT[] NOT NULL,
        is_default BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabela "billing_companies" verificada/criada com sucesso.');

    // Gateways de pagamento por empresa
    await db.query(`
      CREATE TABLE IF NOT EXISTS payment_gateways (
        id SERIAL PRIMARY KEY,
        billing_company_id INTEGER NOT NULL REFERENCES billing_companies(id) ON DELETE CASCADE,
        gateway_type VARCHAR(50) NOT NULL,
        display_name VARCHAR(100),
        credentials JSONB NOT NULL DEFAULT '{}',
        supported_methods TEXT[] NOT NULL,
        priority INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT true,
        sandbox BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(billing_company_id, gateway_type)
      );
    `);
    console.log('Tabela "payment_gateways" verificada/criada com sucesso.');

    // Novas colunas em orders para gateway multi-CNPJ
    const gatewayOrderColumns = [
      { name: 'billing_company_id', sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_company_id INTEGER REFERENCES billing_companies(id)" },
      { name: 'payment_gateway_id', sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway_id INTEGER REFERENCES payment_gateways(id)" },
      { name: 'gateway_type', sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_type VARCHAR(50)" },
      { name: 'gateway_transaction_id', sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_transaction_id VARCHAR(255)" },
      { name: 'gateway_status', sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_status VARCHAR(50)" },
    ];
    for (const col of gatewayOrderColumns) {
      try { await db.query(col.sql); } catch (e) { /* already exists */ }
    }
    console.log('Colunas de gateway adicionadas em "orders".');

    console.log('Schema revenda_pelg atualizado com sucesso!');
  } catch (err) {
    console.error('Erro ao atualizar schema:', err);
    throw err;
  }
};

// Se executado diretamente (node setup_db.js), roda e sai
if (require.main === module) {
  updateSchema().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { updateSchema };
