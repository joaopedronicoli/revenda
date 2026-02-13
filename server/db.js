if (!process.env.DB_HOST) {
    require('dotenv').config();
}
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

// Garantir que cada conexao use timezone America/Sao_Paulo
pool.on('connect', (client) => {
    client.query("SET timezone = 'America/Sao_Paulo'");
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Erro ao conectar no banco de dados:', err);
    } else {
        console.log('Conectado ao PostgreSQL (revenda_pelg):', res.rows[0].now);
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
