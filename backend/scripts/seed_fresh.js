require('dotenv').config();
const { Pool } = require('pg');
const cacheService = require('../utils/cacheService');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
});

const sampleEvents = [
    {
        title: "Sunset Yoga in the Park",
        description: "Join us for a relaxing sunset yoga session. Suitable for all levels. Please bring your own mat!",
        location_name: "High Park, Toronto",
        latitude: 43.6465,
        longitude: -79.4637,
        image_url: "event-yoga.jpg",
        requires_approval: false,
        ticket_price: 0,
        currency: "CAD"
    },
    {
        title: "Tech Networking Mixer",
        description: "Connect with local developers, designers, and entrepreneurs. Drinks and snacks provided.",
        location_name: "The Commons, Downtown",
        latitude: 43.6426,
        longitude: -79.3871,
        image_url: "event-tech.jpg",
        requires_approval: true,
        ticket_price: 15.00,
        currency: "CAD"
    },
    {
        title: "Art Gallery Night",
        description: "Exhibition of local contemporary artists. Guided tour starts at 8 PM.",
        location_name: "Modern Art Space",
        latitude: 43.6535,
        longitude: -79.3840,
        image_url: "event-art.jpg",
        requires_approval: false,
        ticket_price: 25.00,
        currency: "CAD"
    },
    {
        title: "Cooking Class: Italian Pasta",
        description: "Learn how to make authentic fresh pasta from scratch with Chef Mario!",
        location_name: "Little Italy Community Kitchen",
        latitude: 43.6554,
        longitude: -79.4121,
        image_url: "event-cooking.jpg",
        requires_approval: true,
        ticket_price: 50.00,
        currency: "CAD"
    },
    {
        title: "Board Game Tournament",
        description: "Competitive Catan and casual games for everyone. Prizes for winners!",
        location_name: "Snakes & Lattes",
        latitude: 43.6652,
        longitude: -79.4102,
        image_url: "event-games.jpg",
        requires_approval: false,
        ticket_price: 5.00,
        currency: "CAD"
    }
];

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🧹 Clearing all existing data...');
        await client.query('BEGIN');
        
        // Order of deletion matters due to FKs
        await client.query('DELETE FROM "GroupMessages"');
        await client.query('DELETE FROM "Messages"');
        await client.query('DELETE FROM "Registrations"');
        await client.query('DELETE FROM "PaymentTransactions"');
        await client.query('DELETE FROM "EventMedia"');
        await client.query('DELETE FROM "EventTimeSlots"');
        await client.query('DELETE FROM "Events"');
        
        console.log('✅ All event-related tables cleared.');

        // Get users to assign as creators
        const userRes = await client.query('SELECT id FROM "Users" LIMIT 10');
        let userIds = userRes.rows.map(r => r.id);

        if (userIds.length === 0) {
            console.log('⌛ No users found, creating a test creator...');
            const newUser = await client.query(
                'INSERT INTO "Users" (username, password_hash, email, role) VALUES ($1, $2, $3, $4) RETURNING id',
                ['event_pro', '$2a$10$X8X3l/G/uT1BfI8zOnG6aeI9j8E1kE/5d8F6G7H8I9J0', 'pro@example.com', 'user']
            );
            userIds = [newUser.rows[0].id];
        }

        console.log(`🌱 Seeding ${sampleEvents.length} events...`);

        for (const data of sampleEvents) {
            const creatorId = userIds[Math.floor(Math.random() * userIds.length)];
            
            const eventRes = await client.query(
                `INSERT INTO "Events" (title, description, location_name, latitude, longitude, created_by, image_url, requires_approval, ticket_price, currency) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [data.title, data.description, data.location_name, data.latitude, data.longitude, creatorId, data.image_url, data.requires_approval, data.ticket_price, data.currency]
            );
            const eventId = eventRes.rows[0].id;

            // Add Time Slots
            const now = new Date();
            for (let i = 1; i <= 3; i++) {
                const startTime = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000)); // Future days
                startTime.setHours(18, 0, 0, 0);
                
                await client.query(
                    'INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees) VALUES ($1, $2, $3, $4)',
                    [eventId, startTime, 120, 10]
                );
            }

            // Add some media
            await client.query(
                'INSERT INTO "EventMedia" (event_id, media_url, media_type) VALUES ($1, $2, $3)',
                [eventId, data.image_url, 'image']
            );
        }

        await client.query('COMMIT');
        console.log('✨ Seed completed successfully!');
        
        // Flush cache (mocking the singleton)
        // Since we are running in a separate process, we don't have the same memory
        // But the main server will eventually expire or we can restart it.
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
