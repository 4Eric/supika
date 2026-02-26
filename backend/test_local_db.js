const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
});

async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('Successfully connected to local database!');

        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        console.log('Tables found:');
        res.rows.forEach(row => console.log(' - ' + row.table_name));

        client.release();
        process.exit(0);
    } catch (err) {
        console.error('Connection error:', err.message);
        process.exit(1);
    }
}

testConnection();
