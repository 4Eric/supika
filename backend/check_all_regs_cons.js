require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
});

async function checkAllConstraints() {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT conname, contype, pg_get_constraintdef(oid) as def
            FROM pg_constraint
            WHERE conrelid = '"Registrations"'::regclass;
        `);
        console.log('All Registrations Constraints:', result.rows);
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

checkAllConstraints();
