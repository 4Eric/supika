require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DB = process.argv[2] || process.env.DATABASE_URL;

if (!DB) {
    console.error('❌ No DATABASE_URL found. Pass it as an argument or set it in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DB,
    ssl: DB.match(/localhost|127\.0\.0\.1/) ? false : { rejectUnauthorized: false }
});

async function run() {
    // First show all admin users
    const admins = await pool.query('SELECT id, username, email, role FROM "Users" WHERE role = $1 OR id = 1', ['admin']);
    console.log('Admin users found:');
    console.table(admins.rows);

    if (admins.rows.length === 0) {
        console.error('No admin user found');
        return;
    }

    // Update by email
    const newHash = await bcrypt.hash('password123', 10);
    const updateRes = await pool.query(
        'UPDATE "Users" SET password_hash = $1 WHERE email = $2 RETURNING id, username, email',
        [newHash, 'admin@ybyvibe.com']
    );
    console.log('\n✅ Password updated for:');
    console.table(updateRes.rows);
}

run().catch(e => console.error(e.message)).finally(() => pool.end());
