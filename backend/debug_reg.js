require('dotenv').config();
const { poolPromise } = require('./config/db');

async function debugRegister() {
    const pool = await poolPromise;
    try {
        const userId = 103; // Choosing user 103 from before
        const eventId = 184; // Choosing event 184 from before

        // Find slot ids for this event
        const slots = await pool.query('SELECT id FROM "EventTimeSlots" WHERE event_id = $1', [eventId]);
        if (slots.rows.length < 2) {
            console.log('Not enough slots to test.');
            process.exit(0);
        }

        const slot1 = slots.rows[0].id;
        const slot2 = slots.rows[1].id;

        console.log(`User ${userId}, Event ${eventId}, Slot1 ${slot1}, Slot2 ${slot2}`);

        // Clean up
        await pool.query('DELETE FROM "Registrations" WHERE user_id = $1 AND event_id = $2', [userId, eventId]);

        console.log('Registering for slot1...');
        await pool.query('INSERT INTO "Registrations" (user_id, event_id, time_slot_id, status) VALUES ($1, $2, $3, $4)', [userId, eventId, slot1, 'approved']);

        console.log('Registering for slot2...');
        await pool.query('INSERT INTO "Registrations" (user_id, event_id, time_slot_id, status) VALUES ($1, $2, $3, $4)', [userId, eventId, slot2, 'approved']);

        console.log('Success! Both slots registered.');
    } catch (e) {
        console.log('REGISTRATION FAILED:', e.message);
        console.log('Full error:', e);
    } finally {
        process.exit(0);
    }
}

debugRegister();
