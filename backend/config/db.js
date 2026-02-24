const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL Config
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
});

// Wrapping the pgPool in a promise to gracefully match existing await structures
const poolPromise = Promise.resolve(pgPool);

module.exports = {
    poolPromise, pgPool
};
