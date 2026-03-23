const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
});

async function check() {
    try {
        console.log('--- Schema Check: Registrations ---');
        const cols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Registrations'
        `);
        console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));

        console.log('\n--- Data Check: Latest Registrations ---');
        const data = await pool.query(`
            SELECT id, user_id, event_id, status, ticket_token, check_in_time 
            FROM "Registrations" 
            ORDER BY id DESC LIMIT 5
        `);
        console.table(data.rows);

        // Check if any check_in_time exists
        const checkedIn = data.rows.filter(r => r.check_in_time).length;
        console.log(`\nFound ${data.rows.length} registrations, ${checkedIn} checked in.`);

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        await pool.end();
    }
}
check();
