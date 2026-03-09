const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
    // SSL is required on Render and most cloud providers — only disable for local
    ssl: (process.env.DATABASE_URL || '').match(/localhost|127\.0\.0\.1/) ? false : { rejectUnauthorized: false }
};

const isLocal = (process.env.DATABASE_URL || '').match(/localhost|127\.0\.0\.1/);
console.log(`📦 DB: ${isLocal ? 'LOCAL' : 'REMOTE'} | Storage: ${process.env.USE_LOCAL_STORAGE === 'true' ? 'LOCAL disk' : 'CLOUDINARY'}`);

const pgPool = new Pool(poolConfig);

pgPool.on('error', (err) => {
    console.error('⚠️ Database Pool Error:', err.message);
});

// Wrapping the pgPool in a promise to gracefully match existing await structures
const poolPromise = Promise.resolve(pgPool);

module.exports = {
    poolPromise, pgPool
};
