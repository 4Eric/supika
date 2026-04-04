/**
 * Seed additional events hosted by non-admin users
 * Usage: node scripts/seed_user_events.js <PROD_DATABASE_URL>
 */
const { Pool } = require('pg');

const connectionString = process.argv[2];
if (!connectionString) { console.error('Pass DATABASE_URL as argument'); process.exit(1); }

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const soon = (daysFromNow, hour = 18) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
};

// Events by non-admin users: [userId, eventData]
const userEvents = [
    {
        hostId: 102, // Su
        title: 'Language Exchange Café ☕🌐',
        description: 'Practice Mandarin, Cantonese, Korean or Japanese in a relaxed café setting. Native speakers and learners welcome. All levels!',
        location_name: 'Café Luna, Spadina Ave, Toronto',
        latitude: 43.6563, longitude: -79.4022,
        image_url: 'https://images.unsplash.com/photo-1543007631-283050bb3e8c?w=800',
        requires_approval: false, ticket_price: 0,
        slots: [{ daysFromNow: 6, hour: 14, duration: 120, max: 30 }]
    },
    {
        hostId: 106, // VibeUser1
        title: 'Badminton Casual Round Robin 🏸',
        description: 'Casual doubles round robin open to all levels. Courts booked from 7–10PM. $5 covers court fee. Rackets available to borrow!',
        location_name: 'Toronto Badminton Club, Don Mills',
        latitude: 43.7353, longitude: -79.3374,
        image_url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800',
        requires_approval: false, ticket_price: 5,
        slots: [{ daysFromNow: 3, hour: 19, duration: 180, max: 24 }, { daysFromNow: 10, hour: 19, duration: 180, max: 24 }]
    },
    {
        hostId: 110, // VibeUser5
        title: 'DIY Dumpling Party 🥟',
        description: 'Come fold dumplings and make friends! We\'ll provide the dough and fillings. Bring your family recipes or try ours. Chef guidance provided!',
        location_name: 'Community Kitchen, Agincourt',
        latitude: 43.7890, longitude: -79.2776,
        image_url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800',
        requires_approval: true, ticket_price: 12,
        slots: [{ daysFromNow: 8, hour: 13, duration: 150, max: 20 }]
    },
    {
        hostId: 115, // VibeUser10
        title: 'Hiking + Picnic at Rouge Park 🥾🌿',
        description: 'Easy 5km hike through Rouge National Urban Park followed by a group picnic. Great for all fitness levels. Bring snacks to share!',
        location_name: 'Rouge National Urban Park, Scarborough',
        latitude: 43.8102, longitude: -79.1657,
        image_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
        requires_approval: false, ticket_price: 0,
        slots: [{ daysFromNow: 11, hour: 9, duration: 240, max: 40 }]
    },
    {
        hostId: 119, // eFinder.ai (system user — fun for AI-hosted event)
        title: 'AI Tools Workshop 🤖',
        description: 'Learn how to use ChatGPT, Midjourney, and other AI tools to boost your daily productivity. Q&A session included.',
        location_name: 'MaRS Discovery District, College St',
        latitude: 43.6596, longitude: -79.3909,
        image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
        requires_approval: true, ticket_price: 0,
        slots: [{ daysFromNow: 15, hour: 18, duration: 120, max: 60 }]
    }
];

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🔗 Connected\n');
        await client.query('BEGIN');

        for (const ev of userEvents) {
            const evRes = await client.query(`
                INSERT INTO "Events" (title, description, location_name, latitude, longitude, created_by, image_url, requires_approval, ticket_price)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
            `, [ev.title, ev.description, ev.location_name, ev.latitude, ev.longitude, ev.hostId, ev.image_url, ev.requires_approval, ev.ticket_price]);
            const eventId = evRes.rows[0].id;

            await client.query('INSERT INTO "EventHosts" (event_id, user_id) VALUES ($1,$2)', [eventId, ev.hostId]);

            for (const slot of ev.slots) {
                await client.query(`
                    INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees)
                    VALUES ($1,$2,$3,$4)
                `, [eventId, soon(slot.daysFromNow, slot.hour), slot.duration, slot.max]);
            }
            console.log(`✅ Created: ${ev.title} → host id=${ev.hostId} (event id=${eventId})`);
        }

        await client.query('COMMIT');
        console.log(`\n🎉 Seeded ${userEvents.length} user-hosted events!`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
