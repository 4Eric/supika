require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Accept production URL as 1st argument, or fallback to environment variable
const targetUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe';

const pool = new Pool({
    connectionString: targetUrl,
    ssl: (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) ? false : { rejectUnauthorized: false }
});

const sampleImages = [
    'https://res.cloudinary.com/dhxrqirux/image/upload/v1771911312/supika-samples/rj6rp8aqayapnjbbvh2z.jpg',
    'https://res.cloudinary.com/dhxrqirux/image/upload/v1771911313/supika-samples/g3jy3wqjdykpopg5h2id.jpg',
    'https://res.cloudinary.com/dhxrqirux/image/upload/v1771911313/supika-samples/uialj06e33u2imgpphkh.jpg',
    'https://res.cloudinary.com/dhxrqirux/image/upload/v1771911314/supika-samples/ffamk2eqsx2pnetfd07j.jpg',
    'https://res.cloudinary.com/dhxrqirux/image/upload/v1771911315/supika-samples/rr5i1vnfikxws2pmfatf.jpg'
];

const locations = [
    { name: 'Central Park, New York, NY', lat: 40.7829, lng: -73.9654 },
    { name: 'Times Square, New York, NY', lat: 40.7580, lng: -73.9855 },
    { name: 'Brooklyn Bridge Park, Brooklyn, NY', lat: 40.7023, lng: -73.9965 },
    { name: 'DUMBO, Brooklyn, NY', lat: 40.7033, lng: -73.9897 },
    { name: 'Williamsburg, Brooklyn, NY', lat: 40.7081, lng: -73.9571 },
    { name: 'Astoria Park, Queens, NY', lat: 40.7762, lng: -73.9242 },
    { name: 'Flushing Meadows, Queens, NY', lat: 40.7397, lng: -73.8408 },
    { name: 'Prospect Park, Brooklyn, NY', lat: 40.6602, lng: -73.9690 },
    { name: 'The High Line, New York, NY', lat: 40.7480, lng: -74.0048 },
    { name: 'Washington Square Park, New York, NY', lat: 40.7308, lng: -73.9973 }
];

const titles = [
    'Coffee & Code', 'Sunset Yoga', 'Photography Walk', 'Board Game Night',
    'Picnic in the Park', 'Tech Talk: Vue 3', 'Running Club', 'Art Class',
    'Book Club Meetup', 'Language Exchange', 'Networking Mixer', 'Live Music Jam',
    'Outdoor Movie Night', 'Meditation Session', 'Hiking Adventure'
];

const descriptions = [
    'Looking forward to meeting new people and sharing experiences!',
    'A casual gathering for like-minded individuals. Everyone is welcome!',
    'Bring some snacks and your positive energy! Let’s have a great time.',
    'Sharing skills, making friends, and building a community together.',
    'Explore the city together in this interactive guided tour and meetup.'
];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randomFutureDate() {
    const d = new Date();
    d.setDate(d.getDate() + Math.floor(Math.random() * 60) + 1);
    d.setHours(9 + Math.floor(Math.random() * 10), 0, 0, 0);
    return d;
}

// Jitter coordinates to avoid overlapping markers
function jitter(val) { return val + (Math.random() - 0.5) * 0.005; }

async function seed() {
    const client = await pool.connect();
    try {
        console.log('--- 🚀 Seeding 15 Users and 50 Events ---');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('manage', salt);

        await client.query('BEGIN');

        const userIds = [];
        for (let i = 1; i <= 15; i++) {
            const email = `vibe_user${i}@example.com`;
            const username = `VibeUser${i}`;
            const res = await client.query(`
                INSERT INTO "Users" (username, email, password_hash, role)
                VALUES ($1, $2, $3, 'user')
                ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
                RETURNING id
            `, [username, email, hash]);
            userIds.push(res.rows[0].id);
        }
        console.log(`✅ Created ${userIds.length} users.`);

        for (let i = 1; i <= 50; i++) {
            const creatorId = randomItem(userIds);
            const loc = randomItem(locations);
            const img = randomItem(sampleImages);
            const title = `${randomItem(titles)} #${i}`;
            const desc = randomItem(descriptions);
            const approval = Math.random() > 0.6;

            const res = await client.query(`
                INSERT INTO "Events" (title, description, location_name, latitude, longitude, created_by, image_url, requires_approval)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            `, [title, desc, loc.name, jitter(loc.lat), jitter(loc.lng), creatorId, img, approval]);

            const eventId = res.rows[0].id;
            const start = randomFutureDate();
            await client.query(`
                INSERT INTO "EventTimeSlots" (event_id, start_time, duration_minutes, max_attendees)
                VALUES ($1, $2, $3, $4)
            `, [eventId, start.toISOString(), 60 + Math.floor(Math.random() * 120), 5 + Math.floor(Math.random() * 25)]);
        }

        await client.query('COMMIT');
        console.log('✅ Created 50 events with randomized creators and locations.');
        console.log('--- 🎉 Seeding Complete ---');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding failed:', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
