/**
 * Verify production events are in the DB
 * Usage: node scripts/check_events.js <PROD_DATABASE_URL>
 */
const { Pool } = require('pg');

const connectionString = process.argv[2];
if (!connectionString) { console.error('Pass DATABASE_URL as argument'); process.exit(1); }

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
    const r = await pool.query(`
        SELECT e.id, e.title, e.created_by, u.username, 
               (SELECT COUNT(*) FROM "EventTimeSlots" ts WHERE ts.event_id = e.id) AS slots
        FROM "Events" e
        JOIN "Users" u ON u.id = e.created_by
        ORDER BY e.id DESC
        LIMIT 20
    `);
    console.table(r.rows);
    pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
