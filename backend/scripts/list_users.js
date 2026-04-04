/**
 * List all users in production DB
 * Usage: node scripts/list_users.js <PROD_DATABASE_URL>
 */
const { Pool } = require('pg');

const connectionString = process.argv[2];
if (!connectionString) { console.error('Pass DATABASE_URL as argument'); process.exit(1); }

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

pool.query('SELECT id, username, email, role FROM "Users" ORDER BY id')
    .then(r => {
        console.table(r.rows);
        pool.end();
    })
    .catch(e => { console.error(e.message); pool.end(); });
