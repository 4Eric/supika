const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
    // SSL is required on Render and most cloud providers
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
};

const pgPool = new Pool(poolConfig);

pgPool.on('error', (err) => {
    console.error('⚠️ Database Pool Error:', err.message);
});

// Wrapping the pgPool in a promise to gracefully match existing await structures
const poolPromise = Promise.resolve(pgPool);

module.exports = {
    poolPromise, pgPool
};
