const { poolPromise } = require('./config/db');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Cloudinary config will be automatically picked up from CLOUDINARY_URL env var


const imagePaths = [
    'C:/Users/Think/.gemini/antigravity/brain/547269ee-8de3-4a53-bdc5-7392798d7a97/tech_event_1_1771911124866.png',
    'C:/Users/Think/.gemini/antigravity/brain/547269ee-8de3-4a53-bdc5-7392798d7a97/tech_event_2_1771911142090.png',
    'C:/Users/Think/.gemini/antigravity/brain/547269ee-8de3-4a53-bdc5-7392798d7a97/tech_event_3_1771911168384.png',
    'C:/Users/Think/.gemini/antigravity/brain/547269ee-8de3-4a53-bdc5-7392798d7a97/tech_event_4_1771911225058.png',
    'C:/Users/Think/.gemini/antigravity/brain/547269ee-8de3-4a53-bdc5-7392798d7a97/tech_event_5_1771911184592.png',
    'C:/Users/Think/.gemini/antigravity/brain/547269ee-8de3-4a53-bdc5-7392798d7a97/tech_event_6_1771911201940.png',
    'C:/Users/Think/.gemini/antigravity/brain/547269ee-8de3-4a53-bdc5-7392798d7a97/tech_event_7_1771911242757.png',
    'C:/Users/Think/.gemini/antigravity/brain/547269ee-8de3-4a53-bdc5-7392798d7a97/tech_event_8_1771911260716.png'
];

async function migrate() {
    try {
        const pool = await poolPromise;
        console.log('Uploading images to Cloudinary...');

        const cloudinaryUrls = [];
        for (const path of imagePaths) {
            const result = await cloudinary.uploader.upload(path, {
                folder: 'supika-samples'
            });
            cloudinaryUrls.push(result.secure_url);
            console.log(`Uploaded: ${result.secure_url}`);
        }

        console.log('\nUpdating database records...');

        // Loop through 10 possible sample names and map them to our 8 uploaded images (round-robin)
        for (let i = 1; i <= 10; i++) {
            const localName = `sample_tech_${i}.png`;
            const cloudUrl = cloudinaryUrls[(i - 1) % cloudinaryUrls.length];

            const result = await pool.query(
                'UPDATE "Events" SET image_url = $1 WHERE image_url = $2',
                [cloudUrl, localName]
            );

            console.log(`Mapped ${localName} -> ${cloudUrl} (${result.rowCount} rows updated)`);
        }

        console.log('\nMigration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
