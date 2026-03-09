require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const targetUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe';
const pool = new Pool({
    connectionString: targetUrl,
    ssl: (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) ? false : { rejectUnauthorized: false }
});

async function seed() {
    const client = await pool.connect();
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(require('crypto').randomBytes(32).toString('hex'), salt);

        const res = await client.query(`
            INSERT INTO "Users" (username, email, password_hash, role)
            VALUES ('eFinder.ai', 'efinder@supika.app', $1, 'system')
            ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
            RETURNING id
        `, [hash]);

        console.log(`✅ eFinder.ai user created/found with ID: ${res.rows[0].id}`);
        console.log(`   Add this to your .env: EFINDER_USER_ID=${res.rows[0].id}`);
    } catch (e) {
        console.error('❌ Failed:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
