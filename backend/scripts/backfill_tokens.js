/**
 * Backfill NULL ticket_tokens in Registrations
 * Usage: node scripts/backfill_tokens.js <PROD_DATABASE_URL>
 */
const { Pool } = require('pg');

const connectionString = process.argv[2];
if (!connectionString) { console.error('Pass DATABASE_URL as argument'); process.exit(1); }

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        // Check how many are null
        const checkRes = await client.query('SELECT COUNT(*) FROM "Registrations" WHERE ticket_token IS NULL');
        console.log('NULLs before:', checkRes.rows[0].count);

        // Backfill
        const fixRes = await client.query(
            'UPDATE "Registrations" SET ticket_token = gen_random_uuid() WHERE ticket_token IS NULL RETURNING id'
        );
        console.log('Rows fixed:', fixRes.rowCount);

        // Confirm
        const afterRes = await client.query('SELECT COUNT(*) FROM "Registrations" WHERE ticket_token IS NULL');
        console.log('NULLs after:', afterRes.rows[0].count);
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(e => { console.error(e.message); pool.end(); });
