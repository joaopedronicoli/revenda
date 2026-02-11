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

    console.log('Schema revenda_pelg atualizado com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao atualizar schema:', err);
    process.exit(1);
  }
};

updateSchema();
