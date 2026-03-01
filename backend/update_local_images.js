const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const localImages = [
    'local_event_1.png',
    'local_event_2.png',
    'local_event_3.png',
    'local_event_4.png'
];

async function updateImages() {
    try {
        console.log('Fetching events with local or broken image URLs...');
        const res = await pool.query(`
            SELECT id, title, image_url 
            FROM "Events" 
            WHERE image_url NOT LIKE 'http%'
        `);

        console.log(`Found ${res.rows.length} events to update.`);

        for (let i = 0; i < res.rows.length; i++) {
            const event = res.rows[i];
            const newImage = localImages[i % localImages.length];
            console.log(`Updating event "${event.title}" to use image "${newImage}"`);
            await pool.query('UPDATE "Events" SET image_url = $1 WHERE id = $2', [newImage, event.id]);
        }

        console.log('Fetching media records with local or broken URLs...');
        const mediaRes = await pool.query(`
            SELECT id, media_url 
            FROM "EventMedia" 
            WHERE media_url NOT LIKE 'http%'
        `);

        console.log(`Found ${mediaRes.rows.length} media records to update.`);

        for (let i = 0; i < mediaRes.rows.length; i++) {
            const media = mediaRes.rows[i];
            const newImage = localImages[i % localImages.length];
            await pool.query('UPDATE "EventMedia" SET media_url = $1 WHERE id = $2', [newImage, media.id]);
        }

        console.log('Update complete!');
    } catch (err) {
        console.error('Error updating images:', err);
    } finally {
        await pool.end();
    }
}

updateImages();
