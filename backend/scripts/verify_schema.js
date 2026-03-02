const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Try to load dotenv from various backend/.env locations
const backendEnvPaths = [
    'e:/yby_vibe/backend/.env',
    './.env',
    '../.env'
];

let envPathFound = '';
for (const p of backendEnvPaths) {
    if (fs.existsSync(p)) {
        envPathFound = p;
        break;
    }
}

if (envPathFound) {
    require('dotenv').config({ path: envPathFound });
}

const expectedSchema = {
    "Users": ["id", "username", "password_hash", "email", "role", "reset_password_token", "reset_password_expires", "created_at"],
    "Events": ["id", "title", "description", "location_name", "latitude", "longitude", "created_by", "image_url", "requires_approval", "created_at"],
    "EventTimeSlots": ["id", "event_id", "start_time", "duration_minutes", "max_attendees", "created_at"],
    "EventMedia": ["id", "event_id", "media_url", "media_type", "created_at"],
    "Registrations": ["user_id", "event_id", "registration_date", "status", "time_slot_id"],
    "GroupMessages": ["id", "event_id", "time_slot_id", "sender_id", "content", "created_at"],
    "RefreshTokens": ["id", "user_id", "token", "expires_at", "created_at"]
};

async function verifyDb(name, url) {
    console.log(`\n--- Verification for ${name} ---`);
    if (!url) {
        console.warn(`No URL for ${name}`);
        return;
    }
    const pool = new Pool({ connectionString: url });
    let client;
    try {
        client = await pool.connect();
        for (const [table, columns] of Object.entries(expectedSchema)) {
            const res = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 AND table_schema = 'public'
            `, [table]);

            const actualColumns = res.rows.map(r => r.column_name);
            const missing = columns.filter(c => !actualColumns.includes(c));

            if (actualColumns.length === 0) {
                console.log(`❌ Table [${table}] is MISSING`);
            } else if (missing.length > 0) {
                console.log(`⚠️ Table [${table}] is missing columns: ${missing.join(', ')}`);
            } else {
                console.log(`✅ Table [${table}] is correct`);
            }
        }
    } catch (e) {
        console.error(`Failed to connect or query: ${e.message}`);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

async function run() {
    const localUrl = process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe';
    await verifyDb('LOCAL', localUrl);

    // If user provided a URL as argument, check it
    const prodUrl = process.argv[2];
    if (prodUrl) {
        await verifyDb('PRODUCTION', prodUrl);
    } else {
        console.log('\n(Pass a production DATABASE_URL as argument to verify prod)');
    }
}

run();
