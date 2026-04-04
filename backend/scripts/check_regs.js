/**
 * Check Registrations in Production
 * Usage: node scripts/check_regs.js <PROD_DATABASE_URL>
 */
const { Pool } = require('pg');

const connectionString = process.argv[2];
if (!connectionString) { console.error('Pass DATABASE_URL as argument'); process.exit(1); }

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
    const r = await pool.query(`
        SELECT r.user_id, u.username, r.event_id, e.title, r.time_slot_id, r.status, r.ticket_token
        FROM "Registrations" r
        JOIN "Users" u ON u.id = r.user_id
        JOIN "Events" e ON e.id = r.event_id
        ORDER BY r.registration_date DESC
        LIMIT 20
    `);
    console.table(r.rows);
    pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
