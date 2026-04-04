const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DB = 'postgresql://postgres.qraknbnxcomqetpsoali:NhOv2gOYYhVSamjV@aws-1-us-east-2.pooler.supabase.com:5432/postgres';

const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

async function run() {
    // First show all admin users
    const admins = await pool.query('SELECT id, username, email, role FROM "Users" WHERE role = $1 OR id = 1', ['admin']);
    console.log('Admin users found:');
    console.table(admins.rows);

    if (admins.rows.length === 0) {
        console.error('No admin user found');
        return;
    }

    // Update by role = admin (will catch the right user regardless of exact email)
    const newHash = await bcrypt.hash('manage', 10);
    const updateRes = await pool.query(
        'UPDATE "Users" SET password_hash = $1 WHERE role = $2 RETURNING id, username, email',
        [newHash, 'admin']
    );
    console.log('\n✅ Password updated for:');
    console.table(updateRes.rows);
}

run().catch(e => console.error(e.message)).finally(() => pool.end());
