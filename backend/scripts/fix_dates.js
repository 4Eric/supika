const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://yby_admin:manage@localhost:5433/yby_vibe',
});

async function fixDates() {
    try {
        console.log('Updating event dates to the future...');
        // Set all event start times to start from tomorrow
        const result = await pool.query('UPDATE "EventTimeSlots" SET start_time = NOW() + interval \'1 day\'');
        console.log(`Successfully updated ${result.rowCount} time slots to tomorrow.`);
        
        // Also clear any caches so the frontend sees the new data
        // (Note: In a real app we'd use the cacheService, but here we just want the DB update)
    } catch (err) {
        console.error('Failed to update dates:', err);
    } finally {
        await pool.end();
    }
}

fixDates();
