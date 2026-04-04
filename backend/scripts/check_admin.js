const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.qraknbnxcomqetpsoali:NhOv2gOYYhVSamjV@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});
pool.query('SELECT id, username, email, role FROM "Users" WHERE role = \'admin\' OR id = 1')
    .then(r => { console.table(r.rows); pool.end(); })
    .catch(e => { console.error(e.message); pool.end(); });
