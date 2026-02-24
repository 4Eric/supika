require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
});

async function setupPostgres() {
    try {
        console.log('Connecting to PostgreSQL to run setup...');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            console.log('Dropping existing tables if they exist...');
            await client.query(`
                DROP TABLE IF EXISTS "GroupMessages" CASCADE;
                DROP TABLE IF EXISTS "Messages" CASCADE;
                DROP TABLE IF EXISTS "Registrations" CASCADE;
                DROP TABLE IF EXISTS "EventMedia" CASCADE;
                DROP TABLE IF EXISTS "EventTimeSlots" CASCADE;
                DROP TABLE IF EXISTS "Events" CASCADE;
                DROP TABLE IF EXISTS "Users" CASCADE;
            `);

            console.log('Creating Users table...');
            await client.query(`
                CREATE TABLE "Users" (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    role VARCHAR(20) DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            console.log('Creating Events table...');
            await client.query(`
                CREATE TABLE "Events" (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(100) NOT NULL,
                    description TEXT,
                    location_name VARCHAR(255),
                    latitude DECIMAL(10, 6),
                    longitude DECIMAL(10, 6),
                    created_by INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                    image_url VARCHAR(255),
                    requires_approval BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            console.log('Creating EventTimeSlots table...');
            await client.query(`
                CREATE TABLE "EventTimeSlots" (
                    id SERIAL PRIMARY KEY,
                    event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                    start_time TIMESTAMP NOT NULL,
                    duration_minutes INT NOT NULL DEFAULT 60,
                    max_attendees INT NOT NULL DEFAULT 5,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            console.log('Creating EventMedia table...');
            await client.query(`
                CREATE TABLE "EventMedia" (
                    id SERIAL PRIMARY KEY,
                    event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                    media_url VARCHAR(255) NOT NULL,
                    media_type VARCHAR(50) DEFAULT 'image',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            console.log('Creating Registrations table...');
            await client.query(`
                CREATE TABLE "Registrations" (
                    user_id INT NOT NULL REFERENCES "Users"(id) ON DELETE NO ACTION,
                    event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE NO ACTION,
                    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'approved',
                    time_slot_id INT NOT NULL REFERENCES "EventTimeSlots"(id) ON DELETE CASCADE,
                    PRIMARY KEY (user_id, time_slot_id)
                );
            `);

            console.log('Creating Messages table...');
            await client.query(`
                CREATE TABLE "Messages" (
                    id SERIAL PRIMARY KEY,
                    event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                    sender_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                    receiver_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            console.log('Creating GroupMessages table...');
            await client.query(`
                CREATE TABLE "GroupMessages" (
                    id SERIAL PRIMARY KEY,
                    event_id INT NOT NULL REFERENCES "Events"(id) ON DELETE CASCADE,
                    sender_id INT NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await client.query('COMMIT');
            console.log('PostgreSQL Database setup completed successfully!');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error executing schema tables:', error);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Failed to connect to the database:', err);
    } finally {
        pool.end();
    }
}

setupPostgres();
