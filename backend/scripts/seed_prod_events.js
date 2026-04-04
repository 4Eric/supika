/**
 * Production Seed Script — Fresh Events
 * 
 * Clears ALL events (and their related data) from production and seeds
 * fresh, realistic sample events hosted under admin user.
 * 
 * Usage:
 *   node scripts/seed_prod_events.js <PROD_DATABASE_URL>
 */

const { Pool } = require('pg');

const connectionString = process.argv[2];
if (!connectionString) {
    console.error('❌  Pass the production DATABASE_URL as argument');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

// Upcoming dates (relative to ~April 2026)
const soon = (daysFromNow, hour = 18) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
};

const events = [
    {
        title: 'Asian Night Market 🏮',
        description: 'Street food, bubble tea, live music and cultural performances. A vibrant celebration of Asian culture right in the heart of the city. Come hungry!',
        location_name: 'Chinatown Night Market, Downtown',
        latitude: 43.6529, longitude: -79.3973,
        image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
        requires_approval: false, ticket_price: 0,
        slots: [{ daysFromNow: 5, hour: 17, duration: 240, max: 200 }, { daysFromNow: 6, hour: 17, duration: 240, max: 200 }]
    },
    {
        title: 'K-Pop Dance Workshop 💃',
        description: 'Learn trending K-Pop choreography from certified instructors. No experience needed — just good vibes and energy. Wear comfortable clothes!',
        location_name: 'Studio 88, Midtown',
        latitude: 43.6698, longitude: -79.3887,
        image_url: 'https://images.unsplash.com/photo-1545959570-a94084071b5d?w=800',
        requires_approval: true, ticket_price: 20,
        slots: [{ daysFromNow: 7, hour: 14, duration: 90, max: 30 }, { daysFromNow: 14, hour: 14, duration: 90, max: 30 }]
    },
    {
        title: 'Bubble Tea Social ☕',
        description: 'Chilll event for people who love boba and good company. Try 10+ flavors, play board games, and meet new friends in a cozy cafe setting.',
        location_name: 'Presotea Lounge, Scarborough',
        latitude: 43.7731, longitude: -79.2569,
        image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
        requires_approval: false, ticket_price: 0,
        slots: [{ daysFromNow: 3, hour: 15, duration: 120, max: 40 }]
    },
    {
        title: 'Tech & Dim Sum Networking 🥟',
        description: 'Where tech people and dim sum lovers collide. Pitch ideas, swap cards, and eat way too much siu mai. Coffee and tea included.',
        location_name: 'Dragon Palace Restaurant, Markham',
        latitude: 43.8568, longitude: -79.3370,
        image_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800',
        requires_approval: true, ticket_price: 15,
        slots: [{ daysFromNow: 10, hour: 11, duration: 150, max: 50 }]
    },
    {
        title: 'Sunset Picnic & Vibe 🌅',
        description: 'Bring a blanket, bring snacks, bring good energy. We\'ll have music, lawn games and a great sunset view at Harbourfront. Free and open to all.',
        location_name: 'Harbourfront Centre, Toronto',
        latitude: 43.6389, longitude: -79.3814,
        image_url: 'https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=800',
        requires_approval: false, ticket_price: 0,
        slots: [{ daysFromNow: 4, hour: 17, duration: 180, max: 100 }]
    },
    {
        title: 'Photography Walk 📸',
        description: 'Explore the city through a lens. We\'ll walk through hidden alleys, murals and urban gems. All camera types welcome — phone cameras too!',
        location_name: 'Kensington Market, Toronto',
        latitude: 43.6547, longitude: -79.4009,
        image_url: 'https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=800',
        requires_approval: false, ticket_price: 0,
        slots: [{ daysFromNow: 8, hour: 10, duration: 120, max: 25 }]
    },
    {
        title: 'Mahjong Night 🀄',
        description: 'Classic Hong Kong style mahjong — beginners welcome! Tables set up from 7PM. Snacks and drinks provided. Come solo or bring a crew.',
        location_name: 'Community Hall, North York',
        latitude: 43.7615, longitude: -79.4111,
        image_url: 'https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=800',
        requires_approval: false, ticket_price: 10,
        slots: [{ daysFromNow: 2, hour: 19, duration: 180, max: 32 }, { daysFromNow: 9, hour: 19, duration: 180, max: 32 }]
    },
    {
        title: 'Anime Movie Night 🎌',
        description: 'Outdoor screening of a Studio Ghibli classic. Bring a chair or blanket. Popcorn and ramen snacks available on-site. Free entry!',
        location_name: 'Christie Pits Park, Toronto',
        latitude: 43.6663, longitude: -79.4195,
        image_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
        requires_approval: false, ticket_price: 0,
        slots: [{ daysFromNow: 12, hour: 20, duration: 150, max: 150 }]
    }
];

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🔗 Connected to production DB\n');
        await client.query('BEGIN');

        // Find the admin user to host all events
        const adminRes = await client.query('SELECT id FROM "Users" WHERE role = $1 LIMIT 1', ['admin']);
        if (adminRes.rows.length === 0) throw new Error('No admin user found in production!');
        const adminId = adminRes.rows[0].id;
        console.log(`👤 Using admin user id=${adminId} as host\n`);

        // Wipe events and all related data
        console.log('🧹 Clearing existing events...');
        await client.query('DELETE FROM "EventMemories"');
        await client.query('DELETE FROM "GroupMessages"');
        await client.query('DELETE FROM "Messages"');
        await client.query('DELETE FROM "Registrations"');
        await client.query('DELETE FROM "EventHosts"');
        await client.query('DELETE FROM "EventMedia"');
        await client.query('DELETE FROM "EventTimeSlots"');
        await client.query('DELETE FROM "Events"');
        console.log('✅ Cleared\n');

        // Seed new events
        for (const ev of events) {
            const evRes = await client.query(`
                INSERT INTO "Events" (title, description, location_name, latitude, longitude, created_by, image_url, requires_approval, ticket_price)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
            `, [ev.title, ev.description, ev.location_name, ev.latitude, ev.longitude, adminId, ev.image_url, ev.requires_approval, ev.ticket_price]);
            const eventId = evRes.rows[0].id;

            // Register host in EventHosts
            await client.query('INSERT INTO "EventHosts" (event_id, user_id) VALUES ($1,$2)', [eventId, adminId]);

            // Create time slots
            for (const slot of ev.slots) {
                await client.query(`
                    INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees)
                    VALUES ($1,$2,$3,$4)
                `, [eventId, soon(slot.daysFromNow, slot.hour), slot.duration, slot.max]);
            }
            console.log(`✅ Created: ${ev.title} (id=${eventId})`);
        }

        await client.query('COMMIT');
        console.log(`\n🎉 Seeded ${events.length} events successfully!`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
