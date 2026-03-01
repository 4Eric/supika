require('dotenv').config();
const { poolPromise } = require('./config/db');

async function debugData() {
    const pool = await poolPromise;
    try {
        const eventId = 94; // Using the event ID the user is on

        const regs = await pool.query('SELECT user_id, time_slot_id, status FROM "Registrations" WHERE event_id = $1', [eventId]);
        console.log('Registrations for Event 94:', regs.rows);

        const slots = await pool.query('SELECT id, start_time FROM "EventTimeSlots" WHERE event_id = $1', [eventId]);
        console.log('Time Slots for Event 94:', slots.rows);

    } catch (e) {
        console.log('DEBUG FAILED:', e.message);
    } finally {
        process.exit(0);
    }
}

debugData();
