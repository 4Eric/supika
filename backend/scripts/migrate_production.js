/**
 * Complete Production Migration Script
 * 
 * This is a SAFE, idempotent migration script.
 * It uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so it can be run
 * against ANY database (fresh or existing) without data loss.
 * 
 * Usage:
 *   node scripts/migrate_production.js <PRODUCTION_DATABASE_URL>
 * 
 * Example:
 *   node scripts/migrate_production.js "postgresql://user:pass@host:5432/db?sslmode=require"
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const connectionString = process.argv[2] || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ No DATABASE_URL found. Pass it as an argument or set it in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: connectionString.match(/localhost|127\.0\.0\.1/) ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();
    console.log(`\n🔗 Connected to: ${connectionString.replace(/:[^:@]*@/, ':***@')}\n`);

    try {
        await client.query('BEGIN');

        // ─── 1. CORE TABLES ────────────────────────────────────────────────────

        console.log('▶ Creating Users table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "Users" (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                reset_password_token VARCHAR(255),
                reset_password_expires TIMESTAMP,
                avatar_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('▶ Creating Events table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "Events" (
                id SERIAL PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                description TEXT,
                location_name VARCHAR(255),
                latitude DECIMAL(10, 6),
                longitude DECIMAL(10, 6),
                created_by INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                image_url VARCHAR(255),
                requires_approval BOOLEAN DEFAULT FALSE,
                ticket_price DECIMAL(10,2) DEFAULT 0.00,
                stripe_account_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('▶ Creating EventTimeSlots table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "EventTimeSlots" (
                id SERIAL PRIMARY KEY,
                event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                start_time TIMESTAMP NOT NULL,
                duration_minutes INT NOT NULL DEFAULT 60,
                max_attendees INT NOT NULL DEFAULT 5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('▶ Creating EventMedia table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "EventMedia" (
                id SERIAL PRIMARY KEY,
                event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                media_url VARCHAR(255) NOT NULL,
                media_type VARCHAR(50) DEFAULT 'image',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('▶ Creating Registrations table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "Registrations" (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'approved',
                time_slot_id INT NOT NULL REFERENCES "EventTimeSlots"(id) ON DELETE CASCADE,
                check_in_time TIMESTAMP DEFAULT NULL,
                ticket_token UUID DEFAULT gen_random_uuid(),
                rsvp_status VARCHAR(20) DEFAULT 'going'
            );
        `);

        // Unique index — safe to create if not exists
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_user_timeslot 
            ON "Registrations" (user_id, time_slot_id);
        `);

        console.log('▶ Creating Messages table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "Messages" (
                id SERIAL PRIMARY KEY,
                event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                receiver_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('▶ Creating GroupMessages table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "GroupMessages" (
                id SERIAL PRIMARY KEY,
                event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                time_slot_id INT NOT NULL REFERENCES "EventTimeSlots"(id) ON DELETE CASCADE,
                sender_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('▶ Creating RefreshTokens table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "RefreshTokens" (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                token VARCHAR(500) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ─── 2. MIGRATION: Organizations & EventHosts ────────────────────────

        console.log('▶ Creating Organizations table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "Organizations" (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                owner_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                logo_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('▶ Creating EventHosts table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "EventHosts" (
                event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                PRIMARY KEY (event_id, user_id)
            );
        `);

        console.log('▶ Creating EventMemories table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "EventMemories" (
                id SERIAL PRIMARY KEY,
                event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                image_url VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ─── 3. ADDITIVE COLUMN MIGRATIONS ──────────────────────────────────

        console.log('▶ Applying column addons (safe, IF NOT EXISTS)...');

        await client.query(`ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);`);

        await client.query(`ALTER TABLE "Events" ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES "Organizations"(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE "Events" ADD COLUMN IF NOT EXISTS ticket_price DECIMAL(10,2) DEFAULT 0.00;`);
        await client.query(`ALTER TABLE "Events" ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'CAD';`);
        await client.query(`ALTER TABLE "Events" ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);`);
        await client.query(`ALTER TABLE "Events" ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other';`);
        await client.query(`ALTER TABLE "Events" ADD COLUMN IF NOT EXISTS source_url VARCHAR(500);`);

        await client.query(`ALTER TABLE "Registrations" ADD COLUMN IF NOT EXISTS rsvp_status VARCHAR(20) DEFAULT 'going';`);
        await client.query(`ALTER TABLE "Registrations" ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP DEFAULT NULL;`);
        await client.query(`ALTER TABLE "Registrations" ADD COLUMN IF NOT EXISTS ticket_token UUID DEFAULT gen_random_uuid();`);

        // ─── EventComments table ─────────────────────────────────────────────
        console.log('▶ Creating EventComments table (if not exists)...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "EventComments" (
                id SERIAL PRIMARY KEY,
                event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                user_id INT REFERENCES "Users"(id) ON DELETE SET NULL,
                guest_name VARCHAR(100),
                content TEXT NOT NULL,
                parent_id INT REFERENCES "EventComments"(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS "EventCommentLikes" (
                id SERIAL PRIMARY KEY,
                comment_id INT NOT NULL REFERENCES "EventComments"(id) ON DELETE CASCADE,
                user_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                UNIQUE(comment_id, user_id)
            );
        `);

        // ─── 4. SEED EventHosts from existing Events (idempotent) ───────────
        console.log('▶ Seeding EventHosts from existing Events.created_by...');
        await client.query(`
            INSERT INTO "EventHosts" (event_id, user_id)
            SELECT id, created_by FROM "Events"
            ON CONFLICT DO NOTHING;
        `);

        await client.query('COMMIT');
        console.log('\n✅ All migrations completed successfully!\n');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Migration failed, rolled back:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
